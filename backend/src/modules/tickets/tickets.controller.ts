import { asyncRoute } from "../../common/utils/async-route.js";
import { success } from "../../common/responses/success.js";
import { objectId, parseBody } from "../../common/validators/object-id.js";
import { getTicket, listTicketsForUser } from "./tickets.service.js";

export const getMyTickets = asyncRoute(async (req, res) =>
  success(res, await listTicketsForUser(req.principal!.id)),
);

export const getTicketById = asyncRoute(async (req, res) =>
  success(
    res,
    await getTicket(
      parseBody(objectId, req.params.ticketId),
      req.principal!.id,
      req.principal!.role === "admin",
    ),
  ),
);
