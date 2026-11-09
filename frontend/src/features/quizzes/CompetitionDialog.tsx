import { useState } from "react";
import {
  api,
  type ApiAdminQuiz,
  type ApiCompetition,
  type ApiCompetitionRank,
} from "../../api";
import { Modal } from "../../shared/components/ui";
import { CompetitionRound2 } from "./CompetitionRound2";
import { CompetitionRound3 } from "./CompetitionRound3";

type CompetitionDialogProps = {
  quiz: ApiAdminQuiz;
  initialCompetition: ApiCompetition;
  onClose: () => void;
  toast: (message: string) => void;
};

export function CompetitionDialog({
  quiz,
  initialCompetition,
  onClose,
  toast,
}: CompetitionDialogProps) {
  const [competition, setCompetition] = useState(initialCompetition);
  const [busyId, setBusyId] = useState("");
  const [qualifiedIds, setQualifiedIds] = useState<string[]>(
    initialCompetition.qualifiedParticipants.length
      ? initialCompetition.qualifiedParticipants.map((row) => row.userId)
      : [],
  );
  const [overrideReason, setOverrideReason] = useState("");
  const [round2Draft, setRound2Draft] = useState<ApiCompetitionRank[]>(
    initialCompetition.round2Rankings || [],
  );
  const [round3Draft, setRound3Draft] = useState<ApiCompetitionRank[]>(
    initialCompetition.round3Rankings || [],
  );
  const [advancementLimit, setAdvancementLimit] = useState(
    initialCompetition.round3AdvancementLimit || 3,
  );
  const [correctionRound, setCorrectionRound] = useState<0 | 1 | 2 | 3>(0);
  const [correctionReason, setCorrectionReason] = useState("");
  const reloadCompetition = async () => {
    const state = await api.competition(quiz.id);
    setCompetition(state);
    if (state.qualificationPublishedAt)
      setQualifiedIds(state.qualifiedParticipants.map((row) => row.userId));
    setRound2Draft(state.round2Rankings || []);
    setRound3Draft(state.round3Rankings || []);
    setAdvancementLimit(state.round3AdvancementLimit || 3);
  };
  const compAction = (action: () => Promise<unknown>, message: string) => {
    setBusyId(quiz.id);
    void action()
      .then(async (result) => {
        await reloadCompetition();
        setCorrectionRound(0);
        setCorrectionReason("");
        const email = (
          result as { email?: { sent: number; failed: number } } | null
        )?.email;
        toast(
          email
            ? `${message}. Email delivery: ${email.sent} sent, ${email.failed} failed.`
            : message,
        );
      })
      .catch((cause: unknown) =>
        toast(
          cause instanceof Error ? cause.message : "Competition update failed.",
        ),
      )
      .finally(() => setBusyId(""));
  };

  const round2Eligible =
    competition.qualifiedParticipants.map((row) => row.userId) ?? [];
  const round2Ready =
    round2Eligible.length > 0 &&
    round2Draft.length === round2Eligible.length &&
    new Set(round2Draft.map((row) => row.userId)).size ===
      round2Eligible.length &&
    new Set(round2Draft.map((row) => row.rank)).size ===
      round2Eligible.length &&
    round2Eligible.every((id) =>
      round2Draft.some((row) => row.userId === id),
    ) &&
    round2Draft.every(
      (row) =>
        Number.isInteger(row.rank) &&
        row.rank >= 1 &&
        row.rank <= round2Eligible.length,
    );
  return (
    <Modal title={`Competition — ${quiz.title}`} close={onClose}>
      <h3>Round 1 qualification</h3>
      {!competition.qualificationPublishedAt && (
        <button
          className="btn btn-outline"
          disabled={!!busyId}
          onClick={() =>
            compAction(async () => {
              const candidates = await api.prepareQualification(quiz.id);
              setQualifiedIds(
                candidates
                  .filter((row) => row.rank <= 10)
                  .map((row) => row.userId),
              );
              await reloadCompetition();
            }, "Qualification candidates refreshed")
          }
        >
          Prepare top 10
        </button>
      )}
      {competition.qualificationCandidates.map((row) => (
        <label key={row.userId} className="competition-choice">
          <input
            type="checkbox"
            disabled={
              !!competition.round2PublishedAt ||
              (!!competition.qualificationPublishedAt && correctionRound !== 1)
            }
            checked={qualifiedIds.includes(row.userId)}
            onChange={(e) =>
              setQualifiedIds((old) =>
                e.target.checked
                  ? [...old, row.userId]
                  : old.filter((id) => id !== row.userId),
              )
            }
          />{" "}
          Rank {row.rank} · {row.participant?.name || "Unknown"} (
          {row.participant?.email || ""}) · {row.score} points · submitted{" "}
          {row.submittedAt
            ? new Date(row.submittedAt).toLocaleTimeString()
            : "—"}
          {row.rank === 10 &&
          competition.qualificationCandidates.filter(
            (item) => item.score === row.score,
          ).length > 1
            ? " · cutoff tie"
            : ""}
        </label>
      ))}
      {!competition.qualificationPublishedAt &&
        competition.qualificationCandidates.length > 0 && (
          <>
            <label>
              Reason for changing the suggested list (required if changed)
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                maxLength={500}
              />
            </label>
            <button
              className="btn btn-dark"
              disabled={!!busyId || !qualifiedIds.length}
              onClick={() => {
                if (
                  window.confirm(
                    `Publish ${qualifiedIds.length} Round 2 qualifiers?`,
                  )
                )
                  compAction(
                    () =>
                      api.publishQualification(
                        quiz.id,
                        qualifiedIds,
                        overrideReason,
                      ),
                    "Qualified participants published",
                  );
              }}
            >
              Publish qualification
            </button>
          </>
        )}
      {competition.qualificationPublishedAt &&
        !competition.round2PublishedAt && (
          <>
            <button
              className="btn btn-outline"
              onClick={() => {
                setCorrectionRound(correctionRound === 1 ? 0 : 1);
                setCorrectionReason("");
              }}
            >
              Correct qualification
            </button>
            {correctionRound === 1 && (
              <>
                <label>
                  Correction reason
                  <textarea
                    value={correctionReason}
                    onChange={(e) => setCorrectionReason(e.target.value)}
                    maxLength={500}
                  />
                </label>
                <button
                  className="btn btn-dark"
                  disabled={
                    !!busyId || !qualifiedIds.length || !correctionReason.trim()
                  }
                  onClick={() =>
                    compAction(
                      () =>
                        api.correctQualification(
                          quiz.id,
                          qualifiedIds,
                          correctionReason,
                        ),
                      "Qualification corrected",
                    )
                  }
                >
                  Save audited correction
                </button>
              </>
            )}
          </>
        )}
      {competition.qualificationPublishedAt && (
        <CompetitionRound2
          quizId={quiz.id}
          competition={competition}
          busyId={busyId}
          correctionRound={correctionRound}
          setCorrectionRound={setCorrectionRound}
          correctionReason={correctionReason}
          setCorrectionReason={setCorrectionReason}
          round2Draft={round2Draft}
          setRound2Draft={setRound2Draft}
          advancementLimit={advancementLimit}
          setAdvancementLimit={setAdvancementLimit}
          round2Ready={round2Ready}
          round2EligibleCount={round2Eligible.length}
          compAction={compAction}
        />
      )}
      {competition.round2PublishedAt && (
        <CompetitionRound3
          quizId={quiz.id}
          competition={competition}
          busyId={busyId}
          correctionRound={correctionRound}
          setCorrectionRound={setCorrectionRound}
          correctionReason={correctionReason}
          setCorrectionReason={setCorrectionReason}
          round3Draft={round3Draft}
          setRound3Draft={setRound3Draft}
          advancementLimit={advancementLimit}
          compAction={compAction}
        />
      )}
      {competition.round3PublishedAt && !competition.winnerConfirmedAt && (
        <button
          className="btn btn-dark"
          disabled={!!busyId}
          onClick={() => {
            if (
              window.confirm(
                "Confirm the first-ranked participant as the winner?",
              )
            )
              compAction(
                () => api.confirmCompetitionWinner(quiz.id),
                "Winner confirmed",
              );
          }}
        >
          Confirm winner
        </button>
      )}
      {competition.winnerConfirmedAt && (
        <>
          <p role="status">
            Winner confirmed:{" "}
            {competition.round3Rankings.find(
              (row) => row.userId === competition.winnerUserId,
            )?.participant?.name || "participant"}
          </p>
          <button
            className="btn btn-outline"
            disabled={!!busyId}
            onClick={() =>
              compAction(
                () => api.confirmCompetitionWinner(quiz.id),
                "Winner announcement re-sent",
              )
            }
          >
            Re-send winner announcement
          </button>
        </>
      )}
      {competition.round3PublishedAt && (
        <p role="status">
          Final results are published. Create and publish top-three achievement
          certificates from the Certificates section.
        </p>
      )}
    </Modal>
  );
}
