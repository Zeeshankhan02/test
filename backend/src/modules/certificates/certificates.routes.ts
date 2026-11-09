import { Router } from "express";
import { allow } from "../../middleware/authorize.middleware.js";
import {
  downloadMyCertificate,
  generateEventCertificateBatch,
  getEventCertificates,
  getMyCertificates,
  listCertificateTemplates,
  publishCertificates,
  publishEventCertificateBatch,
  revokeCertificate,
  updateCertificateTemplate,
  verifyCertificate,
  createCertificateTemplate,
} from "./certificates.controller.js";

export const certificatesRoutes = Router();
certificatesRoutes.get(
  "/certificates/templates",
  allow("admin"),
  listCertificateTemplates,
);
certificatesRoutes.post(
  "/certificates/templates",
  allow("admin"),
  createCertificateTemplate,
);
certificatesRoutes.patch(
  "/certificates/templates/:templateId",
  allow("admin"),
  updateCertificateTemplate,
);
certificatesRoutes.get("/certificates/events/:eventId", allow("admin"), getEventCertificates);
certificatesRoutes.post("/certificates/events/:eventId/generate", allow("admin"), generateEventCertificateBatch);
certificatesRoutes.post("/certificates/events/:eventId/publish", allow("admin"), publishEventCertificateBatch);
certificatesRoutes.post("/certificates/publish", allow("admin"), publishCertificates);
certificatesRoutes.get("/certificates/me", getMyCertificates);
// Real PDF download; the service verifies recipient ownership + status.
certificatesRoutes.get("/certificates/:certificateId/download", downloadMyCertificate);
certificatesRoutes.post(
  "/certificates/:certificateId/revoke",
  allow("admin"),
  revokeCertificate,
);
certificatesRoutes.get("/certificates/verify/:certificateId", verifyCertificate);
