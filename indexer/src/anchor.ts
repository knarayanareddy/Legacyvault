indexer/src/anchor.ts

import { AnchorProvider, BorshCoder, Program } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import idl from "../../idl/legacyvault.json" assert { type: "json" };
import { env } from "./env";

export const connection = new Connection(env.SOLANA_RPC_URL, "confirmed");
export const programId = new PublicKey(env.LEGACYVAULT_PROGRAM_ID);

// provider wallet is never used for signing here; indexer only decodes
export const provider = new AnchorProvider(connection, {} as any, { commitment: "confirmed" });

export const coder = new BorshCoder(idl as any);
export const program = new Program(idl as any, programId, provider);
