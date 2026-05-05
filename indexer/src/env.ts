indexer/src/env.ts

import "dotenv/config";
import { z } from "zod";

const Env = z.object({
  DATABASE_URL: z.string(),
  REDIS_URL: z.string(),
  SOLANA_RPC_URL: z.string(),
  LEGACYVAULT_PROGRAM_ID: z.string(),

  INDEXER_HTTP_PORT: z.string().default("8787"),
  INDEXER_ENABLE_WS_LOGS: z.string().default("true"),
  INDEXER_ENABLE_HELIUS_WEBHOOK: z.string().default("false"),
  HELIUS_WEBHOOK_AUTH: z.string().optional(),
  INDEXER_BACKFILL_ON_BOOT: z.string().default("false"),
  INDEXER_BACKFILL_LIMIT: z.string().default("200")
});

export const env = Env.parse(process.env);
