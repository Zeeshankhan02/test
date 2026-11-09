import { useEffect, useState } from "react";
import { CalendarDays, ChevronDown, Download, Search } from "lucide-react";
import { api } from "../../api";
import { PageHead } from "../../shared/components/ui";

export function ScanLogs() {
  const [scans, setScans] = useState<Awaited<ReturnType<typeof api.scans>>>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [todayOnly, setTodayOnly] = useState(false);
  useEffect(() => {
    void api
      .scans()
      .then(setScans)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : "Could not load scans.",
        ),
      );
  }, []);
  const visible = scans.filter((scan) => {
    const matchesQuery = `${scan.participantName || ""} ${scan.ticketId}`
      .toLowerCase()
      .includes(query.toLowerCase());
    const matchesStatus = !statusFilter || scan.status === statusFilter;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return (
      matchesQuery &&
      matchesStatus &&
      (!todayOnly || new Date(scan.scannedAt) >= startOfDay)
    );
  });
  const exportScans = () => {
    const csv = [
      "Participant,Ticket ID,Scanned at,Status",
      ...visible.map((scan) =>
        [
          scan.participantName || "Unknown ticket",
          scan.ticketId,
          scan.scannedAt,
          scan.status,
        ]
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(","),
      ),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "fest-scan-history.csv";
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <PageHead
        eyebrow="EAST ENTRY · CODE SPRINT"
        title="Scan history"
        description="Every check-in from your shift, all in one place."
        action={
          <button className="btn btn-outline" onClick={exportScans}>
            <Download size={15} /> Export log
          </button>
        }
      />
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      <div className="logs-card">
        <div className="logs-toolbar">
          <div className="inline-search">
            <Search size={16} />
            <input
              placeholder="Search by name or ticket ID"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <select
            className="btn btn-outline"
            aria-label="Filter by scan status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">All statuses</option>
            <option value="valid_entry">Checked in</option>
            <option value="duplicate">Duplicate</option>
            <option value="invalid">Invalid or cancelled</option>
          </select>
          <button
            className="btn btn-outline"
            aria-pressed={todayOnly}
            onClick={() => setTodayOnly((value) => !value)}
          >
            <CalendarDays size={15} /> {todayOnly ? "Today" : "All dates"}{" "}
            <ChevronDown size={14} />
          </button>
        </div>
        <div className="logs-table">
          <div className="logs-head">
            <span>PARTICIPANT</span>
            <span>TICKET ID</span>
            <span>TIME</span>
            <span>STATUS</span>
          </div>
          {visible.map((scan) => (
            <div className="logs-row" key={scan.id}>
              <div className="logs-participant">
                <span>
                  <b>{scan.participantName || "Unknown ticket"}</b>
                  <small>{scan.teamName || scan.scannedBy}</small>
                </span>
              </div>
              <code>{scan.ticketId}</code>
              <span className="logs-time">
                {new Date(scan.scannedAt).toLocaleString()}
              </span>
              <span
                className={
                  scan.status === "valid_entry"
                    ? "status-valid"
                    : "status-duplicate"
                }
              >
                <i />
                {scan.status.replace("_", " ")}
              </span>
            </div>
          ))}
          {!error && !visible.length && <p>No scans match these filters.</p>}
        </div>
        <div className="table-foot">
          Showing {visible.length} of {scans.length} recent entries
          <span>Latest 100 scans</span>
        </div>
      </div>
    </>
  );
}
