import { fail } from "../../common/errors/app-error.js";
import { recordAudit } from "../../common/utils/audit.js";
import { FestConfig } from "../models.js";
import type { FestDatesInput } from "./fest-config.validator.js";

/**
 * Feature 4: a single authoritative configuration record ("current").
 * Public reads only ever expose the schedule fields; admin writes are
 * audited and validated (end-before-start is rejected by the validator).
 */

export async function getFestDates() {
  const config = await FestConfig.findOne({ key: "current" }).lean();
  if (!config) return null;
  return {
    title: config.title ?? null,
    startsAt: config.startsAt ?? null,
    endsAt: config.endsAt ?? null,
    timezone: config.timezone ?? null,
    venue: config.venue ?? null,
    updatedAt: config.updatedAt,
  };
}

export async function updateFestDates(adminId: string, input: FestDatesInput) {
  // Re-validate defensively even though the zod schema already refines it.
  if (input.endsAt < input.startsAt)
    return fail(
      400,
      "INVALID_DATE_RANGE",
      "The fest end date cannot be earlier than the start date",
    );
  const config = await FestConfig.findOneAndUpdate(
    { key: "current" },
    {
      $set: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        ...(input.venue !== undefined ? { venue: input.venue } : {}),
        updatedBy: adminId,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  await recordAudit(adminId, "fest_config.updated", "fest_config", "current", {
    startsAt: input.startsAt.toISOString(),
    endsAt: input.endsAt.toISOString(),
  });
  return {
    title: config?.title ?? null,
    startsAt: config?.startsAt ?? null,
    endsAt: config?.endsAt ?? null,
    timezone: config?.timezone ?? null,
    venue: config?.venue ?? null,
    updatedAt: config?.updatedAt ?? null,
  };
}
