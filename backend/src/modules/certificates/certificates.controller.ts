import { asyncRoute } from "../../common/utils/async-route.js";
import { success } from "../../common/responses/success.js";
import { objectId, parseBody } from "../../common/validators/object-id.js";
import {
  addTemplate,
  editTemplate,
  generateEventCertificates,
  getEventCertificateStatus,
  getTemplates,
  issueCertificates,
  listUserCertificates,
  renderCertificatePdf,
  publishEventCertificates as publishGeneratedEventCertificates,
  revokeIssuedCertificate,
  verifyIssuedCertificate,
} from "./certificates.service.js";
import {
  certificateIdentifier,
  certificateTemplateInput,
  certificateTemplateUpdateInput,
  publishCertificateInput,
  generateEventCertificatesInput,
  publishEventCertificatesInput,
} from "./certificates.validator.js";

export const listCertificateTemplates = asyncRoute(async (_req, res) =>
  success(res, await getTemplates()),
);

export const createCertificateTemplate = asyncRoute(async (req, res) => {
  const input = parseBody(certificateTemplateInput, req.body);
  return success(res, await addTemplate(req.principal!.id, input), 201);
});

export const updateCertificateTemplate = asyncRoute(async (req, res) => {
  const input = parseBody(certificateTemplateUpdateInput, req.body);
  return success(
    res,
    await editTemplate(
      req.principal!.id,
      parseBody(objectId, req.params.templateId),
      input,
    ),
  );
});

export const publishCertificates = asyncRoute(async (req, res) => {
  const { templateId } = parseBody(publishCertificateInput, req.body);
  return success(res, await issueCertificates(req.principal!.id, templateId));
});

export const getEventCertificates = asyncRoute(async (req, res) =>
  success(res, await getEventCertificateStatus(parseBody(objectId, req.params.eventId))),
);

export const generateEventCertificateBatch = asyncRoute(async (req, res) => {
  const input = parseBody(generateEventCertificatesInput, req.body);
  return success(res, await generateEventCertificates(req.principal!.id, parseBody(objectId, req.params.eventId), input), 201);
});

export const publishEventCertificateBatch = asyncRoute(async (req, res) => {
  const input = parseBody(publishEventCertificatesInput, req.body);
  return success(res, await publishGeneratedEventCertificates(req.principal!.id, parseBody(objectId, req.params.eventId), input.certificateType, input.competitionId));
});

export const getMyCertificates = asyncRoute(async (req, res) =>
  success(res, await listUserCertificates(req.principal!.id)),
);

/** Streams a real PDF. Ownership/revocation/publication checked server-side. */
export const downloadMyCertificate = asyncRoute(async (req, res) => {
  const file = await renderCertificatePdf(
    req.principal!.id,
    parseBody(objectId, req.params.certificateId),
  );
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${file.filename.replace(/"/g, "")}"`,
  );
  res.setHeader("Cache-Control", "private, no-store");
  return res.status(200).end(file.buffer);
});

export const revokeCertificate = asyncRoute(async (req, res) =>
  success(
    res,
    await revokeIssuedCertificate(
      req.principal!.id,
      parseBody(certificateIdentifier, req.params.certificateId),
    ),
  ),
);

export const verifyCertificate = asyncRoute(async (req, res) =>
  success(
    res,
    await verifyIssuedCertificate(
      parseBody(certificateIdentifier, req.params.certificateId),
    ),
  ),
);
