import { request, json } from "../client";
import type { ApiScan } from "../types";

export const scansApi = {
  verifyTicket: (credential: string) =>
    request<{
      status: "valid_entry" | "duplicate" | "invalid";
      ticketId?: string;
      participant?: {
        name: string;
        teamName: string | null;
        eventName: string;
      };
    }>("/scans/verify", json("POST", { credential })),

  scans: async () =>
    (await request<ApiScan[]>("/volunteers/me/scans")).map((scan) => ({
      id: scan._id,
      ticketId: scan.ticketId || "—",
      scannedBy: scan.volunteerId,
      scannedAt: scan.scannedAt,
      participantName: scan.participantName,
      teamName: scan.teamName,
      eventName: scan.eventName,
      status:
        scan.status === "valid_entry"
          ? "valid_entry"
          : scan.status === "already_scanned"
            ? "duplicate"
            : "invalid",
    })),

  volunteerSummary: () =>
    request<{
      todayCheckIns: number;
      todayScans: number;
      totalCheckIns: number;
      recent: {
        id: string;
        scannedAt: string;
        status: string;
        participantName: string;
        teamName: string;
        eventName: string;
      }[];
    }>("/volunteers/me/summary"),
};
