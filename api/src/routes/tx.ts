// api/src/routes/tx.ts
import express from "express";
import { z } from "zod";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  SYSVAR_RENT_PUBKEY
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction
} from "@solana/spl-token";
import BN from "bn.js";

import { requireAuth } from "../auth";
import { program, connection } from "../anchor";
import { buildUnsignedTxBase64 } from "../txbuild";

// PDAs from sdk (workspace)
import { legacyvaultPdas as pdas } from "@legacyvault/sdk";

export const txRouter = express.Router();

const PubkeyStr = z.string().refine((s) => {
  try { new PublicKey(s); return true; } catch { return false; }
}, "Invalid pubkey");

function pk(s: string) { return new PublicKey(s); }

async function buildTx(res: any, feePayer: PublicKey, ixs: TransactionInstruction[], meta: any = {}) {
  const built = await buildUnsignedTxBase64({ connection, feePayer, ixs });
  res.json({ ok: true, ...built, meta });
}

async function getConfig() {
  const [cfg] = pdas.configPda(program.programId);
  return program.account.globalConfig.fetch(cfg) as any;
}

async function getVaultAcc(vault: PublicKey) {
  return program.account.vault.fetch(vault) as any;
}

async function getIndexAcc(vault: PublicKey) {
  const [index] = pdas.indexPda(program.programId, vault);
  return { index, acc: await program.account.vaultIndex.fetch(index) as any };
}

