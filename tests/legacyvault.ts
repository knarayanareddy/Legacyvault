import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Legacyvault } from "../target/types/legacyvault";
import { expect } from "chai";

describe("legacyvault", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Legacyvault as Program<Legacyvault>;

  it("Is initialized!", async () => {
    // Add test logic here
  });
});
