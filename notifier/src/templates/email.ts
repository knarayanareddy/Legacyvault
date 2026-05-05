notifier/src/templates/email.ts

export function checkInReminderEmail(args: { wallet: string; vaultPubkey: string; dueIso: string }) {
  return {
    subject: "LegacyVault check-in reminder",
    text:
      `Wallet ${args.wallet}\n` +
      `Vault ${args.vaultPubkey}\n` +
      `Check-in due by: ${args.dueIso}\n\n` +
      `If you are active, open LegacyVault and check in.`
  };
}

export function unlockEligibleEmail(args: { vaultPubkey: string; eligibleIso: string }) {
  return {
    subject: "LegacyVault unlock eligible",
    text:
      `Vault ${args.vaultPubkey} is now eligible for unlock.\n` +
      `Eligible at: ${args.eligibleIso}\n\n` +
      `Guardians should review and follow the on-chain process.`
  };
}
