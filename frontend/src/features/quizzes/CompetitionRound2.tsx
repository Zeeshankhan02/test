import type { Dispatch, SetStateAction } from "react";
import { api, type ApiCompetition, type ApiCompetitionRank } from "../../api";
import { CompetitionRankEntry } from "./CompetitionRankEntry";

type CompetitionAction = (
  action: () => Promise<unknown>,
  message: string,
) => void;
type CompetitionRound2Props = {
  quizId: string;
  competition: ApiCompetition;
  busyId: string;
  correctionRound: 0 | 1 | 2 | 3;
  setCorrectionRound: Dispatch<SetStateAction<0 | 1 | 2 | 3>>;
  correctionReason: string;
  setCorrectionReason: Dispatch<SetStateAction<string>>;
  round2Draft: ApiCompetitionRank[];
  setRound2Draft: Dispatch<SetStateAction<ApiCompetitionRank[]>>;
  advancementLimit: number;
  setAdvancementLimit: Dispatch<SetStateAction<number>>;
  round2Ready: boolean;
  round2EligibleCount: number;
  compAction: CompetitionAction;
};

export function CompetitionRound2({
  quizId,
  competition,
  busyId,
  correctionRound,
  setCorrectionRound,
  correctionReason,
  setCorrectionReason,
  round2Draft,
  setRound2Draft,
  advancementLimit,
  setAdvancementLimit,
  round2Ready,
  round2EligibleCount,
  compAction,
}: CompetitionRound2Props) {
  return (
    <>
      <h3>Round 2 rankings</h3>
      {competition.round2PublishedAt && !competition.round3PublishedAt && (
        <button
          className="btn btn-outline"
          onClick={() => {
            setCorrectionRound(correctionRound === 2 ? 0 : 2);
            setCorrectionReason("");
          }}
        >
          Correct published rankings
        </button>
      )}
      {round2Draft.map((row, index) => (
        <CompetitionRankEntry
          key={`${row.userId}-${index}`}
          round={2}
          row={row}
          participants={competition.qualifiedParticipants.map((person) => ({
            userId: person.userId,
            label: `${person.participant?.name ?? ""} · ${person.participant?.email ?? ""}`,
          }))}
          participantPlaceholder="Select qualified participant"
          locked={!!competition.round2PublishedAt && correctionRound !== 2}
          removable={!competition.round2PublishedAt}
          onChange={(changes) =>
            setRound2Draft((old) =>
              old.map((item, i) =>
                i === index ? { ...item, ...changes } : item,
              ),
            )
          }
          onRemove={() =>
            setRound2Draft((old) => old.filter((_, i) => i !== index))
          }
        />
      ))}
      {!competition.round2PublishedAt && (
        <>
          <button
            className="btn btn-outline"
            onClick={() =>
              setRound2Draft((old) => [
                ...old,
                { userId: "", rank: old.length + 1 },
              ])
            }
          >
            Add participant
          </button>
          <label>
            Advance to Round 3
            <input
              type="number"
              min={1}
              max={10}
              value={advancementLimit}
              onChange={(e) => setAdvancementLimit(Number(e.target.value))}
            />
            <small>Top {advancementLimit} Round 2 ranks advance.</small>
          </label>
          <button
            className="btn btn-outline"
            disabled={
              !!busyId ||
              !round2Draft.length ||
              round2Draft.some((row) => !row.userId)
            }
            onClick={() =>
              compAction(
                () => api.saveRound2(quizId, round2Draft, advancementLimit),
                "Round 2 draft saved",
              )
            }
          >
            Save Round 2 draft
          </button>
          {!round2Ready && (
            <p role="status">
              Add every one of the {round2EligibleCount} qualified participants
              and assign each a unique rank before publishing.
            </p>
          )}
          <button
            className="btn btn-dark"
            disabled={!!busyId || !round2Ready}
            onClick={() => {
              if (
                window.confirm(
                  "Save and publish the complete Round 2 rankings?",
                )
              )
                compAction(async () => {
                  await api.saveRound2(quizId, round2Draft, advancementLimit);
                  return api.publishRound2(quizId);
                }, "Round 2 published");
            }}
          >
            Publish Round 2
          </button>
        </>
      )}
      {correctionRound === 2 && (
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
            disabled={!!busyId || !correctionReason.trim()}
            onClick={() =>
              compAction(
                () => api.correctRound2(quizId, round2Draft, correctionReason),
                "Round 2 correction saved",
              )
            }
          >
            Save audited correction
          </button>
        </>
      )}
    </>
  );
}
