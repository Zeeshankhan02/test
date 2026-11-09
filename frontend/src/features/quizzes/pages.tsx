import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, CircleHelp, Clock3, Sparkles } from "lucide-react";
import { api, type ApiCompetitionProgress, type ApiQuiz } from "../../api";
import { Empty, PageHead } from "../../shared/components/ui";

export function QuizzesPage({
  toast,
  quizzes,
}: {
  toast: (s: string) => void;
  quizzes: ApiQuiz[];
}) {
  const [play, setPlay] = useState<
    import("../../api").ApiAttemptSnapshot | null
  >(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [finished, setFinished] = useState<{
    scoreRevealed: boolean;
    score: number | null;
    total: number | null;
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const active = quizzes.find((q) => q.status === "published") ?? quizzes[0];
  const eventStartsAt = active?.eventStartsAt
    ? new Date(active.eventStartsAt).getTime()
    : Number.NaN;
  const eventEndsAt = active?.eventEndsAt
    ? new Date(active.eventEndsAt).getTime()
    : Number.NaN;
  const eventStarted = Number.isFinite(eventStartsAt) && eventStartsAt <= now;
  const eventEnded = Number.isFinite(eventEndsAt) && eventEndsAt <= now;
  const quizWindowOpen =
    !active?.endsAt || new Date(active.endsAt).getTime() > now;
  const canStart =
    active?.status === "published" &&
    active.eventStatus === "published" &&
    eventStarted &&
    !eventEnded &&
    quizWindowOpen;
  const [competitionProgress, setCompetitionProgress] =
    useState<ApiCompetitionProgress | null>(null);
  const serverOffset = useRef(0);
  const finalizedRef = useRef(false);
  const answerSaveQueue = useRef<Promise<void>>(Promise.resolve());
  const expiredQuestionRef = useRef("");

  useEffect(() => {
    if (!active?.eventStartsAt || eventStarted) return;
    const timeout = window.setTimeout(
      () => setNow(Date.now()),
      Math.max(0, eventStartsAt - Date.now()) + 50,
    );
    return () => window.clearTimeout(timeout);
  }, [active?._id, active?.eventStartsAt, eventStarted, eventStartsAt]);

  useEffect(() => {
    setCompetitionProgress(null);
    if (active)
      void api
        .competitionProgress(active._id)
        .then(setCompetitionProgress)
        .catch(() => setCompetitionProgress(null));
  }, [active?._id]);

  // tick every second while playing so server deadlines drive the UI
  useEffect(() => {
    if (!play) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [play]);

  const remainingMs = (deadline: string | null | undefined) =>
    deadline
      ? new Date(deadline).getTime() - (now + serverOffset.current)
      : Infinity;
  const overallRemainingMs = remainingMs(play?.overallDeadline);
  const questionRemainingMs = remainingMs(
    play?.questionDeadlines[questionIndex],
  );
  const playSeconds = Math.max(
    0,
    Math.ceil(Math.min(overallRemainingMs, questionRemainingMs) / 1000),
  );

  useEffect(() => {
    if (!play || overallRemainingMs <= 0 || questionRemainingMs > 0) return;
    const index = questionIndex;
    const key = `${play.attemptId}:${index}`;
    if (play.finalizedAt[index]) {
      if (index < play.quiz.questions.length - 1)
        setQuestionIndex((current) =>
          current === index ? current + 1 : current,
        );
      return;
    }
    if (expiredQuestionRef.current === key) return;
    expiredQuestionRef.current = key;
    const save = answerSaveQueue.current
      .catch(() => {})
      .then(() => api.saveAttemptAnswer(play.attemptId, index, null));
    answerSaveQueue.current = save.then(
      () => undefined,
      () => undefined,
    );
    void save
      .then((result) => {
        if (!result.locked) {
          if (result.reason === "still_open") expiredQuestionRef.current = "";
          return;
        }
        setPlay((current) =>
          current?.attemptId === play.attemptId
            ? {
                ...current,
                finalizedAt: current.finalizedAt.map((value, i) =>
                  i === index
                    ? (result.finalizedAt ?? new Date().toISOString())
                    : value,
                ),
              }
            : current,
        );
        if (index < play.quiz.questions.length - 1)
          setQuestionIndex((current) =>
            current === index ? current + 1 : current,
          );
      })
      .catch((cause: unknown) => {
        expiredQuestionRef.current = "";
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not save the timed answer.",
        );
      });
  }, [
    play?.attemptId,
    questionIndex,
    questionRemainingMs <= 0,
    overallRemainingMs <= 0,
    now,
  ]);

  const applySnapshot = (snapshot: import("../../api").ApiAttemptSnapshot) => {
    serverOffset.current = new Date(snapshot.serverTime).getTime() - Date.now();
    setNow(Date.now());
    setPlay(snapshot);
  };

  useEffect(() => {
    if (!active) return;
    let current = true;
    void api
      .myQuizAttempt(active._id)
      .then(async (snapshot) => {
        if (!current || !snapshot) return;
        if (snapshot.status === "completed") {
          setPlay(null);
          setFinished({ scoreRevealed: false, score: null, total: null });
          try {
            const result = await api.myQuizResult(active._id);
            if (current)
              setFinished({
                scoreRevealed: true,
                score: result.score,
                total: result.total,
              });
          } catch {
            // Results remain hidden until the organizer publishes them.
          }
          return;
        }
        applySnapshot(snapshot);
        setQuestionIndex(
          Math.max(
            0,
            snapshot.finalizedAt.findIndex((value) => !value),
          ),
        );
      })
      .catch(() => {
        if (current)
          setError(
            "Could not check your saved quiz attempt. Please refresh and try again.",
          );
      });
    return () => {
      current = false;
    };
  }, [active?._id]);

  const loadResult = async (quizId: string) => {
    try {
      const result = await api.myQuizResult(quizId);
      setFinished({
        scoreRevealed: true,
        score: result.score,
        total: result.total,
      });
    } catch {
      // results not published yet — show a pending banner instead
      setFinished({ scoreRevealed: false, score: null, total: null });
    }
  };

  const finalize = async (attemptId: string) => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    try {
      await answerSaveQueue.current.catch(() => {});
      const outcome = await api.finishAttempt(attemptId);
      setPlay(null);
      if (outcome.scoreRevealed) {
        await loadResult(active?._id ?? "");
      } else {
        setFinished({ scoreRevealed: false, score: null, total: null });
      }
      toast(
        outcome.alreadyCompleted
          ? "Quiz already submitted."
          : "Quiz submitted!",
      );
    } catch (cause) {
      finalizedRef.current = false;
      setError(
        cause instanceof Error ? cause.message : "Could not submit quiz.",
      );
    }
  };

  // auto-finalize when the overall server deadline passes
  useEffect(() => {
    if (play && overallRemainingMs <= 0) void finalize(play.attemptId);
    // finalize() is stable per attempt; re-running on every tick is wasteful
  }, [play, overallRemainingMs <= 0]);

  const saveAnswer = async (index: number, answer: number) => {
    if (!play || play.finalizedAt[index] || questionRemainingMs <= 0) return;
    setPlay((current) =>
      current
        ? {
            ...current,
            answers: current.answers.map((value, i) =>
              i === index ? answer : value,
            ),
          }
        : current,
    );
    setError("");
    try {
      const save = answerSaveQueue.current
        .catch(() => {})
        .then(() => api.saveAttemptAnswer(play.attemptId, index, answer));
      answerSaveQueue.current = save.then(
        () => undefined,
        () => undefined,
      );
      const res = await save;
      if (res.locked) {
        setError(
          `That question was locked before your answer saved (${res.reason ?? "too late"}).`,
        );
        void api
          .attemptState(play.attemptId)
          .then(applySnapshot)
          .catch(() => {});
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save your answer.",
      );
    }
  };

  const start = async () => {
    if (!active || busy || !canStart) return;
    setBusy(true);
    setError("");
    setFinished(null);
    finalizedRef.current = false;
    expiredQuestionRef.current = "";
    try {
      const snapshot = await api.startQuiz(active._id);
      if (snapshot.status === "completed") {
        setPlay(null);
        setFinished({ scoreRevealed: false, score: null, total: null });
        await loadResult(active._id);
        toast(
          "You already submitted this quiz. Your attempt cannot be restarted.",
        );
        return;
      }
      applySnapshot(snapshot);
      setQuestionIndex(0);
      if (snapshot.endedByAdmin)
        toast("This quiz was ended early by the organizers.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not start quiz.",
      );
    } finally {
      setBusy(false);
    }
  };
  const question = play?.quiz.questions[questionIndex];
  const chosenAnswers = play?.answers ?? [];
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
      {competitionProgress && (
        <section
          className="panel competition-progress"
          aria-label="My quiz competition progress"
        >
          <h2>Three-round competition</h2>
          {!competitionProgress.round1Published ? (
            <p>
              Round 1:{" "}
              {competitionProgress.round1Started
                ? competitionProgress.round1Submitted
                  ? "Attempt submitted"
                  : "Attempt in progress"
                : "Not started"}
              . Waiting for finalized results.
            </p>
          ) : (
            <p>
              Round 1: {competitionProgress.round1Score ?? "No submitted score"}{" "}
              points
              {competitionProgress.round1Rank
                ? ` · rank ${competitionProgress.round1Rank}`
                : ""}
              .
            </p>
          )}
          {competitionProgress.qualified !== null && (
            <p>
              {competitionProgress.qualified
                ? "Qualified for Round 2."
                : "Did not qualify for Round 2."}
            </p>
          )}
          {competitionProgress.qualified === null &&
            competitionProgress.round1Published && (
              <p>Round 1 qualification is being reviewed.</p>
            )}
          {competitionProgress.round2 && (
            <p>
              Round 2: rank {competitionProgress.round2.rank}
              {competitionProgress.round2.score != null
                ? ` · ${competitionProgress.round2.score} points`
                : ""}
              .
            </p>
          )}
          {competitionProgress.round3 && (
            <p>
              Final Round 3: rank {competitionProgress.round3.rank}
              {competitionProgress.round3.score != null
                ? ` · ${competitionProgress.round3.score} points`
                : ""}
              .
            </p>
          )}
          {competitionProgress.isWinner && (
            <p>
              Winner confirmed.{" "}
              {competitionProgress.winnerCertificate ? (
                <Link to="/student/certificates">
                  View your winner certificate
                </Link>
              ) : (
                "Your certificate is being prepared."
              )}
            </p>
          )}
        </section>
      )}
      {!active && !play ? (
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
                {play
                  ? `QUESTION ${questionIndex + 1} / ${play.quiz.questions.length}`
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
                {play?.quiz.durationSeconds ?? active?.durationSeconds ?? 0} SEC
              </span>
              <span>·</span>
              <span>
                {play?.quiz.questions.length ?? active?.questions.length ?? 0}{" "}
                QUESTIONS
              </span>
            </div>
            <h2>{play?.quiz.title || active?.title}</h2>
            <p>
              Choose your answers before the timer runs out. Every answer is
              saved as you go — your score is calculated by the server.
            </p>
            {finished && !play ? (
              finished.scoreRevealed ? (
                <div className="quiz-bottom">
                  <b>
                    Your score: {finished.score} / {finished.total}
                  </b>
                </div>
              ) : (
                <div className="quiz-bottom">
                  <b>Submitted!</b> Scores will appear once the organizers
                  publish results.
                </div>
              )
            ) : play && question ? (
              <div className="quiz-question">
                <div className="quiz-progress">
                  <span>
                    QUESTION {questionIndex + 1} OF {play.quiz.questions.length}
                  </span>
                  <b className={playSeconds < 15 ? "timer-warning" : ""}>
                    <Clock3 size={14} />{" "}
                    {Math.floor(playSeconds / 60)
                      .toString()
                      .padStart(2, "0")}
                    :{String(playSeconds % 60).padStart(2, "0")}
                  </b>
                </div>
                <div className="progress-track">
                  <i
                    style={{
                      width: `${((questionIndex + 1) / play.quiz.questions.length) * 100}%`,
                    }}
                  />
                </div>
                <h3>{question.text}</h3>
                <div className="answer-options">
                  {question.options.map((option, index) => (
                    <button
                      key={option}
                      disabled={
                        questionRemainingMs <= 0 ||
                        Boolean(play.finalizedAt[questionIndex])
                      }
                      className={
                        chosenAnswers[questionIndex] === index ? "chosen" : ""
                      }
                      onClick={() => void saveAnswer(questionIndex, index)}
                    >
                      <span>{String.fromCharCode(65 + index)}</span>
                      {option}
                      {chosenAnswers[questionIndex] === index && (
                        <Check size={15} />
                      )}
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
                  {questionIndex < play.quiz.questions.length - 1 ? (
                    <button
                      className="btn btn-dark"
                      disabled={chosenAnswers[questionIndex] === undefined}
                      onClick={() => setQuestionIndex((current) => current + 1)}
                    >
                      Next question <ArrowRight size={15} />
                    </button>
                  ) : (
                    <button
                      className="btn btn-dark"
                      disabled={busy}
                      onClick={() => {
                        setBusy(true);
                        void finalize(play.attemptId).finally(() =>
                          setBusy(false),
                        );
                      }}
                    >
                      {busy ? "Submitting…" : "Finish quiz"}{" "}
                      <ArrowRight size={15} />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <button
                className="btn btn-dark"
                disabled={busy || !canStart}
                onClick={() => void start()}
              >
                {busy
                  ? "Starting…"
                  : active?.status !== "published"
                    ? "Quiz window closed"
                    : active.eventStatus !== "published"
                      ? "Event unavailable"
                      : !Number.isFinite(eventStartsAt)
                        ? "Event schedule unavailable"
                        : !eventStarted
                          ? "Available when event starts"
                          : eventEnded
                            ? "Event ended"
                            : active.eventStatus !== "published"
                              ? "Event unavailable"
                              : !quizWindowOpen
                                ? "Quiz window closed"
                                : "Start the quiz"}{" "}
                <ArrowRight size={16} />
              </button>
            )}
            {active?.status === "published" &&
              !eventStarted &&
              active.eventStartsAt && (
                <p role="status">
                  This quiz opens when the event starts on{" "}
                  {new Date(active.eventStartsAt).toLocaleString()}.
                </p>
              )}
            {active?.status === "published" &&
              active.eventStatus !== "published" && (
                <p role="status">
                  This event is not available for quiz attempts.
                </p>
              )}
            {active?.status === "published" &&
              !Number.isFinite(eventStartsAt) && (
                <p role="status">
                  The event schedule is unavailable. Please contact the
                  organizers.
                </p>
              )}
          </div>
        </div>
      )}
    </>
  );
}
