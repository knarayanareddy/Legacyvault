// indexer/src/handlers/derivedState.ts
import { PublicKey } from "@solana/web3.js";
import { prisma } from "../db";
import { program } from "../anchor";

type AnchorEvent = { name: string; data: any };

function pkToStr(x: any): string {
  if (!x) return "";
  if (typeof x === "string") return x;
  if (x instanceof PublicKey) return x.toBase58();
  if (typeof x?.toBase58 === "function") return x.toBase58();
  return String(x);
}
function toBigInt(x: any): bigint {
  if (x === null || x === undefined) return 0n;
  if (typeof x === "bigint") return x;
  if (typeof x === "number") return BigInt(Math.trunc(x));
  if (typeof x === "string") return BigInt(x);
  if (typeof x?.toString === "function") return BigInt(x.toString());
  return 0n;
}
function toNumber(x: any): number {
  if (x === null || x === undefined) return 0;
  if (typeof x === "number") return x;
  if (typeof x === "bigint") return Number(x);
  if (typeof x === "string") return Number(x);
  if (typeof x?.toString === "function") return Number(x.toString());
  return 0;
}
function field<T = any>(obj: any, ...names: string[]): T | undefined {
  for (const n of names) if (obj && Object.prototype.hasOwnProperty.call(obj, n)) return obj[n];
  return undefined;
}

// ------------ chain hydration (best-effort) ------------

async function hydrateVaultFromChain(vaultPubkey: string) {
  try {
    const vaultPk = new PublicKey(vaultPubkey);
    const acc: any = await program.account.vault.fetchNullable(vaultPk);
    if (!acc) return null;
    return {
      ownerWallet: pkToStr(acc.owner),
      vaultIdU64: acc.vaultId?.toString?.() ?? acc.vaultId?.toString() ?? null,
      status: String(acc.status ?? "Unknown"),
      lastCheckinUnix: BigInt(acc.lastCheckinUnix?.toString?.() ?? "0"),
      heartbeatIntervalSecs: Number(acc.heartbeatIntervalSecs ?? 0),
      inactivityThresholdSecs: Number(acc.inactivityThresholdSecs ?? 0),
      timelockSecs: Number(acc.timelockSecs ?? 0),
      guardianThreshold: Number(acc.guardianThreshold ?? 0),
      panicEnabled: Boolean(acc.panicEnabled ?? false)
    };
  } catch {
    return null;
  }
}

async function hydrateUnlockFromChain(unlockPubkey: string) {
  try {
    const upk = new PublicKey(unlockPubkey);
    const acc: any = await program.account.unlockSession.fetchNullable(upk);
    if (!acc) return null;
    return {
      vaultPubkey: pkToStr(acc.vault),
      nonceU64: acc.nonce?.toString?.() ?? String(acc.nonce ?? "0"),
      status: String(acc.status ?? "Unknown"),
      initiatedBy: pkToStr(acc.initiatedBy),
      initiatedAtUnix: BigInt(acc.initiatedAtUnix?.toString?.() ?? "0"),
      approvals: Number(acc.approvals ?? 0),
      threshold: Number(acc.threshold ?? 0),
      approvedAtUnix: BigInt(acc.approvedAtUnix?.toString?.() ?? "0"),
      executableAtUnix: BigInt(acc.executableAtUnix?.toString?.() ?? "0")
    };
  } catch {
    return null;
  }
}

async function hydrateGlobalConfigFromChain() {
  try {
    const [configPk] = PublicKey.findProgramAddressSync([Buffer.from("config")], program.programId);
    const acc: any = await program.account.globalConfig.fetchNullable(configPk);
    if (!acc) return null;
    return {
      admin: pkToStr(acc.admin),
      arbiter: pkToStr(acc.arbiter),
      treasury: pkToStr(acc.treasury),
      createFeeLamports: toBigInt(acc.createFeeLamports ?? 0),
      paused: Boolean(acc.paused ?? false),
      version: Number(acc.version ?? 1)
    };
  } catch {
    return null;
  }
}

