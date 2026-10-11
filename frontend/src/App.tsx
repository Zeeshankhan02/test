import { useEffect, useMemo, useState } from "react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import QRCode from "react-qr-code";
import {
  Activity,
  Archive,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Compass,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Flame,
  LayoutDashboard,
  LogOut,
  Menu,
  Music2,
  Plus,
  QrCode,
  ScanLine,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Ticket,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { api, type ApiQuiz, type ApiRegistration } from "./api";
import type { Event, Rank, Role, User, Notice } from "./types";
import LandingPage from "./LandingPage";
import ThemeToggle from "./ThemeToggle";
import type { TicketScanStatus } from "./ticketValidation";
import { useAuth } from "./AuthContext";
import { CertificatesPage, VolunteersPage } from "./AdminManagement";

type AppUser = User;

function useEvents() {
  const [items, setItems] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = () => {
    setLoading(true);
    void api
      .events()
      .then(setItems)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : "Could not load events.",
        ),
      )
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  return { items, loading, error, reload: load };
}
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

function SessionPending() {
  return (
    <main className="page-content" aria-live="polite">
      Restoring your session…
    </main>
  );
}

function Login({
  user,
  onLogin,
}: {
  user: AppUser | null;
  onLogin: (role: Role, email: string, password: string) => Promise<boolean>;
}) {
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetToken] = useState(() =>
    new URLSearchParams(window.location.search).get("reset"),
  );
  const [authMode, setAuthMode] = useState<"login" | "forgot" | "reset">(
    resetToken ? "reset" : "login",
  );
  const [notice, setNotice] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (user) navigate(`/${user.role}`);
  }, [user, navigate]);
  return (
    <div className="login-page">
      <div className="login-side">
        <div className="brand brand-light">
          <span className="brand-mark">
            <Sparkles size={18} />
          </span>
          FestiQO
        </div>
        <div className="login-promo">
          <div className="eyebrow light-eyebrow">
            <i /> CAMPUS, IN MOTION
          </div>
          <h1>
            Make this
            <br />
            one <em>unforgettable.</em>
          </h1>
          <p>
            One place for every big moment at your fest. Discover, show up, make
            your mark.
          </p>
          <div className="login-date">
            <CalendarDays size={17} /> OCT 15 — 17, 2026 <span /> YUKTI
          </div>
        </div>
        <div className="promo-foot">
          <div className="avatar-stack">
            <img src="https://i.pravatar.cc/80?img=11" />
            <img src="https://i.pravatar.cc/80?img=32" />
            <img src="https://i.pravatar.cc/80?img=12" />
            <b>+2.4k</b>
          </div>
          <span>students are already in</span>
        </div>
        <div className="orb orb-one" />
        <div className="orb orb-two" />
      </div>
      <div className="login-main">
        <div className="login-theme-toggle">
          <ThemeToggle compact />
        </div>
        <div className="mobile-brand brand">
          <span className="brand-mark">
            <Sparkles size={18} />
          </span>
          FestiQO
        </div>
        <form
          className="login-form"
          onSubmit={(event) => {
            event.preventDefault();
            setError("");
            setSubmitting(true);
            if (authMode === "forgot") {
              void api
                .requestPasswordReset(email)
                .then((result) => setNotice(result.message))
                .catch((cause: unknown) =>
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "Could not request password reset.",
                  ),
                )
                .finally(() => setSubmitting(false));
              return;
            }
            if (authMode === "reset" && resetToken) {
              void api
                .resetPassword(resetToken, password)
                .then(() => {
                  setNotice(
                    "Password changed. Sign in with your new password.",
                  );
                  setAuthMode("login");
                  window.history.replaceState({}, "", "/login");
                  setPassword("");
                })
                .catch((cause: unknown) =>
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "Could not reset password.",
                  ),
                )
                .finally(() => setSubmitting(false));
              return;
            }
            void onLogin(role, email, password)
              .then((valid) => {
                if (!valid)
                  setError(
                    "That account does not have access to the selected workspace.",
                  );
              })
              .catch((cause: unknown) =>
                setError(
                  cause instanceof Error ? cause.message : "Could not sign in.",
                ),
              )
              .finally(() => setSubmitting(false));
          }}
        >
          <div className="eyebrow">WELCOME TO YOUR FEST</div>
          <h2>
            Pick up where the
            <br />
            energy is.
          </h2>
          <p>Choose how you’d like to enter the platform.</p>
          {authMode !== "reset" && (
            <label className="auth-field">
              Email
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                placeholder="you@college.edu"
              />
            </label>
          )}
          {authMode !== "forgot" && (
            <label className="auth-field">
              {authMode === "reset" ? "New password" : "Password"}
              <span className="auth-password">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    authMode === "reset" ? "new-password" : "current-password"
                  }
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={12}
                  placeholder={
                    authMode === "reset"
                      ? "Enter a new password"
                      : "Enter your password"
                  }
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </label>
          )}
          {notice && <p role="status">{notice}</p>}
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          {authMode === "login" && (
            <div
              className="role-picker"
              role="group"
              aria-label="Choose a workspace"
            >
              {(["student", "volunteer", "admin"] as Role[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={role === item ? "selected" : ""}
                  onClick={() => setRole(item)}
                >
                  <span className="role-icon">
                    {item === "student" ? (
                      <Compass size={17} />
                    ) : item === "volunteer" ? (
                      <ScanLine size={17} />
                    ) : (
                      <Settings size={17} />
                    )}
                  </span>
                  <span>
                    <b>{item[0].toUpperCase() + item.slice(1)}</b>
                  </span>
                </button>
              ))}
            </div>
          )}
          <button
            className="btn btn-primary btn-wide"
            type="submit"
            disabled={submitting}
          >
            {submitting
              ? "Please wait..."
              : authMode === "forgot"
                ? "Send reset link"
                : authMode === "reset"
                  ? "Reset password"
                  : `Continue as ${role}`}
            <ArrowRight size={17} />
          </button>
          {authMode === "login" && (
            <button
              type="button"
              className="text-link"
              onClick={() => {
                setAuthMode("forgot");
                setNotice("");
                setError("");
              }}
            >
              Forgot password?
            </button>
          )}
          {authMode !== "login" && (
            <button
              type="button"
              className="text-link"
              onClick={() => {
                setAuthMode("login");
                setNotice("");
                setError("");
              }}
            >
              Back to sign in
            </button>
          )}
          {authMode === "login" && (
            <div className="login-terms signup-prompt">
              New to FestiQO? <Link to="/signup">Create a student account</Link>
            </div>
          )}
        </form>
        <div className="login-help">
          <CircleHelp size={15} /> Need a hand?{" "}
          <a href="mailto:hello@FestiQO.campus">Get in touch</a>
        </div>
      </div>
    </div>
  );
}

