import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Compass,
  ScanLine,
} from "lucide-react";
import { api } from "../../api";
import { ScanLogItem } from "./ScanLogItem";
import { Stat } from "../../shared/components/ui";

export function VolunteerDashboard() {
  const [summary, setSummary] = useState<Awaited<
    ReturnType<typeof api.volunteerSummary>
  > | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    void api
      .volunteerSummary()
      .then(setSummary)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load scanner summary.",
        ),
      );
  }, []);
  const successRate = summary?.todayScans
    ? Math.round((summary.todayCheckIns / summary.todayScans) * 100)
    : 0;
  const latestEvent = summary?.recent[0]?.eventName;
  return (
    <>
      <div className="vol-banner">
        <div>
          <div className="eyebrow vol-eyebrow">
            <i /> VOLUNTEER WORKSPACE
          </div>
          <h1>
            You’re on the
            <br />
            <em>front line.</em>
          </h1>
          <p>Scan event tickets and review your recent check-ins.</p>
          <Link className="btn btn-white" to="/volunteer/scanner">
            Open scanner <ScanLine size={16} />
          </Link>
        </div>
        <div className="vol-illustration">
          <div className="scan-ring">
            <ScanLine size={70} />
            <span />
          </div>
          <div className="vol-glow" />
        </div>
      </div>
      <div className="vol-stats">
        <Stat
          label="Checked in"
          value={String(summary?.todayCheckIns ?? "—")}
          detail="Successful scans today"
          icon={<Check />}
          tone="mint"
        />
        <Stat
          label="Check-in success"
          value={`${successRate}%`}
          detail={`${summary?.todayScans ?? 0} scans today`}
          icon={<Activity />}
          tone="lavender"
        />
        <Stat
          label="Account"
          value="Active"
          detail="Volunteer workspace"
          icon={<Clock3 />}
          tone="peach"
        />
      </div>
      <div className="vol-grid">
        <div className="vol-shift-card">
          <div className="section-kicker">LATEST CHECK-IN EVENT</div>
          <h2>{latestEvent || "No event scans yet"}</h2>
          <p>
            <CalendarDays />{" "}
            {summary?.recent[0]
              ? new Date(summary.recent[0].scannedAt).toLocaleString()
              : "Your scan activity will appear here."}
          </p>
          <p>
            <Compass /> Recent scanner activity
          </p>
          <div className="shift-progress">
            <span>TODAY’S CHECK-INS</span>
            <b>{summary?.todayCheckIns ?? 0}</b>
            <i>
              <em style={{ width: `${successRate}%` }} />
            </i>
          </div>
          <Link to="/volunteer/scanner" className="text-link">
            Start scanning <ArrowRight size={15} />
          </Link>
        </div>
        <div className="vol-recent">
          <div className="section-kicker">
            RECENT CHECK-INS{" "}
            <Link to="/volunteer/logs">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          {summary?.recent.map((scan) => (
            <ScanLogItem
              key={scan.id}
              name={scan.participantName}
              team={scan.teamName}
              time={new Date(scan.scannedAt).toLocaleTimeString()}
              status="Checked in"
            />
          ))}
          {!error && !summary?.recent.length && <p>No successful scans yet.</p>}
        </div>
      </div>
    </>
  );
}
