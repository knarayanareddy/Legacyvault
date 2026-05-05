indexer/src/main.ts

import express from "express";
import { env } from "./env";
import { logger } from "./logger";
import { startWsLogsIngestor } from "./ingestors/wsLogs";
import { heliusWebhookRouter } from "./ingestors/heliusWebhook";
import { backfillOnce } from "./backfill";
import { registry } from "./metrics";

async function main() {
  const app = express();

  app.get("/health", (_, res) => res.json({ ok: true }));
  app.get("/metrics", async (_, res) => {
    res.set("Content-Type", registry.contentType);
    res.end(await registry.metrics());
  });

  if (env.INDEXER_ENABLE_HELIUS_WEBHOOK === "true") {
    app.use("/webhooks", heliusWebhookRouter());
  }

  app.listen(Number(env.INDEXER_HTTP_PORT), () => {
    logger.info({ port: env.INDEXER_HTTP_PORT }, "indexer http listening");
  });

  if (env.INDEXER_ENABLE_WS_LOGS === "true") {
    await startWsLogsIngestor();
  }

  if (env.INDEXER_BACKFILL_ON_BOOT === "true") {
    const limit = Number(env.INDEXER_BACKFILL_LIMIT);
    backfillOnce({ limit }).then((r) => {
      logger.info({ ...r }, "backfill complete");
    }).catch((err) => logger.error({ err }, "backfill failed"));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