function SignupPage({ user }: { user: AppUser | null }) {
  const navigate = useNavigate();
  const { signupStudent } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const [success, setSuccess] = useState(false);
  useEffect(() => {
    if (user) navigate(`/${user.role}`);
  }, [user, navigate]);
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const next: typeof fieldErrors = {};
    if (!email.trim()) next.email = "Enter your email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      next.email = "Enter a valid email address.";
    if (!password) next.password = "Enter a password.";
    else if (password.length < 12)
      next.password = "Use at least 12 characters.";
    if (!confirmPassword) next.confirmPassword = "Confirm your password.";
    else if (password !== confirmPassword)
      next.confirmPassword = "Passwords don’t match.";
    setFieldErrors(next);
    if (Object.keys(next).length) return;
    setLoading(true);
    void signupStudent(email, password)
      .then(() => setSuccess(true))
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not create your account.",
        ),
      )
      .finally(() => setLoading(false));
  };
  return (
    <div className="login-page">
      <div className="login-side">
        <div className="brand brand-light">
          <span className="brand-mark">
            <Sparkles size={18} />
          </span>
          FestiQO
        </div>
        <div className="login-promo">
          <div className="eyebrow light-eyebrow">
            <i /> STUDENTS, THIS ONE’S YOURS
          </div>
          <h1>
            Find your
            <br />
            people <em>here.</em>
          </h1>
          <p>
            Create your student account and keep every event, ticket, and fest
            moment together.
          </p>
        </div>
        <div className="promo-foot">YUKTI · OCTOBER 15—17, 2026</div>
        <div className="orb orb-one" />
        <div className="orb orb-two" />
      </div>
      <div className="login-main">
        <div className="login-theme-toggle">
          <ThemeToggle compact />
        </div>
        <Link to="/" className="mobile-brand brand">
          <span className="brand-mark">
            <Sparkles size={18} />
          </span>
          FestiQO
        </Link>
        {success ? (
          <div className="login-form auth-success">
            <span className="auth-success-mark">
              <Check size={22} />
            </span>
            <div className="eyebrow">YOU’RE ON THE LIST</div>
            <h2>
              Your student account
              <br />
              is ready.
            </h2>
            <p>Sign in with the email and password you just created.</p>
            <Link className="btn btn-primary btn-wide" to="/login">
              Go to login <ArrowRight size={17} />
            </Link>
          </div>
        ) : (
          <form className="login-form signup-form" onSubmit={submit} noValidate>
            <div className="eyebrow">JOIN THE FEST</div>
            <h2>
              Create your
              <br />
              student account.
            </h2>
            <p>Just the basics. The good stuff starts after.</p>
            <label className="auth-field">
              Email
              <input
                type="email"
                autoComplete="email"
                aria-invalid={!!fieldErrors.email}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                placeholder="you@college.edu"
              />
              {fieldErrors.email && (
                <small className="auth-error">{fieldErrors.email}</small>
              )}
            </label>
            <label className="auth-field">
              Password
              <span className="auth-password">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  aria-invalid={!!fieldErrors.password}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
              {fieldErrors.password && (
                <small className="auth-error">{fieldErrors.password}</small>
              )}
            </label>
            <label className="auth-field">
              Confirm password
              <span className="auth-password">
                <input
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  aria-invalid={!!fieldErrors.confirmPassword}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  placeholder="Enter your password again"
                />
                <button
                  type="button"
                  aria-label={
                    showConfirm
                      ? "Hide confirm password"
                      : "Show confirm password"
                  }
                  onClick={() => setShowConfirm((value) => !value)}
                >
                  {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
              {fieldErrors.confirmPassword && (
                <small className="auth-error">
                  {fieldErrors.confirmPassword}
                </small>
              )}
            </label>
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="btn btn-primary btn-wide"
              type="submit"
              disabled={loading}
            >
              {loading ? "Creating account…" : "Create student account"}
              <ArrowRight size={17} />
            </button>
            <p className="auth-switch">
              Already have an account? <Link to="/login">Log in</Link>
            </p>
          </form>
        )}
        <div className="login-help">
          <CircleHelp size={15} /> Need a hand?{" "}
          <a href="mailto:hello@FestiQO.campus">Get in touch</a>
        </div>
      </div>
    </div>
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
    nav.find((n) => location.pathname === n.path)?.label || nav[0].label;
  return (
    <div className={`app-shell role-${user.role}`}>
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <Link className="brand" to={base}>
          <span className="brand-mark">
            <Sparkles size={18} />
          </span>
          FestiQO<span className="brand-beta">2026</span>
        </Link>
        <div className="workspace-switch">
          <div className="workspace-symbol">
            <Flame size={17} />
          </div>
          <div>
            <b>YUKTI</b>
            <small>Annual Fest · 2026</small>
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
              title="Switch demo role"
              onClick={() => onLogout()}
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
            <Route path="/" element={<Dashboard user={user} toast={toast} />} />
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
            <Route path="*" element={<Dashboard user={user} toast={toast} />} />
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
}: {
  user: AppUser;
  toast: (s: string) => void;
}) {
  if (user.role === "volunteer") return <VolunteerDashboard />;
  if (user.role === "admin") return <AdminDashboard toast={toast} />;
  return <StudentDashboard toast={toast} />;
}

function PageHead({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="head-action">{action}</div>}
    </div>
  );
}

