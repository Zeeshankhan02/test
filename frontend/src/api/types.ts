import type { Notice, Role, Scan } from "../types";

export type ApiUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
};

export type ApiEvent = {
  _id: string;
  title: string;
  description: string;
  category: string;
  venue: string;
  startsAt: string;
  endsAt: string;
  status: string;
  capacity: number;
  registeredCount: number;
  image?: string;
  imagePublicId?: string;
  registrationDeadline?: string;
  participationType?: "individual" | "team" | "both";
  teamMin?: number;
  teamMax?: number;
  teamLeaderIncluded?: boolean;
};

export type Envelope<T> = { success: true; data: T };

export type UploadedEventImage = { url: string; publicId: string };

export type EventDraft = {
  title: string;
  description: string;
  category: string;
  venue: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  teamMin: number;
  teamMax: number;
  participationType: "individual" | "team" | "both";
  teamLeaderIncluded: boolean;
  image?: string;
  imagePublicId?: string;
};

export type ApiRegistration = {
  _id: string;
  eventId: string;
  userId: string | { name: string; email: string } | null;
  teamName?: string;
  members: string[];
  createdAt: string;
  status: string;
};

export type ApiFestDates = {
  title: string | null;
  startsAt: string | null;
  endsAt: string | null;
  timezone: string | null;
  venue: string | null;
  updatedAt: string | null;
};

export type FestDatesDraft = {
  title?: string;
  startsAt: string;
  endsAt: string;
  timezone?: string;
  venue?: string;
};

export type ApiAdminQuiz = {
  id: string;
  eventId: string;
  title: string;
  eventTitle: string;
  status: "draft" | "published" | "closed";
  endsAt: string | null;
  resultsPublishedAt: string | null;
  resultsAnnouncedAt: string | null;
  startedAttempts: number;
  submittedAttempts: number;
  pendingEvaluations: number;
};

export type ApiQuizResultsSummary = {
  id: string;
  title: string;
  eventTitle: string;
  status: "draft" | "published" | "closed";
  endsAt: string | null;
  resultsPublishedAt: string | null;
  resultsAnnouncedAt: string | null;
  participants: number;
  startedAttempts: number;
  submittedAttempts: number;
  pendingEvaluations: number;
};

export type ApiQuizResultRow = {
  rank: number;
  userName: string;
  score: number;
  total: number;
  submittedAt: string;
  timeTakenSeconds: number | null;
};

export type ApiQuizResult = {
  quizId: string;
  title: string;
  score: number;
  total: number;
  rank: number;
  submittedAt: string;
  completedAt: string;
  timeTakenSeconds: number | null;
  resultsPublishedAt: string;
};

export type ApiCompetitionRow = {
  userId: string;
  rank: number;
  score: number;
  submittedAt?: string;
  participant: { name: string; email: string } | null;
};

export type ApiCompetitionRank = {
  userId: string;
  rank: number;
  score?: number;
  notes?: string;
  participant?: { name: string; email: string } | null;
};

export type ApiCompetition = {
  title: string;
  qualificationCandidates: ApiCompetitionRow[];
  qualifiedParticipants: ApiCompetitionRow[];
  qualificationPublishedAt?: string | null;
  round2Rankings: ApiCompetitionRank[];
  round2PublishedAt?: string | null;
  round3AdvancementLimit: number;
  round3Rankings: ApiCompetitionRank[];
  round3PublishedAt?: string | null;
  winnerUserId?: string | null;
  winnerConfirmedAt?: string | null;
  winnerCertificate?: {
    id: string;
    userId?: string;
    certificateId: string;
  } | null;
};

export type ApiCompetitionProgress = {
  title: string;
  round1Started: boolean;
  round1Submitted: boolean;
  round1Published: boolean;
  round1Score: number | null;
  round1Rank: number | null;
  qualified: boolean | null;
  round2: ApiCompetitionRank | null;
  round3: ApiCompetitionRank | null;
  isWinner: boolean;
  winnerCertificate: { id: string; certificateId: string } | null;
};

