import { asyncRoute } from "../../common/utils/async-route.js";
import { success } from "../../common/responses/success.js";
import { parseBody } from "../../common/validators/object-id.js";
import { checkInTicket, getScanSummary, listVolunteerScans } from "./scans.service.js";
import { scanInput } from "./scans.validator.js";

export const verifyScan = asyncRoute(async (req, res) => {
  const { credential } = parseBody(scanInput, req.body);
  return success(res, await checkInTicket(req.principal!.id, credential));
});

export const getVolunteerScanSummary = asyncRoute(async (req, res) =>
  success(res, await getScanSummary(req.principal!.id)),
);

export const getVolunteerScanHistory = asyncRoute(async (req, res) =>
  success(res, await listVolunteerScans(req.principal!.id)),
);
