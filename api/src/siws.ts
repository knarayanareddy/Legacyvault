
import { env } from "./env";

/**
 * Minimal SIWS-style message builder.
 * Phantom documents the canonical “domain wants you to sign in…” pattern and fields
 * like uri, nonce, issued-at. <!--citation:2-->
 */
export function buildSiwsMessage(args: {
  domain: string;
  address: string;
  statement: string;
  uri: string;
  version: string;      // "1"
  chainId: string;      // e.g., "solana:devnet"
  nonce: string;
  issuedAt: string;     // ISO string
  expirationTime?: string;
}): string {
  const lines: string[] = [];

  lines.push(`${args.domain} wants you to sign in with your Solana account:`);
  lines.push(`${args.address}`);
  lines.push("");
  lines.push(args.statement);
  lines.push("");
  lines.push(`URI: ${args.uri}`);
  lines.push(`Version: ${args.version}`);
  lines.push(`Chain ID: ${args.chainId}`);
  lines.push(`Nonce: ${args.nonce}`);
  lines.push(`Issued At: ${args.issuedAt}`);
  if (args.expirationTime) lines.push(`Expiration Time: ${args.expirationTime}`);

  return lines.join("\n");
}

export function defaultStatement() {
  return "Sign in to LegacyVault to manage your vaults and build transactions.";
}
