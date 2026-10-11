import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export const makeCredential = (id: string, secret: string) =>
  `${id}.${createHmac("sha256", secret).update(`ticket:${id}`).digest("base64url")}`;

export function verifyCredential(token: string, secret: string): string | null {
  const [id, signature, ...extra] = token.split(".");
  if (!id || !signature || extra.length || !/^[A-Za-z0-9_-]{40,50}$/.test(id))
    return null;
  const expected = createHmac("sha256", secret).update(`ticket:${id}`).digest();
  const actual = Buffer.from(signature, "base64url");
  return actual.length === expected.length &&
    actual.toString("base64url") === signature &&
    timingSafeEqual(actual, expected)
    ? id
    : null;
}

export function encryptCredentialId(id: string, secret: string) {
  const key = createHash("sha256").update(`festiqo-ticket:${secret}`).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(id, "utf8"), cipher.final()]);
  return {
    credentialCiphertext: ciphertext.toString("base64url"),
    credentialIv: iv.toString("base64url"),
    credentialTag: cipher.getAuthTag().toString("base64url"),
  };
}

export function decryptCredentialId(
  encrypted: {
    credentialCiphertext: string;
    credentialIv: string;
    credentialTag: string;
  },
  secret: string,
) {
  const key = createHash("sha256").update(`festiqo-ticket:${secret}`).digest();
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(encrypted.credentialIv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(encrypted.credentialTag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted.credentialCiphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
