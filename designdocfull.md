LegacyVault (Digital Estate + Inheritance Protocol on Solana)
Document status: v1.0 (Implementation Blueprint)
Target: Frontier Hackathon submission by May 11, 2026
Primary deliverable: Working onchain “will vault” with dead-man’s switch + guardian threshold + timelocked distribution

0) Executive Summary
LegacyVault is a Solana program that lets a user:

deposit assets into a vault controlled by program logic,
define beneficiaries and splits,
configure a liveness/heartbeat schedule,
appoint guardians for recovery,
automatically distribute assets after inactivity + guardian approvals + timelock.
It’s a self-custody estate executor: the program becomes the neutral executor under deterministic rules.

1) Goals / Non-goals
1.1 Goals (MVP)
5-minute setup flow:
create vault
deposit assets
set beneficiaries
set guardians
set heartbeat interval
“Dead-man’s switch”:
owner must check in periodically
if missed long enough, guardians can initiate unlock
“Safe unlock”:
guardian threshold (M-of-N)
mandatory waiting period (timelock)
owner override/cancel if false alarm
Deterministic distribution:
SPL tokens & SOL distributed by weights
Evidence anchoring:
store hashed will document + metadata via an attestation scheme (optional MVP)
SAS can be used to anchor attestations/credentials on Solana (schemas + attestations). 
3

1.2 Non-goals (MVP)
A legally binding will generator across all jurisdictions (you can generate a “letter of intent” PDF, but do not claim legal enforceability).
MPC wallet implementation.
Handling every DeFi position type. (MVP: SOL + SPL + NFT; optional: stake receipts.)
2) Product Requirements
2.1 Personas
Owner (Testator): sets up vault & rules.
Guardian: helps confirm death/inactivity; approves unlock.
Beneficiary: claims inheritance.
Viewer (Lawyer/Family): reads public metadata / verifies document hash.
2.2 Core UX flows
Create vault (owner)
Add beneficiaries (owner)
Add guardians + threshold (owner)
Deposit assets (owner)
Check-in (owner)
Initiate unlock (guardian)
Approve unlock (guardians)
Execute distribution (anyone or beneficiaries)
3) Architecture (High-level)
3.1 Onchain
Single Anchor program for MVP: legacyvault

Key PDAs:

GlobalConfig
Vault
VaultAuthority
BeneficiaryRegistry
GuardianRegistry
UnlockRequest
AssetRegistry (optional but helpful)
3.2 Offchain
Web app (owner/guardian/beneficiary portals)
Indexer (decode events, show history)
Optional document storage:
Shadow Drive / Arweave for encrypted PDFs; Shadow Drive usage is commonly documented for “off-chain storage due to Solana storage cost,” with SDK-based uploads. 
4
4) Onchain Data Model (Accounts)
4.1 GlobalConfig (PDA)
Seed: ["config"]

Fields:

admin: Pubkey
paused: bool
treasury: Pubkey (fees)
fee_lamports: u64 (or fee in USDC if you prefer)
min_heartbeat_secs: u32
max_heartbeat_secs: u32
min_inactivity_secs: u32
max_inactivity_secs: u32
min_timelock_secs: u32
max_timelock_secs: u32
version: u16
4.2 Vault (PDA)
Seed: ["vault", owner_pubkey, vault_id]

Fields:

vault_id: u64
owner: Pubkey
created_at_unix: i64
last_checkin_unix: i64
heartbeat_interval_secs: u32
inactivity_threshold_secs: u32
(how long after last_checkin guardians can initiate)
timelock_secs: u32
(waiting period after approvals)
status: VaultStatus = Active | Unlocking | Distributed | Closed
guardian_threshold: u8 (M)
guardians_count: u8 (N)
beneficiaries_count: u16
distribution_nonce: u64 (increments per distribution cycle)
doc_hash: [u8; 32] (optional)
doc_uri: String (optional, capped length)
bump: u8
4.3 VaultAuthority (PDA)
Seed: ["vault_auth", vault_pubkey]

This PDA is set as:

Authority of vault token accounts
Receiver/sender authority for SPL transfers
Custodian for SOL (PDA holds lamports)
4.4 GuardianRegistry (PDA)
Seed: ["guardians", vault_pubkey]

Fields:

vault: Pubkey
guardians: Vec<Pubkey> (bounded, e.g., max 10)
threshold: u8
updated_at_unix: i64
4.5 BeneficiaryRegistry (PDA)
Seed: ["beneficiaries", vault_pubkey]

Fields:

vault: Pubkey
beneficiaries: Vec<Beneficiary> (bounded, e.g., max 20)
total_bps: u32 (must equal 10_000)
updated_at_unix: i64
Beneficiary struct:

wallet: Pubkey
share_bps: u16
label: [u8; 16] (optional short label)
min_age / conditions: not MVP (don’t do conditional logic in hackathon unless required)
4.6 AssetRegistry (optional but recommended)
Seed: ["assets", vault_pubkey]

Tracks what assets are deposited (for UI clarity and deterministic distribution):

sol_lamports_tracked: u64 (informational)
spl_assets: Vec<SplAsset { mint, ata, decimals_hint }>
nft_assets: Vec<NftAsset { mint, token_account }> (optional)
4.7 UnlockRequest (PDA)
Seed: ["unlock", vault_pubkey, distribution_nonce]

Fields:

vault: Pubkey
initiated_at_unix: i64
unlock_eligible_at_unix: i64 (initiated + timelock)
approvals: Vec<Pubkey> (guardians who approved)
approved_count: u8
status: UnlockStatus = Proposed | Approved | Executed | Cancelled
reason_code: u8 (optional)
note_hash: [u8; 32] (optional)
5) Instruction Set (Exactly what to implement)
5.1 Admin
initialize_config(...)
set_paused(bool)
set_fee(fee_lamports)
set_bounds(...)
5.2 Owner — Setup & maintenance
create_vault(params...)
initializes Vault + registries
set_document(doc_hash, doc_uri) (optional)
set_beneficiaries(list)
requires sum(share_bps) == 10_000
only allowed while VaultStatus == Active and no active unlock
set_guardians(list, threshold)
require 1 <= threshold <= len(list)
deposit_sol(lamports)
system transfer from owner to vault PDA
deposit_spl(mint, amount)
transfer tokens from owner ATA → vault token account (owned by VaultAuthority PDA)
withdraw_* (optional MVP)
owner can withdraw while Active (helps for mistakes)
check_in()
updates last_checkin_unix = now
cancel_unlock()
if UnlockRequest Proposed/Approved but not executed, owner cancels
5.3 Guardians — Unlock lifecycle
initiate_unlock(vault)
requires:
now > last_checkin + inactivity_threshold
vault Active
creates UnlockRequest
sets vault status Unlocking
approve_unlock(vault, guardian)
guardian must be in registry
adds to approvals if not present
if approvals >= threshold: set UnlockRequest status Approved
revoke_approval(...) (optional)
5.4 Execution — Distribution
execute_distribution(vault)
requires:
UnlockRequest Approved
now >= unlock_eligible_at_unix
distributes SOL + each registered SPL asset by share_bps
marks UnlockRequest Executed; Vault Distributed
execute_distribution_for_mint(vault, mint) (optional chunking)
avoids compute limits by distributing one asset per call
6) Distribution Logic (Deterministic + compute-safe)
6.1 SOL distribution
Let vault_sol = vault_pda.lamports() - rent_exempt_min (keep rent safe)

For each beneficiary i:

payout_i = floor(vault_sol * share_bps_i / 10_000) Track remainder:
last beneficiary gets remainder to ensure sum equals vault_sol.
6.2 SPL distribution
For each tracked mint:

read vault token account balance bal
compute each beneficiary payout similarly
transfer via token program with PDA signer seeds
6.3 NFTs (optional MVP)
Either:
require explicit mapping: “NFT mint X goes to beneficiary Y”
or “round-robin by share order” (not great) Best: keep NFT out of MVP unless you have time.
7) Time & Liveness (How to do “dead-man’s switch” cleanly)
You do not need background cron jobs on Solana. Instead:

