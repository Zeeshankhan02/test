import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  QrCode,
  ScanLine,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react";
import { api } from "../../api";
import type { TicketScanStatus } from "../../ticketValidation";
import { PageHead } from "../../shared/components/ui";

export function ScannerPage({ toast }: { toast: (s: string) => void }) {
  const [todayCheckIns, setTodayCheckIns] = useState<number | null>(null);
  const [scanning, setScanning] = useState(false);
  const [checking, setChecking] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [result, setResult] = useState<{
    ticketId: string;
    status: TicketScanStatus;
    participant?: { name: string; teamName: string | null; eventName: string };
  } | null>(null);
  useEffect(() => {
    void api
      .volunteerSummary()
      .then((summary) => setTodayCheckIns(summary.todayCheckIns))
      .catch((cause: unknown) =>
        setCameraError(
          cause instanceof Error ? cause.message : "Could not load scan count.",
        ),
      );
  }, []);
  const verifyTicket = async (credential: string) => {
    if (checking) return;
    setChecking(true);
    setScanning(false);
    try {
      const response = await api.verifyTicket(credential.trim());
      const status =
        response.status === "valid_entry" ? "valid" : response.status;
      setResult({
        ticketId: response.ticketId || "—",
        status,
        participant: response.participant,
      });
      if (status === "valid")
        void api
          .volunteerSummary()
          .then((summary) => setTodayCheckIns(summary.todayCheckIns))
          .catch((cause: unknown) =>
            setCameraError(
              cause instanceof Error
                ? cause.message
                : "Could not refresh scan count.",
            ),
          );
      toast(
        status === "valid"
          ? "Entry verified · Welcome!"
          : status === "duplicate"
            ? "Entry blocked · This ticket was already scanned"
            : "Entry blocked · Ticket not found",
      );
    } catch (cause) {
      setResult({ ticketId: "—", status: "invalid" });
      toast(
        cause instanceof Error ? cause.message : "Ticket verification failed.",
      );
    } finally {
      setChecking(false);
    }
  };
  useEffect(() => {
    if (!scanning) return;
    setCameraError("");
    let scanner: import("html5-qrcode").Html5Qrcode | undefined;
    let cancelled = false;
    void import("html5-qrcode")
      .then(async ({ Html5Qrcode }) => {
        if (cancelled) return;
        const activeScanner = new Html5Qrcode("reader");
        scanner = activeScanner;
        await activeScanner.start(
          { facingMode: "environment" },
          { fps: 10 },
          (decoded) => {
            verifyTicket(decoded);
            void activeScanner.stop().catch(() => {});
          },
          () => {},
        );
        if (cancelled && activeScanner.isScanning) await activeScanner.stop();
      })
      .catch(() => {
        if (!cancelled) {
          setScanning(false);
          setCameraError(
            "Camera unavailable. Allow camera access or test a ticket below.",
          );
        }
      });
    return () => {
      cancelled = true;
      if (scanner?.isScanning) void scanner.stop().catch(() => {});
    };
  }, [scanning]);
  return (
    <>
      <PageHead
        eyebrow="EAST ENTRY · CODE SPRINT"
        title="Entry scanner"
        description="Scan a ticket QR to verify a guest. One scan, one smooth entry."
        action={
          <span className="scanner-live">
            <i /> SCANNER READY
          </span>
        }
      />
      <div className="scanner-layout">
        <div className="scanner-camera">
          <div id="reader" className="camera-view">
            <div className="camera-fallback">
              <div className="camera-scan-icon">
                <ScanLine size={36} />
              </div>
              <span>
                {checking
                  ? "Verifying ticket securely…"
                  : scanning
                    ? "Point the camera at a ticket QR"
                    : "Camera view"}
              </span>
              <small>
                {cameraError ||
                  (scanning
                    ? "Hold steady · QR will scan automatically"
                    : "Start the camera to scan a ticket")}
              </small>
            </div>
          </div>
          <div className="camera-bottom">
            <span>
              <span className="live-dot" /> CAMERA · BACK
            </span>
            <button className="icon-button" aria-label="Switch camera">
              <Settings size={16} />
            </button>
          </div>
          <div className="scan-actions">
            <button
              className="btn btn-dark btn-wide"
              onClick={() => {
                setResult(null);
                setScanning(!scanning);
              }}
            >
              {scanning ? (
                <>
                  <X size={16} /> Stop camera
                </>
              ) : (
                <>
                  <ScanLine size={16} />{" "}
                  {result ? "Scan next ticket" : "Start camera"}
                </>
              )}
            </button>
          </div>
        </div>
        <div className="scan-result-panel">
          <span className="section-kicker">LATEST SCAN</span>
          {result ? (
            <div className={`scan-success scan-${result.status}`}>
              <div className={`result-check result-${result.status}`}>
                {result.status === "valid" ? (
                  <Check size={23} />
                ) : (
                  <X size={23} />
                )}
              </div>
              <span className={`status-badge scan-badge-${result.status}`}>
                <i />{" "}
                {result.status === "valid"
                  ? "ENTRY VERIFIED"
                  : result.status === "duplicate"
                    ? "DUPLICATE TICKET"
                    : "INVALID TICKET"}
              </span>
              <h2>
                {result.status === "valid"
                  ? result.participant?.name || "Participant"
                  : result.status === "duplicate"
                    ? "Already checked in"
                    : "Ticket not found"}
              </h2>
              <p>
                {result.status === "valid"
                  ? `${result.participant?.teamName || "Individual registration"} · ${result.participant?.eventName || "Event"}`
                  : result.status === "duplicate"
                    ? "This ticket has already been used."
                    : "No registration matches this QR code."}
              </p>
              <div className="result-ticket">
                <span>TICKET ID</span>
                <b>{result.ticketId}</b>
              </div>
              <div className={`entry-allowed entry-${result.status}`}>
                <ShieldCheck size={17} />{" "}
                {result.status === "valid"
                  ? "Entry allowed · Valid ticket"
                  : result.status === "duplicate"
                    ? "Entry denied · Already scanned"
                    : "Entry denied · Unregistered ticket"}
              </div>
              <button
                className="btn btn-dark btn-wide"
                onClick={() => setResult(null)}
              >
                Ready for next guest <ArrowRight size={15} />
              </button>
            </div>
          ) : (
            <div className="scan-empty">
              <div className="scan-empty-icon">
                <QrCode size={24} />
              </div>
              <h3>All clear here.</h3>
              <p>
                Scanned tickets will show up in this space. Keep an eye out for
                duplicate or invalid passes.
              </p>
            </div>
          )}
          <div className="scan-counter">
            <span>TODAY</span>
            <b>{todayCheckIns ?? "—"}</b>
            <small>successful check-ins</small>
            <i>
              <em />
            </i>
          </div>
        </div>
      </div>
    </>
  );
}
