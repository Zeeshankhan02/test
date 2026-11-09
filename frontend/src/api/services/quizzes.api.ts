import { request, json } from "../client";
import type {
  ApiAdminQuiz,
  ApiQuizResultsSummary,
  ApiQuizResultRow,
  ApiQuizResult,
  ApiCompetitionRow,
  ApiCompetitionRank,
  ApiCompetition,
  ApiCompetitionProgress,
  ApiCompetitionLeaderboards,
  ApiAttemptSnapshot,
  ApiQuiz,
} from "../types";

export const quizzesApi = {
  quizzes: () => request<ApiQuiz[]>("/quizzes"),

  createQuiz: (value: {
    eventId: string;
    title: string;
    durationSeconds: number;
    status?: "draft" | "published";
    questions: { text: string; options: string[]; correctAnswer: number }[];
  }) => request<ApiQuiz>("/quizzes", json("POST", value)),

  updateQuiz: (
    id: string,
    value: Partial<{
      eventId: string;
      title: string;
      durationSeconds: number;
      questions: { text: string; options: string[]; correctAnswer: number }[];
    }>,
  ) => request<ApiQuiz>(`/quizzes/${id}`, json("PATCH", value)),

  publishQuiz: (id: string) =>
    request<ApiQuiz>(`/quizzes/${id}/publish`, json("POST")),

  closeQuiz: (id: string) =>
    request<{ id: string; status: string }>(
      `/quizzes/${id}/close`,
      json("POST"),
    ),

  adminQuizzes: () => request<ApiAdminQuiz[]>("/quizzes/admin/list"),

  quizResultsSummary: (id: string) =>
    request<ApiQuizResultsSummary>(`/quizzes/${id}/results/summary`),

  quizResultRows: (id: string) =>
    request<ApiQuizResultRow[]>(`/quizzes/${id}/results/rows`),

  publishQuizResults: (id: string) =>
    request<{ alreadyPublished: boolean; resultsPublishedAt: string }>(
      `/quizzes/${id}/results/publish`,
      json("POST"),
    ),

  announceQuizResults: (id: string) =>
    request<{
      delivered: number;
      alreadyAnnounced: boolean;
      email: { sent: number; failed: number };
    }>(`/quizzes/${id}/results/announce`, json("POST")),

  competition: (id: string) =>
    request<ApiCompetition>(`/quizzes/${id}/competition`),

  competitionProgress: (id: string) =>
    request<ApiCompetitionProgress>(`/quizzes/${id}/competition`),

  prepareQualification: (id: string) =>
    request<ApiCompetitionRow[]>(
      `/quizzes/${id}/competition/qualification/prepare`,
      json("POST"),
    ),

  publishQualification: (id: string, userIds: string[], reason?: string) =>
    request<{
      participants: ApiCompetitionRow[];
      delivered: number;
      email: { sent: number; failed: number };
    }>(
      `/quizzes/${id}/competition/qualification/publish`,
      json("POST", { userIds, ...(reason ? { reason } : {}) }),
    ),

  correctQualification: (id: string, userIds: string[], reason: string) =>
    request<ApiCompetitionRow[]>(
      `/quizzes/${id}/competition/qualification/correct`,
      json("POST", { userIds, reason }),
    ),

  saveRound2: (
    id: string,
    rankings: ApiCompetitionRank[],
    advancementLimit: number,
  ) =>
    request<ApiCompetitionRank[]>(
      `/quizzes/${id}/competition/round-2`,
      json("PUT", { rankings, advancementLimit }),
    ),

  publishRound2: (id: string) =>
    request<unknown>(
      `/quizzes/${id}/competition/round-2/publish`,
      json("POST"),
    ),

  correctRound2: (id: string, rankings: ApiCompetitionRank[], reason: string) =>
    request<ApiCompetitionRank[]>(
      `/quizzes/${id}/competition/round-2/correct`,
      json("POST", { rankings, reason }),
    ),

  saveRound3: (id: string, rankings: ApiCompetitionRank[]) =>
    request<ApiCompetitionRank[]>(
      `/quizzes/${id}/competition/round-3`,
      json("PUT", { rankings }),
    ),

  publishRound3: (id: string) =>
    request<unknown>(
      `/quizzes/${id}/competition/round-3/publish`,
      json("POST"),
    ),

  correctRound3: (id: string, rankings: ApiCompetitionRank[], reason: string) =>
    request<ApiCompetitionRank[]>(
      `/quizzes/${id}/competition/round-3/correct`,
      json("POST", { rankings, reason }),
    ),

  confirmCompetitionWinner: (id: string) =>
    request<{
      userId: string;
      confirmedAt: string;
      alreadyConfirmed: boolean;
      delivered: number;
      email: { sent: number; failed: number };
    }>(`/quizzes/${id}/competition/winner/confirm`, json("POST")),

  endQuizEarly: (id: string) =>
    request<unknown>(`/quizzes/${id}/end-early`, json("POST")),

  retryQuizFinalization: (id: string) =>
    request<{ finalizedAttempts: number; pendingAttempts: number }>(
      `/quizzes/${id}/finalize/retry`,
      json("POST"),
    ),

  myQuizResult: (id: string) =>
    request<ApiQuizResult>(`/quizzes/${id}/my-result`),

  startQuiz: (id: string) =>
    request<ApiAttemptSnapshot>(`/quizzes/${id}/start`, json("POST")),

  myQuizAttempt: (id: string) =>
    request<ApiAttemptSnapshot | null>(`/quizzes/${id}/my-attempt`),

  attemptState: (attemptId: string) =>
    request<ApiAttemptSnapshot>(`/quiz-attempts/${attemptId}/state`),

  saveAttemptAnswer: (
    attemptId: string,
    index: number,
    answer: number | null,
  ) =>
    request<{
      index: number;
      accepted: boolean;
      status: string;
      locked: boolean;
      reason?: string;
      finalizedAt?: string;
    }>(`/quiz-attempts/${attemptId}/answers`, json("POST", { index, answer })),

  finishAttempt: (attemptId: string) =>
    request<{
      completed: boolean;
      alreadyCompleted: boolean;
      scoreRevealed: boolean;
      submittedAt: string | null;
    }>(`/quiz-attempts/${attemptId}/finalize`, json("POST")),

  submitQuiz: (id: string, answers: (number | null)[]) =>
    request<{
      score: number;
      total: number;
      timedOut: boolean;
      scoreRevealed: boolean;
    }>(`/quiz-attempts/${id}/submit`, json("POST", { answers })),

  leaderboard: (id: string) =>
    request<
      {
        rank: number;
        userName: string;
        avatar?: string;
        score: number;
        submittedAt: string;
      }[]
    >(`/quizzes/${id}/leaderboard`),

  competitionLeaderboards: (id: string) =>
    request<ApiCompetitionLeaderboards>(
      `/quizzes/${id}/competition/leaderboards`,
    ),
};
