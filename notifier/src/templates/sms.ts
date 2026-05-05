notifier/src/templates/sms.ts

export function checkInReminderSms(args: { vaultPubkey: string; dueIso: string }) {
  return `LegacyVault: check-in due for vault ${args.vaultPubkey} by ${args.dueIso}.`;
}
