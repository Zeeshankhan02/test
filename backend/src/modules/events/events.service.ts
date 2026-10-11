import { AppError, fail } from "../../common/errors/app-error.js";
import { recordAudit } from "../../common/utils/audit.js";
import { emitUserNotification } from "../../sockets/socket-server.js";
import { Event, Notification, Registration, Ticket } from "../models.js";
import type { z } from "zod";
import type { eventInput, eventQuery, eventUpdateInput } from "./events.validator.js";

type EventData = z.infer<typeof eventInput>;

export async function searchEvents(
  query: z.infer<typeof eventQuery>,
  isAdmin: boolean,
) {
  const filter = {
    status: isAdmin ? { $in: ["draft", "published", "cancelled"] } : "published",
    ...(query.category ? { category: query.category } : {}),
    ...(query.q
      ? {
          title: {
            $regex: query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            $options: "i",
          },
        }
      : {}),
  };
  const [data, total] = await Promise.all([
    Event.find(filter)
      .sort({ startsAt: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Event.countDocuments(filter),
  ]);
  return {
    data,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function findEvent(eventId: string, isAdmin: boolean) {
  const event = await Event.findOne({
    _id: eventId,
    ...(isAdmin ? {} : { status: "published" }),
  }).lean();
  if (!event) return fail(404, "NOT_FOUND", "Event not found");
  return event;
}

export async function addEvent(adminId: string, input: EventData) {
  const event = await Event.create(input);
  await recordAudit(adminId, "event.created", "event", String(event._id));
  return event;
}

export async function editEvent(
  adminId: string,
  eventId: string,
  changes: z.input<typeof eventUpdateInput>,
) {
  const current = await Event.findById(eventId).select(
    "registeredCount startsAt endsAt teamMin teamMax",
  );
  if (!current) return fail(404, "NOT_FOUND", "Event not found");
  if (changes.capacity !== undefined && changes.capacity < current.registeredCount)
    return fail(
      409,
      "CAPACITY_TOO_LOW",
      "Capacity cannot be lower than existing registrations",
    );
  const startsAt = changes.startsAt
    ? Date.parse(changes.startsAt)
    : current.startsAt.getTime();
  const endsAt = changes.endsAt ? Date.parse(changes.endsAt) : current.endsAt.getTime();
  const teamMin = changes.teamMin ?? current.teamMin;
  const teamMax = changes.teamMax ?? current.teamMax;
  if (endsAt <= startsAt || teamMax < teamMin)
    return fail(400, "VALIDATION_ERROR", "Invalid event dates or team size");
  const event = await Event.findByIdAndUpdate(
    eventId,
    { $set: changes },
    { new: true, runValidators: true },
  );
  if (!event) return fail(404, "NOT_FOUND", "Event not found");
  await recordAudit(adminId, "event.updated", "event", String(event._id));
  return event;
}

export async function publishEvent(adminId: string, eventId: string) {
  const event = await Event.findByIdAndUpdate(
    eventId,
    { $set: { status: "published" } },
    { new: true },
  );
  if (!event) return fail(404, "NOT_FOUND", "Event not found");
  await recordAudit(adminId, "event.published", "event", String(event._id));
  return event;
}

export async function cancelEvent(adminId: string, eventId: string) {
  const session = await Event.db.startSession();
  let notificationIds: string[] = [];
  try {
    await session.withTransaction(async () => {
      notificationIds = [];
      const current = await Event.findOne({
        _id: eventId,
        status: { $in: ["draft", "published"] },
      }).session(session);
      if (!current) return fail(404, "NOT_FOUND", "Event not found or already closed");
      const registrations = await Registration.find({ eventId, status: "confirmed" })
        .select("_id userId members")
        .session(session)
        .lean();
      if (registrations.length > 25_000)
        return fail(
          503,
          "AUDIENCE_TOO_LARGE",
          "Event cancellation exceeds synchronous notification limits",
        );
      const registrationIds = registrations.map((registration) => registration._id);
      const activeTickets = await Ticket.find({
        registrationId: { $in: registrationIds },
        status: "active",
      })
        .select("registrationId")
        .session(session)
        .lean();
      const activeIdSet = new Set(
        activeTickets.map((ticket) => String(ticket.registrationId)),
      );
      const activeRegistrations = registrations.filter((registration) =>
        activeIdSet.has(String(registration._id)),
      );
      const activeRegistrationIds = activeRegistrations.map((row) => row._id);
      const cancelledCount = activeRegistrations.reduce(
        (count, registration) => count + registration.members.length,
        0,
      );
      const cancelled = await Event.findOneAndUpdate(
        { _id: eventId, status: { $in: ["draft", "published"] } },
        {
          $set: { status: "cancelled" },
          ...(cancelledCount ? { $inc: { registeredCount: -cancelledCount } } : {}),
        },
        { new: true, session },
      );
      if (!cancelled)
        return fail(409, "INVALID_TRANSITION", "Event could not be cancelled");
      if (activeRegistrationIds.length) {
        await Registration.updateMany(
          { _id: { $in: activeRegistrationIds }, status: "confirmed" },
          { $set: { status: "cancelled" } },
          { session },
        );
        await Ticket.updateMany(
          { registrationId: { $in: activeRegistrationIds }, status: "active" },
          { $set: { status: "cancelled" } },
          { session },
        );
        const notices = await Notification.insertMany(
          activeRegistrations.map((registration) => ({
            userId: registration.userId,
            type: "event",
            title: "Event cancelled",
            message: `${current.title} has been cancelled.`,
          })),
          { session },
        );
        notificationIds = notices.map((notice) => String(notice._id));
      }
    });
  } finally {
    await session.endSession();
  }
  const notices = await Notification.find({ _id: { $in: notificationIds } }).lean();
  notices.forEach((notice) => emitUserNotification(String(notice.userId), notice));
  const event = await Event.findById(eventId).lean();
  if (!event) return fail(409, "INVALID_TRANSITION", "Event could not be cancelled");
  await recordAudit(adminId, "event.cancelled", "event", String(event._id));
  return event;
}

export async function archiveEvent(adminId: string, eventId: string) {
  const event = await Event.findOneAndUpdate(
    { _id: eventId, status: { $in: ["cancelled", "published"] } },
    { $set: { status: "archived" } },
    { new: true },
  );
  if (!event)
    throw new AppError(
      409,
      "INVALID_TRANSITION",
      "Only published or cancelled events can be archived",
    );
  await recordAudit(adminId, "event.archived", "event", String(event._id));
  return event;
}

export async function listEventRegistrations(eventId: string) {
  return Registration.find({ eventId }).populate("userId", "name email").lean();
}
