
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import idl from "../../idl/legacyvault.json" assert { type: "json" };
import { env } from "./env";
import { FailoverConnection } from "./failover";

const urls = env.SOLANA_RPC_URLS.split(",").map(u => u.trim());
const failover = new FailoverConnection(urls, "confirmed");

export const connection = failover.current;
export const programId = new PublicKey(env.LEGACYVAULT_PROGRAM_ID);

// API never signs; wallet is a dummy
export const provider = new AnchorProvider(connection, {} as any, { commitment: "confirmed" });
export const program = new Program(idl as any, programId, provider);
export const withRetry = <T>(fn: (conn: Connection) => Promise<T>) => failover.execute(fn);
