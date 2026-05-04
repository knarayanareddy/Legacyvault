# LegacyVault — masterdesigndoc.md (Single Source of Truth)
**Version:** 1.0 (production-grade end-to-end spec)  
**Date:** 2026-05-04  
**Purpose:** This document is the canonical spec for building LegacyVault as a complete product (protocol + apps + services). It includes: PDAs, Anchor structs, contexts, error codes, events, off-chain architecture, UX, security model, and a full execution plan.

> **Legal/Compliance disclaimer (non-negotiable):** LegacyVault is an automation and custody tool for digital assets. It is **not** legal advice, does not guarantee compliance with any jurisdiction’s estate/probate law, and does not claim to produce legally enforceable wills by itself. Users should consult licensed counsel. Product copy must reflect this.

---

## Table of contents
1. Product summary
2. Product principles & requirements (full build)
3. Actors & trust model
4. End-to-end user experience (Owner / Guardian / Beneficiary / Professional)
5. System architecture (on-chain + off-chain + storage + indexer)
6. On-chain protocol specification (Anchor)
   - Canonical PDAs / seeds
   - Account model (exact structs)
   - Instruction set (complete)
   - Anchor contexts (exact `#[derive(Accounts)]`)
   - Remaining-accounts conventions (distribution batching)
   - Error codes (exact)
   - Events (exact)
   - Invariants & state machines
7. Off-chain services
8. Data storage & schemas
9. Security & threat model (deep)
10. Testing strategy (protocol + backend + UX)
11. Deployment & operations
12. Roadmap / execution plan (phases, not hackathon)

---

# 1) Product summary
LegacyVault is a Solana-native “digital estate executor” that lets a user (Owner) create a programmable inheritance plan for their digital assets, backed by an on-chain vault and a multi-party, time-delayed unlock process.

**Core capabilities (full build):**
- Vault-based custody for:
  - SOL
  - SPL tokens (including Token-2022)
  - NFTs (SPL token accounts with supply=1; optionally Metaplex metadata references)
  - “Position tokens” (LP receipt tokens, liquid staking tokens, yield vault shares) as SPL
- Inheritance plan:
  - Beneficiaries + shares (bps)
  - Per-asset rules (optional overrides)
  - Guardians + threshold (M-of-N)
  - Liveness / heartbeat rules (Owner check-ins)
  - Inactivity threshold + timelock delay
  - Optional disputes / arbitration hooks
- Safety features:
  - Owner override / cancel unlock
  - Mandatory timelock after approvals
  - Panic freeze
  - Guardian approval audit trail
- Product features:
  - Encrypted document storage (letters of intent, legal docs) with on-chain hash anchoring
  - Notifications and monitoring (email/SMS/push/Wallet notifications)
  - Professional guardian network (optional) with bonding + reputation
  - Subscription plans (optional) with on-chain renewal state

---

# 2) Product principles & requirements (full build)

## 2.1 Non-negotiable principles
1. **Safety over convenience**: false positives must be reversible and slow; theft must be hard.
2. **Deterministic execution**: distribution rules must be on-chain verifiable and replayable.
3. **Least trust**: off-chain services can assist UX but must not be required to custody or finalize distribution.
4. **Transparency**: every step emits events; indexers reconstruct full audit trails.
5. **Compute-aware**: distributions must be chunked to avoid compute limits.

## 2.2 Full build requirements
### Vault & assets
- Deposit/withdraw SOL and SPL
- Vault ATA per mint (owned by a PDA)
- Maintain an “asset registry” on-chain and/or via PDA discovery

### Estate plan
- Beneficiary list + total shares = 10,000 bps
- Per-beneficiary metadata label
- Per-asset overrides:
  - pro-rata by shares (default)
  - assign entire asset to a single beneficiary
  - “split by fixed bps” per asset (optional)

### Unlock process
- Inactivity-based initiation
- Guardian approvals (M-of-N)
- Timelock delay
- Owner override/cancellation
- Dispute flow with optional arbitration

### Monitoring / liveness
- Owner check-in
- Optional delegated liveness key(s)
- Optional “multi-channel check-in” (wallet signature + email OTP) off-chain to reduce false positives

### Documents
- Client-side encryption of docs
- Store URI off-chain (Arweave/Shadow Drive/S3)
- Store hash + metadata on-chain
- Optional attestation pointer (external attestation program integration)

### Professional guardian network (optional but in-scope for full build)
- Guardian profiles (KYC status off-chain)
- Guardian bond / stake (on-chain escrow)
- Selection by owners
- Reputation events + slashing hooks (requires dispute mechanism)

### Subscription / billing (optional but in-scope)
- On-chain subscription state controls premium features:
  - number of vaults
  - number of guardians
  - professional guardian access
  - advanced notifications
  - doc storage quotas (off-chain enforced)

---

# 3) Actors & trust model

## 3.1 Actors
- **Owner**: creates vault, deposits assets, configures guardians/beneficiaries, checks in.
- **Guardian**: approves unlock when inactivity threshold passed; may be friend/family/lawyer/professional.
- **Beneficiary**: receives distributed assets.
- **Professional Guardian**: registered, bonded guardian offering services for a fee.
- **Arbiter (optional)**: resolves disputes and triggers slashing/cancellation actions.

## 3.2 Trust assumptions
- The protocol assumes the Owner chooses trustworthy guardians (or uses bonded professionals).
- The protocol assumes off-chain notification services can fail; on-chain execution must still be possible.
- The protocol does not assume any centralized service is online for funds to move after vault setup.

---

# 4) End-to-end UX (full build)

## 4.1 Owner UX — onboarding
1. Connect wallet
2. Create Vault:
   - choose heartbeat interval (e.g., 30 days)
   - choose inactivity threshold (e.g., 90 days)
   - choose timelock (e.g., 30 days)
   - choose security options:
     - allow liveness delegates? (Y/N)
     - enable panic freeze? (Y/N)
3. Add beneficiaries:
   - add wallet addresses + share %
   - validate shares sum to 100%
   - optional labels (e.g., “Spouse”, “Sibling”)
4. Add guardians:
   - add addresses OR invite via email to connect wallet
   - choose threshold (e.g., 2-of-3)
   - optional: choose a professional guardian from marketplace
5. Deposit assets:
   - “asset inventory” view with import from wallet
   - deposits SOL/SPL/NFTs into vault
6. Upload documents:
   - letter of intent
   - optional legal doc PDF
   - encrypt client-side, upload, store hash + URI on-chain
7. Activate monitoring:
   - show next check-in date
   - configure notification channels

## 4.2 Owner UX — routine
- “Check in” button (wallet signature)
- View vault health:
  - last check-in
  - inactivity deadline
  - whether any unlock session exists