Any action (guardian initiate, anyone execute) checks now vs stored timestamps.
The system is “lazy-evaluated” at interaction time.
Vault fields:

last_checkin_unix
inactivity_threshold_secs
timelock_secs
Eligibility:

initiate if now >= last_checkin + inactivity_threshold
execute if now >= initiated_at + timelock
8) Evidence Anchoring (Document hash + attestations)
MVP minimal:

store doc_hash in Vault.
store encrypted PDF somewhere off-chain (Shadow Drive / Arweave) and store the URI.
If you want stronger credibility:

use SAS to create a schema for “LegacyVault Will Document” and issue an attestation linking owner pubkey → doc_hash + metadata. SAS provides developer docs and instruction references such as schema creation. 
3
Storage:

Helius has an end-to-end Shadow Drive upload tutorial; it explicitly frames Shadow Drive as an off-chain storage solution for large files and walks through SDK upload flows. 
4
9) Security & Threat Model (LegacyVault)
9.1 Primary threats
Guardian collusion / theft
False-positive unlock (owner alive but missed check-in)
Program exploit draining vault assets
Malicious beneficiary front-running distribution calls
UI phishing (not protocol-level, but practical)
9.2 Mitigations (protocol)
Guardian threshold M-of-N + allow owner to choose trusted set
Mandatory timelock after approvals (gives owner time to override)
Owner override window: owner can check_in() and cancel_unlock()
“No single guardian can execute alone” (enforce threshold)
Keep registries bounded and validated
Use “distribution chunking” to avoid partial execution inconsistencies:
either do everything in one transaction (if small)
or record per-asset distribution completion flags
9.3 Mitigations (engineering)
Strict integer math with remainder handling
Re-entrancy not typical, but ensure state transitions happen before transfers where sensible
Heavy test coverage + localnet simulation
Upgrade authority controlled by multisig post-hackathon (not MVP)
10) Testing Plan (LegacyVault)
10.1 Unit tests
Create vault invariants
Beneficiaries sum to 10_000 bps
Guardian threshold validity
Check-in updates timestamp
Initiate unlock only after inactivity
Approvals unique (no double count)
Execute only after timelock + approvals
10.2 End-to-end scenarios
Happy path
create vault → deposit SOL/USDC → set guardians/bene → wait inactivity → initiate → approve → wait timelock → execute → balances correct
False alarm
initiate unlock → owner check_in + cancel → vault returns to Active
Guardian tries early execute
execute fails before timelock
Partial asset distribution
if chunking enabled, verify completion markers
11) Deployment & Ops (LegacyVault)
Environments: localnet → devnet
Indexer:
listen for program logs / events
compute vault status timeline
Key management:
none required besides user wallets
Optional fees:
charge a small lamport fee on create_vault to discourage spam



Appendix A — Optional “Future v2” Enhancements (after hackathon)
Professional guardian network (paid guardians, reputation)
SAS attestation integration for stronger evidence trail 
3
Chunked distribution with per-asset completion flags (handles many assets)
Token-2022 features for compliance/transfer hooks if you introduce custom assets later 
5
Integrate with a mature multisig ecosystem (e.g., Squads) for upgrade authority / admin ops 




Package B — legacyvault (single-program MVP)
Directory layout
text

programs/legacyvault/src/
  lib.rs
  constants.rs
  state.rs
  errors.rs
  events.rs
programs/legacyvault/src/constants.rs
Rust

pub const CONFIG_SEED: &[u8] = b"config";
pub const VAULT_SEED: &[u8] = b"vault";
pub const VAULT_AUTH_SEED: &[u8] = b"vault_auth";
pub const GUARDIANS_SEED: &[u8] = b"guardians";
pub const BENEFICIARIES_SEED: &[u8] = b"beneficiaries";
pub const ASSETS_SEED: &[u8] = b"assets";
pub const UNLOCK_SEED: &[u8] = b"unlock";

pub const BPS_DENOMINATOR: u16 = 10_000;

// Compute-friendly MVP limits
pub const MAX_GUARDIANS: usize = 10;
pub const MAX_BENEFICIARIES: usize = 10;
pub const MAX_SPL_ASSETS: usize = 16;

pub const DOC_URI_MAX: usize = 200;
programs/legacyvault/src/state.rs
Rust

use anchor_lang::prelude::*;
use crate::constants::*;

#[repr(u8)]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum VaultStatus {
    Active = 0,
    Unlocking = 1,
    Distributed = 2,
    Closed = 3,
}

#[repr(u8)]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum UnlockStatus {
    Proposed = 0,
    Approved = 1,
    Cancelled = 2,
    Executed = 3,
}

#[account]
pub struct GlobalConfig {
    pub admin: Pubkey,
    pub paused: bool,

    /// Optional creation fee in lamports
    pub create_fee_lamports: u64,

    pub min_heartbeat_secs: u32,
    pub max_heartbeat_secs: u32,

    pub min_inactivity_secs: u32,
    pub max_inactivity_secs: u32,

    pub min_timelock_secs: u32,
    pub max_timelock_secs: u32,

    pub version: u16,
}

impl GlobalConfig {
    pub const LEN: usize =
        8 + 32 + 1 + 8 + (4 * 6) + 2;
}

#[account]
pub struct Vault {
    pub vault_id: u64,
    pub owner: Pubkey,

    pub created_at_unix: i64,
    pub last_checkin_unix: i64,

    pub heartbeat_interval_secs: u32,
    pub inactivity_threshold_secs: u32,
    pub timelock_secs: u32,

    pub status: VaultStatus,

    pub guardian_threshold: u8,
    pub guardians_count: u8,

    pub beneficiaries_count: u8,

    pub distribution_nonce: u64,

    /// Optional: will/letter-of-intent hash + URI
    pub doc_hash: [u8; 32],
    pub doc_uri_len: u16,
    pub doc_uri: [u8; DOC_URI_MAX],

    pub bump: u8,
}

impl Vault {
    pub const LEN: usize =
        8 +   // disc
        8 +   // vault_id
        32 +  // owner
        8 +   // created_at
        8 +   // last_checkin
        4 + 4 + 4 + // intervals
        1 +   // status
        1 + 1 + // guardian threshold/count
        1 +   // beneficiaries_count
        8 +   // distribution_nonce
        32 +  // doc_hash
        2 +   // doc_uri_len
        DOC_URI_MAX + // doc_uri
        1;    // bump
}

#[account]
pub struct GuardianRegistry {
    pub vault: Pubkey,
    pub threshold: u8,
    pub guardians: Vec<Pubkey>, // <= MAX_GUARDIANS
    pub updated_at_unix: i64,
}

impl GuardianRegistry {
    pub const LEN: usize =
        8 + 32 + 1 + (4 + 32 * MAX_GUARDIANS) + 8;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct BeneficiaryEntry {
    pub wallet: Pubkey,
    pub share_bps: u16,
    pub label: [u8; 16],
}

#[account]
pub struct BeneficiaryRegistry {
    pub vault: Pubkey,
    pub beneficiaries: Vec<BeneficiaryEntry>, // <= MAX_BENEFICIARIES
    pub total_bps: u16,
    pub updated_at_unix: i64,
}

impl BeneficiaryRegistry {
    pub const LEN: usize =
        8 + 32 +
        (4 + (32 + 2 + 16) * MAX_BENEFICIARIES) +
        2 + 8;
}

#[account]
pub struct AssetRegistry {
    pub vault: Pubkey,
    pub spl_mints: Vec<Pubkey>, // <= MAX_SPL_ASSETS
    pub updated_at_unix: i64,
}

impl AssetRegistry {
    pub const LEN: usize =
        8 + 32 + (4 + 32 * MAX_SPL_ASSETS) + 8;
}

#[account]
pub struct UnlockRequest {
    pub vault: Pubkey,
    pub nonce: u64,