function StudentDashboard({ toast }: { toast: (s: string) => void }) {
  const [filter, setFilter] = useState("All events");
  const { items: events, loading, error } = useEvents();
  const [registrations, setRegistrations] = useState<ApiRegistration[]>([]);
  const [registrationError, setRegistrationError] = useState("");
  useEffect(() => {
    void api
      .registrations()
      .then(setRegistrations)
      .catch((cause: unknown) =>
        setRegistrationError(
          cause instanceof Error
            ? cause.message
            : "Could not load registrations.",
        ),
      );
  }, []);
  const shown = useMemo(
    () =>
      events.filter((e) => filter === "All events" || e.category === filter),
    [filter],
  );
  return (
    <>
      <section className="hero">
        <div className="hero-text">
          <div className="eyebrow hero-eyebrow">
            <i /> YUKTI PRESENTS
          </div>
          <h1>
            Where ideas
            <br />
            meet <em>energy.</em>
          </h1>
          <p>
            Three days of big ideas, new faces and moments that stay with you.
            Your fest starts here.
          </p>
          <div className="hero-buttons">
            <Link className="btn btn-white" to="/student/events">
              Explore events <ArrowRight size={16} />
            </Link>
            <Link className="btn btn-glass" to="/student/tickets">
              My tickets <Ticket size={16} />
            </Link>
          </div>
          <div className="hero-meta">
            <span>
              <CalendarDays size={15} /> OCT 15 — 17, 2026
            </span>
            <span className="meta-divider" />
            <span>
              <Users size={15} /> 2,400+ joining
            </span>
          </div>
        </div>
        <div className="hero-art">
          <div className="hero-photo" />
          <div className="hero-chip chip-top">
            <span className="live-dot" /> 3 DAYS OF WHAT’S NEXT
          </div>
          <div className="hero-sticker">
            <span>
              THINK
              <br />
              BIG.
            </span>
            <Sparkles size={20} />
          </div>
          <div className="hero-chip chip-bottom">
            <span className="chip-icon">
              <Music2 size={14} />
            </span>
            TECH · MUSIC · CULTURE
          </div>
        </div>
      </section>
      <section className="stats-row">
        <Stat
          label="Your registrations"
          value={String(registrations.length).padStart(2, "0")}
          detail={
            registrations.length === 1
              ? "One event on your list"
              : "Events on your list"
          }
          icon={<Ticket size={18} />}
          tone="lavender"
        />
        <Stat
          label="Fest starts in"
          value="19 days"
          detail="Thursday, October 15"
          icon={<Clock3 size={18} />}
          tone="peach"
        />
        <Stat
          label="Your quiz rank"
          value="#04"
          detail="Up 2 places this week"
          icon={<Trophy size={18} />}
          tone="mint"
        />
      </section>
      <section className="content-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">FIND YOUR THING</div>
            <h2>Made for your kind of curious.</h2>
            <p>Pick a lane or let the day surprise you.</p>
          </div>
          <Link className="text-link" to="/student/events">
            All events <ArrowRight size={16} />
          </Link>
        </div>
        <div className="filter-row">
          {["All events", "Technical", "Music", "Creative"].map((x) => (
            <button
              className={`filter-pill ${x === filter ? "selected" : ""}`}
              key={x}
              onClick={() => setFilter(x)}
            >
              {x === "Music" ? (
                <Music2 size={14} />
              ) : x === "Technical" ? (
                <Activity size={14} />
              ) : null}
              {x}
            </button>
          ))}
        </div>
        <div className="event-grid">
          {shown.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
        {loading && <p role="status">Loading published events…</p>}
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        {!loading && !error && !shown.length && (
          <Empty
            icon={<Compass />}
            title="No published events yet"
            text="Check back when the fest team publishes its lineup."
          />
        )}
      </section>
      <section className="bottom-grid">
        <div className="next-event-card">
          <div className="next-label">
            <span className="live-dot purple-dot" /> NEXT UP FOR YOU
          </div>
          {registrationError && (
            <p className="auth-error" role="alert">
              {registrationError}
            </p>
          )}
          {registrations[0] ? (
            <div className="next-body">
              <div>
                <span className="category-tag">
                  {events.find((event) => event.id === registrations[0].eventId)
                    ?.category || "EVENT"}
                </span>
                <h3>
                  {events.find((event) => event.id === registrations[0].eventId)
                    ?.title || "Your registered event"}
                </h3>
                <p>
                  {registrations[0].teamName || "Individual registration"} ·
                  Registration confirmed
                </p>
                <div className="next-details">
                  <span>
                    <CalendarDays size={14} />{" "}
                    {new Date(registrations[0].createdAt).toLocaleDateString()}
                  </span>
                  <span>
                    <Ticket size={14} /> Ticket ready
                  </span>
                </div>
              </div>
              <Link to="/student/tickets" className="btn btn-dark">
                Open ticket <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            !registrationError && (
              <p>You haven’t registered for an event yet.</p>
            )
          )}
        </div>
        <div className="mini-notice">
          <div className="mini-notice-top">
            <span className="eyebrow">IN THE LOOP</span>
            <button
              className="icon-button"
              onClick={() => toast("No new announcements")}
            >
              <ArrowRight size={16} />
            </button>
          </div>
          <h3>Quiz Results Out</h3>
          <p>
            Results for Tech Trivia just landed. You’re sitting at <b>#4</b> on
            the leaderboard.
          </p>
          <span className="notice-time">
            <span className="notice-dot" /> 2 hours ago
          </span>
        </div>
      </section>
    </>
  );
}
function Stat({
  label,
  value,
  detail,
  icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <div className="stat-card">
      <span className={`stat-icon ${tone}`}>{icon}</span>
      <span className="stat-label">{label}</span>
      <b className="stat-value">{value}</b>
      <small>{detail}</small>
    </div>
  );
}

function EventCard({ event }: { event: Event }) {
  return (
    <article className="event-card">
      <Link
        to={`/student/events/${event.id}`}
        className="event-image"
        style={{ backgroundImage: `url(${event.image})` }}
      >
        <span className="category-tag">{event.category}</span>
        <button className="event-save" aria-label="Save event">
          <Sparkles size={15} />
        </button>
      </Link>
      <div className="event-info">
        <div className="event-title-row">
          <Link to={`/student/events/${event.id}`}>
            <h3>{event.title}</h3>
          </Link>
          <span className="event-arrow">
            <ArrowUpRight size={16} />
          </span>
        </div>
        <p>{event.description}</p>
        <div className="event-where">
          <span>
            <CalendarDays size={14} />
            {new Date(`${event.date}T00:00:00`).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}{" "}
            · {event.time}
          </span>
          <span>
            <Compass size={14} />
            {event.venue}
          </span>
        </div>
        <div className="event-footer">
          <span className="capacity">
            <span className="capacity-bar">
              <i
                style={{
                  width: `${(event.registered / event.maxParticipants) * 100}%`,
                }}
              />
            </span>
            {event.registered} / {event.maxParticipants} spots
          </span>
          <Link to={`/student/events/${event.id}`} className="small-link">
            View event <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </article>
  );
}

function EventsPage({ toast }: { toast: (s: string) => void }) {
  const [cat, setCat] = useState("All events");
  const [q, setQ] = useState("");
  const { items: events, loading, error, reload } = useEvents();
  const found = events.filter(
    (e) =>
      (cat === "All events" || e.category === cat) &&
      e.title.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <PageHead
        eyebrow="THE FULL LINEUP"
        title="Explore events"
        description="Find the thing you’ll be talking about next week."
        action={
          <button
            className="btn btn-dark"
            onClick={() => toast("Event calendar downloaded")}
          >
            <Download size={16} /> Calendar
          </button>
        }
      />
      <div className="events-tools">
        <div className="inline-search">
          <Search size={17} />
          <input
            placeholder="Search events"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="filter-row">
          {["All events", "Technical", "Music", "Creative"].map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`filter-pill ${cat === c ? "selected" : ""}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <div className="event-grid">
        {found.map((e) => (
          <EventCard key={e.id} event={e} />
        ))}
      </div>
      {loading && <p role="status">Loading published events…</p>}
      {error && (
        <div role="alert" className="auth-error">
          {error}{" "}
          <button className="btn btn-outline" onClick={reload}>
            Retry
          </button>
        </div>
      )}
      {!loading && !error && !found.length && (
        <Empty
          icon={<Compass />}
          title="No events found"
          text="Try a different event name or category."
        />
      )}
    </>
  );
}

function EventDetail({ toast }: { toast: (s: string) => void }) {
  const eventId = window.location.pathname.split("/").pop() || "";
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    void api
      .event(eventId)
      .then(setEvent)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : "Could not load event.",
        ),
      )
      .finally(() => setLoading(false));
  }, [eventId]);
  const { user } = useAuth();
  const [registering, setRegistering] = useState(false);
  const [registrationStatus, setRegistrationStatus] = useState<
    "checking" | "available" | "registered" | "error"
  >("checking");
  useEffect(() => {
    setRegistrationStatus("checking");
    void api
      .registrations()
      .then((rows) =>
        setRegistrationStatus(
          rows.some((registration) => registration.eventId === eventId)
            ? "registered"
            : "available",
        ),
      )
      .catch(() => setRegistrationStatus("error"));
  }, [eventId]);
  if (loading) return <p role="status">Loading event…</p>;
  if (error || !event)
    return (
      <Empty
        icon={<Compass />}
        title="Event unavailable"
        text={error || "This event may no longer be published."}
      />
    );
  const register = async () => {
    if (!user || registering || registrationStatus !== "available") return;
    setRegistering(true);
    try {
      await api.register(event.id, [user.name]);
      setRegistrationStatus("registered");
      toast(`You’re registered for ${event.title}. Your ticket is ready.`);
    } catch (cause) {
      toast(
        cause instanceof Error
          ? cause.message
          : "Could not register for this event.",
      );
    } finally {
      setRegistering(false);
    }
  };
  return (
    <>
      <Link to="/student/events" className="back-link">
        ← All events
      </Link>
      <div
        className="detail-hero"
        style={{
          backgroundImage: `linear-gradient(90deg,rgba(14,22,35,.88),rgba(14,22,35,.1)),url(${event.image})`,
        }}
      >
        <span className="category-tag">{event.category}</span>
        <h1>{event.title}</h1>
        <p>{event.description}</p>
      </div>
      <div className="detail-layout">
        <div className="detail-main">
          <h2>About this event</h2>
          <p className="body-copy">
            Bring your curiosity, your favorite people, and an open mind. This
            is a space to make something, meet someone, and leave with a story
            worth sharing. All experience levels are welcome.
          </p>
          <h3>What to expect</h3>
          <div className="expect-grid">
            <span>
              <Sparkles /> Hands-on experiences
            </span>
            <span>
              <Users /> Meet your people
            </span>
            <span>
              <Trophy /> Prizes & bragging rights
            </span>
          </div>
        </div>
        <aside className="register-card">
          <span className="eyebrow">SAVE YOUR SPOT</span>
          <h3>Everything you need to know.</h3>
          <p>
            <CalendarDays />
            {new Date(`${event.date}T00:00:00`).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}{" "}
            · {event.time}
          </p>
          <p>
            <Compass />
            {event.venue}
          </p>
          <p>
            <Users />
            {event.registered} of {event.maxParticipants} spots filled
          </p>
          <button
            className="btn btn-dark btn-wide"
            onClick={() => void register()}
            disabled={
              registering ||
              registrationStatus === "checking" ||
              registrationStatus === "registered" ||
              registrationStatus === "error"
            }
          >
            {registrationStatus === "registered"
              ? "Already registered"
              : registrationStatus === "checking"
                ? "Checking registration…"
                : registrationStatus === "error"
                  ? "Registration unavailable"
                  : registering
                    ? "Registering…"
                    : "Register for free"}{" "}
            <ArrowRight size={16} />
          </button>
          <small>
            {registrationStatus === "error"
              ? "Could not verify your registration. Refresh the page to try again."
              : "No payment required · Limited spots available"}
          </small>
        </aside>
      </div>
    </>
  );
}

function TicketsPage({ toast }: { toast: (s: string) => void }) {
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
          text="Register for a published event and your ticket will appear here."
        />
      ) : (
        tickets.map(({ ticket, registration, event }) => (
          <div className="ticket-layout" key={ticket._id}>
            <div className="ticket-card">
              <div className="ticket-main">
                <div className="ticket-head">
                  <span className="category-tag">TECHNICAL · TEAM EVENT</span>
                  <span className="status-badge">
                    <i /> {ticket.status.replace("_", " ").toUpperCase()}
                  </span>
                </div>
                <h2>{event.title}</h2>
                <p className="ticket-sub">{event.description}</p>
                <div className="ticket-details">
                  <div>
                    <span>DATE & TIME</span>
                    <b>
                      {new Date(`${event.date}T00:00:00`).toLocaleDateString()}{" "}
                      · {event.time}
                    </b>
                  </div>
                  <div>
                    <span>VENUE</span>
                    <b>{event.venue}</b>
                  </div>
                  <div>
                    <span>PARTICIPANT</span>
                    <b>{user?.name}</b>
                  </div>
                  <div>
                    <span>TEAM</span>
                    <b>
                      {registration.teamName || "Individual"} ·{" "}
                      {registration.members.length} member
                      {registration.members.length === 1 ? "" : "s"}
                    </b>
                  </div>
                </div>
              </div>
              <div className="ticket-stub">
                <div className="perforation" />
                <div className="qr-box">
                  <QRCode
                    value={ticket.credential}
                    size={138}
                    bgColor="#fff"
                    fgColor="#171c27"
                  />
                </div>
                <span className="ticket-number">{ticket._id}</span>
                <small>Present this QR at the entrance</small>
              </div>
              <div className="ticket-notch top" />
              <div className="ticket-notch bottom" />
            </div>
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
            <div className="ticket-help">
              <ShieldCheck size={17} />
              <span>
                <b>Keep your ticket close.</b> This QR code is unique to you and
                can only be scanned once at entry.
              </span>
            </div>
          </div>
        ))
      )}
    </>
  );
}

function QuizzesPage({
  toast,
  quizzes,
}: {
  toast: (s: string) => void;
  quizzes: ApiQuiz[];
}) {
  const [quiz, setQuiz] = useState<import("./api").ApiQuiz | null>(null);
  const [attemptId, setAttemptId] = useState("");
  const [answers, setAnswers] = useState<number[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [score, setScore] = useState<{ score: number; total: number } | null>(
    null,
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const active = quizzes[0];
  useEffect(() => {
    if (!quiz) return;
    const timer = window.setInterval(
      () => setSeconds((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [quiz]);
  useEffect(() => {
    if (quiz && seconds === 0) setQuiz(null);
  }, [quiz, seconds]);
  const start = async () => {
    if (!active || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.startQuiz(active._id);
      setQuiz({ ...result.quiz, _id: active._id, status: "published" });
      setAttemptId(result.attemptId);
      setAnswers([]);
      setQuestionIndex(0);
      setScore(null);
      setSeconds(result.quiz.durationSeconds);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not start quiz.",
      );
    } finally {
      setBusy(false);
    }
  };
  const submit = async () => {
    if (
      !quiz ||
      !attemptId ||
      answers.length !== quiz.questions.length ||
      answers.some((value) => value === undefined)
    ) {
      setError("Answer every question before submitting.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      setScore(await api.submitQuiz(attemptId, answers));
      setQuiz(null);
      toast("Quiz submitted. Your score is ready.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not submit quiz.",
      );
    } finally {
      setBusy(false);
    }
  };
  const question = quiz?.questions[questionIndex];
  return (
    <>
      <PageHead
        eyebrow="PUT YOUR BRAIN IN THE GAME"
        title="Quizzes"
        description="Quick rounds, good bragging rights. See what you know."
      />
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      {!active && !quiz ? (
        <Empty
          icon={<CircleHelp />}
          title="No live quizzes"
          text="Published quizzes will appear here."
        />
      ) : (
        <div className="quiz-feature">
          <div className="quiz-cover">
            <div className="quiz-orbit orbit-a" />
            <div className="quiz-orbit orbit-b" />
            <div className="quiz-cover-content">
              <span className="quiz-badge">
                <Sparkles size={14} /> LIVE QUIZ
              </span>
              <div className="quiz-big-icon">
                <CircleHelp size={33} />
              </div>
              <span className="quiz-cover-note">
                {quiz
                  ? `QUESTION ${questionIndex + 1} / ${quiz.questions.length}`
                  : "READY TO PLAY"}
              </span>
            </div>
            <div className="quiz-spark">✳</div>
          </div>
          <div className="quiz-content">
            <div className="quiz-meta">
              <span>GENERAL KNOWLEDGE</span>
              <span>·</span>
              <span>
                <Clock3 size={13} />{" "}
                {quiz?.durationSeconds ?? active?.durationSeconds ?? 0} SEC
              </span>
              <span>·</span>
              <span>
                {quiz?.questions.length ?? active?.questions.length ?? 0}{" "}
                QUESTIONS
              </span>
            </div>
            <h2>{quiz?.title || active?.title}</h2>
            <p>
              Choose your answers before the timer runs out. Your score is
              calculated by the server.
            </p>
            {quiz && question ? (
              <div className="quiz-question">
                <div className="quiz-progress">
                  <span>
                    QUESTION {questionIndex + 1} OF {quiz.questions.length}
                  </span>
                  <b className={seconds < 15 ? "timer-warning" : ""}>
                    <Clock3 size={14} />{" "}
                    {Math.floor(seconds / 60)
                      .toString()
                      .padStart(2, "0")}
                    :{String(seconds % 60).padStart(2, "0")}
                  </b>
                </div>
                <div className="progress-track">
                  <i
                    style={{
                      width: `${((questionIndex + 1) / quiz.questions.length) * 100}%`,
                    }}
                  />
                </div>
                <h3>{question.text}</h3>
                <div className="answer-options">
                  {question.options.map((option, index) => (
                    <button
                      key={option}
                      className={
                        answers[questionIndex] === index ? "chosen" : ""
                      }
                      onClick={() =>
                        setAnswers((current) =>
                          current
                            .map((answer, i) =>
                              i === questionIndex ? index : answer,
                            )
                            .concat(
                              current.length <= questionIndex ? [index] : [],
                            ),
                        )
                      }
                    >
                      <span>{String.fromCharCode(65 + index)}</span>
                      {option}
                      {answers[questionIndex] === index && <Check size={15} />}
                    </button>
                  ))}
                </div>
                <div className="question-actions">
                  <button
                    className="btn btn-outline"
                    disabled={questionIndex === 0}
                    onClick={() => setQuestionIndex((current) => current - 1)}
                  >
                    Previous
                  </button>
                  {questionIndex < quiz.questions.length - 1 ? (
                    <button
                      className="btn btn-dark"
                      disabled={answers[questionIndex] === undefined}
                      onClick={() => setQuestionIndex((current) => current + 1)}
                    >
                      Next question <ArrowRight size={15} />
                    </button>
                  ) : (
                    <button
                      className="btn btn-dark"
                      disabled={
                        busy || answers.length !== quiz.questions.length
                      }
                      onClick={() => void submit()}
                    >
                      {busy ? "Submitting…" : "Submit quiz"}{" "}
                      <ArrowRight size={15} />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <button
                className="btn btn-dark"
                disabled={busy}
                onClick={() => void start()}
              >
                {busy ? "Starting…" : "Start the quiz"} <ArrowRight size={16} />
              </button>
            )}
            {score && (
              <div className="quiz-bottom">
                <b>
                  Your score: {score.score} / {score.total}
                </b>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function LeaderboardPage() {
  const [rows, setRows] = useState<Rank[]>([]);
  const [error, setError] = useState("");
  const { user } = useAuth();
  useEffect(() => {
    void api
      .quizzes()
      .then(async (quizzes) => {
        if (!quizzes[0]) return [];
        return api.leaderboard(quizzes[0]._id);
      })
      .then((result) =>
        setRows(
          result.map((row) => ({
            ...row,
            timeTaken: new Date(row.submittedAt).toLocaleTimeString(),
          })),
        ),
      )
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load leaderboard.",
        ),
      );
  }, []);
  return (
    <>
      <PageHead
        eyebrow="FRIENDLY COMPETITION"
        title="Leaderboard"
        description="A little healthy competition never hurt. Keep climbing."
        action={
          <button className="btn btn-outline">
            <CalendarDays size={15} /> This week <ChevronDown size={14} />
          </button>
        }
      />
      <div className="leaderboard-shell">
        {rows.length > 0 && (
          <div className="podium">
            {[rows[1], rows[0], rows[2]]
              .filter((row): row is Rank => !!row)
              .map((row, index) => (
                <Podium
                  key={row.rank}
                  user={row.userName}
                  score={String(row.score)}
                  place={index === 0 ? 2 : index === 1 ? 1 : 3}
                  img={`https://i.pravatar.cc/100?u=${encodeURIComponent(row.userName)}`}
                />
              ))}
          </div>
        )}
        <div className="rank-table">
          <div className="rank-header">
            <span>RANK</span>
            <span>PARTICIPANT</span>
            <span>SCORE</span>
            <span>TIME</span>
            <span>TREND</span>
          </div>
          {rows.map((r, i) => (
            <div
              className={`rank-row ${r.userName === user?.name ? "you" : ""}`}
              key={r.rank}
            >
              <b className="rank-num">{String(r.rank).padStart(2, "0")}</b>
              <div className="rank-person">
                <img
                  src={`https://i.pravatar.cc/80?u=${encodeURIComponent(r.userName)}`}
                />
                <b>
                  {r.userName}
                  {r.userName === user?.name && <small>YOU</small>}
                </b>
              </div>
              <b className="rank-score">
                {r.score.toLocaleString()} <small>pts</small>
              </b>
              <span className="rank-time">{r.timeTaken}</span>
              <span className="rank-trend">
                {i < 3 ? (
                  <ArrowUpRight size={16} />
                ) : (
                  <ArrowDownRight size={16} />
                )}
              </span>
            </div>
          ))}
        </div>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        {!rows.length && !error && (
          <p>No quiz scores have been submitted yet.</p>
        )}
        <div className="leader-foot">
          <span>
            <span className="live-dot" /> Updated just now
          </span>
          <span>Scoring resets in 4 days</span>
        </div>
      </div>
    </>
  );
}
function Podium({
  user,
  score,
  place,
  img,
}: {
  user: string;
  score: string;
  place: number;
  img: string;
}) {
  return (
    <div className={`podium-person place-${place}`}>
      <div className="podium-avatar">
        <img src={img} />
        {place === 1 && <span>✦</span>}
      </div>
      <b>{user}</b>
      <small>{score} pts</small>
      <div className="podium-step">
        <span>{place === 1 ? "1ST" : place === 2 ? "2ND" : "3RD"}</span>
      </div>
    </div>
  );
}