export type ApiCompetitionLeaderboards = {
  quiz: { id: string; title: string };
  round1: {
    published: boolean;
    publishedAt: string | null;
    rankings: ApiLeaderboardRank[];
  };
  round2: {
    published: boolean;
    publishedAt: string | null;
    rankings: ApiLeaderboardRank[];
  };
  final: {
    published: boolean;
    publishedAt: string | null;
    rankings: ApiLeaderboardRank[];
    winner: { userId: string; userName: string; confirmedAt: string } | null;
  };
};

export type ApiLeaderboardRank = {
  rank: number;
  userId: string;
  userName: string;
  avatar?: string;
  score: number | null;
  submittedAt?: string | null;
  notes?: string;
};

export type ApiAttemptSnapshot = {
  attemptId: string;
  /** Only present on the initial start/resume payload. */
  resumed?: boolean;
  endedByAdmin?: boolean;
  /** Only present on the /state snapshot payload. */
  status?: "in_progress" | "completed";
  serverTime: string;
  overallDeadline: string | null;
  questionDeadlines: (string | null)[];
  answers: number[];
  finalizedAt: (string | null)[];
  submittedAt?: string | null;
  scoreRevealed?: boolean;
  quiz: {
    id?: string;
    eventId?: string;
    title: string;
    durationSeconds: number;
    questions: { id: string; text: string; options: string[] }[];
  };
};

export type ApiCertificate = {
  _id: string;
  certificateId: string;
  templateId:
    | string
    | {
        _id: string;
        title: string;
        description?: string;
        eventId: string;
        signatureName?: string;
        signatureRole?: string;
        certificateType?: "participation" | "winner";
        logoUrl?: string;
        signatureImageUrl?: string;
        status?: "draft" | "published";
      };
  eventId?:
    string | { _id: string; title: string; startsAt?: string; endsAt?: string };
  recipientName: string;
  awardType?: "participation" | "winner";
  rank?: number;
  publishedAt?: string;
  staleAt?: string;
  revokedAt?: string;
  issuedAt: string;
};

export type ApiEventCertificateStatus = {
  event: { id: string; title: string; status: string; endsAt: string };
  eligibleParticipants: number;
  eligibleWinners: number;
  generated: number;
  published: number;
  certificates: ApiCertificate[];
};

export type ApiDashboard = {
  students: number;
  users: number;
  activeVolunteers: number;
  totalEvents: number;
  events: number;
  upcomingEvents: number;
  registrations: number;
  teamRegistrations: number;
  checkIns: number;
  quizParticipants: number;
  publishedCertificates: number;
  topEvents: {
    id: string;
    title: string;
    category: string;
    capacity: number;
    startsAt: string;
    registrations: number;
  }[];
  registrationsByDay: { date: string; registrations: number }[];
};

export type ApiTicket = {
  _id: string;
  registrationId: string;
  status: string;
  credential: string;
  registration: ApiRegistration | null;
  event: ApiEvent | null;
};

export type ApiScan = {
  _id: string;
  ticketId?: string;
  volunteerId: string;
  scannedAt: string;
  participantName?: string;
  teamName?: string;
  eventName?: string;
  status:
    | Scan["status"]
    | "already_scanned"
    | "invalid_ticket"
    | "cancelled_ticket"
    | "wrong_event";
};

export type ApiVolunteer = {
  _id?: string;
  id?: string;
  email: string;
  name?: string;
  active: boolean;
  createdAt: string;
};

export type ApiNotice = {
  _id: string;
  type: Notice["type"];
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
};

export type ApiQuiz = {
  _id: string;
  eventId: string;
  title: string;
  durationSeconds: number;
  status: "draft" | "published" | "closed";
  eventStartsAt: string | null;
  eventEndsAt: string | null;
  eventStatus: "draft" | "published" | "cancelled" | "archived" | null;
  /** Window end for published quizzes (per-quiz or fest-wide). */
  endsAt?: string | null;
  /** Set once admin publishes results; scores stay hidden before this. */
  resultsPublishedAt?: string | null;
  round3PublishedAt?: string | null;
  questions: {
    id: string;
    text: string;
    options: string[];
    correctAnswer?: number;
  }[];
};

export type ApiCertificateTemplate = {
  _id: string;
  title: string;
  description: string;
  eventId: string;
  signatureName: string;
  signatureRole: string;
  certificateType?: "participation" | "winner";
  logoUrl?: string;
  signatureImageUrl?: string;
  status: "draft" | "published";
  createdAt: string;
};
