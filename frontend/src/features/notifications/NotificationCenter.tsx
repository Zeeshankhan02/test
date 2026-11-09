import { useEffect, useState } from "react";
import { Bell, CalendarDays, Check, Ticket, Trophy } from "lucide-react";
import { api } from "../../api";
import type { Notice } from "../../types";
import { Empty, PageHead } from "../../shared/components/ui";

export function NotificationCenter() {
  const [items, setItems] = useState<Notice[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let disposed = false;
    let disconnect: (() => void) | undefined;
    void api
      .notices()
      .then((rows) => {
        setItems(rows);
        if (disposed) return;
        disconnect = api.subscribeNotifications((notice) =>
          setItems((current) =>
            current.some((item) => item.id === notice.id)
              ? current
              : [notice, ...current],
          ),
        );
      })
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load notifications.",
        ),
      );
    return () => {
      disposed = true;
      disconnect?.();
    };
  }, []);
  const unread = items.filter((n) => !n.isRead).length;
  const markRead = async (id: string) => {
    try {
      await api.markNoticeRead(id);
      setItems((current) =>
        current.map((item) =>
          item.id === id ? { ...item, isRead: true } : item,
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not update notification.",
      );
    }
  };
  return (
    <>
      <PageHead
        eyebrow="ALL CAUGHT UP?"
        title="Notifications"
        description="Your fest, your events, your updates. All in one place."
        action={
          <button
            className="btn btn-outline"
            disabled={!unread}
            onClick={() => {
              void Promise.all(
                items
                  .filter((item) => !item.isRead)
                  .map((item) => api.markNoticeRead(item.id)),
              )
                .then(() =>
                  setItems((current) =>
                    current.map((item) => ({ ...item, isRead: true })),
                  ),
                )
                .catch((cause: unknown) =>
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "Could not update notifications.",
                  ),
                );
            }}
          >
            <Check size={15} /> Mark all as read
          </button>
        }
      />
      <div className="notification-list">
        <div className="notification-summary">
          <span>{unread} unread</span>
          <span>LAST 7 DAYS</span>
        </div>
        {items.map((n) => (
          <article
            key={n.id}
            className={`notification-item ${n.isRead ? "read" : ""}`}
            onClick={() => {
              if (!n.isRead) void markRead(n.id);
            }}
          >
            <span className={`notification-icon nt-${n.type}`}>
              {n.type === "result" ? (
                <Trophy />
              ) : n.type === "event" ? (
                <CalendarDays />
              ) : n.type === "registration" ? (
                <Ticket />
              ) : (
                <Bell />
              )}
            </span>
            <div className="notification-copy">
              <div>
                <b>{n.title}</b>
                {!n.isRead && <i className="unread-dot" />}
              </div>
              <p>{n.message}</p>
              <small>
                {new Date(n.timestamp).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}{" "}
                · FestiQO
              </small>
            </div>
            <button
              className="notification-mark"
              aria-label="Mark as read"
              onClick={(e) => {
                e.stopPropagation();
                if (!n.isRead) void markRead(n.id);
              }}
            >
              {n.isRead ? "Read" : "Mark read"}
            </button>
          </article>
        ))}
      </div>
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      {!items.length && (
        <Empty
          icon={<Bell />}
          title="You’re all caught up"
          text="New event updates and quiz results will show up here."
        />
      )}
    </>
  );
}