    pub initiated_at_unix: i64,

    pub status: UnlockStatus,

    pub approvals: Vec<Pubkey>, // <= MAX_GUARDIANS
    pub approved_count: u8,

    pub approved_at_unix: i64, // set when reaching threshold; else 0
    pub executable_at_unix: i64, // approved_at + timelock

    // distribution completion
    pub sol_done: bool,
    pub spl_done_mask: u16, // bit i corresponds to AssetRegistry.spl_mints[i]

    pub bump: u8,
}

impl UnlockRequest {
    pub const LEN: usize =
        8 + 32 + 8 + 8 +
        1 + // status
        (4 + 32 * MAX_GUARDIANS) +
        1 + // approved_count
        8 + 8 +
        1 + 2 +
        1; // bump
}
programs/legacyvault/src/errors.rs
Rust

use anchor_lang::prelude::*;

#[error_code]
pub enum LegacyVaultError {
    #[msg("Unauthorized")]
    Unauthorized,

    #[msg("Protocol is paused")]
    Paused,

    #[msg("Invalid bounds")]
    InvalidBounds,

    #[msg("Vault is not Active")]
    VaultNotActive,

    #[msg("Vault is not Unlocking")]
    VaultNotUnlocking,

    #[msg("Invalid guardian threshold")]
    InvalidGuardianThreshold,

    #[msg("Too many guardians")]
    TooManyGuardians,

    #[msg("Too many beneficiaries")]
    TooManyBeneficiaries,

    #[msg("Beneficiary shares must sum to 10,000 bps")]
    BeneficiarySharesNot100,

    #[msg("Too many SPL assets")]
    TooManyAssets,

    #[msg("Guardian is not registered")]
    GuardianNotFound,

    #[msg("Guardian already approved")]
    GuardianAlreadyApproved,

    #[msg("Unlock is not eligible yet (inactivity threshold not reached)")]
    UnlockNotEligible,

    #[msg("Unlock request not approved")]
    UnlockNotApproved,

    #[msg("Timelock has not elapsed")]
    TimelockNotElapsed,

    #[msg("Distribution already completed for this asset")]
    DistributionAlreadyDone,

    #[msg("Asset index out of range")]
    AssetIndexOutOfRange,

    #[msg("Invalid document URI length")]
    InvalidDocUriLen,

    #[msg("Invalid beneficiary ATA for mint")]
    InvalidAta,

    #[msg("Math overflow")]
    MathOverflow,
}
programs/legacyvault/src/events.rs
Rust

use anchor_lang::prelude::*;
use crate::state::*;

#[event]
pub struct VaultCreated {
    pub vault: Pubkey,
    pub vault_id: u64,
    pub owner: Pubkey,
    pub ts: i64,
}

#[event]
pub struct GuardiansSet {
    pub vault: Pubkey,
    pub threshold: u8,
    pub guardians_count: u8,
    pub ts: i64,
}

#[event]
pub struct BeneficiariesSet {
    pub vault: Pubkey,
    pub beneficiaries_count: u8,
    pub total_bps: u16,
    pub ts: i64,
}

#[event]
pub struct DocumentSet {
    pub vault: Pubkey,
    pub doc_hash: [u8; 32],
    pub doc_uri_len: u16,
    pub ts: i64,
}

#[event]
pub struct SolDeposited {
    pub vault: Pubkey,
    pub owner: Pubkey,
    pub lamports: u64,
    pub ts: i64,
}

#[event]
pub struct SplDeposited {
    pub vault: Pubkey,
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub ts: i64,
}

#[event]
pub struct CheckIn {
    pub vault: Pubkey,
    pub owner: Pubkey,
    pub ts: i64,
}

#[event]
pub struct UnlockInitiated {
    pub vault: Pubkey,
    pub nonce: u64,
    pub initiated_by: Pubkey,
    pub ts: i64,
}

#[event]
pub struct UnlockApproved {
    pub vault: Pubkey,
    pub nonce: u64,
    pub guardian: Pubkey,
    pub approved_count: u8,
    pub threshold: u8,
    pub ts: i64,
}

#[event]
pub struct UnlockCancelled {
    pub vault: Pubkey,
    pub nonce: u64,
    pub ts: i64,
}

#[event]
pub struct SolDistributed {
    pub vault: Pubkey,
    pub nonce: u64,
    pub ts: i64,
}

#[event]
pub struct SplDistributed {
    pub vault: Pubkey,
    pub nonce: u64,
    pub mint: Pubkey,
    pub asset_index: u8,
    pub ts: i64,
}

#[event]
pub struct DistributionFinalized {
    pub vault: Pubkey,
    pub nonce: u64,
    pub ts: i64,
}
programs/legacyvault/src/lib.rs
Rust

use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, Transfer},
};

pub mod constants;
pub mod errors;
pub mod events;
pub mod state;

use constants::*;
use errors::*;
use events::*;
use state::*;

declare_id!("LEGAcY1111111111111111111111111111111111"); // replace

#[program]
pub mod legacyvault {
    use super::*;

