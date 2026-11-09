import type { Dispatch, SetStateAction } from "react";
import { api, type ApiCompetition, type ApiCompetitionRank } from "../../api";
import { CompetitionRankEntry } from "./CompetitionRankEntry";

type CompetitionAction = (
  action: () => Promise<unknown>,
  message: string,
) => void;
type CompetitionRound3Props = {
  quizId: string;
  competition: ApiCompetition;
  busyId: string;
  correctionRound: 0 | 1 | 2 | 3;
  setCorrectionRound: Dispatch<SetStateAction<0 | 1 | 2 | 3>>;
  correctionReason: string;
  setCorrectionReason: Dispatch<SetStateAction<string>>;
  round3Draft: ApiCompetitionRank[];
  setRound3Draft: Dispatch<SetStateAction<ApiCompetitionRank[]>>;
  advancementLimit: number;
  compAction: CompetitionAction;
};

export function CompetitionRound3({
  quizId,
  competition,
  busyId,
  correctionRound,
  setCorrectionRound,
  correctionReason,
  setCorrectionReason,
  round3Draft,
  setRound3Draft,
  advancementLimit,
  compAction,
}: CompetitionRound3Props) {
  return (
    <>
      <h3>Round 3 final rankings</h3>
      {competition.round3PublishedAt && !competition.winnerConfirmedAt && (
        <button
          className="btn btn-outline"
          onClick={() => {
            setCorrectionRound(correctionRound === 3 ? 0 : 3);
            setCorrectionReason("");
          }}
        >
          Correct published final rankings
        </button>
      )}
      {round3Draft.map((row, index) => (
        <CompetitionRankEntry
          key={`${row.userId}-${index}`}
          round={3}
          row={row}
          participants={competition.round2Rankings
            .filter((person) => person.rank <= advancementLimit)
            .map((person) => ({
              userId: person.userId,
              label: `${person.participant?.name ?? ""} · rank ${person.rank}`,
            }))}
          participantPlaceholder="Select advancing participant"
          locked={!!competition.round3PublishedAt && correctionRound !== 3}
          removable={!competition.round3PublishedAt}
          onChange={(changes) =>
            setRound3Draft((old) =>
              old.map((item, i) =>
                i === index ? { ...item, ...changes } : item,
              ),
            )
          }
          onRemove={() =>
            setRound3Draft((old) => old.filter((_, i) => i !== index))
          }
        />
      ))}
      {!competition.round3PublishedAt && (
        <>
          <button
            className="btn btn-outline"
            onClick={() =>
              setRound3Draft((old) => [
                ...old,
                { userId: "", rank: old.length + 1 },
              ])
            }
          >
            Add participant
          </button>
          <button
            className="btn btn-outline"
            disabled={
              !!busyId ||
              !round3Draft.length ||
              round3Draft.some((row) => !row.userId)
            }
            onClick={() =>
              compAction(
                () => api.saveRound3(quizId, round3Draft),
                "Round 3 draft saved",
              )
            }
          >
            Save final draft
          </button>
          <button
            className="btn btn-dark"
            disabled={!!busyId}
            onClick={() => {
              if (window.confirm("Publish final rankings?"))
                compAction(
                  () => api.publishRound3(quizId),
                  "Final rankings published",
                );
            }}
          >
            Publish final results
          </button>
        </>
      )}
      {correctionRound === 3 && (
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
                () => api.correctRound3(quizId, round3Draft, correctionReason),
                "Final ranking correction saved",
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