async function maybeCreateAtaIx(payer: PublicKey, owner: PublicKey, mint: PublicKey) {
  const ata = getAssociatedTokenAddressSync(mint, owner, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
  const info = await connection.getAccountInfo(ata, "confirmed");
  if (info) return { ata, ix: null as any };
  const ix = createAssociatedTokenAccountInstruction(
    payer, ata, owner, mint, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return { ata, ix };
}

/**
 * NOTE: label16 and fixed byte arrays:
 * - beneficiary label: 16 bytes (numbers 0..255)
 * In JS we create it using: Buffer.from(str.padEnd(16,"\0")).slice(0,16)
 */

txRouter.post("/create-vault", requireAuth, express.json(), async (req: any, res) => {
  const Body = z.object({
    vaultId: z.string(),
    heartbeatSecs: z.number().int().positive(),
    inactivitySecs: z.number().int().positive(),
    timelockSecs: z.number().int().positive(),
    panicEnabled: z.boolean()
  });
  const body = Body.parse(req.body);
  const owner = pk(req.user.wallet);

  const [cfg] = pdas.configPda(program.programId);
  const cfgAcc: any = await program.account.globalConfig.fetch(cfg);
  const treasury = cfgAcc.treasury as PublicKey;

  const [vault] = pdas.vaultPda(program.programId, owner, BigInt(body.vaultId));
  const [vaultAuth] = pdas.vaultAuthPda(program.programId, vault);
  const [index] = pdas.indexPda(program.programId, vault);

  const ix = await program.methods
    .createVault(
      new BN(body.vaultId),
      body.heartbeatSecs,
      body.inactivitySecs,
      body.timelockSecs,
      body.panicEnabled
    )
    .accounts({
      config: cfg,
      vault,
      vaultAuth,
      index,
      owner,
      treasury,
      systemProgram: SystemProgram.programId
    })
    .instruction();

  await buildTx(res, owner, [ix], { vault: vault.toBase58() });
});

// ---------------------
// Documents
// ---------------------
txRouter.post("/set-document", requireAuth, express.json(), async (req: any, res) => {
  const Body = z.object({
    vault: PubkeyStr,
    docHashHex: z.string().length(64),
    docUri: z.string().max(200)
  });
  const body = Body.parse(req.body);

  const owner = pk(req.user.wallet);
  const vault = pk(body.vault);
  const [cfg] = pdas.configPda(program.programId);

  const docHash = Uint8Array.from(Buffer.from(body.docHashHex, "hex"));
  const docUriBytes = Array.from(Buffer.from(body.docUri, "utf8"));

  const ix = await program.methods
    .setDocument(Array.from(docHash) as any, docUriBytes)
    .accounts({ config: cfg, vault, owner })
    .instruction();

  await buildTx(res, owner, [ix]);
});

// ---------------------
// Guardians
// ---------------------
txRouter.post("/add-guardian", requireAuth, express.json(), async (req: any, res) => {
  const Body = z.object({
    vault: PubkeyStr,
    guardian: PubkeyStr,
    role: z.number().int().min(0).max(1) // 0 personal, 1 professional
  });
  const body = Body.parse(req.body);

  const owner = pk(req.user.wallet);
  const vault = pk(body.vault);
  const guardian = pk(body.guardian);

  const [cfg] = pdas.configPda(program.programId);
  const [index] = pdas.indexPda(program.programId, vault);
  const [ge] = pdas.guardianEntryPda(program.programId, vault, guardian);

  const ix = await program.methods
    .addGuardian(body.role)
    .accounts({
      config: cfg, vault, index,
      guardianEntry: ge,
      guardian,
      owner,
      systemProgram: SystemProgram.programId
    })
    .instruction();

  await buildTx(res, owner, [ix]);
});

txRouter.post("/remove-guardian", requireAuth, express.json(), async (req: any, res) => {
  const Body = z.object({ vault: PubkeyStr, guardian: PubkeyStr });
  const body = Body.parse(req.body);

  const owner = pk(req.user.wallet);
  const vault = pk(body.vault);
  const guardian = pk(body.guardian);

  const [cfg] = pdas.configPda(program.programId);
  const [index] = pdas.indexPda(program.programId, vault);
  const [ge] = pdas.guardianEntryPda(program.programId, vault, guardian);

  const ix = await program.methods
    .removeGuardian()
    .accounts({
      config: cfg, vault, index,
      guardianEntry: ge,
      guardian,
      owner
    })
    .instruction();

  await buildTx(res, owner, [ix]);
});

txRouter.post("/set-guardian-threshold", requireAuth, express.json(), async (req: any, res) => {
  const Body = z.object({ vault: PubkeyStr, threshold: z.number().int().min(1).max(255) });
  const body = Body.parse(req.body);

  const owner = pk(req.user.wallet);
  const vault = pk(body.vault);

  const [cfg] = pdas.configPda(program.programId);
  const [index] = pdas.indexPda(program.programId, vault);

  const ix = await program.methods
    .setGuardianThreshold(body.threshold)
    .accounts({ config: cfg, vault, index, owner })
    .instruction();

  await buildTx(res, owner, [ix]);
});

// ---------------------
// Beneficiaries
// ---------------------
txRouter.post("/add-beneficiary", requireAuth, express.json(), async (req: any, res) => {
  const Body = z.object({
    vault: PubkeyStr,
    beneficiary: PubkeyStr,
    shareBps: z.number().int().min(1).max(10_000),
    label: z.string().max(16).default("")
  });
  const body = Body.parse(req.body);

  const owner = pk(req.user.wallet);
  const vault = pk(body.vault);
  const beneficiary = pk(body.beneficiary);

  const label16 = Array.from(Buffer.from(body.label.padEnd(16, "\0")).slice(0, 16));
  const [cfg] = pdas.configPda(program.programId);
  const [index] = pdas.indexPda(program.programId, vault);
  const [be] = pdas.beneficiaryEntryPda(program.programId, vault, beneficiary);

  const ix = await program.methods
    .addBeneficiary(body.shareBps, label16)
    .accounts({
      config: cfg, vault, index,
      beneficiaryEntry: be,
      beneficiary,
      owner,
      systemProgram: SystemProgram.programId
    })
    .instruction();

  await buildTx(res, owner, [ix]);
});

txRouter.post("/update-beneficiary", requireAuth, express.json(), async (req: any, res) => {
  const Body = z.object({
    vault: PubkeyStr,
    beneficiary: PubkeyStr,
    shareBps: z.number().int().min(0).max(10_000),
    label: z.string().max(16).default(""),
    active: z.boolean()
  });
  const body = Body.parse(req.body);

  const owner = pk(req.user.wallet);
  const vault = pk(body.vault);
  const beneficiary = pk(body.beneficiary);

  const label16 = Array.from(Buffer.from(body.label.padEnd(16, "\0")).slice(0, 16));
  const [cfg] = pdas.configPda(program.programId);
  const [index] = pdas.indexPda(program.programId, vault);
  const [be] = pdas.beneficiaryEntryPda(program.programId, vault, beneficiary);

  const ix = await program.methods
    .updateBeneficiary(body.shareBps, label16, body.active)
    .accounts({ config: cfg, vault, index, beneficiaryEntry: be, beneficiary, owner })
    .instruction();

  await buildTx(res, owner, [ix]);
});

txRouter.post("/remove-beneficiary", requireAuth, express.json(), async (req: any, res) => {
  const Body = z.object({ vault: PubkeyStr, beneficiary: PubkeyStr });
  const body = Body.parse(req.body);

  const owner = pk(req.user.wallet);
  const vault = pk(body.vault);
  const beneficiary = pk(body.beneficiary);

  const [cfg] = pdas.configPda(program.programId);
  const [index] = pdas.indexPda(program.programId, vault);
  const [be] = pdas.beneficiaryEntryPda(program.programId, vault, beneficiary);

  const ix = await program.methods
    .removeBeneficiary()
    .accounts({ config: cfg, vault, index, beneficiaryEntry: be, beneficiary, owner })
    .instruction();

  await buildTx(res, owner, [ix]);
});

txRouter.post("/assert-beneficiary-total-10k", requireAuth, express.json(), async (req: any, res) => {
  const Body = z.object({ vault: PubkeyStr });
  const body = Body.parse(req.body);

  const owner = pk(req.user.wallet);
  const vault = pk(body.vault);
  const [cfg] = pdas.configPda(program.programId);
  const { index, acc } = await getIndexAcc(vault);

  const remaining = (acc.beneficiaries as PublicKey[]).map((b) => {
    const [be] = pdas.beneficiaryEntryPda(program.programId, vault, b);
    return { pubkey: be, isSigner: false, isWritable: false };
  });

  const ix = await program.methods
    .assertBeneficiaryTotal10k()
    .accounts({ config: cfg, vault, index, owner })
    .remainingAccounts(remaining)
    .instruction();

  await buildTx(res, owner, [ix], { beneficiaries: remaining.length });
});

// ---------------------
// Asset rules
// ---------------------
txRouter.post("/set-asset-rule", requireAuth, express.json(), async (req: any, res) => {
  const Body = z.object({
    vault: PubkeyStr,
    mint: PubkeyStr,
    mode: z.number().int().min(0).max(1), // 0=ProRata,1=AssignAll
    assignedBeneficiary: PubkeyStr.optional()
  });
  const body = Body.parse(req.body);

  const owner = pk(req.user.wallet);
  const vault = pk(body.vault);
  const mint = pk(body.mint);

  const [cfg] = pdas.configPda(program.programId);
  const [index] = pdas.indexPda(program.programId, vault);
  const [assetRule] = pdas.assetRulePda(program.programId, vault, mint);

  const assigned = body.assignedBeneficiary ? pk(body.assignedBeneficiary) : new PublicKey("11111111111111111111111111111111");

  const ix = await program.methods
    .setAssetRule(body.mode)
    .accounts({
      config: cfg,
      vault,
      index,
      mint,
      assetRule,
      assignedBeneficiary: assigned,
      owner,
      systemProgram: SystemProgram.programId
    })
    .instruction();

  await buildTx(res, owner, [ix]);
});

txRouter.post("/clear-asset-rule", requireAuth, express.json(), async (req: any, res) => {
  const Body = z.object({ vault: PubkeyStr, mint: PubkeyStr });
  const body = Body.parse(req.body);

  const owner = pk(req.user.wallet);
  const vault = pk(body.vault);
  const mint = pk(body.mint);

  const [cfg] = pdas.configPda(program.programId);
  const [assetRule] = pdas.assetRulePda(program.programId, vault, mint);

  const ix = await program.methods
    .clearAssetRule()
    .accounts({ config: cfg, vault, mint, assetRule, owner })
    .instruction();

  await buildTx(res, owner, [ix]);
});

// ---------------------
// Deposits/withdrawals
// ---------------------
txRouter.post("/deposit-sol", requireAuth, express.json(), async (req: any, res) => {
  const Body = z.object({ vault: PubkeyStr, lamports: z.string() });
  const body = Body.parse(req.body);

  const owner = pk(req.user.wallet);
  const vault = pk(body.vault);
  const [cfg] = pdas.configPda(program.programId);

  const ix = await program.methods
    .depositSol(new BN(body.lamports))
    .accounts({ config: cfg, vault, owner, systemProgram: SystemProgram.programId })
    .instruction();

  await buildTx(res, owner, [ix]);
});

txRouter.post("/withdraw-sol", requireAuth, express.json(), async (req: any, res) => {
  const Body = z.object({ vault: PubkeyStr, lamports: z.string() });
  const body = Body.parse(req.body);

  const owner = pk(req.user.wallet);
  const vault = pk(body.vault);
  const [cfg] = pdas.configPda(program.programId);

  const ix = await program.methods
    .withdrawSol(new BN(body.lamports))
    .accounts({ config: cfg, vault, owner, systemProgram: SystemProgram.programId })
    .instruction();

  await buildTx(res, owner, [ix]);
});

txRouter.post("/deposit-spl", requireAuth, express.json(), async (req: any, res) => {
  const Body = z.object({ vault: PubkeyStr, mint: PubkeyStr, amount: z.string() });
  const body = Body.parse(req.body);

  const owner = pk(req.user.wallet);
  const vault = pk(body.vault);
  const mint = pk(body.mint);

  const [cfg] = pdas.configPda(program.programId);
  const [vaultAuth] = pdas.vaultAuthPda(program.programId, vault);

  const ownerAta = getAssociatedTokenAddressSync(mint, owner);
  const vaultAta = getAssociatedTokenAddressSync(mint, vaultAuth, true);

  const ix = await program.methods
    .depositSpl(new BN(body.amount))
    .accounts({
      config: cfg, vault, vaultAuth, mint,
      owner,
      ownerAta,
      vaultAta,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY
    })
    .instruction();

  await buildTx(res, owner, [ix]);
});

txRouter.post("/withdraw-spl", requireAuth, express.json(), async (req: any, res) => {
  const Body = z.object({ vault: PubkeyStr, mint: PubkeyStr, amount: z.string() });
  const body = Body.parse(req.body);

  const owner = pk(req.user.wallet);
  const vault = pk(body.vault);
  const mint = pk(body.mint);

  const [cfg] = pdas.configPda(program.programId);
  const [vaultAuth] = pdas.vaultAuthPda(program.programId, vault);

  const ownerAta = getAssociatedTokenAddressSync(mint, owner);
  const vaultAta = getAssociatedTokenAddressSync(mint, vaultAuth, true);

  const ix = await program.methods
    .withdrawSpl(new BN(body.amount))
    .accounts({
      config: cfg, vault, vaultAuth, mint,
      owner,
      ownerAta,
      vaultAta,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY
    })
    .instruction();

  await buildTx(res, owner, [ix]);
});

// ---------------------
// Liveness
// ---------------------
txRouter.post("/check-in", requireAuth, express.json(), async (req: any, res) => {
  const Body = z.object({ vault: PubkeyStr });
  const body = Body.parse(req.body);

  const owner = pk(req.user.wallet);
  const vault = pk(body.vault);
  const [cfg] = pdas.configPda(program.programId);

  const ix = await program.methods
    .checkIn()
    .accounts({ config: cfg, vault, owner })
    .instruction();

  await buildTx(res, owner, [ix]);
});

txRouter.post("/add-delegate", requireAuth, express.json(), async (req: any, res) => {
  const Body = z.object({ vault: PubkeyStr, delegate: PubkeyStr });
  const body = Body.parse(req.body);

  const owner = pk(req.user.wallet);
  const vault = pk(body.vault);
  const delegate = pk(body.delegate);

  const [cfg] = pdas.configPda(program.programId);
  const [de] = pdas.delegateEntryPda(program.programId, vault, delegate);

  const ix = await program.methods
    .addLivenessDelegate()
    .accounts({
      config: cfg,
      vault,
      delegateEntry: de,
      delegate,
      owner,
      systemProgram: SystemProgram.programId
    })
    .instruction();

  await buildTx(res, owner, [ix]);
});

txRouter.post("/remove-delegate", requireAuth, express.json(), async (req: any, res) => {
  const Body = z.object({ vault: PubkeyStr, delegate: PubkeyStr });
  const body = Body.parse(req.body);

  const owner = pk(req.user.wallet);
  const vault = pk(body.vault);
  const delegate = pk(body.delegate);

  const [cfg] = pdas.configPda(program.programId);
  const [de] = pdas.delegateEntryPda(program.programId, vault, delegate);

  const ix = await program.methods
    .removeLivenessDelegate()
    .accounts({ config: cfg, vault, delegateEntry: de, delegate, owner })
    .instruction();

  await buildTx(res, owner, [ix]);
});

txRouter.post("/delegate-check-in", requireAuth, express.json(), async (req: any, res) => {
  const Body = z.object({ vault: PubkeyStr, delegate: PubkeyStr });
  const body = Body.parse(req.body);

  const delegate = pk(req.user.wallet);
  const vault = pk(body.vault);

  const [cfg] = pdas.configPda(program.programId);
  const [de] = pdas.delegateEntryPda(program.programId, vault, delegate);

  const ix = await program.methods
    .delegateCheckIn()
    .accounts({ config: cfg, vault, delegateEntry: de, delegate })
    .instruction();

  await buildTx(res, delegate, [ix]);
});

// ---------------------
// Freeze
// ---------------------
txRouter.post("/panic-freeze", requireAuth, express.json(), async (req: any, res) => {
  const Body = z.object({ vault: PubkeyStr });
  const body = Body.parse(req.body);

  const owner = pk(req.user.wallet);
  const vault = pk(body.vault);
  const [cfg] = pdas.configPda(program.programId);

  const ix = await program.methods
    .panicFreeze()
    .accounts({ config: cfg, vault, owner })
    .instruction();

  await buildTx(res, owner, [ix]);
});

txRouter.post("/unfreeze", requireAuth, express.json(), async (req: any, res) => {
  const Body = z.object({ vault: PubkeyStr });
  const body = Body.parse(req.body);

  const owner = pk(req.user.wallet);
  const vault = pk(body.vault);
  const [cfg] = pdas.configPda(program.programId);

  const ix = await program.methods
    .unfreeze()
    .accounts({ config: cfg, vault, owner })
    .instruction();

  await buildTx(res, owner, [ix]);
});

// ---------------------
// Unlock
// ---------------------
txRouter.post("/initiate-unlock", requireAuth, express.json(), async (req: any, res) => {
  const Body = z.object({ vault: PubkeyStr });
  const body = Body.parse(req.body);

  const guardian = pk(req.user.wallet);
  const vault = pk(body.vault);
  const [cfg] = pdas.configPda(program.programId);

  const vaultAcc: any = await getVaultAcc(vault);
  const nextNonce = BigInt(vaultAcc.currentNonce.toString()) + 1n;
  const [unlock] = pdas.unlockPda(program.programId, vault, nextNonce);
  const [ge] = pdas.guardianEntryPda(program.programId, vault, guardian);

  const ix = await program.methods
    .initiateUnlock()
    .accounts({
      config: cfg,
      vault,
      guardianEntry: ge,
      unlock,
      guardian,
      systemProgram: SystemProgram.programId
    })
    .instruction();

  await buildTx(res, guardian, [ix], { unlock: unlock.toBase58(), nonce: nextNonce.toString() });
});

txRouter.post("/approve-unlock", requireAuth, express.json(), async (req: any, res) => {
  const Body = z.object({ vault: PubkeyStr, unlock: PubkeyStr });
  const body = Body.parse(req.body);

  const guardian = pk(req.user.wallet);
  const vault = pk(body.vault);
  const unlock = pk(body.unlock);

  const [cfg] = pdas.configPda(program.programId);
  const [ge] = pdas.guardianEntryPda(program.programId, vault, guardian);
  const [approval] = pdas.approvalPda(program.programId, unlock, guardian);

  const ix = await program.methods
    .approveUnlock()
    .accounts({
      config: cfg,
      vault,
      guardianEntry: ge,
      unlock,
      approval,
      guardian,
      systemProgram: SystemProgram.programId
    })
    .instruction();

  await buildTx(res, guardian, [ix]);
});

txRouter.post("/cancel-unlock", requireAuth, express.json(), async (req: any, res) => {
  const Body = z.object({ vault: PubkeyStr, unlock: PubkeyStr });
  const body = Body.parse(req.body);

  const owner = pk(req.user.wallet);
  const vault = pk(body.vault);
  const unlock = pk(body.unlock);

  const [cfg] = pdas.configPda(program.programId);

  const ix = await program.methods
    .cancelUnlock()
    .accounts({ config: cfg, vault, unlock, owner })
    .instruction();

  await buildTx(res, owner, [ix]);
});

// ---------------------
// Dispute
// ---------------------
txRouter.post("/open-dispute", requireAuth, express.json(), async (req: any, res) => {
  const Body = z.object({
    vault: PubkeyStr,
    unlock: PubkeyStr,
    noteHashHex: z.string().length(64)
  });
  const body = Body.parse(req.body);

  const opener = pk(req.user.wallet);
  const vault = pk(body.vault);
  const unlock = pk(body.unlock);

  const [cfg] = pdas.configPda(program.programId);
  const [dispute] = pdas.disputePda(program.programId, unlock);

  const noteHash = Uint8Array.from(Buffer.from(body.noteHashHex, "hex"));

  const ix = await program.methods
    .openDispute(Array.from(noteHash) as any)
    .accounts({
      config: cfg,
      vault,
      unlock,
      dispute,
      opener,
      systemProgram: SystemProgram.programId
    })
    .instruction();

  await buildTx(res, opener, [ix]);
});

txRouter.post("/resolve-dispute-cancel", requireAuth, express.json(), async (req: any, res) => {
  const Body = z.object({ vault: PubkeyStr, unlock: PubkeyStr });
  const body = Body.parse(req.body);

  const arbiter = pk(req.user.wallet);
  const vault = pk(body.vault);
  const unlock = pk(body.unlock);

  const [cfg] = pdas.configPda(program.programId);
  const [dispute] = pdas.disputePda(program.programId, unlock);

  const ix = await program.methods
    .resolveDisputeCancel()
    .accounts({ config: cfg, vault, unlock, dispute, arbiter })
    .instruction();

  await buildTx(res, arbiter, [ix]);
});

txRouter.post("/resolve-dispute-proceed", requireAuth, express.json(), async (req: any, res) => {
  const Body = z.object({ vault: PubkeyStr, unlock: PubkeyStr });
  const body = Body.parse(req.body);

  const arbiter = pk(req.user.wallet);
  const vault = pk(body.vault);
  const unlock = pk(body.unlock);

  const [cfg] = pdas.configPda(program.programId);
  const [dispute] = pdas.disputePda(program.programId, unlock);

  const ix = await program.methods
    .resolveDisputeProceed()
    .accounts({ config: cfg, vault, unlock, dispute, arbiter })
    .instruction();

  await buildTx(res, arbiter, [ix]);
});

// ---------------------
// Distribution (SOL)
// ---------------------
txRouter.post("/init-dist-sol", requireAuth, express.json(), async (req: any, res) => {
  const Body = z.object({ vault: PubkeyStr, unlock: PubkeyStr });
  const body = Body.parse(req.body);

  const payer = pk(req.user.wallet);
  const vault = pk(body.vault);
  const unlock = pk(body.unlock);

  const [cfg] = pdas.configPda(program.programId);
  const [distSol] = pdas.distSolPda(program.programId, unlock);

  const ix = await program.methods
    .initDistributionSolSession()
    .accounts({
      config: cfg,
      vault,
      unlock,
      distSol,
      payer,
      systemProgram: SystemProgram.programId
    })
    .instruction();

  await buildTx(res, payer, [ix], { distSol: distSol.toBase58() });
});

txRouter.post("/exec-dist-sol-batch", requireAuth, express.json(), async (req: any, res) => {
  const Body = z.object({
    vault: PubkeyStr,
    unlock: PubkeyStr,
    startIndex: z.number().int().min(0),
    batchSize: z.number().int().min(1).max(25)
  });
  const body = Body.parse(req.body);

  const payer = pk(req.user.wallet);
  const vault = pk(body.vault);
  const unlock = pk(body.unlock);

  const [cfg] = pdas.configPda(program.programId);
  const [index] = pdas.indexPda(program.programId, vault);
  const [distSol] = pdas.distSolPda(program.programId, unlock);

  const idxAcc: any = await program.account.vaultIndex.fetch(index);
  const ben: PublicKey[] = idxAcc.beneficiaries;

  const slice = ben.slice(body.startIndex, body.startIndex + body.batchSize);
  const remaining = [];
  for (const b of slice) {
    const [be] = pdas.beneficiaryEntryPda(program.programId, vault, b);
    remaining.push({ pubkey: be, isSigner: false, isWritable: false });
    remaining.push({ pubkey: b, isSigner: false, isWritable: true });
  }

  const ix = await program.methods
    .executeDistributionSolBatch(body.startIndex, slice.length)
    .accounts({
      config: cfg,
      vault,
      unlock,
      index,
      distSol,
      systemProgram: SystemProgram.programId
    })
    .remainingAccounts(remaining)
    .instruction();

  await buildTx(res, payer, [ix], { totalBeneficiaries: ben.length });
});

// ---------------------
// Distribution (SPL)
// ---------------------
txRouter.post("/init-dist-spl", requireAuth, express.json(), async (req: any, res) => {
  const Body = z.object({ vault: PubkeyStr, unlock: PubkeyStr, mint: PubkeyStr });
  const body = Body.parse(req.body);

  const payer = pk(req.user.wallet);
  const vault = pk(body.vault);
  const unlock = pk(body.unlock);
  const mint = pk(body.mint);

  const [cfg] = pdas.configPda(program.programId);
  const [vaultAuth] = pdas.vaultAuthPda(program.programId, vault);
  const [distSpl] = pdas.distSplPda(program.programId, unlock, mint);

  const { ata: vaultAta, ix: createVaultAtaIx } = await maybeCreateAtaIx(payer, vaultAuth, mint);

  const ix = await program.methods
    .initDistributionSplSession()
    .accounts({
      config: cfg,
      vault,
      unlock,
      vaultAuth,
      mint,
      distSpl,
      vaultAta,
      payer,
      systemProgram: SystemProgram.programId
    })
    .instruction();

  const ixs = [createVaultAtaIx, ix].filter(Boolean) as TransactionInstruction[];
  await buildTx(res, payer, ixs, { vaultAta: vaultAta.toBase58(), distSpl: distSpl.toBase58() });
});

txRouter.post("/exec-dist-spl-batch", requireAuth, express.json(), async (req: any, res) => {
  const Body = z.object({
    vault: PubkeyStr,
    unlock: PubkeyStr,
    mint: PubkeyStr,
    startIndex: z.number().int().min(0),
    batchSize: z.number().int().min(1).max(10),
    createMissingAtas: z.boolean().default(false)
  });
  const body = Body.parse(req.body);

  const payer = pk(req.user.wallet);
  const vault = pk(body.vault);
  const unlock = pk(body.unlock);
  const mint = pk(body.mint);

  const [cfg] = pdas.configPda(program.programId);
  const [vaultAuth] = pdas.vaultAuthPda(program.programId, vault);
  const [index] = pdas.indexPda(program.programId, vault);
  const [distSpl] = pdas.distSplPda(program.programId, unlock, mint);

  const vaultAta = getAssociatedTokenAddressSync(mint, vaultAuth, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

  const idxAcc: any = await program.account.vaultIndex.fetch(index);
  const ben: PublicKey[] = idxAcc.beneficiaries;

  const slice = ben.slice(body.startIndex, body.startIndex + body.batchSize);

  const preIxs: TransactionInstruction[] = [];
  const remaining: any[] = [];

  for (const b of slice) {
    const [be] = pdas.beneficiaryEntryPda(program.programId, vault, b);
    const ata = getAssociatedTokenAddressSync(mint, b, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

    if (body.createMissingAtas) {
      const info = await connection.getAccountInfo(ata, "confirmed");
      if (!info) {
        preIxs.push(
          createAssociatedTokenAccountInstruction(
            payer, ata, b, mint, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
          )
        );
      }
    }

    remaining.push({ pubkey: be, isSigner: false, isWritable: false });
    remaining.push({ pubkey: b, isSigner: false, isWritable: false });
    remaining.push({ pubkey: ata, isSigner: false, isWritable: true });
  }

  const ix = await program.methods
    .executeDistributionSplBatch(body.startIndex, slice.length)
    .accounts({
      config: cfg,
      vault,
      vaultAuth,
      unlock,
      index,
      mint,
      distSpl,
      vaultAta,
      tokenProgram: TOKEN_PROGRAM_ID
    })
    .remainingAccounts(remaining)
    .instruction();

  await buildTx(res, payer, [...preIxs, ix], { totalBeneficiaries: ben.length });
});

// finalize unlock (requires dist_sol + remaining dist_spl sessions)
txRouter.post("/finalize-unlock", requireAuth, express.json(), async (req: any, res) => {
  const Body = z.object({
    vault: PubkeyStr,
    unlock: PubkeyStr,
    splMints: z.array(PubkeyStr).default([])
  });
  const body = Body.parse(req.body);

  const payer = pk(req.user.wallet);
  const vault = pk(body.vault);
  const unlock = pk(body.unlock);

  const [cfg] = pdas.configPda(program.programId);
  const [distSol] = pdas.distSolPda(program.programId, unlock);

  const remaining = body.splMints.map((m) => {
    const mint = pk(m);
    const [distSpl] = pdas.distSplPda(program.programId, unlock, mint);
    return { pubkey: distSpl, isSigner: false, isWritable: false };
  });

  const ix = await program.methods
    .finalizeUnlock()
    .accounts({ config: cfg, vault, unlock, distSol })
    .remainingAccounts(remaining)
    .instruction();

  await buildTx(res, payer, [ix]);
});

// ---------------------
// Subscription
// ---------------------
txRouter.post("/set-subscription", requireAuth, express.json(), async (req: any, res) => {
  const Body = z.object({
    vault: PubkeyStr,
    planId: z.number().int().min(0).max(255),
    validUntilUnix: z.string()
  });
  const body = Body.parse(req.body);

  const authority = pk(req.user.wallet);
  const vault = pk(body.vault);

  const [cfg] = pdas.configPda(program.programId);
  const [sub] = pdas.subscriptionPda(program.programId, vault);

  const ix = await program.methods
    .setSubscription(body.planId, new BN(body.validUntilUnix))
    .accounts({
      config: cfg,
      vault,
      subscription: sub,
      authority,
      payer: authority,
      systemProgram: SystemProgram.programId
    })
    .instruction();

  await buildTx(res, authority, [ix]);
});

txRouter.post("/renew-subscription", requireAuth, express.json(), async (req: any, res) => {
  const Body = z.object({
    vault: PubkeyStr,
    planId: z.number().int().min(0).max(255),
    addSecs: z.string(),
    feeLamports: z.string()
  });
  const body = Body.parse(req.body);

  const payer = pk(req.user.wallet);
  const vault = pk(body.vault);

  const cfgAcc = await getConfig();
  const treasury = cfgAcc.treasury as PublicKey;

  const [cfg] = pdas.configPda(program.programId);
  const [sub] = pdas.subscriptionPda(program.programId, vault);

  const ix = await program.methods
    .renewSubscription(body.planId, new BN(body.addSecs), new BN(body.feeLamports))
    .accounts({
      config: cfg,
      vault,
      subscription: sub,
      payer,
      treasury,
      systemProgram: SystemProgram.programId
    })
    .instruction();

  await buildTx(res, payer, [ix]);
});

// ---------------------
// Professional guardian profile
// ---------------------
txRouter.post("/register-guardian-profile", requireAuth, express.json(), async (req: any, res) => {
  const Body = z.object({
    displayName: z.string().max(32).default(""),
    websiteUri: z.string().max(100).default("")
  });
  const body = Body.parse(req.body);

  const guardian = pk(req.user.wallet);
  const [cfg] = pdas.configPda(program.programId);
  const [profile] = pdas.guardianProfilePda(program.programId, guardian);

  const ix = await program.methods
    .registerGuardianProfile(
      Array.from(Buffer.from(body.displayName, "utf8")),
      Array.from(Buffer.from(body.websiteUri, "utf8"))
    )
    .accounts({
      config: cfg,
      profile,
      guardian,
      systemProgram: SystemProgram.programId
    })
    .instruction();

  await buildTx(res, guardian, [ix]);
});

// ---------------------
// Bond management
// ---------------------
txRouter.post("/bond-topup", requireAuth, express.json(), async (req: any, res) => {
  const Body = z.object({ lamports: z.string() });
  const body = Body.parse(req.body);

  const guardian = pk(req.user.wallet);
  const [cfg] = pdas.configPda(program.programId);
  const [bond] = pdas.guardianBondPda(program.programId, guardian);

  const ix = await program.methods
    .createOrTopupGuardianBond(new BN(body.lamports))
    .accounts({ config: cfg, bond, guardian, systemProgram: SystemProgram.programId })
    .instruction();

  await buildTx(res, guardian, [ix]);
});

txRouter.post("/bond-withdraw", requireAuth, express.json(), async (req: any, res) => {
  const Body = z.object({ lamports: z.string() });
  const body = Body.parse(req.body);

  const guardian = pk(req.user.wallet);
  const [cfg] = pdas.configPda(program.programId);
  const [bond] = pdas.guardianBondPda(program.programId, guardian);

  const ix = await program.methods
    .withdrawGuardianBond(new BN(body.lamports))
    .accounts({ config: cfg, bond, guardian })
    .instruction();

  await buildTx(res, guardian, [ix]);
});
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
async function discoverVaultHoldingsMints(vaultAuth: PublicKey) {
  const out: Array<{ mint: string; programId: string; amount: string; decimals: number; uiAmountString: string }> = [];

  for (const pid of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
    const parsed = await connection.getParsedTokenAccountsByOwner(vaultAuth, { programId: pid }, "confirmed");
    for (const acc of parsed.value) {
      const info: any = acc.account.data?.parsed?.info;
      if (!info) continue;
      const amount = info.tokenAmount?.amount as string;
      const decimals = info.tokenAmount?.decimals as number;
      const uiAmountString = info.tokenAmount?.uiAmountString as string;
      if (!amount || amount === "0") continue;
      out.push({ mint: info.mint, programId: pid.toBase58(), amount, decimals, uiAmountString });
    }
  }

  // collapse by mint (prefer token-2022 if duplicated; unlikely)
  const map = new Map<string, any>();
  for (const r of out) map.set(r.mint, r);
  return Array.from(map.values());
}
txRouter.post("/distribution-plan", requireAuth, express.json(), async (req: any, res) => {
  const Body = z.object({
    vault: PubkeyStr,
    unlock: PubkeyStr,
    solBatchSize: z.number().int().min(1).max(25).default(10),
    splBatchSize: z.number().int().min(1).max(10).default(5),

    // optional: if provided, we plan for these mints only; else we discover from vault holdings
    mints: z.array(PubkeyStr).optional()
  });
  const body = Body.parse(req.body);

  const requester = pk(req.user.wallet);
  const vault = pk(body.vault);
  const unlock = pk(body.unlock);

  const [cfg] = pdas.configPda(program.programId);
  const [index] = pdas.indexPda(program.programId, vault);

  const idxAcc: any = await program.account.vaultIndex.fetch(index);
  const beneficiaries: PublicKey[] = idxAcc.beneficiaries;
  const total = beneficiaries.length;

  const [vaultAuth] = pdas.vaultAuthPda(program.programId, vault);

  // ---------- SOL dist session progress ----------
  const [distSol] = pdas.distSolPda(program.programId, unlock);
  const distSolAcc: any = await program.account.distributionSolSession.fetchNullable(distSol);

  const solCursor = distSolAcc ? Number(distSolAcc.cursor ?? 0) : 0;
  const solDone = distSolAcc ? Boolean(distSolAcc.done ?? false) : false;

  const steps: any[] = [];

  if (!distSolAcc) {
    steps.push({ name: "init-dist-sol", endpoint: "/v1/tx/init-dist-sol", body: { vault: vault.toBase58(), unlock: unlock.toBase58() } });
  }

  if (!solDone) {
    for (let start = solCursor; start < total; start += body.solBatchSize) {
      const bs = Math.min(body.solBatchSize, total - start);
      steps.push({
        name: `exec-dist-sol-batch:${start}`,
        endpoint: "/v1/tx/exec-dist-sol-batch",
        body: { vault: vault.toBase58(), unlock: unlock.toBase58(), startIndex: start, batchSize: bs }
      });
    }
  }

  // ---------- SPL mints to distribute ----------
  const mints = body.mints?.length
    ? body.mints.map(pk)
    : (await discoverVaultHoldingsMints(vaultAuth)).map((x) => new PublicKey(x.mint));

  const splPlans: any[] = [];
  for (const mint of mints) {
    const [distSpl] = pdas.distSplPda(program.programId, unlock, mint);
    const distSplAcc: any = await program.account.distributionSplSession.fetchNullable(distSpl);

    const cursor = distSplAcc ? Number(distSplAcc.cursor ?? 0) : 0;
    const done = distSplAcc ? Boolean(distSplAcc.done ?? false) : false;

    const mintSteps: any[] = [];

    if (!distSplAcc) {
      mintSteps.push({
        name: `init-dist-spl:${mint.toBase58()}`,
        endpoint: "/v1/tx/init-dist-spl",
        body: { vault: vault.toBase58(), unlock: unlock.toBase58(), mint: mint.toBase58() }
      });
    }

    if (!done) {
      for (let start = cursor; start < total; start += body.splBatchSize) {
        const bs = Math.min(body.splBatchSize, total - start);
        mintSteps.push({
          name: `exec-dist-spl-batch:${mint.toBase58()}:${start}`,
          endpoint: "/v1/tx/exec-dist-spl-batch",
          body: {
            vault: vault.toBase58(),
            unlock: unlock.toBase58(),
            mint: mint.toBase58(),
            startIndex: start,
            batchSize: bs,
            createMissingAtas: false
          }
        });
      }
    }

    splPlans.push({
      mint: mint.toBase58(),
      distSpl: distSpl.toBase58(),
      cursor,
      done,
      steps: mintSteps
    });
  }

  // ---------- Finalize step (requires dist_spl PDAs) ----------
  const splMints = splPlans.map(p => p.mint);
  steps.push({
    name: "finalize-unlock",
    endpoint: "/v1/tx/finalize-unlock",
    body: { vault: vault.toBase58(), unlock: unlock.toBase58(), splMints }
  });

  res.json({
    ok: true,
    vault: vault.toBase58(),
    unlock: unlock.toBase58(),
    totals: { beneficiaries: total },
    progress: {
      sol: { distSol: distSol.toBase58(), cursor: solCursor, done: solDone },
      spl: splPlans.map(p => ({ mint: p.mint, distSpl: p.distSpl, cursor: p.cursor, done: p.done }))
    },
    plan: {
      steps,
      splPlans
    }
  });
});
