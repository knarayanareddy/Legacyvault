notifier/src/workers/smsWorker.ts

import { Worker } from "bullmq";
import { env } from "../env";

export function startSmsWorker() {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_FROM_NUMBER) {
    console.log("[notifier] Twilio not configured; smsWorker disabled");
    return null;
  }

  const twilio = (await import("twilio")).default(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);

  return new Worker("sms", async (job) => {
    const { to, body } = job.data;
    await twilio.messages.create({ from: env.TWILIO_FROM_NUMBER, to, body });
  }, { connection: { url: env.REDIS_URL } });
}
