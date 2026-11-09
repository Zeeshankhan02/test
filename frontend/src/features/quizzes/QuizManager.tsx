import { useEffect, useState } from "react";
import {
  api,
  type ApiAdminQuiz,
  type ApiCompetition,
  type ApiQuizResultRow,
} from "../../api";
import { Modal, PageHead } from "../../shared/components/ui";
import { CompetitionDialog } from "./CompetitionDialog";

export function QuizManager({ toast }: { toast: (s: string) => void }) {
  const [quizzes, setQuizzes] = useState<ApiAdminQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [rowsFor, setRowsFor] = useState<{
    quiz: ApiAdminQuiz;
    rows: ApiQuizResultRow[];
  } | null>(null);
  const [competitionDialog, setCompetitionDialog] = useState<{
    quiz: ApiAdminQuiz;
    state: ApiCompetition;
  } | null>(null);
  const refresh = () => {
    setLoading(true);
    void api
      .adminQuizzes()
      .then(setQuizzes)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : "Could not load quizzes.",
        ),
      )
      .finally(() => setLoading(false));
  };
  useEffect(refresh, []);
  const runAction = (
    quiz: ApiAdminQuiz,
    action: () => Promise<unknown>,
    done: string,
  ) => {
    setBusyId(quiz.id);
    void action()
      .then((result) => {
        const email = (
          result as { email?: { sent: number; failed: number } } | null
        )?.email;
        toast(
          email
            ? `${done}. Email delivery: ${email.sent} sent, ${email.failed} failed.`
            : done,
        );
        refresh();
      })
      .catch((cause: unknown) =>
        toast(cause instanceof Error ? cause.message : "That didn’t work."),
      )
      .finally(() => setBusyId(""));
  };
  const viewResults = (quiz: ApiAdminQuiz) => {
    setBusyId(quiz.id);
    void api
      .quizResultRows(quiz.id)
      .then((rows) => setRowsFor({ quiz, rows }))
      .catch((cause: unknown) =>
        toast(
          cause instanceof Error ? cause.message : "Could not load results.",
        ),
      )
      .finally(() => setBusyId(""));
  };
  const openCompetition = (quiz: ApiAdminQuiz) => {
    setBusyId(quiz.id);
    void api
      .competition(quiz.id)
      .then((state) => setCompetitionDialog({ quiz, state }))
      .catch((cause: unknown) =>
        toast(
          cause instanceof Error
            ? cause.message
            : "Could not load competition.",
        ),
      )
      .finally(() => setBusyId(""));
  };
  return (
    <>
      <PageHead
        eyebrow="LIFECYCLE CONTROL"
        title="Manage quizzes"
        description="Publish windows, close early, and release results when you're ready."
      />
      {loading && <p role="status">Loading quizzes…</p>}
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      {!loading && !quizzes.length && !error && (
        <p>No quizzes yet — build one above and it will appear here.</p>
      )}
      <div className="quiz-admin-list">
        {quizzes.map((quiz) => (
          <div
            key={quiz.id}
            className="panel quiz-admin-row bg-white text-zinc-900 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-800"
          >
            <div className="quiz-admin-info">
              <b>{quiz.title}</b>
              <small>
                {quiz.eventTitle} · {quiz.startedAttempts} started ·{" "}
                {quiz.submittedAttempts} submitted
                {quiz.pendingEvaluations
                  ? ` · ${quiz.pendingEvaluations} pending`
                  : ""}
              </small>
              <span
                className={`quiz-status-pill status-${quiz.status} ${
                  quiz.resultsPublishedAt ? "results-published" : ""
                }`}
              >
                {quiz.status === "draft"
                  ? "DRAFT"
                  : quiz.status === "published"
                    ? quiz.endsAt && new Date(quiz.endsAt) < new Date()
                      ? "WINDOW CLOSED"
                      : "LIVE"
                    : "CLOSED"}
                {quiz.resultsPublishedAt
                  ? " · RESULTS PUBLISHED"
                  : quiz.status !== "draft"
                    ? " · RESULTS PENDING"
                    : ""}
              </span>
            </div>
            <div className="quiz-admin-actions">
              {busyId === quiz.id && <small>Working…</small>}
              {quiz.status === "draft" && (
                <button
                  className="btn btn-outline"
                  disabled={!!busyId}
                  onClick={() =>
                    runAction(
                      quiz,
                      () => api.publishQuiz(quiz.id),
                      "Quiz published",
                    )
                  }
                >
                  Publish
                </button>
              )}
              {quiz.status === "published" && (
                <button
                  className="btn btn-outline"
                  disabled={!!busyId}
                  onClick={() =>
                    runAction(
                      quiz,
                      () => api.endQuizEarly(quiz.id),
                      "Quiz window closed early",
                    )
                  }
                >
                  End early
                </button>
              )}
              {quiz.status !== "draft" && !quiz.resultsPublishedAt && (
                <button
                  className="btn btn-dark"
                  disabled={!!busyId}
                  onClick={() =>
                    runAction(
                      quiz,
                      () => api.publishQuizResults(quiz.id),
                      "Results published",
                    )
                  }
                >
                  Publish results
                </button>
              )}
              {quiz.status !== "draft" && quiz.resultsPublishedAt && (
                <button
                  className="btn btn-outline"
                  disabled={!!busyId}
                  onClick={() =>
                    runAction(
                      quiz,
                      () => api.announceQuizResults(quiz.id),
                      "Results announced to students",
                    )
                  }
                >
                  {quiz.resultsAnnouncedAt ? "Re-send" : "Announce"}
                </button>
              )}
              {quiz.status !== "draft" && (
                <button
                  className="text-link"
                  disabled={!!busyId}
                  onClick={() => viewResults(quiz)}
                >
                  View results
                </button>
              )}
              {quiz.resultsPublishedAt && (
                <button
                  className="btn btn-outline"
                  disabled={!!busyId}
                  onClick={() => openCompetition(quiz)}
                >
                  Competition
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {rowsFor && (
        <Modal
          title={`Results — ${rowsFor.quiz.title}`}
          close={() => setRowsFor(null)}
        >
          <div className="rank-table">
            <div className="rank-header">
              <span>RANK</span>
              <span>PARTICIPANT</span>
              <span>SCORE</span>
              <span>TIME</span>
            </div>
            {rowsFor.rows.map((row) => (
              <div className="rank-row" key={row.rank}>
                <b className="rank-num">{String(row.rank).padStart(2, "0")}</b>
                <div className="rank-person">
                  <b>{row.userName}</b>
                </div>
                <b className="rank-score">
                  {row.score}/{row.total}
                </b>
                <span className="rank-time">
                  {row.timeTakenSeconds != null
                    ? `${Math.floor(row.timeTakenSeconds / 60)}m ${row.timeTakenSeconds % 60}s`
                    : "—"}
                </span>
              </div>
            ))}
            {!rowsFor.rows.length && <p>No finished attempts yet.</p>}
          </div>
        </Modal>
      )}
      {competitionDialog && (
        <CompetitionDialog
          quiz={competitionDialog.quiz}
          initialCompetition={competitionDialog.state}
          onClose={() => setCompetitionDialog(null)}
          toast={toast}
        />
      )}
    </>
  );
}
