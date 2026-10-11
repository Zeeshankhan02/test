import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.middleware.js";
import { getCurrentUser, updatePassword } from "./users.controller.js";

export const usersRoutes = Router();
usersRoutes.use(authenticate);
usersRoutes.get("/me", getCurrentUser);
usersRoutes.patch("/password", updatePassword);
