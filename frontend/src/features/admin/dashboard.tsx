import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Bell,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  Plus,
  Users,
} from "lucide-react";
import { api } from "../../api";
import { useAuth } from "../../AuthContext";
import { Stat } from "../../shared/components/ui";
import { FestDatesCard } from "../fest-config/FestDatesCard";

export function AdminDashboard({ toast }: { toast: (s: string) => void }) {
  const [stats, setStats] = useState<Awaited<
    ReturnType<typeof api.dashboard>
  > | null>(null);
  const { user } = useAuth();
  useEffect(() => {
    void api
      .dashboard()
      .then(setStats)
      .catch((cause: unknown) =>
        toast(
          cause instanceof Error ? cause.message : "Could not load dashboard.",
        ),
      );
  }, []);
  const daily = stats?.registrationsByDay ?? [];
  const maxDaily = Math.max(1, ...daily.map((item) => item.registrations));
  const chartLine = daily.length
    ? daily
        .map(
          (item, index) =>
            `${index ? "L" : "M"}${daily.length < 2 ? 300 : (index * 600) / (daily.length - 1)},${165 - (item.registrations / maxDaily) * 145}`,
        )
        .join(" ")
    : "M0,165 L600,165";
  return (
    <>
      <div className="admin-welcome">
        <div>
          <div className="eyebrow">FEST ADMINISTRATION</div>
          <h1>
            Welcome, {user?.name || "Admin"} <span>✳</span>
          </h1>
          <p>The campus is warming up. Here’s how things are shaping up.</p>
        </div>
        <Link className="btn btn-dark" to="/admin/events">
          <Plus size={17} /> Create event
        </Link>
      </div>
      <div className="admin-stats">
        <Stat
          label="Total registrations"
          value={String(stats?.registrations ?? "—")}
          detail={`${stats?.students ?? 0} student accounts`}
          icon={<Users />}
          tone="lavender"
        />
        <Stat
          label="Events published"
          value={String(stats?.events ?? "—")}
          detail="Published events"
          icon={<CalendarDays />}
          tone="peach"
        />
        <Stat
          label="Quiz participants"
          value={String(stats?.quizParticipants ?? "—")}
          detail="Quiz participants"
          icon={<CircleHelp />}
          tone="mint"
        />
        <Stat
          label="Fest engagement"
          value={
            stats?.registrations
              ? `${Math.round((stats.checkIns / stats.registrations) * 100)}%`
              : "0%"
          }
          detail={`${stats?.checkIns ?? 0} check-ins`}
          icon={<Activity />}
          tone="butter"
        />
      </div>
      <div className="admin-main-grid">
        <div className="admin-panel registration-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">REGISTRATION OVERVIEW</span>
              <h2>Interest is picking up.</h2>
            </div>
            <button className="btn btn-outline">
              Last 7 days <ChevronDown size={14} />
            </button>
          </div>
          <div className="chart-total">
            <b>{stats?.registrations ?? 0}</b>
            <small>registrations recorded</small>
          </div>
          <div className="chart">
            <div className="chart-y">
              <span>{maxDaily}</span>
              <span>{Math.round(maxDaily * 0.66)}</span>
              <span>{Math.round(maxDaily * 0.33)}</span>
              <span>0</span>
            </div>
            <div className="chart-main">
              <div className="chart-lines">
                <i />
                <i />
                <i />
                <i />
              </div>
              <svg
                viewBox="0 0 600 180"
                preserveAspectRatio="none"
                role="img"
                aria-label="Registrations over the last seven days"
              >
                <defs>
                  <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="#7c5cf2" stopOpacity=".2" />
                    <stop offset="1" stopColor="#7c5cf2" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={`${chartLine} L600,180 L0,180Z`} fill="url(#area)" />
                <path
                  d={chartLine}
                  fill="none"
                  stroke="#795af1"
                  strokeWidth="3"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              <div className="chart-x">
                {daily
                  .filter(
                    (_, index) => index % 2 === 0 || index === daily.length - 1,
                  )
                  .map((item) => (
                    <span key={item.date}>
                      {new Date(`${item.date}T00:00:00`)
                        .toLocaleDateString(undefined, {
                          month: "short",
                          day: "2-digit",
                        })
                        .toUpperCase()}
                    </span>
                  ))}
              </div>
            </div>
          </div>
        </div>
        <div className="admin-panel popular-panel">
          <div className="section-kicker">
            TOP PERFORMING EVENTS{" "}
            <Link to="/admin/events">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          {stats?.topEvents.map((event) => (
            <PopularEvent
              key={event.id}
              title={event.title}
              category={event.category.toUpperCase()}
              number={String(event.registrations)}
              capacity={event.capacity}
              pct={String(
                event.capacity
                  ? Math.min(
                      100,
                      Math.round((event.registrations / event.capacity) * 100),
                    )
                  : 0,
              )}
            />
          ))}
          {!stats?.topEvents.length && <p>No event registrations yet.</p>}
          <Link className="popular-cta" to="/admin/events">
            Manage events <ArrowRight size={15} />
          </Link>
        </div>
      </div>
      <div className="content-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">FEST CONFIGURATION</div>
            <h2>Fest dates.</h2>
            <p>Shown across the landing page and student dashboards.</p>
          </div>
        </div>
        <FestDatesCard toast={toast} />
      </div>
      <div className="admin-announcement">
        <div className="announce-mark">
          <Bell size={20} />
        </div>
        <div>
          <b>Give everyone the latest.</b>
          <p>
            Share a fest update with all students or a specific event group.
          </p>
        </div>
        <Link to="/admin/notifications" className="btn btn-dark">
          Write an announcement <ArrowRight size={15} />
        </Link>
      </div>
    </>
  );
}
function PopularEvent({
  title,
  category,
  number,
  capacity,
  pct,
}: {
  title: string;
  category: string;
  number: string;
  capacity: number;
  pct: string;
}) {
  return (
    <div className="popular-event">
      <span>
        <b>{title}</b>
        <small>{category}</small>
      </span>
      <b className="popular-n">
        {number}
        <small> / {capacity}</small>
      </b>
      <i>
        <em style={{ width: `${pct}%` }} />
      </i>
    </div>
  );
}