function VolunteerDashboard() {
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
function ScanLogItem({
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

function ScannerPage({ toast }: { toast: (s: string) => void }) {
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

function ScanLogs() {
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

function AdminDashboard({ toast }: { toast: (s: string) => void }) {
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

function AdminEvents({ toast }: { toast: (s: string) => void }) {
  const [list, setList] = useState<Event[]>([]);
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Technical");
  const [description, setDescription] = useState("");
  const [venue, setVenue] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [capacity, setCapacity] = useState(100);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    void api
      .events()
      .then(setList)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : "Could not load events.",
        ),
      );
  }, []);
  return (
    <>
      <PageHead
        eyebrow="MAKE IT HAPPEN"
        title="Events"
        description="Create the moments your campus will remember."
        action={
          <button
            className="btn btn-dark"
            onClick={() => {
              setEditingId(null);
              setModal(true);
            }}
          >
            <Plus size={16} /> Create event
          </button>
        }
      />
      <div className="admin-list">
        {list.map((e) => (
          <div className="admin-event-row" key={e.id}>
            <img src={e.image || undefined} />
            <span>
              <b>{e.title}</b>
              <small>
                {e.category} · {e.date} · {e.venue}
              </small>
            </span>
            <span className="admin-event-count">
              {e.registered} <small>/ {e.maxParticipants} registered</small>
            </span>
            <span className="status-badge">
              <i /> {e.status.toUpperCase()}
            </span>
            <button
              className="icon-button"
              aria-label="Edit event"
              onClick={() => {
                setError("");
                void api
                  .eventRecord(e.id)
                  .then((record) => {
                    setEditingId(e.id);
                    setName(record.title);
                    setCategory(record.category);
                    setDescription(record.description);
                    setVenue(record.venue);
                    const localDate = (value: string) => {
                      const date = new Date(value);
                      date.setMinutes(
                        date.getMinutes() - date.getTimezoneOffset(),
                      );
                      return date.toISOString().slice(0, 16);
                    };
                    setStartsAt(localDate(record.startsAt));
                    setEndsAt(localDate(record.endsAt));
                    setCapacity(record.capacity);
                    setModal(true);
                  })
                  .catch((cause: unknown) =>
                    setError(
                      cause instanceof Error
                        ? cause.message
                        : "Could not load event.",
                    ),
                  );
              }}
            >
              <Settings size={16} />
            </button>
            {!["cancelled", "archived", "ended"].includes(e.status) && (
              <button
                className="icon-button"
                aria-label="Cancel event"
                onClick={() =>
                  void api
                    .cancelEvent(e.id)
                    .then((event) => {
                      setList((current) =>
                        current.map((item) =>
                          item.id === event.id ? event : item,
                        ),
                      );
                      toast("Event cancelled");
                    })
                    .catch((cause: unknown) =>
                      setError(
                        cause instanceof Error
                          ? cause.message
                          : "Could not cancel event.",
                      ),
                    )
                }
              >
                <X size={16} />
              </button>
            )}
            {["cancelled", "ended"].includes(e.status) && (
              <button
                className="icon-button"
                aria-label="Archive event"
                onClick={() =>
                  void api
                    .archiveEvent(e.id)
                    .then((event) => {
                      setList((current) =>
                        current.map((item) =>
                          item.id === event.id ? event : item,
                        ),
                      );
                      toast("Event archived");
                    })
                    .catch((cause: unknown) =>
                      setError(
                        cause instanceof Error
                          ? cause.message
                          : "Could not archive event.",
                      ),
                    )
                }
              >
                <Archive size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      {modal && (
        <Modal
          title={editingId ? "Edit event" : "Create an event"}
          close={() => {
            setModal(false);
            setEditingId(null);
          }}
        >
          <label>
            Event name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. The Big Idea"
            />
          </label>
          <label>
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option>Technical</option>
              <option>Music</option>
              <option>Creative</option>
            </select>
          </label>
          <label>
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What will guests experience?"
            />
          </label>
          <label>
            Venue
            <input
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              required
              placeholder="Main Auditorium"
            />
          </label>
          <label>
            Starts
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              required
            />
          </label>
          <label>
            Ends
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              required
            />
          </label>
          <label>
            Capacity
            <input
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              required
            />
          </label>
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button className="btn btn-outline" onClick={() => setModal(false)}>
              Cancel
            </button>
            <button
              className="btn btn-dark"
              disabled={
                saving ||
                !name.trim() ||
                !description.trim() ||
                !venue.trim() ||
                !startsAt ||
                !endsAt
              }
              onClick={() => {
                setSaving(true);
                setError("");
                const payload = {
                  title: name.trim(),
                  category,
                  description: description.trim(),
                  venue: venue.trim(),
                  startsAt: new Date(startsAt).toISOString(),
                  endsAt: new Date(endsAt).toISOString(),
                  capacity,
                  teamMin: 1,
                  teamMax: 1,
                };
                const save = editingId
                  ? api.updateEvent(editingId, payload)
                  : api
                      .createEvent(payload)
                      .then((draft) => api.publishEvent(draft.id));
                void save
                  .then((saved) => {
                    setList((current) =>
                      editingId
                        ? current.map((event) =>
                            event.id === saved.id ? saved : event,
                          )
                        : [saved, ...current],
                    );
                    setModal(false);
                    setEditingId(null);
                    setName("");
                    setDescription("");
                    setVenue("");
                    setStartsAt("");
                    setEndsAt("");
                    toast("Event published");
                  })
                  .catch((cause: unknown) =>
                    setError(
                      cause instanceof Error
                        ? cause.message
                        : "Could not create event.",
                    ),
                  )
                  .finally(() => setSaving(false));
              }}
            >
              {saving ? "Saving…" : "Publish event"} <ArrowRight size={15} />
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function Participants() {
  const [rows, setRows] = useState<ApiRegistration[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [dashboard, setDashboard] = useState<Awaited<
    ReturnType<typeof api.dashboard>
  > | null>(null);
  const [query, setQuery] = useState("");
  const [eventId, setEventId] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    void Promise.all([api.events(), api.dashboard()])
      .then(([items, stats]) => {
        setEvents(items);
        setDashboard(stats);
      })
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load participants.",
        ),
      );
  }, []);
  useEffect(() => {
    void api
      .participants({ eventId, status, limit: 100 })
      .then(setRows)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load participants.",
        ),
      );
  }, [eventId, status]);
  const visible = rows.filter((row) => {
    const person =
      typeof row.userId === "string"
        ? row.userId
        : `${row.userId.name} ${row.userId.email}`;
    return `${person} ${row.teamName || ""}`
      .toLowerCase()
      .includes(query.toLowerCase());
  });
  const download = () => {
    const csv = [
      "Participant,Email,Event,Team,Registered,Status",
      ...visible.map((row) => {
        const user =
          typeof row.userId === "string"
            ? { name: row.userId, email: "" }
            : row.userId;
        const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
        return [
          user.name,
          user.email,
          events.find((item) => item.id === row.eventId)?.title || "",
          row.teamName || "",
          row.createdAt,
          row.status,
        ]
          .map(quote)
          .join(",");
      }),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "fest-participants.csv";
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <PageHead
        eyebrow="YOUR COMMUNITY, IN ONE PLACE"
        title="Participants"
        description="A live look at everyone showing up for the fest."
        action={
          <button className="btn btn-outline" onClick={download}>
            <Download size={15} /> Export list
          </button>
        }
      />
      <div className="participant-stats">
        <Stat
          label="Registered"
          value={String(dashboard?.registrations ?? "—")}
          detail={`Across ${dashboard?.events ?? 0} events`}
          icon={<Users />}
          tone="lavender"
        />
        <Stat
          label="Teams"
          value={String(dashboard?.teamRegistrations ?? "—")}
          detail="Team registrations"
          icon={<Flame />}
          tone="peach"
        />
        <Stat
          label="Checked in"
          value={String(dashboard?.checkIns ?? "—")}
          detail="Tickets checked in"
          icon={<Check />}
          tone="mint"
        />
      </div>
      <div className="logs-card">
        <div className="logs-toolbar">
          <div className="inline-search">
            <Search size={16} />
            <input
              placeholder="Search participants"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <select
            className="btn btn-outline"
            aria-label="Filter by event"
            value={eventId}
            onChange={(event) => setEventId(event.target.value)}
          >
            <option value="">All events</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title}
              </option>
            ))}
          </select>
          <select
            className="btn btn-outline"
            aria-label="Filter by status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">Any status</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="logs-table">
          <div className="participant-head">
            <span>PARTICIPANT</span>
            <span>EVENT / TEAM</span>
            <span>REGISTERED</span>
            <span>STATUS</span>
          </div>
          {visible.map((row) => {
            const person =
              typeof row.userId === "string"
                ? { name: row.userId, email: "" }
                : row.userId;
            const event = events.find((item) => item.id === row.eventId);
            return (
              <div className="participant-row" key={row._id}>
                <div className="logs-participant">
                  <span className="participant-avatar">
                    {person.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span>
                    <b>{person.name}</b>
                    <small>{person.email}</small>
                  </span>
                </div>
                <span>
                  <b>{event?.title || "Event"}</b>
                  <small>{row.teamName || "Individual registration"}</small>
                </span>
                <span className="logs-time">
                  {new Date(row.createdAt).toLocaleDateString()}
                </span>
                <span className="status-valid">
                  <i />
                  {row.status}
                </span>
              </div>
            );
          })}
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          {!error && !visible.length && (
            <p>No participants match these filters.</p>
          )}
        </div>
      </div>
    </>
  );
}

type QuizDraftQuestion = { text: string; options: string[]; correct: number };

function QuizBuilder({ toast }: { toast: (s: string) => void }) {
  const [title, setTitle] = useState("");
  const [eventId, setEventId] = useState("");
  const [events, setEvents] = useState<Event[]>([]);
  const [eventsError, setEventsError] = useState("");
  const [duration, setDuration] = useState(60);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correct, setCorrect] = useState(0);
  const [extra, setExtra] = useState<string[]>([]);
  const [additionalQuestions, setAdditionalQuestions] = useState<
    QuizDraftQuestion[]
  >([]);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    void api
      .events({ limit: 100 })
      .then(setEvents)
      .catch((cause: unknown) =>
        setEventsError(
          cause instanceof Error ? cause.message : "Could not load events.",
        ),
      );
  }, []);
  return (
    <>
      <PageHead
        eyebrow="BUILD A LITTLE FRIENDLY COMPETITION"
        title="Quiz builder"
        description="Give curious minds something fun to get into."
        action={
          <button className="btn btn-outline" onClick={() => setPreview(true)}>
            <Eye size={15} /> Preview
          </button>
        }
      />
      <div className="builder-layout">
        <div className="builder-main">
          <div className="builder-settings panel bg-white text-zinc-900 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-800">
            <label>
              QUIZ EVENT
              <select
                className="bg-white text-zinc-900 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700"
                value={eventId}
                onChange={(event) => setEventId(event.target.value)}
                required
              >
                <option value="">Choose an event</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title}
                  </option>
                ))}
              </select>
              {eventsError && <small role="alert">{eventsError}</small>}
            </label>
            <label>
              QUIZ TITLE
              <input
                className="bg-white text-zinc-900 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label>
              DURATION
              <select
                className="bg-white text-zinc-900 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              >
                <option value={30}>30 seconds per question</option>
                <option value={60}>60 seconds per question</option>
                <option value={90}>90 seconds per question</option>
              </select>
            </label>
          </div>
          <div className="builder-question panel bg-white text-zinc-900 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-800">
            <div className="builder-question-head">
              <span>QUESTION 01</span>
              <button
                className="icon-button dark:text-zinc-200 dark:hover:bg-zinc-800"
                aria-label="Remove question"
                onClick={() => toast("Keep at least one question in the quiz")}
              >
                <X size={15} />
              </button>
            </div>
            <label className="field-label">
              QUESTION TEXT
              <input
                className="bg-white text-zinc-900 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Write a question"
              />
            </label>
            <div className="builder-options-head">
              <span className="field-label">ANSWER OPTIONS</span>
              <span className="correct-caption">SELECT THE CORRECT ANSWER</span>
            </div>
            {options.map((option, i) => (
              <div
                className={`builder-option text-zinc-800 dark:text-zinc-200 dark:border-zinc-700 ${
                  correct === i ? "correct" : ""
                }`}
                key={i}
              >
                <button
                  className="radio-dot"
                  aria-label={`Set option ${i + 1} as correct`}
                  onClick={() => setCorrect(i)}
                />
                <input
                  value={option}
                  className="bg-white text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                  onChange={(e) =>
                    setOptions(
                      options.map((v, j) => (j === i ? e.target.value : v)),
                    )
                  }
                />
                {correct === i && (
                  <span>
                    <Check size={12} /> Correct
                  </span>
                )}
              </div>
            ))}
            {extra.map((value, i) => (
              <div
                className="builder-option text-zinc-800 dark:text-zinc-200 dark:border-zinc-700"
                key={`extra-${i}`}
              >
                <i className="radio-dot" />
                <input
                  value={value}
                  className="bg-white text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                  onChange={(e) =>
                    setExtra(
                      extra.map((v, j) => (j === i ? e.target.value : v)),
                    )
                  }
                  placeholder={`Option ${options.length + i + 1}`}
                />
                <button
                  className="icon-button dark:text-zinc-200 dark:hover:bg-zinc-800"
                  aria-label="Remove option"
                  onClick={() => setExtra(extra.filter((_, j) => j !== i))}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            <button
              className="text-link add-option"
              onClick={() => setExtra([...extra, ""])}
            >
              <Plus size={14} /> Add option
            </button>
          </div>
          {additionalQuestions.map((item, questionIndex) => (
            <div
              className="builder-question panel bg-white text-zinc-900 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-800"
              key={questionIndex}
            >
              <div className="builder-question-head">
                <span>
                  QUESTION {String(questionIndex + 2).padStart(2, "0")}
                </span>
                <button
                  className="icon-button dark:text-zinc-200 dark:hover:bg-zinc-800"
                  aria-label="Remove question"
                  onClick={() =>
                    setAdditionalQuestions((current) =>
                      current.filter((_, index) => index !== questionIndex),
                    )
                  }
                >
                  <X size={15} />
                </button>
              </div>
              <label className="field-label">
                QUESTION TEXT
                <input
                  className="bg-white text-zinc-900 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700"
                  value={item.text}
                  onChange={(event) =>
                    setAdditionalQuestions((current) =>
                      current.map((question, index) =>
                        index === questionIndex
                          ? { ...question, text: event.target.value }
                          : question,
                      ),
                    )
                  }
                  placeholder="Write a question"
                />
              </label>
              <div className="builder-options-head">
                <span className="field-label">ANSWER OPTIONS</span>
                <span className="correct-caption">
                  SELECT THE CORRECT ANSWER
                </span>
              </div>
              {item.options.map((option, optionIndex) => (
                <div
                  className={`builder-option text-zinc-800 dark:text-zinc-200 dark:border-zinc-700 ${item.correct === optionIndex ? "correct" : ""}`}
                  key={optionIndex}
                >
                  <button
                    className="radio-dot"
                    aria-label={`Set option ${optionIndex + 1} as correct`}
                    onClick={() =>
                      setAdditionalQuestions((current) =>
                        current.map((question, index) =>
                          index === questionIndex
                            ? { ...question, correct: optionIndex }
                            : question,
                        ),
                      )
                    }
                  />
                  <input
                    value={option}
                    className="bg-white text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                    onChange={(event) =>
                      setAdditionalQuestions((current) =>
                        current.map((question, index) =>
                          index === questionIndex
                            ? {
                                ...question,
                                options: question.options.map(
                                  (value, answerIndex) =>
                                    answerIndex === optionIndex
                                      ? event.target.value
                                      : value,
                                ),
                              }
                            : question,
                        ),
                      )
                    }
                  />
                  {item.correct === optionIndex && (
                    <span>
                      <Check size={12} /> Correct
                    </span>
                  )}
                </div>
              ))}
              <button
                className="text-link add-option"
                disabled={item.options.length >= 8}
                onClick={() =>
                  setAdditionalQuestions((current) =>
                    current.map((question, index) =>
                      index === questionIndex
                        ? { ...question, options: [...question.options, ""] }
                        : question,
                    ),
                  )
                }
              >
                <Plus size={14} /> Add option
              </button>
            </div>
          ))}
          <button
            className="btn btn-outline"
            disabled={additionalQuestions.length >= 99}
            onClick={() =>
              setAdditionalQuestions((current) => [
                ...current,
                { text: "", options: ["", "", "", ""], correct: 0 },
              ])
            }
          >
            <Plus size={15} /> Add question
          </button>
          <div className="builder-save">
            <span>
              <ShieldCheck size={15} /> Quiz is published for students
            </span>
            <button
              className="btn btn-dark"
              disabled={saving}
              onClick={() => {
                const choices = [...options, ...extra].map((value) =>
                  value.trim(),
                );
                if (!eventId) {
                  toast("Choose the event participants must register for");
                  return;
                }
                if (
                  !title.trim() ||
                  !question.trim() ||
                  choices.some((value) => !value) ||
                  additionalQuestions.some(
                    (item) =>
                      !item.text.trim() ||
                      item.options.some((value) => !value.trim()),
                  )
                ) {
                  toast(
                    "Complete the title, question, and answer options first",
                  );
                  return;
                }
                setSaving(true);
                void api
                  .createQuiz({
                    eventId,
                    title: title.trim(),
                    durationSeconds: duration,
                    status: "published",
                    questions: [
                      {
                        text: question.trim(),
                        options: choices,
                        correctAnswer: correct,
                      },
                      ...additionalQuestions.map((item) => ({
                        text: item.text.trim(),
                        options: item.options.map((value) => value.trim()),
                        correctAnswer: item.correct,
                      })),
                    ],
                  })
                  .then(() => toast("Quiz published"))
                  .catch((error: unknown) =>
                    toast(
                      error instanceof Error
                        ? error.message
                        : "Could not save quiz.",
                    ),
                  )
                  .finally(() => setSaving(false));
              }}
            >
              {saving ? "Publishing…" : "Publish quiz"} <ArrowRight size={15} />
            </button>
          </div>
        </div>
        <aside className="builder-aside">
          <div className="builder-summary panel bg-white text-zinc-900 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-800">
            <span className="section-kicker">QUIZ SUMMARY</span>
            <h3>{title || "Untitled quiz"}</h3>
            <div>
              <Clock3 /> {duration} seconds per question
            </div>
            <div>
              <CircleHelp /> {1 + additionalQuestions.length} questions
            </div>
            <div>
              <Users /> Registered event participants
            </div>
            <span className="draft-pill">DRAFT · NOT PUBLISHED</span>
          </div>
          <div className="builder-tip dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-800">
            <Sparkles />
            <b>Keep it snappy.</b>
            <p>
              Short questions and clear answers make for a better quiz
              experience.
            </p>
          </div>
        </aside>
      </div>
      {preview && (
        <Modal title="Quiz preview" close={() => setPreview(false)}>
          <h2>{title || "Untitled quiz"}</h2>
          <p>{duration} seconds per question</p>
          {[
            { text: question, options: [...options, ...extra] },
            ...additionalQuestions,
          ].map((item, index) => (
            <section key={index}>
              <b>
                {index + 1}. {item.text || "Question text"}
              </b>
              <ol>
                {item.options.map((option, optionIndex) => (
                  <li key={optionIndex}>
                    {option || `Option ${optionIndex + 1}`}
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </Modal>
      )}
    </>
  );
}

function Announcement({ toast }: { toast: (s: string) => void }) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState("All students");
  const [sending, setSending] = useState(false);
  return (
    <>
      <PageHead
        eyebrow="KEEP EVERYONE IN THE LOOP"
        title="Announcements"
        description="One clear message can make everyone’s day go smoother."
      />
      <div className="announce-layout">
        <div className="announce-form panel">
          <div className="form-section-title">
            <span>01</span>
            <div>
              <b>Who needs to know?</b>
              <small>Choose who will see your announcement.</small>
            </div>
          </div>
          <div className="audience-options">
            {["All students", "All users", "Volunteers"].map((a, i) => (
              <button
                key={a}
                className={audience === a ? "selected" : ""}
                onClick={() => setAudience(a)}
              >
                <span className="audience-icon">
                  {i === 0 ? <Users /> : <Ticket />}
                </span>
                <span>
                  <b>{a}</b>
                  <small>
                    {
                      [
                        "Everyone with a student account",
                        "Students and volunteers",
                        "Active volunteers",
                      ][i]
                    }
                  </small>
                </span>
                <i className="radio-dot" />
              </button>
            ))}
          </div>
          <div className="form-section-title">
            <span>02</span>
            <div>
              <b>Write your message</b>
              <small>Keep it short, clear, and useful.</small>
            </div>
          </div>
          <label className="field-label">
            TITLE
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="A quick heads-up…"
              maxLength={60}
            />
            <small>{title.length} / 60</small>
          </label>
          <label className="field-label">
            MESSAGE
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What should everyone know?"
              rows={4}
            />
            <small>{message.length} / 280</small>
          </label>
          <button
            className="btn btn-dark btn-wide"
            disabled={sending}
            onClick={() => {
              if (!title.trim() || !message.trim()) {
                toast("Add a title and message first");
                return;
              }
              const target =
                audience === "All students"
                  ? "students"
                  : audience === "Volunteers"
                    ? "volunteers"
                    : "all";
              setSending(true);
              void api
                .announce(title.trim(), message.trim(), target)
                .then(({ delivered }) => {
                  toast(`Announcement sent to ${delivered} accounts`);
                  setTitle("");
                  setMessage("");
                })
                .catch((cause: unknown) =>
                  toast(
                    cause instanceof Error
                      ? cause.message
                      : "Could not send announcement.",
                  ),
                )
                .finally(() => setSending(false));
            }}
          >
            {sending ? "Sending…" : "Send announcement"}{" "}
            <ArrowRight size={15} />
          </button>
          <small className="form-note">
            <ShieldCheck size={14} /> You can review before sending. This action
            will notify the selected audience.
          </small>
        </div>
        <aside className="announce-preview">
          <div className="section-kicker">
            LIVE PREVIEW <span>AS A STUDENT</span>
          </div>
          <div className="phone-preview">
            <div className="phone-top">
              <span>9:41</span>
              <span>●●● ▰</span>
            </div>
            <div className="phone-notice">
              <div className="preview-icon">
                <Bell size={17} />
              </div>
              <span className="preview-app">
                FestiQO <small>now</small>
              </span>
              <b>{title || "Your announcement title"}</b>
              <p>
                {message ||
                  "Your message will appear here, just as it will for students."}
              </p>
              <small className="audience-pill">{audience}</small>
            </div>
            <div className="phone-nav">
              <span />
              <span />
              <span />
            </div>
          </div>
          <p className="preview-hint">
            This is how it’ll look in the student notification center.
          </p>
        </aside>
      </div>
    </>
  );
}

function NotificationCenter() {
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

function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [close]);
  return (
    <div className="modal-backdrop" onClick={close}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-button" aria-label="Close" onClick={close}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Empty({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="empty-state">
      <span>{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

export default App;
