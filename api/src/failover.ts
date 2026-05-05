import { Connection, Commitment } from "@solana/web3.js";
import { logger } from "./logger";

export class FailoverConnection {
  private connections: Connection[];
  private currentIndex: number = 0;

  constructor(urls: string[], commitment: Commitment = "confirmed") {
    this.connections = urls.map(url => new Connection(url, commitment));
  }

  get current(): Connection {
    return this.connections[this.currentIndex];
  }

  async execute<T>(fn: (conn: Connection) => Promise<T>): Promise<T> {
    let lastError: any;
    
    // Try all connections starting from current
    for (let i = 0; i < this.connections.length; i++) {
      const idx = (this.currentIndex + i) % this.connections.length;
      const conn = this.connections[idx];

      try {
        const result = await fn(conn);
        this.currentIndex = idx; // stay on this one if it worked
        return result;
      } catch (err: any) {
        lastError = err;
        logger.warn({ 
          url: conn.rpcEndpoint, 
          err: err.message,
          attempt: i + 1 
        }, "RPC call failed, trying next...");
      }
    }

    throw lastError;
  }
}
