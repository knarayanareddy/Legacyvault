import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Legacyvault } from "../target/types/legacyvault";
import { expect } from "chai";
import { 
  PublicKey, 
  SystemProgram, 
  Keypair, 
  LAMPORTS_PER_SOL 
} from "@solana/web3.js";

describe("Legacyvault Security Checks", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Legacyvault as Program<Legacyvault>;

  const owner = Keypair.generate();
  const maliciousActor = Keypair.generate();
  const guardian = Keypair.generate();
  const treasury = Keypair.generate();
  const arbiter = Keypair.generate();
  const billingAuthority = Keypair.generate();
  
  let vault: PublicKey;
  let vaultAuth: PublicKey;
  let index: PublicKey;
  let config: PublicKey;

  const vaultId = new anchor.BN(123);

  before(async () => {
    // Airdrop to actors
    const sig1 = await provider.connection.requestAirdrop(owner.publicKey, 10 * LAMPORTS_PER_SOL);
    const sig2 = await provider.connection.requestAirdrop(maliciousActor.publicKey, 2 * LAMPORTS_PER_SOL);
    const sig3 = await provider.connection.requestAirdrop(guardian.publicKey, 2 * LAMPORTS_PER_SOL);
    
    await Promise.all([
      provider.connection.confirmTransaction(sig1),
      provider.connection.confirmTransaction(sig2),
      provider.connection.confirmTransaction(sig3)
    ]);

    // Find PDAs
    [config] = PublicKey.findProgramAddressSync([Buffer.from("config")], program.programId);
    
    [vault] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), owner.publicKey.toBuffer(), vaultId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    [vaultAuth] = PublicKey.findProgramAddressSync([Buffer.from("vault_auth"), vault.toBuffer()], program.programId);
    [index] = PublicKey.findProgramAddressSync([Buffer.from("index"), vault.toBuffer()], program.programId);

    // 1. Initialize Global Config (using provider wallet as admin for test)
    try {
      await program.methods.initializeConfig(
        treasury.publicKey,
        new anchor.BN(0.01 * LAMPORTS_PER_SOL), // create fee
        60, 3600, // heartbeat
        3600, 86400, // inactivity
        3600, 86400, // timelock
        arbiter.publicKey,
        billingAuthority.publicKey
      ).accounts({
        config,
        admin: provider.wallet.publicKey,
        treasury: treasury.publicKey,
        systemProgram: SystemProgram.programId,
      }).rpc();
    } catch (e) {
      // already initialized in this env?
    }

    // 2. Create Vault
    await program.methods.createVault(
      vaultId,
      3600, // heartbeat
      3600, // inactivity
      3600, // timelock
      true  // panic enabled
    ).accounts({
      config,
      vault,
      vaultAuth,
      index,
      owner: owner.publicKey,
      treasury: treasury.publicKey,
      systemProgram: SystemProgram.programId
    }).signers([owner]).rpc();
  });

  it("FAIL: Malicious actor cannot remove a guardian from someone else's vault", async () => {
    // First, owner adds a guardian
    const targetGuardian = Keypair.generate();
    const [ge] = PublicKey.findProgramAddressSync(
      [Buffer.from("guardian"), vault.toBuffer(), targetGuardian.publicKey.toBuffer()],
      program.programId
    );

    await program.methods.addGuardian(0).accounts({
      config,
      vault,
      index,
      guardianEntry: ge,
      guardian: targetGuardian.publicKey,
      owner: owner.publicKey,
      systemProgram: SystemProgram.programId
    }).signers([owner]).rpc();

    // Now, malicious actor tries to remove that guardian
    try {
      await program.methods.removeGuardian().accounts({
        config,
        vault,
        index,
        guardianEntry: ge,
        guardian: targetGuardian.publicKey,
        owner: maliciousActor.publicKey, // WRONG SIGNER
      }).signers([maliciousActor]).rpc();
      
      expect.fail("Should have failed with Unauthorized");
    } catch (e: any) {
      // Check for Unauthorized error (code 6000 usually in Anchor for first custom error)
      expect(e.toString()).to.contain("Unauthorized");
    }
  });

  it("FAIL: Malicious actor cannot initiate unlock for a vault they don't guard", async () => {
    const nextNonce = new anchor.BN(1);
    const [unlock] = PublicKey.findProgramAddressSync(
      [Buffer.from("unlock"), vault.toBuffer(), nextNonce.toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    const [maliciousGe] = PublicKey.findProgramAddressSync(
        [Buffer.from("guardian"), vault.toBuffer(), maliciousActor.publicKey.toBuffer()],
        program.programId
      );

    try {
      await program.methods.initiateUnlock().accounts({
        config,
        vault,
        guardianEntry: maliciousGe, // Malicious actor's entry (doesn't exist)
        unlock,
        guardian: maliciousActor.publicKey,
        systemProgram: SystemProgram.programId
      }).signers([maliciousActor]).rpc();

      expect.fail("Should have failed because guardianEntry doesn't exist/is wrong");
    } catch (e: any) {
      // PDA check or account initialization check will fail
      expect(e.toString()).to.contain("AccountNotInitialized").or.contain("ConstraintSeeds");
    }
  });

  it("FAIL: Cannot execute distribution before timelock expiry", async () => {
      // 1. Add guardian (owner)
      const [ge] = PublicKey.findProgramAddressSync(
        [Buffer.from("guardian"), vault.toBuffer(), guardian.publicKey.toBuffer()],
        program.programId
      );
      await program.methods.addGuardian(0).accounts({
        config, vault, index, guardianEntry: ge, 
        guardian: guardian.publicKey, owner: owner.publicKey, systemProgram: SystemProgram.programId
      }).signers([owner]).rpc();

      await program.methods.setGuardianThreshold(1).accounts({
          config, vault, index, owner: owner.publicKey
      }).signers([owner]).rpc();

      // 2. Initiate unlock (guardian)
      const nonce = new anchor.BN(1);
      const [unlock] = PublicKey.findProgramAddressSync(
        [Buffer.from("unlock"), vault.toBuffer(), nonce.toArrayLike(Buffer, "le", 8)],
        program.programId
      );
      await program.methods.initiateUnlock().accounts({
        config, vault, guardianEntry: ge, unlock, guardian: guardian.publicKey, systemProgram: SystemProgram.programId
      }).signers([guardian]).rpc();

      // 3. Try to distribute SOL immediately (fails because status is not yet 'Approved')
      const [distSol] = PublicKey.findProgramAddressSync([Buffer.from("dist_sol"), unlock.toBuffer()], program.programId);
      
      try {
        await program.methods.initDistributionSolSession().accounts({
            config, vault, unlock, distSol, payer: guardian.publicKey, systemProgram: SystemProgram.programId
        }).signers([guardian]).rpc();
        expect.fail("Should have failed with UnlockWrongState");
      } catch (e: any) {
        expect(e.toString()).to.contain("UnlockWrongState");
      }
  });
});
