import { Router } from "express";
import {
  forgotPassword,
  logout,
  refresh,
  requestSignupOtp,
  resetPassword,
  signIn,
  verifySignupOtp,
} from "./auth.controller.js";

export const publicAuthRoutes = Router();
publicAuthRoutes.post("/signup/request-otp", requestSignupOtp);
publicAuthRoutes.post("/signup/verify-otp", verifySignupOtp);
publicAuthRoutes.post("/login", signIn);
publicAuthRoutes.post("/refresh", refresh);
publicAuthRoutes.post("/logout", logout);
publicAuthRoutes.post("/password/forgot", forgotPassword);
publicAuthRoutes.post("/password/reset", resetPassword);
