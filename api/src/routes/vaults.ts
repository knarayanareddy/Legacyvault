
import express from "express";
import { prisma } from "../db";
import { requireAuth } from "../auth";

export const vaultsRouter = express.Router();

vaultsRouter.get("/", requireAuth, async (req: any, res) => {
  const wallet = req.user.wallet;
  const vaults = await prisma.vault.findMany({ where: { ownerWallet: wallet }, orderBy: { createdAt: "desc" } });
  res.json({ ok: true, vaults });
});

vaultsRouter.get("/:vaultPubkey", requireAuth, async (req: any, res) => {
  const v = await prisma.vault.findUnique({ where: { vaultPubkey: req.params.vaultPubkey } });
  if (!v) return res.status(404).json({ ok: false });
  if (v.ownerWallet !== req.user.wallet) return res.status(403).json({ ok: false });
  res.json({ ok: true, vault: v });
});
// api/src/routes/vaults.ts (add this handler)
vaultsRouter.get("/:vaultPubkey/full", requireAuth, async (req: any, res) => {
  const vault = await prisma.vault.findUnique({
    where: { vaultPubkey: req.params.vaultPubkey },
    include: {
      guardians: true,
      beneficiaries: true,
      unlockSessions: {
        orderBy: { createdAt: "desc" },
        include: { approvalsRows: true, distSol: true, distSpl: true, dispute: true }
      },
      subscriptions: true
    }
  });
  if (!vault) return res.status(404).json({ ok: false });
  if (vault.ownerWallet !== req.user.wallet) return res.status(403).json({ ok: false });
  res.json({ ok: true, vault });
});
