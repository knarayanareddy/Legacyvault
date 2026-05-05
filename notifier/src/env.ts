notifier/src/env.ts

import "dotenv/config";
import { z } from "zod";

const Env = z.object({
  DATABASE_URL: z.string(),
  REDIS_URL: z.string(),
  NOTIFIER_HTTP_PORT: z.string().default("8789"),

  SMTP_HOST: z.string(),
  SMTP_PORT: z.string(),
  SMTP_USER: z.string(),
  SMTP_PASS: z.string(),
  EMAIL_FROM: z.string(),

  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional()
});

export const env = Env.parse(process.env);
