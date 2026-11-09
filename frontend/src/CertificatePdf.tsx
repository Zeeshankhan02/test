import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { renderToStaticMarkup } from "react-dom/server";
import QRCode from "react-qr-code";
import type { ApiCertificate } from "./api";

const styles = StyleSheet.create({
  page: { padding: 28, backgroundColor: "#f8f6ef", color: "#12243a", fontFamily: "Times-Roman" },
  frame: { flex: 1, border: "4pt solid #bd984b", padding: 10 },
  inner: { flex: 1, border: "1.5pt solid #12243a", alignItems: "center", padding: 24, justifyContent: "space-between" },
  logo: { width: 58, height: 58, objectFit: "contain" },
  heading: { fontSize: 12, letterSpacing: 3, color: "#9b762b" },
  title: { fontSize: 28, letterSpacing: 2, marginTop: 8 },
  subtitle: { fontSize: 12, color: "#526174", marginTop: 6 },
  recipient: { fontSize: 34, color: "#12243a", textAlign: "center", marginVertical: 10 },
  event: { fontSize: 16, textAlign: "center" },
  info: { fontSize: 10, color: "#526174", marginTop: 8 },
  footer: { width: "100%", flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 16 },
  signature: { width: 180, borderTop: "1pt solid #9b762b", paddingTop: 6, textAlign: "center", fontSize: 11 },
  qr: { width: 58, height: 58 },
  id: { fontSize: 8, color: "#526174", marginTop: 8 },
});

export default function CertificatePdf({ certificate, eventName, eventDate, festName = "YUKTI", verificationUrl }: { certificate: Partial<ApiCertificate> & { title?: string; description?: string; signatureName?: string; signatureRole?: string; logoUrl?: string; signatureImageUrl?: string }; eventName: string; eventDate?: string; festName?: string; verificationUrl: string }) {
  const rank = certificate.rank;
  const medalColor = rank === 2 ? "#7b8794" : rank === 3 ? "#9a623d" : "#bd984b";
  const award = rank === 1 ? "First Place · Gold" : rank === 2 ? "Second Place · Silver" : rank === 3 ? "Third Place · Bronze" : "Certificate of Participation";
  const qr = `data:image/svg+xml;base64,${btoa(renderToStaticMarkup(<QRCode value={verificationUrl} size={120} />))}`;
  return <Document title={certificate.title || award} author="FestiQO"><Page size="A4" orientation="landscape" style={styles.page}><View style={[styles.frame, { borderColor: medalColor }]}><View style={styles.inner}>
    {certificate.logoUrl ? <Image src={certificate.logoUrl} style={styles.logo} /> : <Text style={[styles.heading, { color: medalColor }]}>{festName}</Text>}
    <View style={{ alignItems: "center" }}><Text style={[styles.heading, { color: medalColor }]}>{festName.toUpperCase()} · OFFICIAL RECOGNITION</Text><Text style={[styles.title, { color: medalColor }]}>{rank ? "CERTIFICATE OF ACHIEVEMENT" : "CERTIFICATE OF PARTICIPATION"}</Text><Text style={styles.subtitle}>{certificate.description || "This certificate is proudly presented to"}</Text><Text style={styles.recipient}>{certificate.recipientName || "Participant"}</Text><Text style={[styles.event, { color: medalColor }]}>{award}</Text><Text style={styles.event}>{eventName}</Text>{eventDate && <Text style={styles.info}>Event completed {new Date(eventDate).toLocaleDateString()}</Text>}<Text style={styles.info}>Issued {new Date(certificate.issuedAt || Date.now()).toLocaleDateString()}</Text></View>
    <View style={styles.footer}><View style={{ alignItems: "center" }}>{certificate.signatureImageUrl && <Image src={certificate.signatureImageUrl} style={{ width: 100, height: 36, objectFit: "contain" }} />}<Text style={styles.signature}>{certificate.signatureName || "Fest Coordinator"}{"\n"}{certificate.signatureRole || "Authorized Signatory"}</Text></View><View style={{ alignItems: "center" }}><Image src={qr} style={styles.qr} /><Text style={styles.id}>{certificate.certificateId}</Text></View></View>
  </View></View></Page></Document>;
}
