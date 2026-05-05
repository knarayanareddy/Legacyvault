import { PublicKey } from "@solana/web3.js";

export type BeneficiaryEntry = {
  pubkey: PublicKey;
  beneficiary: PublicKey;
  shareBps: number;
  active: boolean;
};

export type VaultIndex = {
  guardians: PublicKey[];
  beneficiaries: PublicKey[];
};

export function sortPubkeysAsc(keys: PublicKey[]): PublicKey[] {
  return [...keys].sort((a, b) => Buffer.compare(a.toBuffer(), b.toBuffer()));
}
