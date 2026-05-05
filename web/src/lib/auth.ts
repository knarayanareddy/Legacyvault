web/src/lib/auth.ts

import bs58 from "bs58";
import { apiFetch } from "./api";
import { WEB } from "./env";

export function buildSiwsMessageClient(args: {
  domain: string;
  address: string;
  statement: string;
  uri: string;
  version: string;
  chainId: string;
  nonce: string;
  issuedAt: string;
}) {
  return [
    `${args.domain} wants you to sign in with your Solana account:`,
    `${args.address}`,
    "",
    args.statement,
    "",
    `URI: ${args.uri}`,
    `Version: ${args.version}`,
    `Chain ID: ${args.chainId}`,
    `Nonce: ${args.nonce}`,
    `Issued At: ${args.issuedAt}`
  ].join("\n");
}

export async function siwsSignIn(args: {
  wallet: { publicKey: any; signMessage: (msg: Uint8Array) => Promise<Uint8Array> };
}) {
  const nonceResp = await apiFetch("/v1/auth/nonce", { method: "POST", body: JSON.stringify({}) });

  const walletStr = args.wallet.publicKey.toBase58();
  const statement = "Sign in to LegacyVault to manage your vaults and build transactions.";

  const message = buildSiwsMessageClient({
    domain: WEB.domain,
    address: walletStr,
    statement,
    uri: `http://${WEB.domain}`,
    version: "1",
    chainId: "solana:devnet",
    nonce: nonceResp.nonce,
    issuedAt: nonceResp.issuedAt
  });

  const sigBytes = await args.wallet.signMessage(new TextEncoder().encode(message));
  const signatureBase58 = bs58.encode(sigBytes);

  const verify = await apiFetch("/v1/auth/verify", {
    method: "POST",
    body: JSON.stringify({
      wallet: walletStr,
      message,
      signatureBase58,
      nonce: nonceResp.nonce,
      issuedAt: nonceResp.issuedAt
    })
  });

  localStorage.setItem("lv_token", verify.token);
  return verify;
}
