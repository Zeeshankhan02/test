import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import CertificatePdf from "./CertificatePdf";

const document = React.createElement(CertificatePdf, {
  certificate: {
    certificateId: "FQ-SMOKE-123",
    recipientName: "Certificate Smoke Test",
    awardType: "winner",
    rank: 2,
    issuedAt: new Date().toISOString(),
    title: "Achievement",
    signatureName: "Admin",
    signatureRole: "Coordinator",
  },
  eventName: "Test Event",
  verificationUrl: "https://example.test/certificate/verify/FQ-SMOKE-123",
}) as Parameters<typeof renderToBuffer>[0];
const result = await renderToBuffer(document);
if (new TextDecoder().decode(result.subarray(0, 5)) !== "%PDF-")
  throw new Error("Certificate renderer did not produce a PDF");
console.info(`Certificate PDF smoke test passed (${result.length} bytes)`);
