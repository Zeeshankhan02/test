import { Router } from "express";
import {
  forgotPassword,
  logout,
  refresh,
  resetPassword,
  signIn,
  signup,
} from "./auth.controller.js";

export const publicAuthRoutes = Router();
publicAuthRoutes.post("/signup", signup);
publicAuthRoutes.post("/login", signIn);
publicAuthRoutes.post("/refresh", refresh);
publicAuthRoutes.post("/logout", logout);
publicAuthRoutes.post("/password/forgot", forgotPassword);
publicAuthRoutes.post("/password/reset", resetPassword);
