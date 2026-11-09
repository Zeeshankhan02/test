import { request, json, getAccessToken, baseUrl } from "../client";
import type {
  ApiCertificate,
  ApiEventCertificateStatus,
  ApiCertificateTemplate,
} from "../types";

export const certificatesApi = {
  certificateTemplates: () =>
    request<ApiCertificateTemplate[]>("/certificates/templates"),

  eventCertificates: (eventId: string) =>
    request<ApiEventCertificateStatus>(`/certificates/events/${eventId}`),

  generateEventCertificates: (
    eventId: string,
    input: {
      templateId: string;
      certificateType: "participation" | "winner";
      competitionId?: string;
    },
  ) =>
    request<{ generated: number; total: number }>(
      `/certificates/events/${eventId}/generate`,
      json("POST", input),
    ),

  publishEventCertificates: (
    eventId: string,
    input: {
      certificateType: "participation" | "winner";
      competitionId?: string;
    },
  ) =>
    request<{ published: number; publishedAt: string }>(
      `/certificates/events/${eventId}/publish`,
      json("POST", input),
    ),

  createCertificateTemplate: (
    value: Omit<ApiCertificateTemplate, "_id" | "status" | "createdAt">,
  ) =>
    request<ApiCertificateTemplate>(
      "/certificates/templates",
      json("POST", value),
    ),

  updateCertificateTemplate: (
    id: string,
    value: Omit<ApiCertificateTemplate, "_id" | "status" | "createdAt">,
  ) =>
    request<ApiCertificateTemplate>(
      `/certificates/templates/${id}`,
      json("PATCH", value),
    ),

  publishCertificates: (templateId: string) =>
    request<{ published: number }>(
      "/certificates/publish",
      json("POST", { templateId }),
    ),

  publishWinnerCertificate: (quizId: string, templateId: string) =>
    request<{ _id: string; certificateId: string; userId: string }>(
      `/certificates/competitions/${quizId}/winner`,
      json("POST", { templateId }),
    ),

  myCertificates: () => request<ApiCertificate[]>("/certificates/me"),

  verifyCertificate: (certificateId: string) =>
    request<{
      certificateId: string;
      issuedAt?: string;
      published: boolean;
      valid: boolean;
      status: "valid" | "unpublished" | "revoked";
      recipientName?: string;
      eventName?: string;
      certificateType?: "participation" | "winner";
      rank?: number | null;
      awardPosition?: string | null;
      template?: { title: string };
    }>(`/certificates/verify/${encodeURIComponent(certificateId)}`),

  downloadCertificate: async (certificateDocId: string) => {
    const response = await fetch(
      `${baseUrl}/certificates/${certificateDocId}/download`,
      {
        headers: getAccessToken()
          ? { Authorization: `Bearer ${getAccessToken()}` }
          : {},
        credentials: "include",
      },
    );
    if (!response.ok) {
      const result = (await response.json().catch(() => null)) as {
        error?: { message?: string };
        message?: string;
      } | null;
      throw new Error(
        result?.error?.message ||
          result?.message ||
          `Request failed (${response.status})`,
      );
    }
    return response.blob();
  },
};