    // ---------------------------
    // Admin
    // ---------------------------

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        create_fee_lamports: u64,
        min_heartbeat_secs: u32,
        max_heartbeat_secs: u32,
        min_inactivity_secs: u32,
        max_inactivity_secs: u32,
        min_timelock_secs: u32,
        max_timelock_secs: u32,
    ) -> Result<()> {
        let cfg = &mut ctx.accounts.config;
        cfg.admin = ctx.accounts.admin.key();
        cfg.paused = false;
        cfg.create_fee_lamports = create_fee_lamports;
        cfg.min_heartbeat_secs = min_heartbeat_secs;
        cfg.max_heartbeat_secs = max_heartbeat_secs;
        cfg.min_inactivity_secs = min_inactivity_secs;
        cfg.max_inactivity_secs = max_inactivity_secs;
        cfg.min_timelock_secs = min_timelock_secs;
        cfg.max_timelock_secs = max_timelock_secs;
        cfg.version = 1;
        Ok(())
    }

    pub fn set_paused(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
        require_keys_eq!(ctx.accounts.config.admin, ctx.accounts.admin.key(), LegacyVaultError::Unauthorized);
        ctx.accounts.config.paused = paused;
        Ok(())
    }

    // ---------------------------
    // Owner setup
    // ---------------------------

    pub fn create_vault(
        ctx: Context<CreateVault>,
        vault_id: u64,
        heartbeat_interval_secs: u32,
        inactivity_threshold_secs: u32,
        timelock_secs: u32,
    ) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require!(!cfg.paused, LegacyVaultError::Paused);

        // Bounds checks (tight in MVP)
        require!(heartbeat_interval_secs >= cfg.min_heartbeat_secs && heartbeat_interval_secs <= cfg.max_heartbeat_secs, LegacyVaultError::InvalidBounds);
        require!(inactivity_threshold_secs >= cfg.min_inactivity_secs && inactivity_threshold_secs <= cfg.max_inactivity_secs, LegacyVaultError::InvalidBounds);
        require!(timelock_secs >= cfg.min_timelock_secs && timelock_secs <= cfg.max_timelock_secs, LegacyVaultError::InvalidBounds);

        let now = Clock::get()?.unix_timestamp;

        let v = &mut ctx.accounts.vault;
        v.vault_id = vault_id;
        v.owner = ctx.accounts.owner.key();
        v.created_at_unix = now;
        v.last_checkin_unix = now;
        v.heartbeat_interval_secs = heartbeat_interval_secs;
        v.inactivity_threshold_secs = inactivity_threshold_secs;
        v.timelock_secs = timelock_secs;
        v.status = VaultStatus::Active;
        v.guardian_threshold = 0;
        v.guardians_count = 0;
        v.beneficiaries_count = 0;
        v.distribution_nonce = 0;
        v.doc_hash = [0u8; 32];
        v.doc_uri_len = 0;
        v.doc_uri = [0u8; DOC_URI_MAX];
        v.bump = ctx.bumps.vault;

        // registries
        let g = &mut ctx.accounts.guardians;
        g.vault = v.key();
        g.threshold = 0;
        g.guardians = vec![];
        g.updated_at_unix = now;

        let b = &mut ctx.accounts.beneficiaries;
        b.vault = v.key();
        b.beneficiaries = vec![];
        b.total_bps = 0;
        b.updated_at_unix = now;

        let a = &mut ctx.accounts.assets;
        a.vault = v.key();
        a.spl_mints = vec![];
        a.updated_at_unix = now;

        emit!(VaultCreated { vault: v.key(), vault_id, owner: v.owner, ts: now });

        Ok(())
    }

    pub fn set_guardians(ctx: Context<SetGuardians>, guardians: Vec<Pubkey>, threshold: u8) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require!(!cfg.paused, LegacyVaultError::Paused);

        let v = &mut ctx.accounts.vault;
        require_keys_eq!(v.owner, ctx.accounts.owner.key(), LegacyVaultError::Unauthorized);
        require!(v.status == VaultStatus::Active, LegacyVaultError::VaultNotActive);

        require!(guardians.len() <= MAX_GUARDIANS, LegacyVaultError::TooManyGuardians);
        require!(threshold >= 1 && (threshold as usize) <= guardians.len(), LegacyVaultError::InvalidGuardianThreshold);

        let g = &mut ctx.accounts.guardians;
        g.threshold = threshold;
        g.guardians = guardians;
        g.updated_at_unix = Clock::get()?.unix_timestamp;

        v.guardian_threshold = threshold;
        v.guardians_count = g.guardians.len() as u8;

        emit!(GuardiansSet {
            vault: v.key(),
            threshold,
            guardians_count: v.guardians_count,
            ts: g.updated_at_unix,
        });

        Ok(())
    }

    pub fn set_beneficiaries(ctx: Context<SetBeneficiaries>, beneficiaries: Vec<BeneficiaryEntry>) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require!(!cfg.paused, LegacyVaultError::Paused);

        let v = &mut ctx.accounts.vault;
        require_keys_eq!(v.owner, ctx.accounts.owner.key(), LegacyVaultError::Unauthorized);
        require!(v.status == VaultStatus::Active, LegacyVaultError::VaultNotActive);

        require!(beneficiaries.len() <= MAX_BENEFICIARIES, LegacyVaultError::TooManyBeneficiaries);

        let mut total: u32 = 0;
        for b in beneficiaries.iter() {
            total = total.checked_add(b.share_bps as u32).ok_or(LegacyVaultError::MathOverflow)?;
        }
        require!(total == BPS_DENOMINATOR as u32, LegacyVaultError::BeneficiarySharesNot100);

        let reg = &mut ctx.accounts.beneficiaries;
        reg.beneficiaries = beneficiaries;
        reg.total_bps = BPS_DENOMINATOR;
        reg.updated_at_unix = Clock::get()?.unix_timestamp;

        v.beneficiaries_count = reg.beneficiaries.len() as u8;

        emit!(BeneficiariesSet {
            vault: v.key(),
            beneficiaries_count: v.beneficiaries_count,
            total_bps: reg.total_bps,
            ts: reg.updated_at_unix,
        });

        Ok(())
    }

    pub fn set_document(ctx: Context<SetDocument>, doc_hash: [u8; 32], doc_uri: Vec<u8>) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require!(!cfg.paused, LegacyVaultError::Paused);

        let v = &mut ctx.accounts.vault;
        require_keys_eq!(v.owner, ctx.accounts.owner.key(), LegacyVaultError::Unauthorized);
        require!(v.status == VaultStatus::Active, LegacyVaultError::VaultNotActive);

        require!(doc_uri.len() <= DOC_URI_MAX, LegacyVaultError::InvalidDocUriLen);
        v.doc_hash = doc_hash;
        v.doc_uri_len = doc_uri.len() as u16;
        v.doc_uri = [0u8; DOC_URI_MAX];
        v.doc_uri[..doc_uri.len()].copy_from_slice(&doc_uri);

        emit!(DocumentSet {
            vault: v.key(),
            doc_hash,
            doc_uri_len: v.doc_uri_len,
            ts: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    pub fn deposit_sol(ctx: Context<DepositSol>, lamports: u64) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require!(!cfg.paused, LegacyVaultError::Paused);

        let v = &ctx.accounts.vault;
        require_keys_eq!(v.owner, ctx.accounts.owner.key(), LegacyVaultError::Unauthorized);
        require!(v.status == VaultStatus::Active, LegacyVaultError::VaultNotActive);

        // System transfer owner -> vault PDA
        anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.owner.key(),
            &ctx.accounts.vault.key(),
            lamports,
        );
        // In handler you should invoke it:
        anchor_lang::solana_program::program::invoke(
            &anchor_lang::solana_program::system_instruction::transfer(
                &ctx.accounts.owner.key(),
                &ctx.accounts.vault.key(),
                lamports,
            ),
            &[
                ctx.accounts.owner.to_account_info(),
                ctx.accounts.vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        emit!(SolDeposited { vault: v.key(), owner: v.owner, lamports, ts: Clock::get()?.unix_timestamp });
        Ok(())
    }

    pub fn deposit_spl(ctx: Context<DepositSpl>, amount: u64) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require!(!cfg.paused, LegacyVaultError::Paused);

        let v = &ctx.accounts.vault;
        require_keys_eq!(v.owner, ctx.accounts.owner.key(), LegacyVaultError::Unauthorized);
        require!(v.status == VaultStatus::Active, LegacyVaultError::VaultNotActive);

        // Transfer owner ATA -> vault ATA (owned by vault_auth PDA)
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.owner_token_ata.to_account_info(),
                    to: ctx.accounts.vault_token_ata.to_account_info(),
                    authority: ctx.accounts.owner.to_account_info(),
                },
            ),
            amount,
        )?;

        // Register mint if new
        let assets = &mut ctx.accounts.assets;
        let mint = ctx.accounts.mint.key();
        if !assets.spl_mints.iter().any(|m| *m == mint) {
            require!(assets.spl_mints.len() < MAX_SPL_ASSETS, LegacyVaultError::TooManyAssets);
            assets.spl_mints.push(mint);
            assets.updated_at_unix = Clock::get()?.unix_timestamp;
        }

        emit!(SplDeposited { vault: v.key(), owner: v.owner, mint, amount, ts: Clock::get()?.unix_timestamp });
        Ok(())
    }

    pub fn check_in(ctx: Context<CheckIn>) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require!(!cfg.paused, LegacyVaultError::Paused);

        let v = &mut ctx.accounts.vault;
        require_keys_eq!(v.owner, ctx.accounts.owner.key(), LegacyVaultError::Unauthorized);
        require!(v.status == VaultStatus::Active, LegacyVaultError::VaultNotActive);

        v.last_checkin_unix = Clock::get()?.unix_timestamp;
        emit!(CheckIn { vault: v.key(), owner: v.owner, ts: v.last_checkin_unix });
        Ok(())
    }

    // ---------------------------
    // Unlock lifecycle
    // ---------------------------

    pub fn initiate_unlock(ctx: Context<InitiateUnlock>) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require!(!cfg.paused, LegacyVaultError::Paused);

        let now = Clock::get()?.unix_timestamp;
        let v = &mut ctx.accounts.vault;
        require!(v.status == VaultStatus::Active, LegacyVaultError::VaultNotActive);

        let eligible_at = v.last_checkin_unix
            .checked_add(v.inactivity_threshold_secs as i64)
            .ok_or(LegacyVaultError::MathOverflow)?;
        require!(now >= eligible_at, LegacyVaultError::UnlockNotEligible);

        // create unlock request
        v.status = VaultStatus::Unlocking;
        v.distribution_nonce = v.distribution_nonce.checked_add(1).ok_or(LegacyVaultError::MathOverflow)?;

        let u = &mut ctx.accounts.unlock;
        u.vault = v.key();
        u.nonce = v.distribution_nonce;
        u.initiated_at_unix = now;
        u.status = UnlockStatus::Proposed;
        u.approvals = vec![];
        u.approved_count = 0;
        u.approved_at_unix = 0;
        u.executable_at_unix = 0;
        u.sol_done = false;
        u.spl_done_mask = 0;
        u.bump = ctx.bumps.unlock;

        emit!(UnlockInitiated { vault: v.key(), nonce: u.nonce, initiated_by: ctx.accounts.guardian.key(), ts: now });
        Ok(())
    }

    pub fn approve_unlock(ctx: Context<ApproveUnlock>) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require!(!cfg.paused, LegacyVaultError::Paused);

        let now = Clock::get()?.unix_timestamp;

        let v = &ctx.accounts.vault;
        require!(v.status == VaultStatus::Unlocking, LegacyVaultError::VaultNotUnlocking);

        // guardian must be registered
        let reg = &ctx.accounts.guardians;
        let gk = ctx.accounts.guardian.key();
        require!(reg.guardians.iter().any(|x| *x == gk), LegacyVaultError::GuardianNotFound);

        let u = &mut ctx.accounts.unlock;
        require!(u.status == UnlockStatus::Proposed || u.status == UnlockStatus::Approved, LegacyVaultError::UnlockNotApproved);

        require!(!u.approvals.iter().any(|x| *x == gk), LegacyVaultError::GuardianAlreadyApproved);
        u.approvals.push(gk);
        u.approved_count = u.approved_count.checked_add(1).ok_or(LegacyVaultError::MathOverflow)?;

        // threshold reached?
        if u.approved_count >= reg.threshold {
            u.status = UnlockStatus::Approved;
            u.approved_at_unix = now;
            u.executable_at_unix = now.checked_add(v.timelock_secs as i64).ok_or(LegacyVaultError::MathOverflow)?;
        }

        emit!(UnlockApproved {
            vault: v.key(),
            nonce: u.nonce,
            guardian: gk,
            approved_count: u.approved_count,
            threshold: reg.threshold,
            ts: now,
        });

        Ok(())
    }

    pub fn cancel_unlock(ctx: Context<CancelUnlock>) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require!(!cfg.paused, LegacyVaultError::Paused);

        let v = &mut ctx.accounts.vault;
        require_keys_eq!(v.owner, ctx.accounts.owner.key(), LegacyVaultError::Unauthorized);
        require!(v.status == VaultStatus::Unlocking, LegacyVaultError::VaultNotUnlocking);

        let u = &mut ctx.accounts.unlock;
        u.status = UnlockStatus::Cancelled;
        v.status = VaultStatus::Active;

        emit!(UnlockCancelled { vault: v.key(), nonce: u.nonce, ts: Clock::get()?.unix_timestamp });
        Ok(())
    }

    // ---------------------------
    // Distribution (chunked)
    // ---------------------------

    pub fn execute_distribution_sol(ctx: Context<ExecuteDistributionSol>) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require!(!cfg.paused, LegacyVaultError::Paused);

        let now = Clock::get()?.unix_timestamp;
        let v = &mut ctx.accounts.vault;
        require!(v.status == VaultStatus::Unlocking, LegacyVaultError::VaultNotUnlocking);

        let u = &mut ctx.accounts.unlock;
        require!(u.status == UnlockStatus::Approved, LegacyVaultError::UnlockNotApproved);
        require!(now >= u.executable_at_unix, LegacyVaultError::TimelockNotElapsed);
        require!(!u.sol_done, LegacyVaultError::DistributionAlreadyDone);

        // Implement SOL distribution using remaining_accounts = beneficiary wallets
        // and invoke_signed with vault PDA seeds.
        u.sol_done = true;

        emit!(SolDistributed { vault: v.key(), nonce: u.nonce, ts: now });

        Ok(())
    }

    pub fn execute_distribution_spl(ctx: Context<ExecuteDistributionSpl>, asset_index: u8, amount_hint: u64) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require!(!cfg.paused, LegacyVaultError::Paused);

        let now = Clock::get()?.unix_timestamp;
        let v = &mut ctx.accounts.vault;
        require!(v.status == VaultStatus::Unlocking, LegacyVaultError::VaultNotUnlocking);

        let u = &mut ctx.accounts.unlock;
        require!(u.status == UnlockStatus::Approved, LegacyVaultError::UnlockNotApproved);
        require!(now >= u.executable_at_unix, LegacyVaultError::TimelockNotElapsed);

        let assets = &ctx.accounts.assets;
        require!((asset_index as usize) < assets.spl_mints.len(), LegacyVaultError::AssetIndexOutOfRange);

        let mask_bit = 1u16.checked_shl(asset_index as u32).ok_or(LegacyVaultError::MathOverflow)?;
        require!((u.spl_done_mask & mask_bit) == 0, LegacyVaultError::DistributionAlreadyDone);

        // Implement SPL distribution:
        // - vault_token_ata -> beneficiary_ata for each beneficiary
        // - remaining_accounts expected as pairs: (beneficiary_wallet, beneficiary_ata)
        // - validate ATA(mint, wallet) per pair
        // amount_hint is unused; just helps UI; compute balance on-chain.
        u.spl_done_mask |= mask_bit;

        emit!(SplDistributed {
            vault: v.key(),
            nonce: u.nonce,
            mint: ctx.accounts.mint.key(),
            asset_index,
            ts: now,
        });

        Ok(())
    }

    pub fn finalize_distribution(ctx: Context<FinalizeDistribution>) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require!(!cfg.paused, LegacyVaultError::Paused);

        let now = Clock::get()?.unix_timestamp;

        let v = &mut ctx.accounts.vault;
        let u = &mut ctx.accounts.unlock;
        let assets = &ctx.accounts.assets;

        require!(v.status == VaultStatus::Unlocking, LegacyVaultError::VaultNotUnlocking);
        require!(u.status == UnlockStatus::Approved, LegacyVaultError::UnlockNotApproved);

        // Check that sol done + all spl assets done
        let all_mask: u16 = if assets.spl_mints.len() >= 16 {
            u16::MAX
        } else {
            (1u16 << (assets.spl_mints.len() as u16)) - 1
        };

        require!(u.sol_done, LegacyVaultError::DistributionAlreadyDone);
        require!(u.spl_done_mask == all_mask, LegacyVaultError::DistributionAlreadyDone);

        u.status = UnlockStatus::Executed;
        v.status = VaultStatus::Distributed;

        emit!(DistributionFinalized { vault: v.key(), nonce: u.nonce, ts: now });

        Ok(())
    }
}

