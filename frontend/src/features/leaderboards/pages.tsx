import { useEffect, useState } from "react";
import { Clock3, Trophy } from "lucide-react";
import { api, type ApiCompetitionLeaderboards, type ApiQuiz } from "../../api";
import { useAuth } from "../../AuthContext";
import { PageHead, Podium } from "../../shared/components/ui";

export function LeaderboardPage() {
  const [quizzes, setQuizzes] = useState<ApiQuiz[]>([]);
  const [quizId, setQuizId] = useState("");
  const [board, setBoard] = useState<ApiCompetitionLeaderboards | null>(null);
  const [round, setRound] = useState<"round1" | "round2" | "final">("round1");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { user } = useAuth();
  useEffect(() => {
    let current = true;
    void api
      .quizzes()
      .then((items) => {
        if (!current) return;
        setQuizzes(items);
        setQuizId(
          items.find((quiz) => quiz.status === "published")?._id ??
            items[0]?._id ??
            "",
        );
      })
      .catch((cause: unknown) => {
        if (current)
          setError(
            cause instanceof Error ? cause.message : "Could not load quizzes.",
          );
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, []);
  useEffect(() => {
    if (!quizId) {
      setBoard(null);
      return;
    }
    let current = true;
    setLoading(true);
    setError("");
    void api
      .competitionLeaderboards(quizId)
      .then((result) => {
        if (current) setBoard(result);
      })
      .catch((cause: unknown) => {
        if (current)
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load leaderboards.",
          );
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [quizId]);
  const roundBoard = board?.[round];
  const rows = roundBoard?.rankings ?? [];
  const roundLabel =
    round === "round1"
      ? "Round 1"
      : round === "round2"
        ? "Round 2"
        : "Final results";
  return (
    <>
      <PageHead
        eyebrow="FRIENDLY COMPETITION"
        title="Leaderboards"
        description="Track published rankings across all three quiz rounds."
      />
      <div className="leaderboard-shell">
        {quizzes.length > 1 && (
          <label className="leaderboard-quiz-select">
            Quiz
            <select
              value={quizId}
              onChange={(event) => {
                setQuizId(event.target.value);
                setRound("round1");
              }}
            >
              {quizzes.map((quiz) => (
                <option key={quiz._id} value={quiz._id}>
                  {quiz.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <div
          className="leaderboard-round-tabs"
          role="tablist"
          aria-label="Quiz round leaderboards"
        >
          {(
            [
              ["round1", "Round 1"],
              ["round2", "Round 2"],
              ["final", "Final results"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={round === key}
              className={round === key ? "active" : ""}
              onClick={() => setRound(key)}
            >
              {label}
            </button>
          ))}
        </div>
        {board && (
          <div className="leaderboard-round-title">
            <h2>
              {board.quiz.title} · {roundLabel}
            </h2>
            <span>
              {roundBoard?.published
                ? `Published ${roundBoard.publishedAt ? new Date(roundBoard.publishedAt).toLocaleDateString() : ""}`
                : "Not published yet"}
            </span>
          </div>
        )}
        {round === "final" && roundBoard?.published && board?.final.winner && (
          <div className="leaderboard-winner" role="status">
            <Trophy size={20} />
            <span>
              <b>Winner: {board.final.winner.userName}</b>
              <small>Confirmed by the organizers</small>
            </span>
          </div>
        )}
        {round === "final" && roundBoard?.published && !board?.final.winner && (
          <p className="leaderboard-pending">
            <Clock3 size={15} /> Final rankings are published; the winner has
            not been confirmed yet.
          </p>
        )}
        {loading && (
          <p className="leaderboard-pending" role="status">
            Loading leaderboard…
          </p>
        )}
        {!loading && !quizzes.length && (
          <p className="leaderboard-pending">
            No quiz leaderboards are available for your registered events yet.
          </p>
        )}
        {!loading && !!quizId && roundBoard && !roundBoard.published && (
          <p className="leaderboard-pending">
            <Clock3 size={15} /> {roundLabel} rankings will appear after the
            organizers publish them.
          </p>
        )}
        {!loading && roundBoard?.published && rows.length > 0 && (
          <div className="podium">
            {[rows[1], rows[0], rows[2]]
              .filter((row): row is NonNullable<typeof row> => !!row)
              .map((row, index) => (
                <Podium
                  key={row.rank}
                  user={row.userName}
                  score={row.score == null ? "—" : String(row.score)}
                  place={index === 0 ? 2 : index === 1 ? 1 : 3}
                  img={
                    row.avatar ||
                    `https://i.pravatar.cc/100?u=${encodeURIComponent(row.userName)}`
                  }
                />
              ))}
          </div>
        )}
        {!loading && roundBoard?.published && rows.length > 0 && (
          <div className="rank-table round-rank-table">
            <div className="rank-header">
              <span>RANK</span>
              <span>PARTICIPANT</span>
              <span>POINTS</span>
              <span>SUBMITTED</span>
            </div>
            {rows.map((r) => (
              <div
                className={`rank-row ${r.userId === user?.id ? "you" : ""}`}
                key={r.userId}
              >
                <b className="rank-num">{String(r.rank).padStart(2, "0")}</b>
                <div className="rank-person">
                  {r.avatar && <img src={r.avatar} alt="" />}
                  <b>
                    {r.userName}
                    {r.userId === user?.id && <small>YOU</small>}
                  </b>
                </div>
                <b className="rank-score">
                  {r.score == null ? (
                    "—"
                  ) : (
                    <>
                      {r.score.toLocaleString()} <small>pts</small>
                    </>
                  )}
                </b>
                <span className="rank-time">
                  {r.submittedAt
                    ? new Date(r.submittedAt).toLocaleDateString()
                    : "—"}
                </span>
              </div>
            ))}
          </div>
        )}
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        {!loading && roundBoard?.published && !rows.length && (
          <p className="leaderboard-pending">
            No ranked participants are recorded for this round.
          </p>
        )}
        <div className="leader-foot">
          <span>
            {roundBoard?.published
              ? "Official published results"
              : "Results are released by the organizers"}
          </span>
          <span>
            {round === "final" && board?.final.winner
              ? "Winner confirmed"
              : roundLabel}
          </span>
        </div>
      </div>
    </>
  );
}