async function syncGlobalConfig(tx: any) {
  const hydrated = await hydrateGlobalConfigFromChain();
  if (!hydrated) return;

  await tx.globalConfig.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      admin: hydrated.admin,
      arbiter: hydrated.arbiter,
      treasury: hydrated.treasury,
      createFeeFeeLamports: hydrated.createFeeLamports,
      paused: hydrated.paused,
      version: hydrated.version
    },
    update: {
      admin: hydrated.admin,
      arbiter: hydrated.arbiter,
      treasury: hydrated.treasury,
      createFeeLamports: hydrated.createFeeLamports,
      paused: hydrated.paused,
      version: hydrated.version
    }
  });
}

// ------------ resolvers (auto-create) ------------

async function ensureVault(tx: any, vaultPubkey: string, hintOwner?: string) {
  let v = await tx.vault.findUnique({ where: { vaultPubkey } });
  if (v) return v;

  // create placeholder; fill with hintOwner if available
  v = await tx.vault.create({
    data: {
      vaultPubkey,
      ownerWallet: hintOwner ?? "unknown",
      vaultIdU64: null,
      status: "Unknown"
    }
  });

  // hydrate best-effort immediately
  const hydrated = await hydrateVaultFromChain(vaultPubkey);
  if (hydrated) {
    v = await tx.vault.update({
      where: { id: v.id },
      data: {
        ownerWallet: hydrated.ownerWallet ?? v.ownerWallet,
        vaultIdU64: hydrated.vaultIdU64 ?? v.vaultIdU64,
        status: hydrated.status ?? v.status,
        lastCheckinUnix: hydrated.lastCheckinUnix,
        heartbeatIntervalSecs: hydrated.heartbeatIntervalSecs,
        inactivityThresholdSecs: hydrated.inactivityThresholdSecs,
        timelockSecs: hydrated.timelockSecs,
        guardianThreshold: hydrated.guardianThreshold,
        panicEnabled: hydrated.panicEnabled
      }
    });
  }

  return v;
}

async function ensureUnlock(tx: any, unlockPubkey: string, vaultId: string, nonceU64?: string) {
  let u = await tx.unlockSession.findUnique({ where: { unlockPubkey } });
  if (u) return u;

  u = await tx.unlockSession.create({
    data: {
      unlockPubkey,
      vaultId,
      nonceU64: nonceU64 ?? "0",
      status: "Unknown",
      initiatedBy: "unknown",
      initiatedAtUnix: 0n,
      approvals: 0,
      threshold: 0,
      approvedAtUnix: null,
      executableAtUnix: null
    }
  });

  // best-effort hydrate
  const hydrated = await hydrateUnlockFromChain(unlockPubkey);
  if (hydrated) {
    // ensure referenced vault exists and link if mismatch
    const chainVault = await ensureVault(tx, hydrated.vaultPubkey);
    u = await tx.unlockSession.update({
      where: { id: u.id },
      data: {
        vaultId: chainVault.id,
        nonceU64: hydrated.nonceU64,
        status: hydrated.status,
        initiatedBy: hydrated.initiatedBy,
        initiatedAtUnix: hydrated.initiatedAtUnix,
        approvals: hydrated.approvals,
        threshold: hydrated.threshold,
        approvedAtUnix: hydrated.approvedAtUnix ? hydrated.approvedAtUnix : null,
        executableAtUnix: hydrated.executableAtUnix ? hydrated.executableAtUnix : null
      }
    });
  }

  return u;
}