// ============================================================
// Contexts
// ============================================================

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        payer = admin,
        space = GlobalConfig::LEN,
        seeds = [CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, GlobalConfig>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetPaused<'info> {
    #[account(mut, seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, GlobalConfig>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(vault_id: u64)]
pub struct CreateVault<'info> {
    #[account(seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, GlobalConfig>,

    #[account(
        init,
        payer = owner,
        space = Vault::LEN,
        seeds = [VAULT_SEED, owner.key().as_ref(), &vault_id.to_le_bytes()],
        bump
    )]
    pub vault: Account<'info, Vault>,

    /// CHECK: PDA authority for token accounts; derived from vault pubkey
    #[account(
        seeds = [VAULT_AUTH_SEED, vault.key().as_ref()],
        bump
    )]
    pub vault_auth: UncheckedAccount<'info>,

    #[account(
        init,
        payer = owner,
        space = GuardianRegistry::LEN,
        seeds = [GUARDIANS_SEED, vault.key().as_ref()],
        bump
    )]
    pub guardians: Account<'info, GuardianRegistry>,

    #[account(
        init,
        payer = owner,
        space = BeneficiaryRegistry::LEN,
        seeds = [BENEFICIARIES_SEED, vault.key().as_ref()],
        bump
    )]
    pub beneficiaries: Account<'info, BeneficiaryRegistry>,

    #[account(
        init,
        payer = owner,
        space = AssetRegistry::LEN,
        seeds = [ASSETS_SEED, vault.key().as_ref()],
        bump
    )]
    pub assets: Account<'info, AssetRegistry>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetGuardians<'info> {
    #[account(seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, GlobalConfig>,

    #[account(mut)]
    pub vault: Account<'info, Vault>,

    #[account(mut, seeds = [GUARDIANS_SEED, vault.key().as_ref()], bump)]
    pub guardians: Account<'info, GuardianRegistry>,

    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetBeneficiaries<'info> {
    #[account(seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, GlobalConfig>,

    #[account(mut)]
    pub vault: Account<'info, Vault>,

    #[account(mut, seeds = [BENEFICIARIES_SEED, vault.key().as_ref()], bump)]
    pub beneficiaries: Account<'info, BeneficiaryRegistry>,

    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetDocument<'info> {
    #[account(seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, GlobalConfig>,

    #[account(mut)]
    pub vault: Account<'info, Vault>,

    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct DepositSol<'info> {
    #[account(seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, GlobalConfig>,

    #[account(mut)]
    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositSpl<'info> {
    #[account(seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, GlobalConfig>,

    #[account(mut)]
    pub vault: Account<'info, Vault>,

    /// CHECK: PDA authority for vault token account
    #[account(
        seeds = [VAULT_AUTH_SEED, vault.key().as_ref()],
        bump
    )]
    pub vault_auth: UncheckedAccount<'info>,

    #[account(mut, seeds = [ASSETS_SEED, vault.key().as_ref()], bump)]
    pub assets: Account<'info, AssetRegistry>,

    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = owner
    )]
    pub owner_token_ata: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = mint,
        associated_token::authority = vault_auth
    )]
    pub vault_token_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct CheckIn<'info> {
    #[account(seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, GlobalConfig>,

    #[account(mut)]
    pub vault: Account<'info, Vault>,

    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct InitiateUnlock<'info> {
    #[account(seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, GlobalConfig>,

    #[account(mut)]
    pub vault: Account<'info, Vault>,

    #[account(seeds = [GUARDIANS_SEED, vault.key().as_ref()], bump)]
    pub guardians: Account<'info, GuardianRegistry>,

    #[account(
        init,
        payer = guardian,
        space = UnlockRequest::LEN,
        seeds = [UNLOCK_SEED, vault.key().as_ref(), &(vault.distribution_nonce.wrapping_add(1)).to_le_bytes()],
        bump
    )]
    pub unlock: Account<'info, UnlockRequest>,

    #[account(mut)]
    pub guardian: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ApproveUnlock<'info> {
    #[account(seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, GlobalConfig>,

    #[account(mut)]
    pub vault: Account<'info, Vault>,

    #[account(seeds = [GUARDIANS_SEED, vault.key().as_ref()], bump)]
    pub guardians: Account<'info, GuardianRegistry>,

    #[account(mut)]
    pub unlock: Account<'info, UnlockRequest>,

    pub guardian: Signer<'info>,
}

