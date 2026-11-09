import { Check } from "lucide-react";

export function ScanLogItem({
  name,
  team,
  time,
  status,
}: {
  name: string;
  team: string;
  time: string;
  status: string;
}) {
  return (
    <div className="scan-log">
      <span className="scan-log-check">
        <Check size={14} />
      </span>
      <span>
        <b>{name}</b>
        <small>{team}</small>
      </span>
      <span className="scan-log-time">{time}</span>
      <span className="scan-ok">{status}</span>
    </div>
  );
}
