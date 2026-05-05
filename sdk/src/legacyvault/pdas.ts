import { PublicKey } from "@solana/web3.js";

export const SEEDS = {
  CONFIG: Buffer.from("config"),
  VAULT: Buffer.from("vault"),
  VAULT_AUTH: Buffer.from("vault_auth"),
  INDEX: Buffer.from("index"),

  GUARDIAN: Buffer.from("guardian"),
  BENEFICIARY: Buffer.from("beneficiary"),
  DELEGATE: Buffer.from("delegate"),

  ASSET_RULE: Buffer.from("asset_rule"),

  UNLOCK: Buffer.from("unlock"),
  APPROVAL: Buffer.from("approval"),

  DIST_SOL: Buffer.from("dist_sol"),
  DIST_SPL: Buffer.from("dist_spl"),

  DISPUTE: Buffer.from("dispute"),

  SUB: Buffer.from("sub"),

  G_PROFILE: Buffer.from("g_profile"),
  G_BOND: Buffer.from("g_bond"),
};

export function u64LE(x: bigint) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(x);
  return b;
}

export function configPda(programId: PublicKey) {
  return PublicKey.findProgramAddressSync([SEEDS.CONFIG], programId);
}

export function vaultPda(programId: PublicKey, owner: PublicKey, vaultId: bigint) {
  return PublicKey.findProgramAddressSync([SEEDS.VAULT, owner.toBuffer(), u64LE(vaultId)], programId);
}

export function vaultAuthPda(programId: PublicKey, vault: PublicKey) {
  return PublicKey.findProgramAddressSync([SEEDS.VAULT_AUTH, vault.toBuffer()], programId);
}

export function indexPda(programId: PublicKey, vault: PublicKey) {
  return PublicKey.findProgramAddressSync([SEEDS.INDEX, vault.toBuffer()], programId);
}

export function guardianEntryPda(programId: PublicKey, vault: PublicKey, guardian: PublicKey) {
  return PublicKey.findProgramAddressSync([SEEDS.GUARDIAN, vault.toBuffer(), guardian.toBuffer()], programId);
}

export function beneficiaryEntryPda(programId: PublicKey, vault: PublicKey, beneficiary: PublicKey) {
  return PublicKey.findProgramAddressSync([SEEDS.BENEFICIARY, vault.toBuffer(), beneficiary.toBuffer()], programId);
}

export function delegateEntryPda(programId: PublicKey, vault: PublicKey, delegate: PublicKey) {
  return PublicKey.findProgramAddressSync([SEEDS.DELEGATE, vault.toBuffer(), delegate.toBuffer()], programId);
}

export function assetRulePda(programId: PublicKey, vault: PublicKey, mint: PublicKey) {
  return PublicKey.findProgramAddressSync([SEEDS.ASSET_RULE, vault.toBuffer(), mint.toBuffer()], programId);
}

export function unlockPda(programId: PublicKey, vault: PublicKey, nonce: bigint) {
  return PublicKey.findProgramAddressSync([SEEDS.UNLOCK, vault.toBuffer(), u64LE(nonce)], programId);
}

export function approvalPda(programId: PublicKey, unlock: PublicKey, guardian: PublicKey) {
  return PublicKey.findProgramAddressSync([SEEDS.APPROVAL, unlock.toBuffer(), guardian.toBuffer()], programId);
}

export function distSolPda(programId: PublicKey, unlock: PublicKey) {
  return PublicKey.findProgramAddressSync([SEEDS.DIST_SOL, unlock.toBuffer()], programId);
}

export function distSplPda(programId: PublicKey, unlock: PublicKey, mint: PublicKey) {
  return PublicKey.findProgramAddressSync([SEEDS.DIST_SPL, unlock.toBuffer(), mint.toBuffer()], programId);
}

export function disputePda(programId: PublicKey, unlock: PublicKey) {
  return PublicKey.findProgramAddressSync([SEEDS.DISPUTE, unlock.toBuffer()], programId);
}

export function subscriptionPda(programId: PublicKey, vault: PublicKey) {
  return PublicKey.findProgramAddressSync([SEEDS.SUB, vault.toBuffer()], programId);
}

export function guardianProfilePda(programId: PublicKey, guardian: PublicKey) {
  return PublicKey.findProgramAddressSync([SEEDS.G_PROFILE, guardian.toBuffer()], programId);
}

export function guardianBondPda(programId: PublicKey, guardian: PublicKey) {
  return PublicKey.findProgramAddressSync([SEEDS.G_BOND, guardian.toBuffer()], programId);
}
