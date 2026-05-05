notifier/src/workers/emailWorker.ts

import nodemailer from "nodemailer";
import { Worker } from "bullmq";
import { env } from "../env";

const transport = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: Number(env.SMTP_PORT),
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS }
});

export function startEmailWorker() {
  return new Worker("email", async (job) => {
    const { to, subject, text } = job.data;
    await transport.sendMail({ from: env.EMAIL_FROM, to, subject, text });
  }, { connection: { url: env.REDIS_URL } });
}