#[derive(Accounts)]
pub struct CancelUnlock<'info> {
    #[account(seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, GlobalConfig>,

    #[account(mut)]
    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub unlock: Account<'info, UnlockRequest>,

    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct ExecuteDistributionSol<'info> {
    #[account(seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, GlobalConfig>,

    #[account(mut)]
    pub vault: Account<'info, Vault>,

    #[account(seeds = [BENEFICIARIES_SEED, vault.key().as_ref()], bump)]
    pub beneficiaries: Account<'info, BeneficiaryRegistry>,

    #[account(mut)]
    pub unlock: Account<'info, UnlockRequest>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExecuteDistributionSpl<'info> {
    #[account(seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, GlobalConfig>,

    #[account(mut)]
    pub vault: Account<'info, Vault>,

    /// CHECK: PDA authority for vault token account
    #[account(
        seeds = [VAULT_AUTH_SEED, vault.key().as_ref()],
        bump
    )]
    pub vault_auth: UncheckedAccount<'info>,

    #[account(seeds = [BENEFICIARIES_SEED, vault.key().as_ref()], bump)]
    pub beneficiaries: Account<'info, BeneficiaryRegistry>,

    #[account(seeds = [ASSETS_SEED, vault.key().as_ref()], bump)]
    pub assets: Account<'info, AssetRegistry>,

    #[account(mut)]
    pub unlock: Account<'info, UnlockRequest>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = vault_auth
    )]
    pub vault_token_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct FinalizeDistribution<'info> {
    #[account(seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, GlobalConfig>,

    #[account(mut)]
    pub vault: Account<'info, Vault>,

    #[account(seeds = [ASSETS_SEED, vault.key().as_ref()], bump)]
    pub assets: Account<'info, AssetRegistry>,

    #[account(mut)]
    pub unlock: Account<'info, UnlockRequest>,
}




LegacyVault
config PDA: [b"config"]
vault PDA: [b"vault", owner_pubkey, vault_id_le]
vault_auth PDA: [b"vault_auth", vault_pubkey]
guardians PDA: [b"guardians", vault_pubkey]
beneficiaries PDA: [b"beneficiaries", vault_pubkey]
assets PDA: [b"assets", vault_pubkey]
unlock PDA: [b"unlock", vault_pubkey, nonce_le]



Implementation notes you’ll want to follow immediately (so this spec “just works”)


LegacyVault SPL distribution (remaining accounts convention)
For execute_distribution_spl you’ll almost certainly pass remaining accounts as pairs:

(beneficiary_wallet_0, beneficiary_ata_0, beneficiary_wallet_1, beneficiary_ata_1, ...) Validate each ATA in the handler using associated-token derivation for (wallet, mint).
Chunked distribution is intentional
The design uses:

execute_distribution_sol
execute_distribution_spl(asset_index)
finalize_distribution so you don’t blow compute limits in one transaction.




LegacyVault — Rust handler logic (SOL + SPL transfers, chunked)
The skeleton already has the chunking; now we implement the actual transfers and on-chain ATA validation.

B1) Associated token address derivation helper (on-chain)
Create:

programs/legacyvault/src/utils.rs
Rust

use anchor_lang::prelude::*;

pub fn ata_address(wallet: &Pubkey, mint: &Pubkey, token_program: &Pubkey, ata_program: &Pubkey) -> Pubkey {
    // Associated token address seeds:
    // [wallet, token_program_id, mint] with ATA program id
    let seeds: &[&[u8]] = &[
        wallet.as_ref(),
        token_program.as_ref(),
        mint.as_ref(),
    ];
    Pubkey::find_program_address(seeds, ata_program).0
}
Add to lib.rs:

Rust

pub mod utils;
B2) Implement SOL distribution (execute_distribution_sol)
Replace body with:

Rust

