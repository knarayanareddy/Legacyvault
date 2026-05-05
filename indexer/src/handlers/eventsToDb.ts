// indexer/src/handlers/eventsToDb.ts
import { prisma } from "../db";
import { applyDerivedStateFromEvents } from "./derivedState";

export async function persistEvents(args: {
  signature: string;
  slot: bigint;
  programId: string;
  blockTime?: bigint | null;
  events: Array<{ name: string; data: any }>;
}) {
  await prisma.eventLog.upsert({
    where: { signature: args.signature },
    create: {
      signature: args.signature,
      slot: args.slot,
      programId: args.programId,
      eventName: args.events.map(e => e.name).join(","),
      dataJson: args.events as any,
      blockTime: args.blockTime ?? null
    },
    update: {
      slot: args.slot,
      eventName: args.events.map(e => e.name).join(","),
      dataJson: args.events as any,
      blockTime: args.blockTime ?? null
    }
  });

  // NEW:
  await applyDerivedStateFromEvents({
    signature: args.signature,
    slot: args.slot,
    blockTime: args.blockTime ?? null,
    programId: args.programId,
    events: args.events
  });
}
