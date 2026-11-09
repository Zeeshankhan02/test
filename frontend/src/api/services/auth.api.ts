import { request, raw, json, setAccessToken } from "../client";
import { toUser } from "../mappers";
import type { ApiUser } from "../types";

export const authApi = {
  async login(email: string, password: string) {
    const session = await raw<{ accessToken: string; user: ApiUser }>(
      "/auth/login",
      json("POST", { email, password }),
    );
    setAccessToken(session.accessToken);
    return toUser(session.user);
  },

  requestSignupOtp: (name: string, email: string, password: string) =>
    request<{ message: string }>(
      "/auth/signup/request-otp",
      json("POST", { name, email, password }),
    ),

  async verifySignupOtp(email: string, otp: string) {
    const session = await raw<{ accessToken: string; user: ApiUser }>(
      "/auth/signup/verify-otp",
      json("POST", { email, otp }),
    );
    setAccessToken(session.accessToken);
    return toUser(session.user);
  },

  async logout() {
    try {
      await request("/auth/logout", json("POST"));
    } finally {
      setAccessToken(null);
    }
  },

  async changePassword(currentPassword: string, newPassword: string) {
    await request(
      "/auth/password",
      json("PATCH", { currentPassword, newPassword }),
    );
    setAccessToken(null);
  },

  requestPasswordReset: (email: string) =>
    request<{ message: string }>(
      "/auth/password/forgot",
      json("POST", { email }),
    ),

  resetPassword: (email: string, otp: string, password: string) =>
    request<{ changed: boolean }>(
      "/auth/password/reset",
      json("POST", { email, otp, password }),
    ),
};