export async function applyDerivedStateFromEvents(args: {
  signature: string;
  slot: bigint;
  blockTime?: bigint | null;
  programId: string;
  events: AnchorEvent[];
}) {
  await prisma.$transaction(async (tx) => {
    // Idempotency gate (skip derived-state reapply if we already processed this signature)
    const processed = await tx.processedTx.findUnique({ where: { signature: args.signature } });
    if (processed) return;

    // Mark processed early; if txn fails, entire tx rolls back (good).
    await tx.processedTx.create({
      data: { signature: args.signature, slot: args.slot }
    });

    for (const evt of args.events) {
      const d = evt.data ?? {};
      const tsUnix = toBigInt(field(d, "ts", "timestamp", "tsUnix") ?? 0);

      switch (evt.name) {
        // -------------
        // Config / Admin
        // -------------
        case "ConfigInitialized":
        case "ArbiterSet":
        case "FeesSet":
        case "BoundsSet":
        case "PauseSet": {
          await syncGlobalConfig(tx);
          break;
        }

        // -------------
        // VaultCreated / vault lifecycle
        // -------------
        case "VaultCreated": {
          const vaultPubkey = pkToStr(field(d, "vault"));
          const ownerWallet = pkToStr(field(d, "owner"));
          const vaultIdU64 = toBigInt(field(d, "vaultId", "vault_id") ?? 0).toString();

          await tx.vault.upsert({
            where: { vaultPubkey },
            create: { vaultPubkey, ownerWallet, vaultIdU64, status: "Active" },
            update: { ownerWallet, vaultIdU64, status: "Active" }
          });

          // also seed cursor row if missing (optional)
          await tx.indexerCursor.upsert({
            where: { id: "legacyvault" },
            create: { id: "legacyvault", lastSlot: args.slot },
            update: { lastSlot: args.slot }
          });

          break;
        }

        case "PanicFrozen": {
          const vaultPubkey = pkToStr(field(d, "vault"));
          const v = await ensureVault(tx, vaultPubkey);
          await tx.vault.update({ where: { id: v.id }, data: { status: "Frozen" } });
          break;
        }

        case "Unfrozen": {
          const vaultPubkey = pkToStr(field(d, "vault"));
          const v = await ensureVault(tx, vaultPubkey);
          await tx.vault.update({ where: { id: v.id }, data: { status: "Active" } });
          break;
        }

        case "DocumentSet": {
          const vaultPubkey = pkToStr(field(d, "vault"));
          const v = await ensureVault(tx, vaultPubkey);

          const docHash = field(d, "docHash", "doc_hash") as any;
          const docHashHex = docHash ? Buffer.from(docHash).toString("hex") : "";
          const uriLen = toNumber(field(d, "docUriLen", "doc_uri_len") ?? 0);

          if ((tx as any).document) {
            await (tx as any).document.upsert({
              where: { vaultId_docHashHex: { vaultId: v.id, docHashHex } },
              create: { vaultId: v.id, docHashHex, uri: null, uriLen, tsUnix },
              update: { uriLen, tsUnix }
            });
          }
          break;
        }

        // -------------
        // Guardians / Beneficiaries
        // -------------
        case "GuardianAdded": {
          const vaultPubkey = pkToStr(field(d, "vault"));
          const guardian = pkToStr(field(d, "guardian"));
          const role = String(field(d, "role") ?? "Personal");

          const v = await ensureVault(tx, vaultPubkey);
          await tx.guardian.upsert({
            where: { vaultId_guardian: { vaultId: v.id, guardian } },
            create: { vaultId: v.id, guardian, role, active: true },
            update: { role, active: true }
          });
          break;
        }

        case "GuardianRemoved": {
          const vaultPubkey = pkToStr(field(d, "vault"));
          const guardian = pkToStr(field(d, "guardian"));

          const v = await ensureVault(tx, vaultPubkey);
          await tx.guardian.updateMany({ where: { vaultId: v.id, guardian }, data: { active: false } });
          break;
        }

        case "GuardianThresholdSet": {
          const vaultPubkey = pkToStr(field(d, "vault"));
          const threshold = toNumber(field(d, "threshold") ?? 0);
          const v = await ensureVault(tx, vaultPubkey);
          await tx.vault.update({ where: { id: v.id }, data: { guardianThreshold: threshold } });
          break;
        }

        case "BeneficiaryAdded": {
          const vaultPubkey = pkToStr(field(d, "vault"));
          const beneficiary = pkToStr(field(d, "beneficiary"));
          const shareBps = toNumber(field(d, "shareBps", "share_bps") ?? 0);

          const v = await ensureVault(tx, vaultPubkey);
          await tx.beneficiary.upsert({
            where: { vaultId_beneficiary: { vaultId: v.id, beneficiary } },
            create: { vaultId: v.id, beneficiary, shareBps, label: null, active: true },
            update: { shareBps, active: true }
          });
          break;
        }

        case "BeneficiaryUpdated": {
          const vaultPubkey = pkToStr(field(d, "vault"));
          const beneficiary = pkToStr(field(d, "beneficiary"));
          const shareBps = toNumber(field(d, "shareBps", "share_bps") ?? 0);
          const active = Boolean(field(d, "active") ?? true);

          const v = await ensureVault(tx, vaultPubkey);
          await tx.beneficiary.upsert({
            where: { vaultId_beneficiary: { vaultId: v.id, beneficiary } },
            create: { vaultId: v.id, beneficiary, shareBps, label: null, active },
            update: { shareBps, active }
          });
          break;
        }

        case "BeneficiaryRemoved": {
          const vaultPubkey = pkToStr(field(d, "vault"));
          const beneficiary = pkToStr(field(d, "beneficiary"));

          const v = await ensureVault(tx, vaultPubkey);
          await tx.beneficiary.updateMany({ where: { vaultId: v.id, beneficiary }, data: { active: false } });
          break;
        }

        // -------------
        // Asset rules
        // -------------
        case "AssetRuleSet": {
          const vaultPubkey = pkToStr(field(d, "vault"));
          const mint = pkToStr(field(d, "mint"));
          const mode = String(field(d, "mode") ?? "ProRata");
          const assignedBeneficiary = pkToStr(field(d, "assignedBeneficiary", "assigned_beneficiary"));

          const v = await ensureVault(tx, vaultPubkey);
          if ((tx as any).assetRule) {
            await (tx as any).assetRule.upsert({
              where: { vaultId_mint: { vaultId: v.id, mint } },
              create: { vaultId: v.id, mint, mode, assignedBeneficiary, tsUnix },
              update: { mode, assignedBeneficiary, tsUnix }
            });
          }
          break;
        }

        // -------------
        // Check-ins
        // -------------
        case "CheckIn": {
          const vaultPubkey = pkToStr(field(d, "vault"));
          const v = await ensureVault(tx, vaultPubkey);
          await tx.vault.update({ where: { id: v.id }, data: { lastCheckinUnix: tsUnix } });
          break;
        }

        // -------------
        // Unlock lifecycle
        // -------------
        case "UnlockInitiated": {
          const vaultPubkey = pkToStr(field(d, "vault"));
          const unlockPubkey = pkToStr(field(d, "unlock"));
          const nonceU64 = toBigInt(field(d, "nonce") ?? 0).toString();
          const initiatedBy = pkToStr(field(d, "initiatedBy", "initiated_by"));

          const v = await ensureVault(tx, vaultPubkey);
          await tx.vault.update({ where: { id: v.id }, data: { status: "Unlocking" } });

          await tx.unlockSession.upsert({
            where: { unlockPubkey },
            create: {
              unlockPubkey,
              vaultId: v.id,
              nonceU64,
              status: "Proposed",
              initiatedBy,
              initiatedAtUnix: tsUnix,
              approvals: 0,
              threshold: 0,
              approvedAtUnix: null,
              executableAtUnix: null
            },
            update: {
              vaultId: v.id,
              nonceU64,
              status: "Proposed",
              initiatedBy,
              initiatedAtUnix: tsUnix
            }
          });
          break;
        }

        case "UnlockApproved": {
          const vaultPubkey = pkToStr(field(d, "vault"));
          const unlockPubkey = pkToStr(field(d, "unlock"));
          const guardian = pkToStr(field(d, "guardian"));
          const approvals = toNumber(field(d, "approvals") ?? 0);
          const threshold = toNumber(field(d, "threshold") ?? 0);

          const v = await ensureVault(tx, vaultPubkey);
          const u = await ensureUnlock(tx, unlockPubkey, v.id);

          await tx.unlockSession.update({
            where: { id: u.id },
            data: {
              approvals,
              threshold,
              status: approvals >= threshold && threshold > 0 ? "Approved" : "Proposed"
            }
          });

          await tx.approval.upsert({
            where: { unlockId_guardian: { unlockId: u.id, guardian } },
            create: { unlockId: u.id, guardian, approvedAtUnix: tsUnix },
            update: { approvedAtUnix: tsUnix }
          });
          break;
        }

        case "UnlockCancelled": {
          const vaultPubkey = pkToStr(field(d, "vault"));
          const unlockPubkey = pkToStr(field(d, "unlock"));

          const v = await ensureVault(tx, vaultPubkey);
          await tx.vault.update({ where: { id: v.id }, data: { status: "Active" } });

          await tx.unlockSession.updateMany({ where: { unlockPubkey }, data: { status: "Cancelled" } });
          break;
        }

        // -------------
        // Disputes
        // -------------
        case "DisputeOpened": {
          const unlockPubkey = pkToStr(field(d, "unlock"));
          const openedBy = pkToStr(field(d, "openedBy", "opened_by"));
          const noteHash = field(d, "noteHash", "note_hash") as any;
          const noteHashHex = noteHash ? Buffer.from(noteHash).toString("hex") : "";

          // hydrate unlock (need vault link)
          const hydrated = await hydrateUnlockFromChain(unlockPubkey);
          const v = hydrated ? await ensureVault(tx, hydrated.vaultPubkey) : null;
          const u = v ? await ensureUnlock(tx, unlockPubkey, v.id) : await tx.unlockSession.findUnique({ where: { unlockPubkey } });

          if (u) {
            await tx.unlockSession.update({ where: { id: u.id }, data: { status: "Disputed" } });

            await tx.disputeCase.upsert({
              where: { unlockId: u.id },
              create: { unlockId: u.id, status: "Open", openedBy, openedAtUnix: tsUnix, noteHashHex },
              update: { status: "Open", openedBy, openedAtUnix: tsUnix, noteHashHex }
            });
          }
          break;
        }

        case "DisputeResolved": {
          const unlockPubkey = pkToStr(field(d, "unlock"));
          const status = String(field(d, "status") ?? "ResolvedProceed");

          const u = await tx.unlockSession.findUnique({ where: { unlockPubkey } });
          if (u) {
            await tx.disputeCase.updateMany({ where: { unlockId: u.id }, data: { status, resolvedAt: new Date() } });
            if (status.includes("Cancel")) {
              await tx.unlockSession.update({ where: { id: u.id }, data: { status: "Cancelled" } });
              const v = await tx.vault.findUnique({ where: { id: u.vaultId } });
              if (v) await tx.vault.update({ where: { id: v.id }, data: { status: "Active" } });
            }
          }
          break;
        }

        // -------------
        // Distributions
        // -------------
        case "SolDistributionInitialized": {
          const unlockPubkey = pkToStr(field(d, "unlock"));
          const totalDistributable = toBigInt(field(d, "totalDistributable", "total_distributable") ?? 0);

          const u = await tx.unlockSession.findUnique({ where: { unlockPubkey } });
          if (u) {
            await tx.distributionSolSession.upsert({
              where: { unlockId: u.id },
              create: { unlockId: u.id, totalDistributable, paidTotal: 0n, cursor: 0, done: totalDistributable === 0n },
              update: { totalDistributable }
            });
          }
          break;
        }

        case "SolDistributionBatchExecuted": {
          const unlockPubkey = pkToStr(field(d, "unlock"));
          const newCursor = toNumber(field(d, "newCursor", "new_cursor") ?? 0);

          const u = await tx.unlockSession.findUnique({ where: { unlockPubkey } });
          if (u) {
            await tx.distributionSolSession.updateMany({ where: { unlockId: u.id }, data: { cursor: newCursor } });
          }
          break;
        }

        case "SplDistributionInitialized": {
          const unlockPubkey = pkToStr(field(d, "unlock"));
          const mint = pkToStr(field(d, "mint"));
          const totalBalance = toBigInt(field(d, "totalBalance", "total_balance") ?? 0);

          const u = await tx.unlockSession.findUnique({ where: { unlockPubkey } });
          if (u) {
            await tx.distributionSplSession.upsert({
              where: { unlockId_mint: { unlockId: u.id, mint } },
              create: { unlockId: u.id, mint, totalBalance, paidTotal: 0n, cursor: 0, done: totalBalance === 0n },
              update: { totalBalance }
            });
          }
          break;
        }

        case "SplDistributionBatchExecuted": {
          const unlockPubkey = pkToStr(field(d, "unlock"));
          const mint = pkToStr(field(d, "mint"));
          const newCursor = toNumber(field(d, "newCursor", "new_cursor") ?? 0);
          const done = Boolean(field(d, "done") ?? false);

          const u = await tx.unlockSession.findUnique({ where: { unlockPubkey } });
          if (u) {
            await tx.distributionSplSession.updateMany({ where: { unlockId: u.id, mint }, data: { cursor: newCursor, done } });
          }
          break;
        }

        case "UnlockFinalized": {
          const vaultPubkey = pkToStr(field(d, "vault"));
          const unlockPubkey = pkToStr(field(d, "unlock"));

          const v = await ensureVault(tx, vaultPubkey);
          await tx.vault.update({ where: { id: v.id }, data: { status: "Distributed" } });
          await tx.unlockSession.updateMany({ where: { unlockPubkey }, data: { status: "Executed" } });
          break;
        }

        // -------------
        // Subscription / pro guardian
        // -------------
        case "SubscriptionSet": {
          const vaultPubkey = pkToStr(field(d, "vault"));
          const planId = toNumber(field(d, "planId", "plan_id") ?? 0);
          const validUntilUnix = toBigInt(field(d, "validUntilUnix", "valid_until_unix") ?? 0);

          const v = await ensureVault(tx, vaultPubkey);
          await tx.subscription.upsert({
            where: { vaultId_planId: { vaultId: v.id, planId } },
            create: { vaultId: v.id, planId, validUntilUnix },
            update: { validUntilUnix }
          });
          break;
        }

        case "GuardianProfileRegistered": {
          const guardian = pkToStr(field(d, "guardian"));
          await tx.guardianProfile.upsert({
            where: { guardian },
            create: { guardian, displayName: null, websiteUri: null, kycLevel: 0, active: true },
            update: {}
          });
          break;
        }

        case "GuardianBondUpdated": {
          const guardian = pkToStr(field(d, "guardian"));
          const amount = toBigInt(field(d, "amount") ?? 0);
          const locked = Boolean(field(d, "locked") ?? false);

          await tx.guardianBond.upsert({
            where: { guardian },
            create: { guardian, amount, locked },
            update: { amount, locked }
          });
          break;
        }

        default:
          break;
      }
    }

    // advance cursor monotonically
    await tx.indexerCursor.upsert({
      where: { id: "legacyvault" },
      create: { id: "legacyvault", lastSlot: args.slot },
      update: { lastSlot: args.slot }
    });
  });
}
