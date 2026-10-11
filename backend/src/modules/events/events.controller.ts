import { asyncRoute } from "../../common/utils/async-route.js";
import { success } from "../../common/responses/success.js";
import { fail } from "../../common/errors/app-error.js";
import { objectId, parseBody } from "../../common/validators/object-id.js";
import { uploadEventImage } from "../../integrations/cloudinary.js";
import {
  addEvent,
  archiveEvent as archive,
  cancelEvent as cancel,
  clearEventImage,
  deleteEvent as remove,
  editEvent,
  findEvent,
  listEventRegistrations,
  publishEvent as publish,
  removeEventImage,
  searchEvents,
} from "./events.service.js";
import { eventInput, eventQuery, eventUpdateInput } from "./events.validator.js";

export const listEvents = asyncRoute(async (req, res) => {
  const query = parseBody(eventQuery, req.query);
  const result = await searchEvents(query, req.principal?.role === "admin");
  return res.json({ success: true, ...result });
});

export const getEvent = asyncRoute(async (req, res) =>
  success(
    res,
    await findEvent(
      parseBody(objectId, req.params.eventId),
      req.principal?.role === "admin",
    ),
  ),
);

export const createEvent = asyncRoute(async (req, res) => {
  const input = parseBody(eventInput, req.body);
  return success(res, await addEvent(req.principal!.id, input), 201);
});

export const updateEvent = asyncRoute(async (req, res) => {
  const input = parseBody(eventUpdateInput, req.body);
  return success(
    res,
    await editEvent(req.principal!.id, parseBody(objectId, req.params.eventId), input),
  );
});

/**
 * Uploads an event poster to Cloudinary before the event exists. The admin form
 * calls this first so the image can be previewed and attached on submit; if the
 * event creation fails the client calls the delete endpoint with the public id.
 */
export const uploadEventImageFile = asyncRoute(async (req, res) => {
  if (!req.file) return fail(400, "IMAGE_REQUIRED", "Select an image file to upload");
  const uploaded = await uploadEventImage(req.file);
  return success(res, uploaded, 201);
});

/**
 * Removes a previously uploaded poster that never became part of a saved event
 * (for example when event creation failed).
 */
export const deleteEventImageByPublicId = asyncRoute(async (req, res) => {
  const raw = Array.isArray(req.params.publicId)
    ? req.params.publicId.join("/")
    : (req.params.publicId ?? "");
  const decoded = decodeURIComponent(raw).trim().replace(/^\/+/, "");
  if (!decoded || decoded.includes(".."))
    return fail(400, "VALIDATION_ERROR", "Invalid image identifier");
  const deleted = await removeEventImage(decoded);
  if (!deleted) return fail(502, "IMAGE_DELETE_FAILED", "Could not delete the image");
  return success(res, { deleted: true, publicId: decoded });
});

export const removeEvent = asyncRoute(async (req, res) =>
  success(
    res,
    await remove(req.principal!.id, parseBody(objectId, req.params.eventId)),
  ),
);

export const publishEvent = asyncRoute(async (req, res) =>
  success(
    res,
    await publish(req.principal!.id, parseBody(objectId, req.params.eventId)),
  ),
);

export const cancelEvent = asyncRoute(async (req, res) =>
  success(
    res,
    await cancel(req.principal!.id, parseBody(objectId, req.params.eventId)),
  ),
);

export const archiveEvent = asyncRoute(async (req, res) =>
  success(
    res,
    await archive(req.principal!.id, parseBody(objectId, req.params.eventId)),
  ),
);

export const getEventRegistrations = asyncRoute(async (req, res) =>
  success(res, await listEventRegistrations(parseBody(objectId, req.params.eventId))),
);
