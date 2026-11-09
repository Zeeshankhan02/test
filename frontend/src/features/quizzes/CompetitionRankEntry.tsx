import type { ApiCompetitionRank } from "../../api";

type CompetitionRankEntryProps = {
  round: 2 | 3;
  row: ApiCompetitionRank;
  participants: { userId: string; label: string }[];
  participantPlaceholder: string;
  locked: boolean;
  removable: boolean;
  onChange: (changes: Partial<ApiCompetitionRank>) => void;
  onRemove: () => void;
};

export function CompetitionRankEntry({
  round,
  row,
  participants,
  participantPlaceholder,
  locked,
  removable,
  onChange,
  onRemove,
}: CompetitionRankEntryProps) {
  return (
    <div className="competition-rank-entry">
      <select
        value={row.userId}
        disabled={locked}
        onChange={(event) => onChange({ userId: event.target.value })}
      >
        <option value="">{participantPlaceholder}</option>
        {participants.map((participant) => (
          <option key={participant.userId} value={participant.userId}>
            {participant.label}
          </option>
        ))}
      </select>
      <input
        aria-label={`Round ${round} rank`}
        type="number"
        min={1}
        value={row.rank}
        disabled={locked}
        onChange={(event) => onChange({ rank: Number(event.target.value) })}
      />
      <input
        aria-label={`Round ${round} score`}
        type="number"
        min={0}
        value={row.score ?? ""}
        placeholder="Score"
        disabled={locked}
        onChange={(event) =>
          onChange({
            score:
              event.target.value === ""
                ? undefined
                : Number(event.target.value),
          })
        }
      />
      <input
        aria-label={`Round ${round} notes`}
        value={row.notes || ""}
        placeholder="Remarks"
        disabled={locked}
        onChange={(event) => onChange({ notes: event.target.value })}
      />
      {removable && (
        <button className="btn btn-outline" onClick={onRemove}>
          Remove
        </button>
      )}
    </div>
  );
}
