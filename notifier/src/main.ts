notifier/src/main.ts

import express from "express";
import { env } from "./env";
import { runHourlyScheduler } from "./scheduler";
import { startEmailWorker } from "./workers/emailWorker";

async function main() {
  const app = express();
  app.get("/health", (_, res) => res.json({ ok: true }));

  app.listen(Number(env.NOTIFIER_HTTP_PORT), () => {
    console.log(`[notifier] listening on :${env.NOTIFIER_HTTP_PORT}`);
  });

  startEmailWorker();

  // naive cron loop
  setInterval(() => {
    runHourlyScheduler().catch(console.error);
  }, 60 * 60 * 1000);

  // run once at boot
  await runHourlyScheduler();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
