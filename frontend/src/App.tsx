import { useEffect, useState } from "react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Compass,
  ExternalLink,
  FileText,
  Flame,
  LayoutDashboard,
  LogOut,
  Menu,
  ScanLine,
  Search,
  ShieldCheck,
  Sparkles,
  Ticket,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { api, useFestDates, type ApiQuiz } from "./api";
import type { Role, User } from "./types";
import LandingPage from "./LandingPage";
import ThemeToggle from "./ThemeToggle";
import { useAuth } from "./AuthContext";
import { VolunteersPage } from "./features/admin/volunteers/VolunteersPage";
import { CertificatesPage } from "./features/admin/certificates/CertificatesPage";
import { ProfilePage } from "./shared/components/ui";
import {
  StudentDashboard,
  EventsPage,
  EventDetail,
  TicketsPage,
  QuizzesPage,
  LeaderboardPage,
} from "./features/student/pages";
import {
  VolunteerDashboard,
  ScannerPage,
  ScanLogs,
} from "./features/volunteers/pages";
import {
  AdminDashboard,
  AdminEvents,
  Participants,
  QuizBuilder,
} from "./features/admin/pages";
import {
  PublicCertificateVerification,
  StudentCertificates,
} from "./features/certificates/pages";
import {
  Announcement,
  NotificationCenter,
} from "./features/notifications/pages";
import { Login, SignupPage, SessionPending } from "./features/auth/pages";

type AppUser = User;

const navByRole: Record<
  Role,
  { label: string; path: string; icon: typeof Compass }[]
> = {
  student: [
    { label: "Overview", path: "/student", icon: LayoutDashboard },
    { label: "Explore events", path: "/student/events", icon: Compass },
    { label: "My tickets", path: "/student/tickets", icon: Ticket },
    { label: "Quizzes", path: "/student/quizzes", icon: CircleHelp },
    { label: "Leaderboard", path: "/student/leaderboard", icon: Trophy },
    { label: "Notifications", path: "/student/notifications", icon: Bell },
  ],
  volunteer: [
    { label: "Shift overview", path: "/volunteer", icon: LayoutDashboard },
    { label: "Entry scanner", path: "/volunteer/scanner", icon: ScanLine },
    { label: "Scan history", path: "/volunteer/logs", icon: FileText },
  ],
  admin: [
    { label: "Overview", path: "/admin", icon: LayoutDashboard },
    { label: "Events", path: "/admin/events", icon: CalendarDays },
    { label: "Participants", path: "/admin/participants", icon: Users },
    { label: "Quizzes", path: "/admin/quizzes", icon: CircleHelp },
    { label: "Volunteers", path: "/admin/volunteers", icon: Users },
    { label: "Certificates", path: "/admin/certificates", icon: FileText },
    { label: "Announcements", path: "/admin/notifications", icon: Bell },
  ],
};

function App() {
  const { user, ready, login, logout } = useAuth();
  const [notice, setNotice] = useState("");
  const toast = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };
  return (
    <>
      <Routes>
        <Route
          path="/certificate/verify/:certificateId?"
          element={<PublicCertificateVerification />}
        />
        <Route
          path="/login"
          element={
            ready ? <Login user={user} onLogin={login} /> : <SessionPending />
          }
        />
        <Route
          path="/signup"
          element={ready ? <SignupPage user={user} /> : <SessionPending />}
        />
        <Route
          path="/unauthorized"
          element={
            <div className="not-found">
              <ShieldCheck />
              <h1>That area is restricted</h1>
              <p>Your account doesn’t have access to this workspace.</p>
              <Link to="/">
                Go home <ArrowRight size={16} />
              </Link>
            </div>
          }
        />
        <Route
          path="/"
          element={
            <LandingPage dashboardPath={user ? `/${user.role}` : undefined} />
          }
        />
        {(["student", "volunteer", "admin"] as Role[]).map((role) => (
          <Route
            key={role}
            path={`/${role}/*`}
            element={
              <Protected user={user} role={role} ready={ready}>
                <Workspace user={user!} onLogout={logout} toast={toast} />
              </Protected>
            }
          />
        ))}
        <Route
          path="*"
          element={<Navigate to={user ? `/${user.role}` : "/login"} replace />}
        />
      </Routes>
      {notice && (
        <div className="toast">
          <span className="toast-check">
            <Check size={15} />
          </span>
          {notice}
        </div>
      )}
    </>
  );
}