pub fn execute_distribution_sol(ctx: Context<ExecuteDistributionSol>) -> Result<()> {
    let cfg = &ctx.accounts.config;
    require!(!cfg.paused, LegacyVaultError::Paused);

    let now = Clock::get()?.unix_timestamp;

    let v = &mut ctx.accounts.vault;
    require!(v.status == VaultStatus::Unlocking, LegacyVaultError::VaultNotUnlocking);

    let u = &mut ctx.accounts.unlock;
    require!(u.status == UnlockStatus::Approved, LegacyVaultError::UnlockNotApproved);
    require!(now >= u.executable_at_unix, LegacyVaultError::TimelockNotElapsed);
    require!(!u.sol_done, LegacyVaultError::DistributionAlreadyDone);

    let reg = &ctx.accounts.beneficiaries;
    require!(reg.beneficiaries.len() > 0, LegacyVaultError::TooManyBeneficiaries);

    // remaining accounts must be beneficiary wallets, writable
    require!(ctx.remaining_accounts.len() == reg.beneficiaries.len(), LegacyVaultError::TooManyBeneficiaries);

    // Keep vault rent-exempt
    let rent = Rent::get()?;
    let min_balance = rent.minimum_balance(Vault::LEN);

    let vault_info = v.to_account_info();
    let vault_lamports = **vault_info.try_borrow_lamports()?;
    require!(vault_lamports > min_balance, LegacyVaultError::MathOverflow);

    let mut distributable = vault_lamports
        .checked_sub(min_balance)
        .ok_or(LegacyVaultError::MathOverflow)?;

    if distributable == 0 {
        u.sol_done = true;
        emit!(SolDistributed { vault: v.key(), nonce: u.nonce, ts: now });
        return Ok(());
    }

    // Distribute with remainder to last beneficiary
    let mut paid_total: u64 = 0;
    for (i, b) in reg.beneficiaries.iter().enumerate() {
        let expected_wallet = b.wallet;
        let wallet_ai = &ctx.remaining_accounts[i];
        require_keys_eq!(wallet_ai.key(), expected_wallet, LegacyVaultError::Unauthorized);
        require!(wallet_ai.is_writable, LegacyVaultError::Unauthorized);

        let mut pay = (distributable as u128)
            .checked_mul(b.share_bps as u128).ok_or(LegacyVaultError::MathOverflow)?
            .checked_div(10_000).ok_or(LegacyVaultError::MathOverflow)? as u64;

        // last gets remainder
        if i == reg.beneficiaries.len() - 1 {
            let remainder = distributable.checked_sub(paid_total).ok_or(LegacyVaultError::MathOverflow)?;
            pay = remainder;
        }

        if pay > 0 {
            **vault_info.try_borrow_mut_lamports()? -= pay;
            **wallet_ai.try_borrow_mut_lamports()? += pay;
            paid_total = paid_total.checked_add(pay).ok_or(LegacyVaultError::MathOverflow)?;
        }
    }

    u.sol_done = true;
    emit!(SolDistributed { vault: v.key(), nonce: u.nonce, ts: now });

    Ok(())
}
B3) Implement SPL distribution (execute_distribution_spl)
This version expects remaining accounts as pairs: (beneficiary_wallet_0, beneficiary_ata_0, beneficiary_wallet_1, beneficiary_ata_1, ...)

Replace body with:

Rust

pub fn execute_distribution_spl(ctx: Context<ExecuteDistributionSpl>, asset_index: u8, _amount_hint: u64) -> Result<()> {
    let cfg = &ctx.accounts.config;
    require!(!cfg.paused, LegacyVaultError::Paused);

    let now = Clock::get()?.unix_timestamp;

    let v = &mut ctx.accounts.vault;
    require!(v.status == VaultStatus::Unlocking, LegacyVaultError::VaultNotUnlocking);

    let u = &mut ctx.accounts.unlock;
    require!(u.status == UnlockStatus::Approved, LegacyVaultError::UnlockNotApproved);
    require!(now >= u.executable_at_unix, LegacyVaultError::TimelockNotElapsed);

    let assets = &ctx.accounts.assets;
    require!((asset_index as usize) < assets.spl_mints.len(), LegacyVaultError::AssetIndexOutOfRange);

    let expected_mint = assets.spl_mints[asset_index as usize];
    require_keys_eq!(expected_mint, ctx.accounts.mint.key(), LegacyVaultError::Unauthorized);

    let mask_bit = (1u16)
        .checked_shl(asset_index as u32)
        .ok_or(LegacyVaultError::MathOverflow)?;
    require!((u.spl_done_mask & mask_bit) == 0, LegacyVaultError::DistributionAlreadyDone);

    let reg = &ctx.accounts.beneficiaries;
    let n = reg.beneficiaries.len();
    require!(n > 0, LegacyVaultError::TooManyBeneficiaries);

    // remaining accounts must be 2*n
    require!(ctx.remaining_accounts.len() == 2 * n, LegacyVaultError::TooManyBeneficiaries);

    // vault token balance
    let vault_bal = ctx.accounts.vault_token_ata.amount;
    if vault_bal == 0 {
        u.spl_done_mask |= mask_bit;
        emit!(SplDistributed {
            vault: v.key(),
            nonce: u.nonce,
            mint: ctx.accounts.mint.key(),
            asset_index,
            ts: now,
        });
        return Ok(());
    }

    let token_program_id = ctx.accounts.token_program.key();
    let ata_program_id = anchor_spl::associated_token::ID;

    // Payouts with remainder to last
    let mut paid_total: u64 = 0;

    let pool_id_seeds: &[&[&[u8]]] = &[&[
        VAULT_AUTH_SEED,
        v.key().as_ref(),
        // NOTE: your vault_auth bump must be made available in context bumps if you type it
        // If vault_auth is UncheckedAccount, Anchor still provides ctx.bumps if it's in the context.
        &[ctx.bumps.vault_auth],
    ]];

    for i in 0..n {
        let b = &reg.beneficiaries[i];

        let wallet_ai = &ctx.remaining_accounts[2 * i];
        let ata_ai = &ctx.remaining_accounts[2 * i + 1];

        require_keys_eq!(wallet_ai.key(), b.wallet, LegacyVaultError::Unauthorized);

        // Validate ATA address derivation AND token account fields
        let expected_ata = crate::utils::ata_address(
            &b.wallet,
            &ctx.accounts.mint.key(),
            &token_program_id,
            &ata_program_id,
        );
        require_keys_eq!(ata_ai.key(), expected_ata, LegacyVaultError::InvalidAta);

        let ata: Account<TokenAccount> = Account::try_from(ata_ai)?;
        require_keys_eq!(ata.owner, b.wallet, LegacyVaultError::InvalidAta);
        require_keys_eq!(ata.mint, ctx.accounts.mint.key(), LegacyVaultError::InvalidAta);

        let mut pay = (vault_bal as u128)
            .checked_mul(b.share_bps as u128).ok_or(LegacyVaultError::MathOverflow)?
            .checked_div(10_000).ok_or(LegacyVaultError::MathOverflow)? as u64;

        if i == n - 1 {
            let remainder = vault_bal.checked_sub(paid_total).ok_or(LegacyVaultError::MathOverflow)?;
            pay = remainder;
        }

        if pay > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.vault_token_ata.to_account_info(),
                        to: ata.to_account_info(),
                        authority: ctx.accounts.vault_auth.to_account_info(),
                    },
                    pool_id_seeds,
                ),
                pay,
            )?;
            paid_total = paid_total.checked_add(pay).ok_or(LegacyVaultError::MathOverflow)?;
        }
    }

    u.spl_done_mask |= mask_bit;

    emit!(SplDistributed {
        vault: v.key(),
        nonce: u.nonce,
        mint: ctx.accounts.mint.key(),
        asset_index,
        ts: now,
    });

    Ok(())
}
Context tweak required
To access ctx.bumps.vault_auth, make sure vault_auth is present in the ExecuteDistributionSpl context with seeds and bump (it already is in your skeleton). If not, add it.





TypeScript client mini-SDK
This is a practical set of files you can drop into sdk/ (or your app) to reliably build transactions.

Assumptions:

You’re using @coral-xyz/anchor + @solana/web3.js
You have IDLs generated for both programs (Anchor does this)
You can import the program objects from Anchor
C1) PDA helpers
sdk/pdas.ts
TypeScript

import { PublicKey } from "@solana/web3.js";

export const CLIMAFI_SEEDS = {
  CONFIG: Buffer.from("config"),
  POOL: Buffer.from("pool"),
  VAULT_AUTH: Buffer.from("vault_auth"),
  LP_MINT: Buffer.from("lp_mint"),
  POLICY: Buffer.from("policy"),
  OBS: Buffer.from("obs"),
};

