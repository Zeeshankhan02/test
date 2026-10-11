export type Role = "student" | "volunteer" | "admin";
export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar: string;
};
export type Event = {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  venue: string;
  category: string;
  status: "draft" | "upcoming" | "live" | "ended" | "cancelled" | "archived";
  maxParticipants: number;
  registered: number;
  image: string;
  imagePublicId?: string;
};
export type Registration = {
  id: string;
  eventId: string;
  userId: string;
  teamName?: string | null;
  members: string[];
  registeredAt: string;
  status: "confirmed" | "pending";
  ticketId: string;
};
export type Volunteer = {
  id: string;
  email: string;
  status: "active" | "inactive";
  createdAt: string;
};
export type CertificateTemplate = {
  id: string;
  title: string;
  description: string;
  eventId: string;
  signatureName: string;
  signatureRole: string;
  status: "draft" | "published";
  createdAt: string;
  recipientCount: number;
};
export type Certificate = {
  id: string;
  templateId: string;
  registrationId: string;
  eventId: string;
  recipientName: string;
  publishedAt: string;
};
export type Scan = {
  id: string;
  ticketId: string;
  scannedBy: string;
  scannedAt: string;
  status: "valid_entry" | "duplicate" | "invalid";
  participantName?: string;
  teamName?: string;
  eventName?: string;
};
export type QuizQuestion = {
  id: string;
  text: string;
  options: string[];
  correctAnswer: number;
};
export type Quiz = {
  id: string;
  title: string;
  duration: number;
  questions: QuizQuestion[];
};
export type Rank = {
  rank: number;
  userName: string;
  score: number;
  timeTaken: string;
};
export type Notice = {
  id: string;
  type: "result" | "event" | "registration" | "announcement" | "system";
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
};
