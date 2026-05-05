indexer/src/ingestors/heliusWebhook.ts

import express from "express";
import { env } from "../env";
import { decodeAnchorEvents } from "../decode";
import { persistEvents } from "../handlers/eventsToDb";
import { programId } from "../anchor";

/**
 * Helius webhooks can be configured with an authHeader that Helius includes
 * in deliveries; validate it here. <!--citation:5-->
 */
export function heliusWebhookRouter() {
  const router = express.Router();

  router.post("/helius", express.json({ limit: "2mb" }), async (req, res) => {
    try {
      const auth = req.headers["authorization"];
      if (env.HELIUS_WEBHOOK_AUTH && auth !== env.HELIUS_WEBHOOK_AUTH) {
        return res.status(401).json({ ok: false });
      }

      // Enhanced webhook payload is typically an array of tx objects
      const payload = req.body;
      const txs = Array.isArray(payload) ? payload : [payload];

      for (const tx of txs) {
        const signature = tx?.signature ?? tx?.transaction?.signatures?.[0];
        const logs: string[] = tx?.transaction?.meta?.logMessages ?? tx?.meta?.logMessages ?? [];
        if (!signature || logs.length === 0) continue;

        // only keep txs that actually mention the program id in logs (cheap filter)
        if (!logs.some(l => l.includes(programId.toBase58()))) continue;

        const events = decodeAnchorEvents(logs);
        if (events.length === 0) continue;

        await persistEvents({
          signature,
          slot: BigInt(tx?.slot ?? 0),
          programId: programId.toBase58(),
          blockTime: tx?.blockTime ? BigInt(tx.blockTime) : null,
          events
        });
      }

      res.json({ ok: true });
    } catch (e) {
      console.error("[indexer][heliusWebhook] error", e);
      res.status(500).json({ ok: false });
    }
  });

  return router;
}
