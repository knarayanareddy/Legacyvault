
import "dotenv/config";
import { z } from "zod";

const Env = z.object({
  DATABASE_URL: z.string(),
  REDIS_URL: z.string(),
  SOLANA_RPC_URLS: z.string().default("https://api.mainnet-beta.solana.com"),
  LEGACYVAULT_PROGRAM_ID: z.string(),

  API_HTTP_PORT: z.string().default("8788"),
  API_JWT_SECRET: z.string(),
  API_DOMAIN: z.string(),
  API_ORIGIN: z.string(),
  API_SESSION_TTL_SECS: z.string().default("604800")
});

export const env = Env.parse(process.env);
