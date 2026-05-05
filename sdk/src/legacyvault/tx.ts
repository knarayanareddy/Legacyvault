import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import BN from "bn.js";
import {
  approvalPda, assetRulePda, beneficiaryEntryPda, configPda, delegateEntryPda,
  distSolPda, distSplPda, guardianBondPda, guardianEntryPda, guardianProfilePda,
  indexPda, subscriptionPda, unlockPda, vaultAuthPda, vaultPda,
} from "./pdas.js";

export async function ixCreateVault(args: {
  program: Program;
  owner: PublicKey;
  vaultId: bigint;
  heartbeatSecs: number;
  inactivitySecs: number;
  timelockSecs: number;
  panicEnabled: boolean;
}) {
  const { program, owner, vaultId } = args;
  const [cfg] = configPda(program.programId);
  const [vault] = vaultPda(program.programId, owner, vaultId);
  const [vaultAuth] = vaultAuthPda(program.programId, vault);
  const [index] = indexPda(program.programId, vault);

  // treasury is read from config on-chain, but the context expects it; easiest is fetch config
  const cfgAcc: any = await (program.account as any).globalConfig.fetch(cfg);
  const treasury = cfgAcc.treasury as PublicKey;

  return program.methods
    .createVault(
      new BN(vaultId.toString()),
      args.heartbeatSecs,
      args.inactivitySecs,
      args.timelockSecs,
      args.panicEnabled
    )
    .accounts({
      config: cfg,
      vault,
      vaultAuth,
      index,
      owner,
      treasury,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function ixAddBeneficiary(args: {
  program: Program;
  owner: PublicKey;
  vault: PublicKey;
  beneficiary: PublicKey;
  shareBps: number;
  label16: number[]; // length 16
}) {
  const [cfg] = configPda(args.program.programId);
  const [index] = indexPda(args.program.programId, args.vault);
  const [be] = beneficiaryEntryPda(args.program.programId, args.vault, args.beneficiary);

  return args.program.methods
    .addBeneficiary(args.shareBps, args.label16)
    .accounts({
      config: cfg,
      vault: args.vault,
      index,
      beneficiaryEntry: be,
      beneficiary: args.beneficiary,
      owner: args.owner,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function ixUpdateBeneficiary(args: {
  program: Program;
  owner: PublicKey;
  vault: PublicKey;
  beneficiary: PublicKey;
  shareBps: number;
  label16: number[];
  active: boolean;
}) {
  const [cfg] = configPda(args.program.programId);
  const [index] = indexPda(args.program.programId, args.vault);
  const [be] = beneficiaryEntryPda(args.program.programId, args.vault, args.beneficiary);

  return args.program.methods
    .updateBeneficiary(args.shareBps, args.label16, args.active)
    .accounts({
      config: cfg,
      vault: args.vault,
      index,
      beneficiaryEntry: be,
      beneficiary: args.beneficiary,
      owner: args.owner,
    })
    .instruction();
}

export async function ixAddGuardian(args: {
  program: Program;
  owner: PublicKey;
  vault: PublicKey;
  guardian: PublicKey;
  role: number; // enum
}) {
  const [cfg] = configPda(args.program.programId);
  const [index] = indexPda(args.program.programId, args.vault);
  const [ge] = guardianEntryPda(args.program.programId, args.vault, args.guardian);

  return args.program.methods
    .addGuardian(args.role)
    .accounts({
      config: cfg,
      vault: args.vault,
      index,
      guardianEntry: ge,
      guardian: args.guardian,
      owner: args.owner,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function ixSetGuardianThreshold(args: {
  program: Program;
  owner: PublicKey;
  vault: PublicKey;
  threshold: number;
}) {
  const [cfg] = configPda(args.program.programId);
  const [index] = indexPda(args.program.programId, args.vault);

  return args.program.methods
    .setGuardianThreshold(args.threshold)
    .accounts({
      config: cfg,
      vault: args.vault,
      index,
      owner: args.owner,
    })
    .instruction();
}

export async function ixDepositSpl(args: {
  program: Program;
  owner: PublicKey;
  vault: PublicKey;
  mint: PublicKey;
  amount: BN;
}) {
  const [cfg] = configPda(args.program.programId);
  const [vaultAuth] = vaultAuthPda(args.program.programId, args.vault);

  const ownerAta = getAssociatedTokenAddressSync(args.mint, args.owner);
  const vaultAta = getAssociatedTokenAddressSync(args.mint, vaultAuth, true);

  return args.program.methods
    .depositSpl(args.amount)
    .accounts({
      config: cfg,
      vault: args.vault,
      vaultAuth,
      mint: args.mint,
      owner: args.owner,
      ownerAta,
      vaultAta,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"),
      systemProgram: SystemProgram.programId,
      rent: PublicKey.default,
    })
    .instruction();
}

export async function ixInitiateUnlock(args: {
  program: Program;
  vault: PublicKey;
  guardian: PublicKey;
  nonce: bigint; // caller usually fetches vault.currentNonce and adds 1
}) {
  const [cfg] = configPda(args.program.programId);
  const [ge] = guardianEntryPda(args.program.programId, args.vault, args.guardian);
  const [unlock] = unlockPda(args.program.programId, args.vault, args.nonce);

  return args.program.methods
    .initiateUnlock()
    .accounts({
      config: cfg,
      vault: args.vault,
      guardianEntry: ge,
      unlock,
      guardian: args.guardian,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function ixApproveUnlock(args: {
  program: Program;
  vault: PublicKey;
  unlock: PublicKey;
  guardian: PublicKey;
}) {
  const [cfg] = configPda(args.program.programId);
  const [ge] = guardianEntryPda(args.program.programId, args.vault, args.guardian);
  const [approval] = approvalPda(args.program.programId, args.unlock, args.guardian);

  return args.program.methods
    .approveUnlock()
    .accounts({
      config: cfg,
      vault: args.vault,
      guardianEntry: ge,
      unlock: args.unlock,
      approval,
      guardian: args.guardian,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function ixInitDistSol(args: {
  program: Program;
  vault: PublicKey;
  unlock: PublicKey;
  payer: PublicKey;
}) {
  const [cfg] = configPda(args.program.programId);
  const [distSol] = distSolPda(args.program.programId, args.unlock);

  return args.program.methods
    .initDistributionSolSession()
    .accounts({
      config: cfg,
      vault: args.vault,
      unlock: args.unlock,
      distSol,
      payer: args.payer,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function ixInitDistSpl(args: {
  program: Program;
  vault: PublicKey;
  unlock: PublicKey;
  mint: PublicKey;
  payer: PublicKey;
}) {
  const [cfg] = configPda(args.program.programId);
  const [vaultAuth] = vaultAuthPda(args.program.programId, args.vault);
  const [distSpl] = distSplPda(args.program.programId, args.unlock, args.mint);
  const vaultAta = getAssociatedTokenAddressSync(args.mint, vaultAuth, true);

  return args.program.methods
    .initDistributionSplSession()
    .accounts({
      config: cfg,
      vault: args.vault,
      unlock: args.unlock,
      vaultAuth,
      mint: args.mint,
      distSpl,
      vaultAta,
      payer: args.payer,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}