- Manage:
  - update guardians/beneficiaries
  - add/remove assets
  - withdraw assets (only when safe)
  - update document versions (hash changes)

## 4.3 Guardian UX
- Guardian dashboard:
  - vaults you guard
  - for each: status, last check-in, eligible date for unlock
- When eligible:
  - “Initiate unlock” (creates unlock session)
  - “Approve unlock” (adds approval)
- Guardian transparency:
  - approvals list
  - timelock countdown
  - immutable event trail

## 4.4 Beneficiary UX
- Beneficiary dashboard:
  - vaults where you are beneficiary
  - expected share ranges (estimates)
  - when distribution executed: assets received + receipts (events)

## 4.5 Professional guardian UX
- Create guardian profile
- Undergo KYC (off-chain)
- Bond stake on-chain
- Receive invitations / requests
- Earn fees (off-chain invoicing or on-chain fee split if implemented)

---

# 5) System architecture

## 5.1 On-chain (Anchor program: `legacyvault`)
Single Anchor program (monorepo) with modules:
- vault creation & settings
- beneficiary registry (per-entry PDAs)
- guardian registry (per-entry PDAs)
- asset rules (per-mint PDAs)
- deposits & withdrawals
- liveness check-ins & delegates
- unlock sessions + approvals
- distribution sessions (chunked execution)
- disputes & slashing hooks (optional)
- subscription state (optional)
- professional guardian profiles + bonds (optional)

## 5.2 Off-chain services
1. **API Gateway**
   - auth/session (wallet-based SIWS: “Sign-in with Solana”)
   - vault metadata
   - notifications configuration
   - document upload orchestration
2. **Indexer**
   - listens to program logs/events
   - populates read models (vault status timelines)
3. **Notifier**
   - email/SMS/push
   - guardian invites
   - check-in reminders
   - unlock initiated alerts
4. **Doc Service**
   - encryption happens client-side
   - service provides pre-signed upload URLs + pinning
5. **KYC Provider Adapter** (optional)
   - for professional guardians / institutional plans
6. **Automation Worker**
   - suggests transactions:
     - when vault becomes unlock-eligible
     - batched distribution execution
   - never holds private keys (runs as “assistant”, not a custodian)

## 5.3 Storage
- Postgres (core app)
- Redis (caches, rate limits)
- Off-chain object storage (Arweave / Shadow Drive / S3)
- Analytics warehouse (optional)

---

# 6) On-chain protocol specification (Anchor)

## 6.1 Canonical PDAs / seed conventions
All seeds are canonical and must be identical across program + SDKs.

