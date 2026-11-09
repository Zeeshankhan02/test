import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { Download, ExternalLink, ShieldCheck, Ticket } from "lucide-react";
import { api } from "../../api";
import { useAuth } from "../../AuthContext";
import { Empty, PageHead } from "../../shared/components/ui";

export function TicketsPage({ toast }: { toast: (s: string) => void }) {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<
    Awaited<ReturnType<typeof api.myTicketDetails>>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    void api
      .myTicketDetails()
      .then(setTickets)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : "Could not load tickets.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);
  return (
    <>
      <PageHead
        eyebrow="YOUR WRISTBAND, DIGITALLY"
        title="My tickets"
        description="Everything you need to get through the door, right here."
      />
      {loading ? (
        <p role="status">Loading tickets…</p>
      ) : error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : !tickets.length ? (
        <Empty
          icon={<Ticket />}
          title="No tickets yet"
          text="Tickets for your registered events appear here and stay in your history if an event ends, is cancelled, or is archived."
        />
      ) : (
        tickets.map(({ ticket, registration, event }) => {
          const ticketStatus =
            ticket.status === "active"
              ? "ACTIVE"
              : ticket.status === "checked_in"
                ? "CHECKED IN"
                : ticket.status === "cancelled"
                  ? "CANCELLED"
                  : ticket.status === "revoked"
                    ? "REVOKED"
                    : "STATUS UNAVAILABLE";
          const ticketMessage =
            ticket.status === "checked_in"
              ? "This ticket has already been scanned and cannot be used again."
              : ticket.status === "cancelled" || ticket.status === "revoked"
                ? "This ticket is no longer valid for entry."
                : !event
                  ? "The event was removed. This ticket is retained for your records; contact the organizers if you need event details."
                  : event.status === "cancelled"
                    ? "This event was cancelled. Contact the organizers about your registration."
                    : event.status === "archived"
                      ? "The organizers archived this event. Your ticket remains in your history."
                      : event.status === "ended"
                        ? "This event has ended. Your ticket remains in your history."
                        : "";
          const ticketUsable =
            ticket.status === "active" && event?.status !== "cancelled";
          return (
            <div className="ticket-layout" key={ticket._id}>
              <div className="ticket-card">
                <div className="ticket-main">
                  <div className="ticket-head">
                    <span className="category-tag">TECHNICAL · TEAM EVENT</span>
                    <span className="status-badge">
                      <i /> {ticketStatus}
                    </span>
                  </div>
                  <h2>{event?.title || "Event no longer available"}</h2>
                  <p className="ticket-sub">
                    {event?.description || "Event details are unavailable."}
                  </p>
                  <div className="ticket-details">
                    <div>
                      <span>DATE & TIME</span>
                      <b>
                        {event?.startsAt
                          ? new Date(event.startsAt).toLocaleString()
                          : "Unavailable"}
                      </b>
                    </div>
                    <div>
                      <span>VENUE</span>
                      <b>{event?.venue || "Unavailable"}</b>
                    </div>
                    <div>
                      <span>PARTICIPANT</span>
                      <b>{user?.name}</b>
                    </div>
                    {registration?.teamName && (
                      <div>
                        <span>TEAM LEADER</span>
                        <b>
                          {registration.userId &&
                          typeof registration.userId === "object"
                            ? registration.userId.name
                            : user?.name}
                        </b>
                      </div>
                    )}
                    <div>
                      <span>TEAM</span>
                      <b>
                        {registration?.teamName || "Individual"} ·{" "}
                        {registration?.members?.length || 0} member
                        {registration?.members?.length === 1 ? "" : "s"}
                      </b>
                      {registration?.teamName && (
                        <small>
                          Members: {registration.members.join(", ")}
                        </small>
                      )}
                    </div>
                  </div>
                </div>
                <div className="ticket-stub">
                  <div className="perforation" />
                  <div className="qr-box">
                    {ticketUsable ? (
                      <QRCode
                        value={ticket.credential}
                        size={138}
                        bgColor="#fff"
                        fgColor="#171c27"
                      />
                    ) : (
                      <span role="status">Ticket QR unavailable</span>
                    )}
                  </div>
                  <span className="ticket-number">{ticket._id}</span>
                  <small>Present this QR at the entrance</small>
                </div>
                <div className="ticket-notch top" />
                <div className="ticket-notch bottom" />
              </div>
              {ticketUsable && (
                <div className="ticket-actions">
                  <button
                    className="btn btn-dark"
                    onClick={() => toast("Ticket saved to your device")}
                  >
                    <Download size={16} /> Download ticket
                  </button>
                  <button
                    className="btn btn-outline"
                    onClick={() => toast("Ticket link copied")}
                  >
                    <ExternalLink size={16} /> Share ticket
                  </button>
                </div>
              )}
              <div className="ticket-help">
                <ShieldCheck size={17} />
                <span>
                  <b>
                    {ticketMessage
                      ? "Ticket information"
                      : "Keep your ticket close."}
                  </b>{" "}
                  {ticketMessage ||
                    "This QR code is unique to you and can only be scanned once at entry."}
                </span>
              </div>
            </div>
          );
        })
      )}
    </>
  );
}
