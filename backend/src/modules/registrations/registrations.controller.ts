import { asyncRoute } from "../../common/utils/async-route.js";
import { success } from "../../common/responses/success.js";
import { objectId, parseBody } from "../../common/validators/object-id.js";
import {
  cancelParticipantRegistration,
  getParticipantRegistration,
  getParticipantRegistrations,
  listRegistrations as getRegistrations,
  registerParticipant,
} from "./registrations.service.js";
import { registrationInput, registrationsQuery } from "./registrations.validator.js";

export const listRegistrations = asyncRoute(async (req, res) => {
  const query = parseBody(registrationsQuery, req.query);
  const result = await getRegistrations(
    query.page,
    query.limit,
    query.status,
    query.eventId,
  );
  return res.json({ success: true, ...result });
});

export const registerForEvent = asyncRoute(async (req, res) => {
  const input = parseBody(registrationInput, req.body);
  const result = await registerParticipant(
    parseBody(objectId, req.params.eventId),
    { id: req.principal!.id, name: req.principal!.name },
    input,
  );
  return success(res, result, 201);
});

export const cancelRegistration = asyncRoute(async (req, res) => {
  await cancelParticipantRegistration(parseBody(objectId, req.params.registrationId), {
    id: req.principal!.id,
    role: req.principal!.role as "student" | "admin",
  });
  return success(res, { cancelled: true });
});

export const getMyRegistration = asyncRoute(async (req, res) =>
  success(res, await getParticipantRegistrations(req.principal!.id)),
);

export const getRegistration = asyncRoute(async (req, res) =>
  success(
    res,
    await getParticipantRegistration(
      parseBody(objectId, req.params.registrationId),
      req.principal!.id,
      req.principal!.role === "admin",
    ),
  ),
);
