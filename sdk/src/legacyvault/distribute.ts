import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import BN from "bn.js";
import { beneficiaryEntryPda, configPda, distSolPda, distSplPda, indexPda, vaultAuthPda } from "./pdas.js";

export async function buildSolDistributionBatches(args: {
  program: Program;
  vault: PublicKey;
  unlock: PublicKey;
  batchSize: number; // e.g., 10
}): Promise<TransactionInstruction[]> {
  const { program, vault, unlock, batchSize } = args;
 
  const [cfg] = configPda(program.programId);
  const [indexAddr] = indexPda(program.programId, vault);
  const [distSol] = distSolPda(program.programId, unlock);
 
  const index: any = await (program.account as any).vaultIndex.fetch(indexAddr);
  const beneficiaries: PublicKey[] = index.beneficiaries;

  const ixs: TransactionInstruction[] = [];

  for (let start = 0; start < beneficiaries.length; start += batchSize) {
    const end = Math.min(start + batchSize, beneficiaries.length);
    const slice = beneficiaries.slice(start, end);

    const remaining = [];
    for (const b of slice) {
      const [be] = beneficiaryEntryPda(program.programId, vault, b);
      remaining.push({ pubkey: be, isSigner: false, isWritable: false });
      remaining.push({ pubkey: b, isSigner: false, isWritable: true });
    }

    const ix = await program.methods
      .executeDistributionSolBatch(start, end - start)
      .accounts({
        config: cfg,
        vault,
        unlock,
        index: indexAddr,
        distSol,
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts(remaining)
      .instruction();

    ixs.push(ix);
  }

  return ixs;
}

export async function buildSplDistributionBatches(args: {
  program: Program;
  vault: PublicKey;
  unlock: PublicKey;
  mint: PublicKey;
  batchSize: number;
}): Promise<TransactionInstruction[]> {
  const { program, vault, unlock, mint, batchSize } = args;

  const [cfg] = configPda(program.programId);
  const [indexAddr] = indexPda(program.programId, vault);
  const [vaultAuth] = vaultAuthPda(program.programId, vault);
  const [distSpl] = distSplPda(program.programId, unlock, mint);
  const vaultAta = getAssociatedTokenAddressSync(mint, vaultAuth, true);
 
  const index: any = await (program.account as any).vaultIndex.fetch(indexAddr);
  const beneficiaries: PublicKey[] = index.beneficiaries;

  const ixs: TransactionInstruction[] = [];

  for (let start = 0; start < beneficiaries.length; start += batchSize) {
    const end = Math.min(start + batchSize, beneficiaries.length);
    const slice = beneficiaries.slice(start, end);

    const remaining = [];
    for (const b of slice) {
      const [be] = beneficiaryEntryPda(program.programId, vault, b);
      const ata = getAssociatedTokenAddressSync(mint, b);
      remaining.push({ pubkey: be, isSigner: false, isWritable: false });
      remaining.push({ pubkey: b, isSigner: false, isWritable: false });
      remaining.push({ pubkey: ata, isSigner: false, isWritable: true });
    }

    const ix = await program.methods
      .executeDistributionSplBatch(start, end - start)
      .accounts({
        config: cfg,
        vault,
        vaultAuth,
        unlock,
        index: indexAddr,
        mint,
        distSpl,
        vaultAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .remainingAccounts(remaining)
      .instruction();

    ixs.push(ix);
  }

  return ixs;
}
