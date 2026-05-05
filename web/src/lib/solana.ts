web/src/lib/solana.ts

import { Connection } from "@solana/web3.js";
import { WEB } from "./env";
export const connection = new Connection(WEB.solanaRpc, "confirmed");
