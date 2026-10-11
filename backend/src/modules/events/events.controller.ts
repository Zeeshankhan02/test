import { asyncRoute } from "../../common/utils/async-route.js";
import { success } from "../../common/responses/success.js";
import { objectId, parseBody } from "../../common/validators/object-id.js";
import {
  addEvent,
  archiveEvent as archive,
  cancelEvent as cancel,
  editEvent,
  findEvent,
  listEventRegistrations,
  publishEvent as publish,
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