```rust
CONFIG_SEED         = b"config"

VAULT_SEED          = b"vault"        + owner_pubkey + vault_id_le_u64
VAULT_AUTH_SEED     = b"vault_auth"   + vault_pubkey

BENEFICIARY_SEED    = b"beneficiary"  + vault_pubkey + beneficiary_pubkey
GUARDIAN_SEED       = b"guardian"     + vault_pubkey + guardian_pubkey

ASSET_RULE_SEED     = b"asset_rule"   + vault_pubkey + mint_pubkey

LIVENESS_DELEGATE_SEED = b"delegate"  + vault_pubkey + delegate_pubkey

UNLOCK_SEED         = b"unlock"       + vault_pubkey + nonce_le_u64
APPROVAL_SEED       = b"approval"     + unlock_pubkey + guardian_pubkey

DIST_SOL_SEED       = b"dist_sol"     + unlock_pubkey
DIST_SPL_SEED       = b"dist_spl"     + unlock_pubkey + mint_pubkey

DISPUTE_SEED        = b"dispute"      + unlock_pubkey

SUBSCRIPTION_SEED   = b"sub"          + vault_pubkey

GUARDIAN_PROFILE_SEED = b"g_profile"  + guardian_pubkey
GUARDIAN_BOND_SEED    = b"g_bond"     + guardian_pubkey
6.2 Program constants
Rust

BPS_DENOMINATOR: u16 = 10_000

MAX_LABEL_LEN: usize = 16
DOC_URI_MAX: usize = 200

// Hard caps to keep accounts bounded.
// NOTE: In full build, we use per-entry PDAs, so these caps are mostly UI-side.
MAX_BENEFICIARIES_HINT: u16 = 100
MAX_GUARDIANS_HINT: u16 = 50
6.3 Exact Anchor state (structs)
These structs are intended to be used verbatim in programs/legacyvault/src/state.rs.

Rust

use anchor_lang::prelude::*;

#[repr(u8)]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum VaultStatus {
    Active = 0,
    Unlocking = 1,
    Distributed = 2,
    Frozen = 3,
    Closed = 4,
}

#[repr(u8)]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum UnlockStatus {
    Proposed = 0,
    Approved = 1,
    Cancelled = 2,
    Disputed = 3,
    Executing = 4,
    Executed = 5,
}

#[repr(u8)]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum AssetRuleMode {
    ProRata = 0,         // default: split by beneficiary shares
    AssignAll = 1,       // send entire balance to one beneficiary
    CustomSplits = 2,    // per-asset split table (optional, v2)
}

#[repr(u8)]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum GuardianRole {
    Personal = 0,
    Professional = 1,
}

#[repr(u8)]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum DisputeStatus {
    Open = 0,
    ResolvedCancel = 1,
    ResolvedProceed = 2,
}

#[account]
pub struct GlobalConfig {
    pub admin: Pubkey,
    pub paused: bool,

    pub treasury: Pubkey,          // receives fees (SOL or USDC via ATA elsewhere)
    pub create_fee_lamports: u64,  // anti-spam fee

    // bounds
    pub min_heartbeat_secs: u32,
    pub max_heartbeat_secs: u32,
    pub min_inactivity_secs: u32,
    pub max_inactivity_secs: u32,
    pub min_timelock_secs: u32,
    pub max_timelock_secs: u32,

    // optional: arbiter authority for disputes
    pub arbiter: Pubkey,

    pub version: u16,
}

impl GlobalConfig {
    pub const LEN: usize =
        8 + 32 + 1 + 32 + 8 + (4 * 6) + 32 + 2;
}

#[account]
pub struct Vault {
    pub vault_id: u64,
    pub owner: Pubkey,

    pub created_at_unix: i64,

    // liveness
    pub last_checkin_unix: i64,
    pub heartbeat_interval_secs: u32,
    pub inactivity_threshold_secs: u32,

    // unlock safety
    pub timelock_secs: u32,
    pub status: VaultStatus,

    // guardian policy
    pub guardian_threshold: u8,   // M
    pub guardians_count: u16,     // N (informational; derived off-chain too)

    // beneficiary policy
    pub beneficiaries_count: u16, // informational

    // unlock sessions
    pub current_nonce: u64,       // increments per unlock cycle

    // panic/freeze
    pub panic_enabled: bool,

    // document anchor
    pub doc_hash: [u8; 32],
    pub doc_uri_len: u16,
    pub doc_uri: [u8; 200],

    pub bump: u8,
}

impl Vault {
    pub const DOC_URI_MAX: usize = 200;
    pub const LEN: usize =
        8 +  // disc
        8 +  // vault_id
        32 + // owner
        8 +  // created_at
        8 +  // last_checkin
        4 +  // heartbeat
        4 +  // inactivity
        4 +  // timelock
        1 +  // status
        1 +  // guardian_threshold
        2 +  // guardians_count
        2 +  // beneficiaries_count
        8 +  // current_nonce
        1 +  // panic_enabled
        32 + // doc_hash
        2 +  // doc_uri_len
        200 +// doc_uri
        1;   // bump
}

#[account]
pub struct GuardianEntry {
    pub vault: Pubkey,
    pub guardian: Pubkey,
    pub role: GuardianRole,
    pub added_at_unix: i64,
    pub active: bool,
}

impl GuardianEntry {
    pub const LEN: usize = 8 + 32 + 32 + 1 + 8 + 1;
}

#[account]
pub struct BeneficiaryEntry {
    pub vault: Pubkey,
    pub beneficiary: Pubkey,

    pub share_bps: u16,
    pub label: [u8; 16],

    pub added_at_unix: i64,
    pub active: bool,
}

impl BeneficiaryEntry {
    pub const LEN: usize = 8 + 32 + 32 + 2 + 16 + 8 + 1;
}

#[account]
pub struct AssetRule {
    pub vault: Pubkey,
    pub mint: Pubkey,

    pub mode: AssetRuleMode,

    // AssignAll target
    pub assigned_beneficiary: Pubkey,

    pub updated_at_unix: i64,
}

impl AssetRule {
    pub const LEN: usize = 8 + 32 + 32 + 1 + 32 + 8;
}

#[account]
pub struct LivenessDelegate {
    pub vault: Pubkey,
    pub delegate: Pubkey,
    pub added_at_unix: i64,
    pub active: bool,
}

impl LivenessDelegate {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 1;
}

#[account]
pub struct UnlockSession {
    pub vault: Pubkey,
    pub nonce: u64,

    pub status: UnlockStatus,

    pub initiated_by: Pubkey,
    pub initiated_at_unix: i64,

    pub approvals: u16,
    pub threshold: u8,

    pub approved_at_unix: i64,     // set when approvals reach threshold
    pub executable_at_unix: i64,   // approved_at + timelock

    // distribution flags
    pub sol_done: bool,

    pub bump: u8,
}

impl UnlockSession {
    pub const LEN: usize =
        8 + 32 + 8 + 1 + 32 + 8 + 2 + 1 + 8 + 8 + 1 + 1;
}

#[account]
pub struct GuardianApproval {
    pub unlock: Pubkey,
    pub guardian: Pubkey,
    pub approved_at_unix: i64,
}

impl GuardianApproval {
    pub const LEN: usize = 8 + 32 + 32 + 8;
}

#[account]
pub struct DistributionSplSession {
    pub unlock: Pubkey,
    pub mint: Pubkey,

    // cursor for batching beneficiaries (index in sorted beneficiary list)
    pub cursor: u32,

    // total vault balance snapshot (optional; can recompute from token account)
    pub initialized_at_unix: i64,
    pub done: bool,

    pub bump: u8,
}

impl DistributionSplSession {
    pub const LEN: usize = 8 + 32 + 32 + 4 + 8 + 1 + 1;
}

#[account]
pub struct DisputeCase {
    pub unlock: Pubkey,
    pub opened_by: Pubkey,
    pub opened_at_unix: i64,
    pub status: DisputeStatus,
    pub note_hash: [u8; 32],
}

impl DisputeCase {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 1 + 32;
}

#[account]
pub struct Subscription {
    pub vault: Pubkey,
    pub plan_id: u8,              // 0=free, 1=standard, 2=pro
    pub valid_until_unix: i64,    // 0 means free/none
    pub updated_at_unix: i64,
}

impl Subscription {
    pub const LEN: usize = 8 + 32 + 1 + 8 + 8;
}

#[account]
pub struct GuardianProfile {
    pub guardian: Pubkey,
    pub display_name: [u8; 32],
    pub website_uri: [u8; 100],
    pub kyc_level: u8,            // 0=none,1=basic,2=verified (set off-chain; anchored via admin)
    pub active: bool,
    pub updated_at_unix: i64,
}

impl GuardianProfile {
    pub const LEN: usize = 8 + 32 + 32 + 100 + 1 + 1 + 8;
}

#[account]
pub struct GuardianBond {
    pub guardian: Pubkey,
    pub bond_vault: Pubkey,       // token account or SOL PDA depending on implementation
    pub amount: u64,
    pub locked: bool,
    pub updated_at_unix: i64,
}

impl GuardianBond {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 1 + 8;
}
6.4 Instruction set (complete)
Admin / protocol
initialize_config(...)
set_paused(bool)
set_arbiter(pubkey)
set_fees(create_fee_lamports)
set_bounds(...)
Vault lifecycle
create_vault(vault_id, heartbeat_interval_secs, inactivity_threshold_secs, timelock_secs, panic_enabled)
close_vault() (requires distributed or empty; optional)
Guardians
add_guardian(guardian_pubkey, role)
remove_guardian(guardian_pubkey)
set_guardian_threshold(m: u8)
Beneficiaries
add_beneficiary(beneficiary_pubkey, share_bps, label)
update_beneficiary(beneficiary_pubkey, share_bps, label, active)
remove_beneficiary(beneficiary_pubkey)
assert_beneficiary_total_10k() (optional strict check instruction)
Asset rules
set_asset_rule(mint, mode, assigned_beneficiary)
clear_asset_rule(mint)
Deposits / withdrawals (Owner-only, while safe)
deposit_sol(lamports)
withdraw_sol(lamports) (only if vault Active and no UnlockSession in progress)
deposit_spl(amount) (mint provided in accounts)
withdraw_spl(amount) (only if vault Active and no UnlockSession in progress)
Documents
set_document(doc_hash, doc_uri_bytes)
Liveness
check_in() (Owner)
add_liveness_delegate(delegate_pubkey)
remove_liveness_delegate(delegate_pubkey)
delegate_check_in() (Delegate signer)
Unlock & approvals
initiate_unlock() (Guardian signer; requires inactivity threshold reached)
approve_unlock() (Guardian signer; one approval per guardian)
cancel_unlock() (Owner signer; sets session cancelled and vault Active)
panic_freeze() (Owner signer; sets vault Frozen)
unfreeze() (Owner signer; returns to Active if safe)
Disputes / arbitration (optional but specified)
open_dispute(note_hash) (Owner or Guardian; sets unlock Disputed)
resolve_dispute_cancel() (Arbiter; cancels unlock, vault Active)
resolve_dispute_proceed() (Arbiter; returns unlock Approved state)
Distribution (chunked)
execute_distribution_sol_batch(start_index: u32, batch_size: u16)
init_distribution_spl_session(mint) (creates DistributionSplSession PDA)
execute_distribution_spl_batch(start_index: u32, batch_size: u16) (for a specific mint)
finalize_unlock() (marks UnlockSession Executed; vault Distributed)
Subscription (optional)
set_subscription(plan_id, valid_until_unix) (admin or authorized billing signer)
renew_subscription(plan_id, add_secs) (user pays off-chain; on-chain updates)
Professional guardian network (optional)
register_guardian_profile(display_name, website_uri)
set_guardian_kyc_level(guardian, level) (admin)
create_guardian_bond(amount) (guardian deposits bond)
lock_guardian_bond() / unlock_guardian_bond() (admin or arbiter)
slash_guardian_bond(amount) (arbiter)
6.5 Anchor contexts (exact #[derive(Accounts)])
These contexts are intended to be used verbatim in programs/legacyvault/src/lib.rs. Token account constraints assume SPL Token v1. For Token-2022, add parallel contexts using the Token-2022 program id where needed.

Rust

use anchor_lang::prelude::*;
use anchor_spl::{
  associated_token::AssociatedToken,
  token::{self, Mint, Token, TokenAccount, Transfer},
};

use crate::state::*;
use crate::errors::LegacyVaultError;
use crate::constants::*;

pub const CONFIG_SEED: &[u8] = b"config";
pub const VAULT_SEED: &[u8] = b"vault";
pub const VAULT_AUTH_SEED: &[u8] = b"vault_auth";
pub const BENEFICIARY_SEED: &[u8] = b"beneficiary";
pub const GUARDIAN_SEED: &[u8] = b"guardian";
pub const ASSET_RULE_SEED: &[u8] = b"asset_rule";
pub const LIVENESS_DELEGATE_SEED: &[u8] = b"delegate";
pub const UNLOCK_SEED: &[u8] = b"unlock";
pub const APPROVAL_SEED: &[u8] = b"approval";
pub const DIST_SPL_SEED: &[u8] = b"dist_spl";
pub const DISPUTE_SEED: &[u8] = b"dispute";
pub const SUBSCRIPTION_SEED: &[u8] = b"sub";
pub const GUARDIAN_PROFILE_SEED: &[u8] = b"g_profile";
pub const GUARDIAN_BOND_SEED: &[u8] = b"g_bond";

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

  /// CHECK: PDA authority for vault token accounts
  #[account(
    seeds = [VAULT_AUTH_SEED, vault.key().as_ref()],
    bump
  )]
  pub vault_auth: UncheckedAccount<'info>,

  #[account(mut)]
  pub owner: Signer<'info>,

  pub system_program: Program<'info, System>,
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
pub struct AddGuardian<'info> {
  #[account(seeds = [CONFIG_SEED], bump)]
  pub config: Account<'info, GlobalConfig>,

  #[account(mut)]
  pub vault: Account<'info, Vault>,

  #[account(
    init,
    payer = owner,
    space = GuardianEntry::LEN,
    seeds = [GUARDIAN_SEED, vault.key().as_ref(), guardian.key().as_ref()],
    bump
  )]
  pub guardian_entry: Account<'info, GuardianEntry>,

  /// CHECK: guardian pubkey (not signer)
  pub guardian: UncheckedAccount<'info>,

  pub owner: Signer<'info>,
  pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RemoveGuardian<'info> {
  #[account(seeds = [CONFIG_SEED], bump)]
  pub config: Account<'info, GlobalConfig>,

  #[account(mut)]
  pub vault: Account<'info, Vault>,

  #[account(
    mut,
    seeds = [GUARDIAN_SEED, vault.key().as_ref(), guardian.key().as_ref()],
    bump,
    close = owner
  )]
  pub guardian_entry: Account<'info, GuardianEntry>,

  /// CHECK
  pub guardian: UncheckedAccount<'info>,

  pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetGuardianThreshold<'info> {
  #[account(seeds = [CONFIG_SEED], bump)]
  pub config: Account<'info, GlobalConfig>,
  #[account(mut)]
  pub vault: Account<'info, Vault>,
  pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct AddBeneficiary<'info> {
  #[account(seeds = [CONFIG_SEED], bump)]
  pub config: Account<'info, GlobalConfig>,

  #[account(mut)]
  pub vault: Account<'info, Vault>,

  #[account(
    init,
    payer = owner,
    space = BeneficiaryEntry::LEN,
    seeds = [BENEFICIARY_SEED, vault.key().as_ref(), beneficiary.key().as_ref()],
    bump
  )]
  pub beneficiary_entry: Account<'info, BeneficiaryEntry>,

  /// CHECK: beneficiary pubkey (not signer)
  pub beneficiary: UncheckedAccount<'info>,

  pub owner: Signer<'info>,
  pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateBeneficiary<'info> {
  #[account(seeds = [CONFIG_SEED], bump)]
  pub config: Account<'info, GlobalConfig>,

  #[account(mut)]
  pub vault: Account<'info, Vault>,

  #[account(
    mut,
    seeds = [BENEFICIARY_SEED, vault.key().as_ref(), beneficiary.key().as_ref()],
    bump
  )]
  pub beneficiary_entry: Account<'info, BeneficiaryEntry>,

  /// CHECK
  pub beneficiary: UncheckedAccount<'info>,

  pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct RemoveBeneficiary<'info> {
  #[account(seeds = [CONFIG_SEED], bump)]
  pub config: Account<'info, GlobalConfig>,
  #[account(mut)]
  pub vault: Account<'info, Vault>,

  #[account(
    mut,
    seeds = [BENEFICIARY_SEED, vault.key().as_ref(), beneficiary.key().as_ref()],
    bump,
    close = owner
  )]
  pub beneficiary_entry: Account<'info, BeneficiaryEntry>,

  /// CHECK
  pub beneficiary: UncheckedAccount<'info>,

  pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetAssetRule<'info> {
  #[account(seeds = [CONFIG_SEED], bump)]
  pub config: Account<'info, GlobalConfig>,

  #[account(mut)]
  pub vault: Account<'info, Vault>,

  pub mint: Account<'info, Mint>,

  #[account(
    init_if_needed,
    payer = owner,
    space = AssetRule::LEN,
    seeds = [ASSET_RULE_SEED, vault.key().as_ref(), mint.key().as_ref()],
    bump
  )]
  pub asset_rule: Account<'info, AssetRule>,

  /// CHECK: only used if mode AssignAll
  pub assigned_beneficiary: UncheckedAccount<'info>,

  pub owner: Signer<'info>,
  pub system_program: Program<'info, System>,
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
pub struct WithdrawSol<'info> {
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

  /// CHECK: PDA authority for vault token accounts
  #[account(
    seeds = [VAULT_AUTH_SEED, vault.key().as_ref()],
    bump
  )]
  pub vault_auth: UncheckedAccount<'info>,

  pub mint: Account<'info, Mint>,

  #[account(mut)]
  pub owner: Signer<'info>,

  #[account(
    mut,
    associated_token::mint = mint,
    associated_token::authority = owner
  )]
  pub owner_ata: Account<'info, TokenAccount>,

  #[account(
    init_if_needed,
    payer = owner,
    associated_token::mint = mint,
    associated_token::authority = vault_auth
  )]
  pub vault_ata: Account<'info, TokenAccount>,

  pub token_program: Program<'info, Token>,
  pub associated_token_program: Program<'info, AssociatedToken>,
  pub system_program: Program<'info, System>,
  pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct WithdrawSpl<'info> {
  #[account(seeds = [CONFIG_SEED], bump)]
  pub config: Account<'info, GlobalConfig>,

  #[account(mut)]
  pub vault: Account<'info, Vault>,

  /// CHECK: PDA authority for vault token accounts
  #[account(
    seeds = [VAULT_AUTH_SEED, vault.key().as_ref()],
    bump
  )]
  pub vault_auth: UncheckedAccount<'info>,

  pub mint: Account<'info, Mint>,

  #[account(mut)]
  pub owner: Signer<'info>,

  #[account(
    init_if_needed,
    payer = owner,
    associated_token::mint = mint,
    associated_token::authority = owner
  )]
  pub owner_ata: Account<'info, TokenAccount>,

  #[account(
    mut,
    associated_token::mint = mint,
    associated_token::authority = vault_auth
  )]
  pub vault_ata: Account<'info, TokenAccount>,

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
pub struct AddLivenessDelegate<'info> {
  #[account(seeds = [CONFIG_SEED], bump)]
  pub config: Account<'info, GlobalConfig>,
  #[account(mut)]
  pub vault: Account<'info, Vault>,

  #[account(
    init,
    payer = owner,
    space = LivenessDelegate::LEN,
    seeds = [LIVENESS_DELEGATE_SEED, vault.key().as_ref(), delegate.key().as_ref()],
    bump
  )]
  pub delegate_entry: Account<'info, LivenessDelegate>,

  /// CHECK
  pub delegate: UncheckedAccount<'info>,

  pub owner: Signer<'info>,
  pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RemoveLivenessDelegate<'info> {
  #[account(seeds = [CONFIG_SEED], bump)]
  pub config: Account<'info, GlobalConfig>,
  #[account(mut)]
  pub vault: Account<'info, Vault>,

  #[account(
    mut,
    seeds = [LIVENESS_DELEGATE_SEED, vault.key().as_ref(), delegate.key().as_ref()],
    bump,
    close = owner
  )]
  pub delegate_entry: Account<'info, LivenessDelegate>,

  /// CHECK
  pub delegate: UncheckedAccount<'info>,

  pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct DelegateCheckIn<'info> {
  #[account(seeds = [CONFIG_SEED], bump)]
  pub config: Account<'info, GlobalConfig>,
  #[account(mut)]
  pub vault: Account<'info, Vault>,

  #[account(
    seeds = [LIVENESS_DELEGATE_SEED, vault.key().as_ref(), delegate.key().as_ref()],
    bump
  )]
  pub delegate_entry: Account<'info, LivenessDelegate>,

  pub delegate: Signer<'info>,
}

#[derive(Accounts)]
pub struct InitiateUnlock<'info> {
  #[account(seeds = [CONFIG_SEED], bump)]
  pub config: Account<'info, GlobalConfig>,

  #[account(mut)]
  pub vault: Account<'info, Vault>,

  #[account(
    seeds = [GUARDIAN_SEED, vault.key().as_ref(), guardian.key().as_ref()],
    bump
  )]
  pub guardian_entry: Account<'info, GuardianEntry>,

  #[account(
    init,
    payer = guardian,
    space = UnlockSession::LEN,
    seeds = [UNLOCK_SEED, vault.key().as_ref(), &(vault.current_nonce.wrapping_add(1)).to_le_bytes()],
    bump
  )]
  pub unlock: Account<'info, UnlockSession>,

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

  #[account(
    seeds = [GUARDIAN_SEED, vault.key().as_ref(), guardian.key().as_ref()],
    bump
  )]
  pub guardian_entry: Account<'info, GuardianEntry>,

  #[account(mut)]
  pub unlock: Account<'info, UnlockSession>,

  #[account(
    init,
    payer = guardian,
    space = GuardianApproval::LEN,
    seeds = [APPROVAL_SEED, unlock.key().as_ref(), guardian.key().as_ref()],
    bump
  )]
  pub approval: Account<'info, GuardianApproval>,

  #[account(mut)]
  pub guardian: Signer<'info>,

  pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelUnlock<'info> {
  #[account(seeds = [CONFIG_SEED], bump)]
  pub config: Account<'info, GlobalConfig>,
  #[account(mut)]
  pub vault: Account<'info, Vault>,
  #[account(mut)]
  pub unlock: Account<'info, UnlockSession>,
  pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct PanicFreeze<'info> {
  #[account(seeds = [CONFIG_SEED], bump)]
  pub config: Account<'info, GlobalConfig>,
  #[account(mut)]
  pub vault: Account<'info, Vault>,
  pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct Unfreeze<'info> {
  #[account(seeds = [CONFIG_SEED], bump)]
  pub config: Account<'info, GlobalConfig>,
  #[account(mut)]
  pub vault: Account<'info, Vault>,
  pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct OpenDispute<'info> {
  #[account(seeds = [CONFIG_SEED], bump)]
  pub config: Account<'info, GlobalConfig>,

  #[account(mut)]
  pub vault: Account<'info, Vault>,

  #[account(mut)]
  pub unlock: Account<'info, UnlockSession>,

  #[account(
    init_if_needed,
    payer = opener,
    space = DisputeCase::LEN,
    seeds = [DISPUTE_SEED, unlock.key().as_ref()],
    bump
  )]
  pub dispute: Account<'info, DisputeCase>,

  #[account(mut)]
  pub opener: Signer<'info>,

  pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ResolveDispute<'info> {
  #[account(seeds = [CONFIG_SEED], bump)]
  pub config: Account<'info, GlobalConfig>,

  #[account(mut)]
  pub vault: Account<'info, Vault>,

  #[account(mut)]
  pub unlock: Account<'info, UnlockSession>,

  #[account(mut, seeds = [DISPUTE_SEED, unlock.key().as_ref()], bump)]
  pub dispute: Account<'info, DisputeCase>,

  pub arbiter: Signer<'info>,
}

#[derive(Accounts)]
pub struct ExecuteDistributionSolBatch<'info> {
  #[account(seeds = [CONFIG_SEED], bump)]
  pub config: Account<'info, GlobalConfig>,

  #[account(mut)]
  pub vault: Account<'info, Vault>,

  #[account(mut)]
  pub unlock: Account<'info, UnlockSession>,

  // Remaining accounts convention (see section 6.6):
  // [beneficiary_entry_0, beneficiary_wallet_0, beneficiary_entry_1, beneficiary_wallet_1, ...]
  pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitDistributionSplSession<'info> {
  #[account(seeds = [CONFIG_SEED], bump)]
  pub config: Account<'info, GlobalConfig>,
  #[account(mut)]
  pub vault: Account<'info, Vault>,
  #[account(mut)]
  pub unlock: Account<'info, UnlockSession>,

  pub mint: Account<'info, Mint>,

  #[account(
    init,
    payer = payer,
    space = DistributionSplSession::LEN,
    seeds = [DIST_SPL_SEED, unlock.key().as_ref(), mint.key().as_ref()],
    bump
  )]
  pub dist_spl: Account<'info, DistributionSplSession>,

  #[account(mut)]
  pub payer: Signer<'info>,
  pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExecuteDistributionSplBatch<'info> {
  #[account(seeds = [CONFIG_SEED], bump)]
  pub config: Account<'info, GlobalConfig>,

  #[account(mut)]
  pub vault: Account<'info, Vault>,

  /// CHECK: PDA authority for vault token accounts
  #[account(
    seeds = [VAULT_AUTH_SEED, vault.key().as_ref()],
    bump
  )]
  pub vault_auth: UncheckedAccount<'info>,

  #[account(mut)]
  pub unlock: Account<'info, UnlockSession>,

  pub mint: Account<'info, Mint>,

  #[account(mut, seeds = [DIST_SPL_SEED, unlock.key().as_ref(), mint.key().as_ref()], bump)]
  pub dist_spl: Account<'info, DistributionSplSession>,

  #[account(
    mut,
    associated_token::mint = mint,
    associated_token::authority = vault_auth
  )]
  pub vault_ata: Account<'info, TokenAccount>,

  pub token_program: Program<'info, Token>,

  // Remaining accounts convention (see 6.6):
  // [beneficiary_entry_0, beneficiary_wallet_0, beneficiary_ata_0, beneficiary_entry_1, beneficiary_wallet_1, beneficiary_ata_1, ...]
}

#[derive(Accounts)]
pub struct FinalizeUnlock<'info> {
  #[account(seeds = [CONFIG_SEED], bump)]
  pub config: Account<'info, GlobalConfig>,
  #[account(mut)]
  pub vault: Account<'info, Vault>,
  #[account(mut)]
  pub unlock: Account<'info, UnlockSession>,
}

#[derive(Accounts)]
pub struct SetSubscription<'info> {
  #[account(seeds = [CONFIG_SEED], bump)]
  pub config: Account<'info, GlobalConfig>,
  #[account(mut)]
  pub vault: Account<'info, Vault>,

  #[account(
    init_if_needed,
    payer = payer,
    space = Subscription::LEN,
    seeds = [SUBSCRIPTION_SEED, vault.key().as_ref()],
    bump
  )]
  pub subscription: Account<'info, Subscription>,

  #[account(mut)]
  pub payer: Signer<'info>,
  pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RegisterGuardianProfile<'info> {
  #[account(seeds = [CONFIG_SEED], bump)]
  pub config: Account<'info, GlobalConfig>,

  #[account(
    init_if_needed,
    payer = guardian,
    space = GuardianProfile::LEN,
    seeds = [GUARDIAN_PROFILE_SEED, guardian.key().as_ref()],
    bump
  )]
  pub profile: Account<'info, GuardianProfile>,

  #[account(mut)]
  pub guardian: Signer<'info>,

  pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateGuardianBond<'info> {
  #[account(seeds = [CONFIG_SEED], bump)]
  pub config: Account<'info, GlobalConfig>,

  #[account(
    init_if_needed,
    payer = guardian,
    space = GuardianBond::LEN,
    seeds = [GUARDIAN_BOND_SEED, guardian.key().as_ref()],
    bump
  )]
  pub bond: Account<'info, GuardianBond>,

  #[account(mut)]
  pub guardian: Signer<'info>,

  pub system_program: Program<'info, System>,
}
6.6 Remaining-accounts conventions (distribution batching)
Distribution must be compute-safe and therefore batched.

6.6.1 Beneficiary ordering
To avoid ambiguity, beneficiaries are processed in a deterministic sorted order:

Sort by beneficiary_pubkey ascending (bytes) off-chain.
The UI/automation worker must pass accounts in that order for each batch.
6.6.2 SOL distribution batching: execute_distribution_sol_batch(start_index, batch_size)
Remaining accounts list format (2 per beneficiary):

beneficiary_entry_i (PDA account; read-only)
beneficiary_wallet_i (system account; writable)
So remaining accounts length must be 2 * batch_size.

Batch payout computation:

For each beneficiary in batch:
pay_i = floor(distributable_sol * share_bps / 10_000) except last global beneficiary gets remainder.
Because batching makes “remainder to last beneficiary” tricky, we enforce:
SOL distribution can be either:
single-shot (recommended when beneficiaries <= ~20), or
batched with a DistributionSolSession state that tracks paid_total and a finalization step. Full build decision: implement DistributionSolSession for correctness at scale (omitted from structs above for brevity; add if you expect >20 beneficiaries). If you expect low counts, you may keep single-shot.
6.6.3 SPL distribution batching: execute_distribution_spl_batch(start_index, batch_size)
Remaining accounts list format (3 per beneficiary):

beneficiary_entry_i (PDA; read-only)
beneficiary_wallet_i (read-only)
beneficiary_ata_i for the given mint (writable)
So remaining accounts length must be 3 * batch_size.

Validation rules:

beneficiary_entry_i.vault == vault
beneficiary_entry_i.active == true
beneficiary_wallet_i.key == beneficiary_entry_i.beneficiary
beneficiary_ata_i must be the associated token account for (beneficiary_wallet_i, mint) (validate on-chain)
Progress:

DistributionSplSession.cursor advances by batch_size until full beneficiary list is processed.
When cursor reaches total active beneficiaries:
mark dist_spl.done = true
6.6.4 Finalization rule
finalize_unlock can only succeed if:

unlock status is Approved/Executing
unlock.sol_done == true (or SOL dist session finalized)
all required SPL mint sessions are done (off-chain can enforce by requiring list of sessions)
no dispute is open
6.7 Error codes (exact)
Rust

use anchor_lang::prelude::*;

#[error_code]
pub enum LegacyVaultError {
  #[msg("Unauthorized")]
  Unauthorized,

  #[msg("Protocol paused")]
  Paused,

  #[msg("Invalid bounds")]
  InvalidBounds,

  #[msg("Vault not Active")]
  VaultNotActive,

  #[msg("Vault not Unlocking")]
  VaultNotUnlocking,

  #[msg("Vault is Frozen")]
  VaultFrozen,

  #[msg("Invalid guardian threshold")]
  InvalidGuardianThreshold,

  #[msg("Inactivity threshold not reached")]
  UnlockNotEligible,

  #[msg("Unlock session wrong state")]
  UnlockWrongState,

  #[msg("Guardian entry inactive or missing")]
  GuardianNotActive,

  #[msg("Approval already exists")]
  AlreadyApproved,

  #[msg("Threshold not reached")]
  ThresholdNotReached,

  #[msg("Timelock not elapsed")]
  TimelockNotElapsed,

  #[msg("Unlock is disputed")]
  UnlockDisputed,

  #[msg("Invalid beneficiary share")]
  InvalidShare,

  #[msg("Total beneficiary shares must sum to 10,000 bps")]
  SharesNot10k,

  #[msg("Invalid document URI length")]
  InvalidDocUriLen,

  #[msg("Invalid mint / token account")]
  InvalidTokenAccount,

  #[msg("Asset rule invalid for mode")]
  InvalidAssetRule,

  #[msg("Distribution already done")]
  DistributionAlreadyDone,

  #[msg("Batch parameters invalid")]
  InvalidBatch,

  #[msg("Math overflow")]
  MathOverflow,
}
6.8 Events (exact)
Rust

use anchor_lang::prelude::*;
use crate::state::*;

#[event]
pub struct ConfigInitialized {
  pub admin: Pubkey,
  pub treasury: Pubkey,
  pub ts: i64,
}

#[event]
pub struct VaultCreated {
  pub vault: Pubkey,
  pub vault_id: u64,
  pub owner: Pubkey,
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
pub struct GuardianAdded {
  pub vault: Pubkey,
  pub guardian: Pubkey,
  pub role: GuardianRole,
  pub ts: i64,
}

#[event]
pub struct GuardianRemoved {
  pub vault: Pubkey,
  pub guardian: Pubkey,
  pub ts: i64,
}

#[event]
pub struct GuardianThresholdSet {
  pub vault: Pubkey,
  pub threshold: u8,
  pub ts: i64,
}

#[event]
pub struct BeneficiaryAdded {
  pub vault: Pubkey,
  pub beneficiary: Pubkey,
  pub share_bps: u16,
  pub ts: i64,
}

#[event]
pub struct BeneficiaryUpdated {
  pub vault: Pubkey,
  pub beneficiary: Pubkey,
  pub share_bps: u16,
  pub active: bool,
  pub ts: i64,
}

#[event]
pub struct BeneficiaryRemoved {
  pub vault: Pubkey,
  pub beneficiary: Pubkey,
  pub ts: i64,
}

#[event]
pub struct AssetRuleSet {
  pub vault: Pubkey,
  pub mint: Pubkey,
  pub mode: AssetRuleMode,
  pub assigned_beneficiary: Pubkey,
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
pub struct SolWithdrawn {
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
pub struct SplWithdrawn {
  pub vault: Pubkey,
  pub owner: Pubkey,
  pub mint: Pubkey,
  pub amount: u64,
  pub ts: i64,
}

#[event]
pub struct CheckIn {
  pub vault: Pubkey,
  pub by: Pubkey, // owner or delegate
  pub ts: i64,
}

#[event]
pub struct UnlockInitiated {
  pub vault: Pubkey,
  pub unlock: Pubkey,
  pub nonce: u64,
  pub initiated_by: Pubkey,
  pub ts: i64,
}

#[event]
pub struct UnlockApproved {
  pub vault: Pubkey,
  pub unlock: Pubkey,
  pub guardian: Pubkey,
  pub approvals: u16,
  pub threshold: u8,
  pub ts: i64,
}

#[event]
pub struct UnlockCancelled {
  pub vault: Pubkey,
  pub unlock: Pubkey,
  pub ts: i64,
}

#[event]
pub struct PanicFrozen {
  pub vault: Pubkey,
  pub ts: i64,
}

#[event]
pub struct Unfrozen {
  pub vault: Pubkey,
  pub ts: i64,
}

#[event]
pub struct DisputeOpened {
  pub unlock: Pubkey,
  pub opened_by: Pubkey,
  pub note_hash: [u8; 32],
  pub ts: i64,
}

#[event]
pub struct DisputeResolved {
  pub unlock: Pubkey,
  pub status: DisputeStatus,
  pub ts: i64,
}

#[event]
pub struct SolDistributionBatchExecuted {
  pub unlock: Pubkey,
  pub start_index: u32,
  pub batch_size: u16,
  pub ts: i64,
}

#[event]
pub struct SplDistributionBatchExecuted {
  pub unlock: Pubkey,
  pub mint: Pubkey,
  pub start_index: u32,
  pub batch_size: u16,
  pub new_cursor: u32,
  pub done: bool,
  pub ts: i64,
}

#[event]
pub struct UnlockFinalized {
  pub vault: Pubkey,
  pub unlock: Pubkey,
  pub ts: i64,
}

#[event]
pub struct SubscriptionSet {
  pub vault: Pubkey,
  pub plan_id: u8,
  pub valid_until_unix: i64,
  pub ts: i64,
}

#[event]
pub struct GuardianProfileRegistered {
  pub guardian: Pubkey,
  pub ts: i64,
}

#[event]
pub struct GuardianBondUpdated {
  pub guardian: Pubkey,
  pub amount: u64,
  pub locked: bool,
  pub ts: i64,
}
6.9 Invariants & state machines
Vault status transitions
Active:
owner can deposit/withdraw
owner can modify guardians/beneficiaries
owner can check-in
guardians can initiate unlock only if inactivity threshold reached
Unlocking:
no owner withdrawals
guardians can approve
owner can cancel (unless dispute locks it; policy choice)
distribution can execute only after timelock
Distributed:
vault considered completed; optionally allow close
Frozen:
no unlock approvals/distribution; owner can unfreeze
Closed:
terminal state
Unlock session transitions
Proposed → Approved (when approvals reach threshold)
Approved → Disputed (if dispute opened)
Disputed → Approved (arbiter proceed)
Disputed → Cancelled (arbiter cancel)
Approved → Executing (when distribution starts; optional)
Executing → Executed (finalize)
7) Off-chain services (full build)
7.1 API Gateway (Node/Go)
Responsibilities:

SIWS auth sessions (wallet signatures)
Serve vault metadata and “read models” from indexer DB
Manage notification settings and contacts (email/phone)
Provide transaction builders (unsigned) for:
deposit/withdraw
initiate/approve unlock
distribution batches (SOL + SPL)
Professional guardian discovery endpoints
7.2 Indexer
Subscribes to program logs via RPC/WebSocket
Decodes events
Populates normalized tables:
vaults
guardians
beneficiaries
unlock_sessions
approvals
distributions
disputes
Exposes derived state:
“unlock eligible at” timestamps per vault
“timelock ends at”
“next check-in deadline”
“risk alerts” (e.g., threshold too low)
7.3 Notifier service
Scheduled reminders:
upcoming check-in (T-7d, T-1d)
missed check-in
unlock eligible
unlock initiated
approvals requested
timelock ending soon
Channels:
email
SMS
push notifications (mobile)
optional wallet notifications
7.4 Document service
Client-side encryption:
derive symmetric key from user secret or wallet-based key agreement
never send plaintext to servers
Storage:
upload encrypted blob to Arweave/Shadow Drive/S3
On-chain:
store doc_hash (sha256) and doc_uri
Optional:
“signing ceremony” (owner + witnesses sign the hash off-chain; store signatures in doc metadata)
7.5 KYC / professional guardian
KYC results stored off-chain
On-chain GuardianProfile.kyc_level set by admin after verification
Guardian bond deposits held on-chain (bonding mechanism)
8) Data storage & schemas (product DB)
Postgres tables (minimum):

users (wallet, created_at)
vaults (vault_pubkey, owner_wallet, settings snapshot)
guardians (vault_pubkey, guardian_wallet, role, active)
beneficiaries (vault_pubkey, beneficiary_wallet, share_bps, active)
unlock_sessions (unlock_pubkey, vault_pubkey, nonce, status, timestamps)
approvals (unlock_pubkey, guardian_wallet, ts)
asset_rules (vault_pubkey, mint, mode, assigned_beneficiary)
documents (vault_pubkey, doc_hash, uri, version, created_at)
notifications (wallet, channels, schedules)
guardian_profiles (guardian_wallet, kyc_level, display info)
guardian_bonds (guardian_wallet, amount, locked)
9) Security & threat model (deep)
9.1 Threats and mitigations
Guardian collusion theft
Mitigations:
M-of-N threshold + timelock
owner override/cancel
dispute mechanism + arbiter
professional guardian bonding + slashing (optional)
strict event transparency for forensics
False positive unlock (owner alive, missed check-in)
Mitigations:
long inactivity threshold (90–180d typical)
multiple reminders (multi-channel)
timelock after approvals
owner can check-in + cancel during timelock
Phishing / UI compromise
Mitigations:
show transaction simulation and clear “this withdraws funds from vault” warnings
hardware wallet encouraged
allowlist official app origins
publish open-source tx builders
Program exploit / drain
Mitigations:
minimize privileged admin powers
pause switch
strict PDA signer checks
audits + fuzzing + invariants
separate upgrade authority behind multisig
Arbiter abuse (if disputes enabled)
Mitigations:
arbiter optional per vault (owner chooses)
arbiter actions timelocked or multi-sig (future)
transparent events and challenge process
10) Testing strategy
10.1 Protocol tests (Anchor)
PDA derivation tests
guardian/beneficiary add/remove, threshold checks
deposits/withdrawals blocked during unlocking/frozen
unlock initiation eligibility based on clock
approval uniqueness via GuardianApproval PDA
timelock enforcement
distribution batch correctness:
SPL ATA validation
correct pro-rata sums
cursor progression and idempotency
dispute transitions
10.2 Backend tests
indexer correctness: events → read model
notifier scheduling correctness
doc encryption/decryption roundtrip
transaction builder determinism (same inputs produce same tx)
10.3 End-to-end
scenario: create vault, deposit, set plan, check-in
wait simulated time: unlock eligible → approve → timelock → distribute → finalize
11) Deployment & operations
11.1 Environments
localnet (dev)
devnet (staging)
mainnet-beta (prod)
11.2 Key management
Upgrade authority behind multisig
Admin keys for:
pause
arbiter assignment
KYC-level updates (optional) Stored in hardware-backed KMS for production.
11.3 Observability
Index events
Alert on:
spikes in unlock initiations
repeated dispute openings
failed distributions (compute, missing ATAs)
suspicious guardian behavior (many approvals across many vaults)
12) Roadmap / execution plan (full product build)
Phase 0 — Research & spec hardening (2–3 weeks)
finalize state machine and batching design
decide subscription model and whether on-chain enforced
finalize dispute/arbitration approach (optional vs required)
Phase 1 — Protocol core (4–6 weeks)
implement vault creation, guardians, beneficiaries
deposits/withdrawals
liveness check-in + delegates
unlock session + approvals + timelock
SOL + SPL distribution (single-shot first, then batching)
event completeness + indexer schema
internal audit + fix pass
Phase 2 — Product apps (4–8 weeks parallel)
Next.js web app:
owner dashboard
guardian portal
beneficiary portal
transaction builder library (TS SDK)
indexer + read model
notifier (email/SMS)
docs encryption + upload service
Phase 3 — Safety + scale features (6–10 weeks)
full batching sessions for SOL + SPL
per-asset rules (AssignAll + ProRata shipped; custom splits later)
freeze/unfreeze + “panic mode” UX
dispute module (arbiter + resolution events)
Phase 4 — Professional guardians (6–12 weeks)
guardian profile registration
KYC pipeline integration
bonding contract and admin-set KYC levels
marketplace UX:
filtering (jurisdiction, language, fees)
request flow (off-chain contract + on-chain guardian entry)
reputation scoring (off-chain read model + on-chain attestations optional)
Phase 5 — Audits + beta (8–12 weeks)
third-party security audit(s)
bug bounty
staged mainnet rollout:
low limits
progressive feature enabling
wallet partnerships (embedded “Legacy” feature)
Phase 6 — Production scale (ongoing)
formal verification for critical distribution math
multi-program split if needed (marketplace module separated)
compliance posture improvements:
clearer legal doc workflows
jurisdiction-specific templates (off-chain)
enterprise offering:
exchanges/custodians “deceased account handling” integrations
