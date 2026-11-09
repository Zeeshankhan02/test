import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Check,
  CircleHelp,
  Eye,
  EyeOff,
  Sparkles,
} from "lucide-react";
import { festDateLabel, festDurationLabel, useFestDates } from "../../api";
import type { User } from "../../types";
import ThemeToggle from "../../ThemeToggle";
import { useAuth } from "../../AuthContext";

export function SignupPage({ user }: { user: User | null }) {
  const navigate = useNavigate();
  const { signupStudent, verifyStudentSignup } = useAuth();
  const festDates = useFestDates();
  const festLabel = festDateLabel(festDates);
  const festDuration = festDurationLabel(festDates);
  const festName = festDates?.title ?? "YUKTI";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const [success, setSuccess] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  useEffect(() => {
    if (user) navigate(`/${user.role}`);
  }, [user, navigate]);
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (otpSent) {
      if (!/^\d{6}$/.test(otp)) {
        setError("Enter the six-digit code sent to your email.");
        return;
      }
      setLoading(true);
      void verifyStudentSignup(email, otp)
        .then(() => setSuccess(true))
        .catch((cause: unknown) =>
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not verify your email.",
          ),
        )
        .finally(() => setLoading(false));
      return;
    }
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
      .then(() => {
        setOtpSent(true);
        setNotice("A verification code has been sent to your email.");
      })
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
        <div className="promo-foot">
          {festName} · {festLabel ?? "Dates coming soon"}
          {festDuration ? ` · ${festDuration}` : ""}
        </div>
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
                readOnly={otpSent}
                placeholder="you@college.edu"
              />
              {fieldErrors.email && (
                <small className="auth-error">{fieldErrors.email}</small>
              )}
            </label>
            {!otpSent && (
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
                    placeholder="At least 12 characters"
                  />
                  <button
                    type="button"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
                {fieldErrors.password && (
                  <small className="auth-error">{fieldErrors.password}</small>
                )}
              </label>
            )}
            {!otpSent && (
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
            )}
            {otpSent && (
              <label className="auth-field">
                Email verification code
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
                <small>Check your email. The code expires in 10 minutes.</small>
              </label>
            )}
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            {notice && <p role="status">{notice}</p>}
            <button
              className="btn btn-primary btn-wide"
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Please wait…"
                : otpSent
                  ? "Verify email and create account"
                  : "Send verification code"}
              <ArrowRight size={17} />
            </button>
            {otpSent && (
              <button
                type="button"
                className="text-link"
                disabled={loading}
                onClick={() => {
                  setLoading(true);
                  void signupStudent(email, password)
                    .then(() => {
                      setError("");
                      setNotice("A new code has been sent to your email.");
                    })
                    .catch((cause: unknown) =>
                      setError(
                        cause instanceof Error
                          ? cause.message
                          : "Could not resend the code.",
                      ),
                    )
                    .finally(() => setLoading(false));
                }}
              >
                Resend code
              </button>
            )}
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
