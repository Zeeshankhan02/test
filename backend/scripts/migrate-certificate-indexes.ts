import mongoose from "mongoose";
import { env } from "../src/config/env.js";
import { Certificate } from "../src/modules/models.js";

try {
  await mongoose.connect(env.MONGODB_URI);
  const legacy = await Certificate.find({ eventId: { $exists: false } })
    .populate("templateId", "eventId status")
    .select("templateId issuedAt");
  for (const certificate of legacy) {
    const template = certificate.templateId as unknown as { eventId?: mongoose.Types.ObjectId; status?: string } | null;
    if (!template?.eventId) continue;
    await Certificate.updateOne(
      { _id: certificate._id, eventId: { $exists: false } },
      { $set: { eventId: template.eventId, ...(template.status === "published" ? { publishedAt: certificate.issuedAt } : {}) } },
    );
  }
  const duplicates = await Certificate.aggregate([
    { $match: { eventId: { $exists: true }, staleAt: { $exists: false }, revokedAt: { $exists: false } } },
    { $group: { _id: { eventId: "$eventId", registrationId: "$registrationId", awardType: "$awardType", competitionId: { $ifNull: ["$competitionId", null] } }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 1 },
  ]);
  if (duplicates.length)
    throw new Error("Duplicate active certificates found for one event, registration, and category. Reconcile those records before retrying.");
  const indexes = await Certificate.collection.indexes();
  await Certificate.createIndexes();
  for (const name of ["templateId_1_registrationId_1", "competitionId_1"])
    if (indexes.some((index) => index.name === name)) await Certificate.collection.dropIndex(name);
  console.info("Certificate indexes migrated.");
} finally {
  await mongoose.disconnect();
}
