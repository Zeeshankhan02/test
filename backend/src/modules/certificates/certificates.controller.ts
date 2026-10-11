import { asyncRoute } from "../../common/utils/async-route.js";
import { success } from "../../common/responses/success.js";
import { objectId, parseBody } from "../../common/validators/object-id.js";
import {
  addTemplate,
  editTemplate,
  getTemplates,
  issueCertificates,
  listUserCertificates,
  revokeIssuedCertificate,
  verifyIssuedCertificate,
} from "./certificates.service.js";
import {
  certificateIdentifier,
  certificateTemplateInput,
  certificateTemplateUpdateInput,
  publishCertificateInput,
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

export const getMyCertificates = asyncRoute(async (req, res) =>
  success(res, await listUserCertificates(req.principal!.id)),
);

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
