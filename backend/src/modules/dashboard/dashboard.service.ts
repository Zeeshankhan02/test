import {
  Certificate,
  CertificateTemplate,
  Event,
  QuizAttempt,
  Registration,
  ScanLog,
  User,
} from "../models.js";

export async function getDashboardData() {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - 6);
  const [
    students,
    users,
    activeVolunteers,
    totalEvents,
    events,
    upcomingEvents,
    registrations,
    teamRegistrations,
    checkIns,
    quizParticipants,
    publishedCertificateTemplates,
    daily,
    eventCounts,
  ] = await Promise.all([
    User.countDocuments({ role: "student" }),
    User.countDocuments(),
    User.countDocuments({ role: "volunteer", active: true }),
    Event.countDocuments(),
    Event.countDocuments({ status: "published" }),
    Event.countDocuments({ status: "published", startsAt: { $gt: new Date() } }),
    Registration.countDocuments({ status: "confirmed" }),
    Registration.countDocuments({
      status: "confirmed",
      teamName: { $exists: true, $ne: "" },
    }),
    ScanLog.countDocuments({ status: "valid_entry" }),
    QuizAttempt.countDocuments({ submittedAt: { $exists: true } }),
    CertificateTemplate.find({ status: "published" }).distinct("_id"),
    Registration.aggregate([
      { $match: { status: "confirmed", createdAt: { $gte: since } } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: "UTC",
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Registration.aggregate([
      { $match: { status: "confirmed" } },
      { $group: { _id: "$eventId", registrations: { $sum: 1 } } },
      { $sort: { registrations: -1 } },
      { $limit: 3 },
    ]),
  ]);
  const topEvents = await Promise.all(
    eventCounts.map(async ({ _id, registrations: count }) => {
      const event = await Event.findOne({ _id, status: "published" })
        .select("title category capacity startsAt")
        .lean();
      return event
        ? {
            id: String(_id),
            title: event.title,
            category: event.category,
            capacity: event.capacity,
            startsAt: event.startsAt,
            registrations: count,
          }
        : null;
    }),
  );
  const byDate = new Map(
    daily.map(({ _id, count }) => [_id as string, count as number]),
  );
  const registrationsByDay = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(since);
    date.setUTCDate(since.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    return { date: key, registrations: byDate.get(key) ?? 0 };
  });
  const publishedCertificates = await Certificate.countDocuments({
    templateId: { $in: publishedCertificateTemplates },
    revokedAt: { $exists: false },
  });
  return {
    students,
    users,
    activeVolunteers,
    totalEvents,
    events,
    upcomingEvents,
    registrations,
    teamRegistrations,
    checkIns,
    quizParticipants,
    publishedCertificates,
    topEvents: topEvents.filter((event) => event !== null),
    registrationsByDay,
  };
}
