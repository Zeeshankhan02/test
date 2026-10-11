import { asyncRoute } from "../../common/utils/async-route.js";
import { success } from "../../common/responses/success.js";
import { objectId, parseBody } from "../../common/validators/object-id.js";
import {
  addVolunteer,
  getVolunteers,
  setVolunteerStatus,
} from "./volunteers.service.js";
import {
  volunteerCreateSchema,
  volunteerStatusSchema,
} from "./volunteers.validator.js";

export const listVolunteers = asyncRoute(async (_req, res) =>
  success(res, await getVolunteers()),
);

export const createVolunteer = asyncRoute(async (req, res) => {
  const input = parseBody(volunteerCreateSchema, req.body);
  return success(res, await addVolunteer(req.principal!.id, input), 201);
});

export const updateVolunteerStatus = asyncRoute(async (req, res) => {
  const { active } = parseBody(volunteerStatusSchema, req.body);
  const userId = parseBody(objectId, req.params.userId);
  return success(res, await setVolunteerStatus(req.principal!.id, userId, active));
});
