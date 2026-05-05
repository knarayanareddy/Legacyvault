notifier/src/scheduler.ts

import { prisma } from "./db";
import { emailQueue } from "./queue";
import { checkInReminderEmail } from "./templates/email";

/**
 * Minimal scheduler:
 * - once per hour: find vaults whose last check-in is older than heartbeat interval
 * In production, compute exact due dates from on-chain state (indexed) and user preferences.
 */
export async function runHourlyScheduler() {
  // You’d store user notification contacts in DB; for now, placeholder:
  const demoEmail = process.env.DEMO_NOTIFY_EMAIL;
  if (!demoEmail) return;

  const vaults = await prisma.vault.findMany({ take: 50, orderBy: { updatedAt: "desc" } });

  for (const v of vaults) {
    const dueIso = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const email = checkInReminderEmail({ wallet: v.ownerWallet, vaultPubkey: v.vaultPubkey, dueIso });

    await emailQueue.add("checkin", { to: demoEmail, ...email }, { removeOnComplete: true });
  }
}
