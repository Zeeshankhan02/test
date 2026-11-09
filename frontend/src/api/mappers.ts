import type { ApiUser, ApiEvent, ApiVolunteer } from "./types";
import type { Event, User, Volunteer } from "../types";

export function toUser(user: ApiUser): User {
  return {
    ...user,
    avatar:
      user.avatar ||
      `https://i.pravatar.cc/150?u=${encodeURIComponent(user.email)}`,
  };
}

export function toEvent(event: ApiEvent): Event {
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  const status = ["draft", "cancelled", "archived"].includes(event.status)
    ? (event.status as Event["status"])
    : end < new Date()
      ? "ended"
      : start <= new Date()
        ? "live"
        : "upcoming";
  return {
    id: event._id,
    title: event.title,
    description: event.description,
    date: event.startsAt.slice(0, 10),
    time: start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    venue: event.venue,
    category: event.category,
    status,
    maxParticipants: event.capacity,
    registered: event.registeredCount,
    image: event.image || "",
    imagePublicId: event.imagePublicId || "",
    participationType: event.participationType || "individual",
    teamMin: event.teamMin ?? 1,
    teamMax: event.teamMax ?? 1,
    teamLeaderIncluded: event.teamLeaderIncluded ?? true,
  };
}

export function toVolunteer(volunteer: ApiVolunteer): Volunteer {
  return {
    id: volunteer.id || volunteer._id || "",
    email: volunteer.email,
    status: volunteer.active ? "active" : "inactive",
    createdAt: volunteer.createdAt,
  };
}

export function displayName(email: string) {
  return (
    email
      .split("@")[0]
      .replace(/[._-]+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Volunteer"
  );
}
