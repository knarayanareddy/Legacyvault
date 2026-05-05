// web/src/lib/discovery.ts
import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

export type TokenHolding = {
  mint: string;
  programId: string; // token program id (classic or token-2022)
  amount: string;    // raw string
  decimals: number;
  uiAmountString: string;
};

export async function discoverTokenHoldingsByOwner(connection: Connection, owner: PublicKey): Promise<TokenHolding[]> {
  const holdings: TokenHolding[] = [];

  for (const pid of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
    try {
      const parsed = await connection.getParsedTokenAccountsByOwner(owner, { programId: pid }, "confirmed");
      for (const acc of parsed.value) {
        const info: any = acc.account.data?.parsed?.info;
        const tokenAmount = info?.tokenAmount;
        if (!info?.mint || !tokenAmount?.amount) continue;
        if (tokenAmount.amount === "0") continue;

        holdings.push({
          mint: info.mint,
          programId: pid.toBase58(),
          amount: tokenAmount.amount,
          decimals: tokenAmount.decimals,
          uiAmountString: tokenAmount.uiAmountString ?? String(tokenAmount.uiAmount ?? "")
        });
      }
    } catch (e) {
      console.error(`[discovery] failed to fetch for program ${pid.toBase58()}`, e);
    }
  }

  // dedupe by mint
  const map = new Map<string, TokenHolding>();
  for (const h of holdings) map.set(h.mint, h);
  return Array.from(map.values());
}