export const LEGACY_SEEDS = {
  CONFIG: Buffer.from("config"),
  VAULT: Buffer.from("vault"),
  VAULT_AUTH: Buffer.from("vault_auth"),
  GUARDIANS: Buffer.from("guardians"),
  BENEFICIARIES: Buffer.from("beneficiaries"),
  ASSETS: Buffer.from("assets"),
  UNLOCK: Buffer.from("unlock"),
};

export function u64LE(n: bigint) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(n);
  return b;
}

export function i64LE(n: bigint) {
  const b = Buffer.alloc(8);
  b.writeBigInt64LE(n);
  return b;
}

// --------------------
// ClimaFi PDAs
// --------------------
export function climafiConfigPda(programId: PublicKey) {
  return PublicKey.findProgramAddressSync([CLIMAFI_SEEDS.CONFIG], programId);
}

export function climafiPoolPda(programId: PublicKey, poolId: bigint) {
  return PublicKey.findProgramAddressSync(
    [CLIMAFI_SEEDS.POOL, u64LE(poolId)],
    programId
  );
}

export function climafiVaultAuthPda(programId: PublicKey, poolId: bigint) {
  return PublicKey.findProgramAddressSync(
    [CLIMAFI_SEEDS.VAULT_AUTH, u64LE(poolId)],
    programId
  );
}

export function climafiLpMintPda(programId: PublicKey, poolId: bigint) {
  return PublicKey.findProgramAddressSync(
    [CLIMAFI_SEEDS.LP_MINT, u64LE(poolId)],
    programId
  );
}

export function climafiPolicyPda(programId: PublicKey, policyId: bigint) {
  return PublicKey.findProgramAddressSync(
    [CLIMAFI_SEEDS.POLICY, u64LE(policyId)],
    programId
  );
}

export function climafiObsPda(
  programId: PublicKey,
  regionId: bigint,
  perilU8: number,
  dayStartUnix: bigint
) {
  return PublicKey.findProgramAddressSync(
    [CLIMAFI_SEEDS.OBS, u64LE(regionId), Buffer.from([perilU8]), i64LE(dayStartUnix)],
    programId
  );
}

// --------------------
// LegacyVault PDAs
// --------------------
export function legacyConfigPda(programId: PublicKey) {
  return PublicKey.findProgramAddressSync([LEGACY_SEEDS.CONFIG], programId);
}

export function legacyVaultPda(programId: PublicKey, owner: PublicKey, vaultId: bigint) {
  return PublicKey.findProgramAddressSync(
    [LEGACY_SEEDS.VAULT, owner.toBuffer(), u64LE(vaultId)],
    programId
  );
}

export function legacyVaultAuthPda(programId: PublicKey, vault: PublicKey) {
  return PublicKey.findProgramAddressSync([LEGACY_SEEDS.VAULT_AUTH, vault.toBuffer()], programId);
}

export function legacyGuardiansPda(programId: PublicKey, vault: PublicKey) {
  return PublicKey.findProgramAddressSync([LEGACY_SEEDS.GUARDIANS, vault.toBuffer()], programId);
}

export function legacyBeneficiariesPda(programId: PublicKey, vault: PublicKey) {
  return PublicKey.findProgramAddressSync([LEGACY_SEEDS.BENEFICIARIES, vault.toBuffer()], programId);
}

export function legacyAssetsPda(programId: PublicKey, vault: PublicKey) {
  return PublicKey.findProgramAddressSync([LEGACY_SEEDS.ASSETS, vault.toBuffer()], programId);
}

export function legacyUnlockPda(programId: PublicKey, vault: PublicKey, nonce: bigint) {
  return PublicKey.findProgramAddressSync([LEGACY_SEEDS.UNLOCK, vault.toBuffer(), u64LE(nonce)], programId);
}






LegacyVault distribution transaction builder (chunked SOL + SPL)
This builder:

fetches vault + registries
builds executeDistributionSol with remaining beneficiary wallet accounts
builds one tx per SPL mint (asset_index) with remaining (wallet, ata) pairs
builds finalizeDistribution
sdk/legacyTx.ts
TypeScript

import { Program } from "@coral-xyz/anchor";
import { PublicKey, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import BN from "bn.js";
import {
  legacyAssetsPda,
  legacyBeneficiariesPda,
  legacyUnlockPda,
  legacyVaultAuthPda,
} from "./pdas";

export async function buildLegacyDistributionTxs(args: {
  program: Program;          // Anchor Program<Legacyvault>
  vault: PublicKey;
  nonce: BN;                 // unlock nonce
}): Promise<{
  solTx: Transaction;
  splTxs: Transaction[];
  finalizeTx: Transaction;
}> {
  const { program, vault, nonce } = args;

  const [vaultAuth] = legacyVaultAuthPda(program.programId, vault);
  const [beneficiariesPda] = legacyBeneficiariesPda(program.programId, vault);
  const [assetsPda] = legacyAssetsPda(program.programId, vault);
  const [unlockPda] = legacyUnlockPda(program.programId, vault, BigInt(nonce.toString()));

  const beneficiaries = await program.account.beneficiaryRegistry.fetch(beneficiariesPda);
  const assets = await program.account.assetRegistry.fetch(assetsPda);

  const benList: { wallet: PublicKey; shareBps: number }[] = beneficiaries.beneficiaries.map((b: any) => ({
    wallet: b.wallet as PublicKey,
    shareBps: b.shareBps as number,
  }));

  // 1) SOL tx: remaining accounts = beneficiary wallets
  const solIx = await program.methods
    .executeDistributionSol()
    .accounts({
      config: (await (async () => {
        // if you have a config PDA helper, use it; otherwise fetch from IDL accounts map
        return (await PublicKey.findProgramAddressSync([Buffer.from("config")], program.programId))[0];
      })()) as any,
      vault,
      beneficiaries: beneficiariesPda,
      unlock: unlockPda,
      systemProgram: /* SystemProgram.programId */ undefined as any,
    })
    .remainingAccounts(
      benList.map(b => ({ pubkey: b.wallet, isSigner: false, isWritable: true }))
    )
    .instruction();

  const solTx = new Transaction().add(solIx);

  // 2) SPL txs: one per asset index
  const splTxs: Transaction[] = [];
  const mints: PublicKey[] = assets.splMints as PublicKey[];

  for (let i = 0; i < mints.length; i++) {
    const mint = mints[i];
    const vaultTokenAta = getAssociatedTokenAddressSync(mint, vaultAuth, true);

    const remaining = [];
    for (const b of benList) {
      const ata = getAssociatedTokenAddressSync(mint, b.wallet);
      remaining.push({ pubkey: b.wallet, isSigner: false, isWritable: false });
      remaining.push({ pubkey: ata, isSigner: false, isWritable: true });
    }

    const splIx = await program.methods
      .executeDistributionSpl(i, new BN(0)) // asset_index, amount_hint
      .accounts({
        config: (await PublicKey.findProgramAddressSync([Buffer.from("config")], program.programId))[0] as any,
        vault,
        vaultAuth,
        beneficiaries: beneficiariesPda,
        assets: assetsPda,
        unlock: unlockPda,
        mint,
        vaultTokenAta,
        tokenProgram: /* TOKEN_PROGRAM_ID */ undefined as any,
      })
      .remainingAccounts(remaining)
      .instruction();

    splTxs.push(new Transaction().add(splIx));
  }

  // 3) Finalize tx
  const finalizeIx = await program.methods
    .finalizeDistribution()
    .accounts({
      config: (await PublicKey.findProgramAddressSync([Buffer.from("config")], program.programId))[0] as any,
      vault,
      assets: assetsPda,
      unlock: unlockPda,
    })
    .instruction();

  const finalizeTx = new Transaction().add(finalizeIx);

  return { solTx, splTxs, finalizeTx };
}




LegacyVault
execute_distribution_sol remaining accounts must be beneficiary wallets in registry order.
execute_distribution_spl(asset_index) remaining accounts must be:
(wallet0, ata0, wallet1, ata1, ...)
Then call finalize_distribution.
