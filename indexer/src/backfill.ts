import { connection, programId } from "./anchor";
import { decodeAnchorEvents } from "./decode";
import { persistEvents } from "./handlers/eventsToDb";
import { prisma } from "./db";

export async function backfillOnce(args: { limit: number }) {
  const cursor = await prisma.indexerCursor.upsert({
    where: { id: "legacyvault" },
    create: { id: "legacyvault", lastSlot: 0n },
    update: {}
  });

  // We backfill by signatures; slot cursor used only for progress reporting.
  // Fetch recent signatures for the program id.
  const sigs = await connection.getSignaturesForAddress(programId, { limit: args.limit }, "confirmed");

  // Process oldest first for more natural state progression
  sigs.reverse();

  let processed = 0;
  for (const s of sigs) {
    const signature = s.signature;

    const already = await prisma.processedTx.findUnique({ where: { signature } });
    if (already) continue;

    const tx = await connection.getTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0
    });
    if (!tx?.meta?.logMessages) continue;

    const events = decodeAnchorEvents(tx.meta.logMessages);
    if (events.length === 0) {
      // still mark as processed to avoid refetch loops if desired:
      // await prisma.processedTx.create({ data: { signature, slot: BigInt(s.slot ?? 0) } });
      continue;
    }

    await persistEvents({
      signature,
      slot: BigInt(s.slot ?? 0),
      programId: programId.toBase58(),
      blockTime: tx.blockTime ? BigInt(tx.blockTime) : null,
      events
    });

    processed++;
  }

  // update slot cursor to max seen
  const maxSlot = sigs.reduce((m, x) => Math.max(m, x.slot ?? 0), 0);
  await prisma.indexerCursor.update({ where: { id: "legacyvault" }, data: { lastSlot: BigInt(maxSlot) } });

  return { processed, fetched: sigs.length, lastSlot: maxSlot };
}
