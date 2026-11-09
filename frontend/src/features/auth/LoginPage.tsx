import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  CircleHelp,
  Compass,
  Eye,
  EyeOff,
  ScanLine,
  Settings,
  Sparkles,
} from "lucide-react";
import { api, festDateLabel, festDurationLabel, useFestDates } from "../../api";
import type { Role, User } from "../../types";
import ThemeToggle from "../../ThemeToggle";

export function SessionPending() {
  return (
    <main className="page-content" aria-live="polite">
      Restoring your session…
    </main>
  );
}

export function Login({
  user,
  onLogin,
}: {
  user: User | null;
  onLogin: (role: Role, email: string, password: string) => Promise<boolean>;
}) {
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "forgot" | "verifyReset">(
    "login",
  );
  const [otp, setOtp] = useState("");
  const [notice, setNotice] = useState("");
  const festDates = useFestDates();
  const festLabel = festDateLabel(festDates);
  const festDuration = festDurationLabel(festDates);
  const festName = festDates?.title ?? "YUKTI";
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
            <CalendarDays size={17} /> {festLabel ?? "Dates coming soon"}
            {festDuration ? ` · ${festDuration}` : ""} <span /> {festName}
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
                .then((result) => {
                  setNotice(result.message);
                  setAuthMode("verifyReset");
                })
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
            if (authMode === "verifyReset") {
              void api
                .resetPassword(email, otp, password)
                .then(async () => {
                  setAuthMode("login");
                  setOtp("");
                  setNotice("Password changed. Signing you in…");
                  const signedIn = await onLogin(role, email, password);
                  setNotice(
                    signedIn ? "Password changed and you’re signed in." : "",
                  );
                  if (!signedIn)
                    setError(
                      "Password changed, but this account does not have access to the selected workspace.",
                    );
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
          {
            <label className="auth-field">
              Email
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                readOnly={authMode === "verifyReset"}
                placeholder="you@college.edu"
              />
            </label>
          }
          {authMode !== "forgot" && (
            <label className="auth-field">
              {authMode === "verifyReset" ? "New password" : "Password"}
              <span className="auth-password">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    authMode === "verifyReset"
                      ? "new-password"
                      : "current-password"
                  }
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={12}
                  placeholder={
                    authMode === "verifyReset"
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
          {authMode === "verifyReset" && (
            <label className="auth-field">
              Password reset code
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={otp}
                onChange={(event) =>
                  setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                required
                placeholder="Enter the 6-digit code"
              />
              <small>The code expires in 10 minutes.</small>
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
                ? "Send verification code"
                : authMode === "verifyReset"
                  ? "Change password"
                  : `Continue as ${role}`}
            <ArrowRight size={17} />
          </button>
          {authMode === "verifyReset" && (
            <button
              type="button"
              className="text-link"
              disabled={submitting}
              onClick={() => {
                setSubmitting(true);
                void api
                  .requestPasswordReset(email)
                  .then((result) => setNotice(result.message))
                  .catch((cause: unknown) =>
                    setError(
                      cause instanceof Error
                        ? cause.message
                        : "Could not resend the code.",
                    ),
                  )
                  .finally(() => setSubmitting(false));
              }}
            >
              Resend code
            </button>
          )}
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
