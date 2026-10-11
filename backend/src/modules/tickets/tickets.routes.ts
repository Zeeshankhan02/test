import { Router } from "express";
import { getMyTickets, getTicketById } from "./tickets.controller.js";

export const ticketsRoutes = Router();

ticketsRoutes.get("/tickets/me", getMyTickets);
ticketsRoutes.get("/tickets/:ticketId", getTicketById);
