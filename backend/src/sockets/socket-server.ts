import type { Server as HttpServer } from "node:http";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { env } from "../config/env.js";
import { allowedOrigins } from "../config/cors.js";
import { User } from "../modules/models.js";

export type SocketPrincipal = {
  id: string;
  role: "student" | "volunteer" | "admin";
};

let socketServer: Server | null = null;

export function attachSocketServer(server: HttpServer) {
  socketServer = new Server(server, {
    cors: { origin: [...allowedOrigins], credentials: true },
  });
  socketServer.use((socket, next) => {
    try {
      const payload = jwt.verify(
        String(socket.handshake.auth.token || ""),
        env.JWT_ACCESS_SECRET,
        { issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE },
      );
      if (
        typeof payload === "string" ||
        !payload.sub ||
        !payload.exp ||
        !Number.isInteger(payload.ver) ||
        !["student", "volunteer", "admin"].includes(String(payload.role))
      ) {
        return next(new Error("Authentication required"));
      }
      const tokenUser = {
        id: payload.sub,
        role: payload.role as SocketPrincipal["role"],
        ver: Number(payload.ver),
      };
      void User.findById(tokenUser.id)
        .select("active role +tokenVersion")
        .lean()
        .then((user) => {
          if (!user?.active || (user.tokenVersion || 0) !== tokenUser.ver)
            return next(new Error("Authentication required"));
          socket.data.principal = {
            id: tokenUser.id,
            role: tokenUser.role,
          } satisfies SocketPrincipal;
          socket.data.expiry = setTimeout(
            () => socket.disconnect(true),
            Math.max(0, Number(payload.exp) * 1000 - Date.now()),
          );
          socket.once("disconnect", () => clearTimeout(socket.data.expiry));
          next();
        })
        .catch(() => next(new Error("Authentication required")));
    } catch {
      next(new Error("Authentication required"));
    }
  });
  socketServer.on("connection", (socket) => {
    const principal = socket.data.principal as SocketPrincipal;
    socket.join(`user:${principal.id}`);
  });
  return socketServer;
}

export function emitUserNotification(userId: string, notification: unknown) {
  socketServer?.to(`user:${userId}`).emit("notification:new", notification);
}

export function disconnectUserSockets(userId: string) {
  socketServer?.in(`user:${userId}`).disconnectSockets(true);
}

export async function closeSocketServer() {
  if (!socketServer) return;
  const current = socketServer;
  socketServer = null;
  await new Promise<void>((resolve) => current.close(() => resolve()));
}
