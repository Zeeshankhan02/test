import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  decryptCredentialId,
  encryptCredentialId,
  makeCredential,
  verifyCredential,
} from "../../dist/modules/tickets/ticket-credential.js";

const secret = randomBytes(32).toString("base64url");
const id = randomBytes(32).toString("base64url");
const token = makeCredential(id, secret);
assert.equal(verifyCredential(token, secret), id);
assert.equal(verifyCredential(token, randomBytes(32).toString("base64url")), null);
const [tokenId, signature] = token.split(".");
const changedSignature = `${signature.slice(0, 10)}${signature[10] === "A" ? "B" : "A"}${signature.slice(11)}`;
assert.equal(verifyCredential(`${tokenId}.${changedSignature}`, secret), null);
const encrypted = encryptCredentialId(id, secret);
assert.notEqual(encrypted.credentialCiphertext, id);
assert.equal(decryptCredentialId(encrypted, secret), id);
assert.throws(() =>
  decryptCredentialId(
    {
      ...encrypted,
      credentialTag: `${encrypted.credentialTag[0] === "A" ? "B" : "A"}${encrypted.credentialTag.slice(1)}`,
    },
    secret,
  ),
);
console.log("Ticket credential signature checks passed.");
