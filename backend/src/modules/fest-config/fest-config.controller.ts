import { asyncRoute } from "../../common/utils/async-route.js";
import { success } from "../../common/responses/success.js";
import { parseBody } from "../../common/validators/object-id.js";
import { getFestDates, updateFestDates } from "./fest-config.service.js";
import { festDatesSchema } from "./fest-config.validator.js";

export const readFestDates = asyncRoute(async (_req, res) =>
  success(res, await getFestDates()),
);

export const saveFestDates = asyncRoute(async (req, res) => {
  const input = parseBody(festDatesSchema, req.body);
  return success(res, await updateFestDates(req.principal!.id, input));
});
