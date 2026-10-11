import { Router } from "express";
import { allow } from "../../middleware/authorize.middleware.js";
import {
  getMyCertificates,
  listCertificateTemplates,
  publishCertificates,
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
certificatesRoutes.post("/certificates/publish", allow("admin"), publishCertificates);
certificatesRoutes.get("/certificates/me", getMyCertificates);
certificatesRoutes.post(
  "/certificates/:certificateId/revoke",
  allow("admin"),
  revokeCertificate,
);
certificatesRoutes.get("/certificates/verify/:certificateId", verifyCertificate);
