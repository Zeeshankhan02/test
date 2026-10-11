import { connectDatabase, disconnectDatabase } from "../src/config/database.js";
import { env } from "../src/config/env.js";
import { Ticket } from "../src/modules/models.js";
import { encryptCredentialId } from "../src/modules/tickets/ticket-credential.js";

await connectDatabase();
let migrated = 0;
try {
  const cursor = Ticket.find({ credentialId: { $exists: true } })
    .select("+credentialId")
    .lean()
    .cursor();
  for await (const ticket of cursor) {
    const credentialId = ticket.credentialId;
    if (!credentialId) continue;
    await Ticket.updateOne(
      { _id: ticket._id, credentialId },
      {
        $set: encryptCredentialId(credentialId, env.JWT_REFRESH_SECRET),
        $unset: { credentialId: 1 },
      },
    );
    migrated += 1;
  }
  console.log(`Encrypted credentials for ${migrated} tickets.`);
} finally {
  await disconnectDatabase();
}
