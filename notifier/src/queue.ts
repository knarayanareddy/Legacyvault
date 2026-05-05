notifier/src/queue.ts

import { Queue } from "bullmq";
import { env } from "./env";

export const emailQueue = new Queue("email", { connection: { url: env.REDIS_URL } });
export const smsQueue = new Queue("sms", { connection: { url: env.REDIS_URL } });
