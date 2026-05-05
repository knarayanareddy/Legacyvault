
import { Connection, PublicKey, Transaction } from "@solana/web3.js";

export async function buildUnsignedTxBase64(args: {
  connection: Connection;
  feePayer: PublicKey;
  ixs: any[];
}) {
  const { blockhash, lastValidBlockHeight } = await args.connection.getLatestBlockhash("confirmed");

  const tx = new Transaction();
  tx.feePayer = args.feePayer;
  tx.recentBlockhash = blockhash;
  tx.add(...args.ixs);

  const b64 = tx.serialize({ requireAllSignatures: false }).toString("base64");
  return { txBase64: b64, blockhash, lastValidBlockHeight };
}