function Protected({
  user,
  role,
  ready,
  children,
}: {
  user: AppUser | null;
  role: Role;
  ready: boolean;
  children: React.ReactNode;
}) {
  return !ready ? (
    <SessionPending />
  ) : !user ? (
    <Navigate to="/login" replace />
  ) : user.role !== role ? (
    <Navigate to="/unauthorized" replace />
  ) : (
    <>{children}</>
  );
}

function Workspace({
  user,
  onLogout,
  toast,
}: {
  user: AppUser;
  onLogout: () => void;
  toast: (s: string) => void;
}) {
  const festDates = useFestDates();
  const festName = festDates?.title ?? "YUKTI";
  const festYear = festDates?.startsAt
    ? new Date(festDates.startsAt).getFullYear()
    : new Date().getFullYear();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [studentQuizzes, setStudentQuizzes] = useState<ApiQuiz[]>([]);
  const [quizAccessLoading, setQuizAccessLoading] = useState(
    user.role === "student",
  );
  useEffect(() => {
    if (user.role !== "student") return;
    void api
      .quizzes()
      .then(setStudentQuizzes)
      .catch(() => setStudentQuizzes([]))
      .finally(() => setQuizAccessLoading(false));
  }, [user.id, user.role]);
  const nav = navByRole[user.role].filter(
    (item) =>
      user.role !== "student" ||
      !["Quizzes", "Leaderboard"].includes(item.label) ||
      studentQuizzes.length > 0,
  );
  const base = `/${user.role}`;
  const title =
    location.pathname === `${base}/profile`
      ? "My profile"
      : nav.find((n) => location.pathname === n.path)?.label || nav[0].label;
  return (
    <div className={`app-shell role-${user.role}`}>
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <Link className="brand" to={base}>
          <span className="brand-mark">
            <Sparkles size={18} />
          </span>
          FestiQO<span className="brand-beta">{festYear}</span>
        </Link>
        <div className="workspace-switch">
          <div className="workspace-symbol">
            <Flame size={17} />
          </div>
          <div>
            <b>{festName}</b>
            <small>Annual Fest · {festYear}</small>
          </div>
          <ChevronDown size={15} />
        </div>
        <div className="side-label">WORKSPACE</div>
        <nav className="side-nav">
          {nav.map((item) => {
            const Icon = item.icon;
            const active =
              location.pathname === item.path ||
              (item.path !== base && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={active ? "active" : ""}
              >
                <Icon size={18} />
                {item.label}
                {item.label === "My tickets" && (
                  <span className="nav-count">1</span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="side-bottom">
          <div className="side-label">YOUR FEST</div>
          <button onClick={() => toast("Help center is ready for you")}>
            <CircleHelp size={18} />
            Help center
            <ExternalLink size={13} className="external" />
          </button>
          <div className="side-user">
            <img src={user.avatar} />
            <span>
              <b>{user.name}</b>
              <small>
                {user.role === "admin"
                  ? "Fest organizer"
                  : user.role === "volunteer"
                    ? "Volunteer team"
                    : "Student account"}
              </small>
            </span>
            <button aria-label="Sign out" onClick={onLogout}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      {mobileOpen && (
        <button
          aria-label="Close menu"
          className="mobile-scrim"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <main className="main-area">
        <header className="topbar">
          <button
            className="mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
          >
            <Menu />
          </button>
          <div className="crumb">
            FestiQO <span>/</span> <b>{title}</b>
          </div>
          <div className="top-actions">
            <ThemeToggle compact />
            <button
              className="icon-button top-search"
              aria-label="Search"
              onClick={() => setSearchOpen((v) => !v)}
            >
              <Search size={18} />
            </button>
            <button
              className="icon-button notification-trigger"
              aria-label="Notifications"
              onClick={() =>
                navigate(
                  user.role === "admin"
                    ? "/admin/notifications"
                    : `/${user.role}/notifications`,
                )
              }
            >
              <Bell size={18} />
              <i />
            </button>
            <span className="top-divider" />
            <button
              className="role-switch"
              title="View profile"
              aria-label="View profile"
              onClick={() => navigate(`${base}/profile`)}
            >
              <img src={user.avatar} />
              <ChevronDown size={14} />
            </button>
          </div>
        </header>
        {searchOpen && (
          <div className="quick-search">
            <Search size={17} />
            <input
              autoFocus
              placeholder="Search events, tickets, quizzes…"
              onKeyDown={(e) => {
                if (e.key === "Escape") setSearchOpen(false);
              }}
            />
            <kbd>ESC</kbd>
            <button
              onClick={() => setSearchOpen(false)}
              aria-label="Close search"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div className="page-content">
          <Routes>
            <Route path="/profile" element={<ProfilePage user={user} />} />
            <Route
              path="/"
              element={
                <Dashboard
                  user={user}
                  toast={toast}
                  studentQuizzes={studentQuizzes}
                />
              }
            />
            <Route
              path="/events"
              element={
                user.role === "student" ? (
                  <EventsPage toast={toast} />
                ) : (
                  <AdminEvents toast={toast} />
                )
              }
            />
            <Route path="/events/:id" element={<EventDetail toast={toast} />} />
            <Route path="/tickets" element={<TicketsPage toast={toast} />} />
            <Route
              path="/quizzes"
              element={
                user.role === "admin" ? (
                  <QuizBuilder toast={toast} />
                ) : user.role === "student" ? (
                  quizAccessLoading ? (
                    <p role="status">Checking quiz access…</p>
                  ) : studentQuizzes.length ? (
                    <QuizzesPage toast={toast} quizzes={studentQuizzes} />
                  ) : (
                    <Navigate to="/student" replace />
                  )
                ) : (
                  <Navigate to="/unauthorized" replace />
                )
              }
            />
            <Route
              path="/leaderboard"
              element={
                user.role === "student" && !quizAccessLoading ? (
                  studentQuizzes.length ? (
                    <LeaderboardPage />
                  ) : (
                    <Navigate to="/student" replace />
                  )
                ) : user.role === "student" ? (
                  <p role="status">Checking quiz access…</p>
                ) : (
                  <Navigate to="/unauthorized" replace />
                )
              }
            />
            <Route path="/scanner" element={<ScannerPage toast={toast} />} />
            <Route path="/logs" element={<ScanLogs />} />
            <Route path="/participants" element={<Participants />} />
            <Route
              path="/volunteers"
              element={
                user.role === "admin" ? (
                  <VolunteersPage toast={toast} />
                ) : (
                  <Navigate to="/unauthorized" replace />
                )
              }
            />
            <Route
              path="/certificates"
              element={
                user.role === "admin" ? (
                  <CertificatesPage toast={toast} />
                ) : user.role === "student" ? (
                  <section className="content-section">
                    <div className="section-heading">
                      <div>
                        <div className="eyebrow">YOUR FEST ACHIEVEMENTS</div>
                        <h2>My certificates</h2>
                      </div>
                    </div>
                    <StudentCertificates festName={festName} />
                  </section>
                ) : (
                  <Navigate to="/unauthorized" replace />
                )
              }
            />
            <Route
              path="/notifications"
              element={
                user.role === "admin" ? (
                  <Announcement toast={toast} />
                ) : (
                  <NotificationCenter />
                )
              }
            />
            <Route
              path="*"
              element={
                <Dashboard
                  user={user}
                  toast={toast}
                  studentQuizzes={studentQuizzes}
                />
              }
            />
          </Routes>
        </div>
      </main>
      <MobileNav nav={nav} path={location.pathname} />
    </div>
  );
}

function MobileNav({
  nav,
  path,
}: {
  nav: (typeof navByRole)[Role];
  path: string;
}) {
  return (
    <nav className="mobile-nav">
      {nav
        .filter((n) => n.label !== "Leaderboard" && n.label !== "Notifications")
        .slice(0, 4)
        .map((n) => {
          const Icon = n.icon;
          return (
            <Link
              key={n.path}
              to={n.path}
              className={path === n.path ? "active" : ""}
            >
              <Icon size={19} />
              <small>{n.label.split(" ")[0]}</small>
            </Link>
          );
        })}
    </nav>
  );
}

function Dashboard({
  user,
  toast,
  studentQuizzes,
}: {
  user: AppUser;
  toast: (s: string) => void;
  studentQuizzes: ApiQuiz[];
}) {
  if (user.role === "volunteer") return <VolunteerDashboard />;
  if (user.role === "admin") return <AdminDashboard toast={toast} />;
  return <StudentDashboard user={user} quizzes={studentQuizzes} />;
}

export default App;
