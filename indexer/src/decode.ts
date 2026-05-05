indexer/src/decode.ts

import { EventParser } from "@coral-xyz/anchor";
import { programId, program } from "./anchor";

export function decodeAnchorEvents(logs: string[]) {
  const parser = new EventParser(programId, program.coder);
  const events: Array<{ name: string; data: any }> = [];
  parser.parseLogs(logs, (evt) => {
    events.push({ name: evt.name, data: evt.data });
  });
  return events;
}
