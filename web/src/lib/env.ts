web/src/lib/env.ts

export const WEB = {
  apiBase: process.env.NEXT_PUBLIC_API_BASE!,
  solanaRpc: process.env.NEXT_PUBLIC_SOLANA_RPC_URL!,
  domain: process.env.NEXT_PUBLIC_DOMAIN!
};
