indexer/src/ingestors/wsLogs.ts

import { connection, programId } from "../anchor";
import { decodeAnchorEvents } from "../decode";
import { persistEvents } from "../handlers/eventsToDb";
import { lastProcessedSlotGauge, eventsProcessedCounter } from "../metrics";

export async function startWsLogsIngestor() {
  console.log("[indexer] starting WS logs subscription");

  connection.onLogs(programId, async (logInfo, ctx) => {
    try {
      const events = decodeAnchorEvents(logInfo.logs);
      if (events.length === 0) return;

      await persistEvents({
        signature: logInfo.signature,
        slot: BigInt(ctx.slot),
        programId: programId.toBase58(),
        blockTime: null,
        events
      });

      // Update Metrics
      lastProcessedSlotGauge.set(ctx.slot);
      for (const e of events) {
        eventsProcessedCounter.inc({ event_name: e.name });
      }
    } catch (e) {
      console.error("[indexer][wsLogs] error", e);
    }
  }, "confirmed");
}
