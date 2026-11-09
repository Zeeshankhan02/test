import { request, json, getAccessToken, baseUrl } from "../client";
import type { ApiNotice } from "../types";
import type { Notice } from "../../types";
import { io } from "socket.io-client";

export const notificationsApi = {
  notices: async () =>
    (await request<ApiNotice[]>("/notifications")).map((notice) => ({
      id: notice._id,
      type: notice.type,
      title: notice.title,
      message: notice.message,
      timestamp: notice.createdAt,
      isRead: notice.isRead,
    })),

  subscribeNotifications: (onNotice: (notice: Notice) => void) => {
    if (!getAccessToken())
      throw new Error("Sign in before subscribing to notifications");
    const socket = io(new URL(baseUrl).origin, {
      auth: { token: getAccessToken()! },
    });
    socket.on("notification:new", (row: ApiNotice) =>
      onNotice({
        id: row._id,
        type: row.type,
        title: row.title,
        message: row.message,
        timestamp: row.createdAt,
        isRead: row.isRead,
      }),
    );
    return () => socket.disconnect();
  },

  markNoticeRead: (id: string) =>
    request(`/notifications/${id}/read`, json("PATCH")),

  announce: (
    title: string,
    message: string,
    audience: "students" | "volunteers" | "all",
  ) =>
    request<{ delivered: number; email: { sent: number; failed: number } }>(
      "/notifications",
      json("POST", { title, message, audience }),
    ),
};
