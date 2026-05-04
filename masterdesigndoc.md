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




Important implementation refinement (needed for provably-correct batching):
Your master design doc used per-entry PDAs for guardians/beneficiaries. That makes it hard to prove “no beneficiary was omitted” during chunked distribution without an on-chain canonical ordering.
Solution implemented here: add a VaultIndex PDA that stores the sorted list of active guardian pubkeys and beneficiary pubkeys. Distribution batches verify entries against this index, so missing/duplicated beneficiaries are rejected on-chain.
You should add a short note in the master doc under “Remaining-accounts conventions” that VaultIndex is canonical ordering.

0) Repo layout (program + SDK)
text

programs/legacyvault/src/
  lib.rs
  constants.rs
  state.rs
  errors.rs
  events.rs
  utils.rs

sdk/legacyvault/
  pdas.ts
  types.ts
  tx.ts
  distribute.ts
1) Anchor program — legacyvault
1.1 constants.rs
Rust

pub const CONFIG_SEED: &[u8] = b"config";
pub const VAULT_SEED: &[u8] = b"vault";
pub const VAULT_AUTH_SEED: &[u8] = b"vault_auth";
pub const INDEX_SEED: &[u8] = b"index";

pub const GUARDIAN_SEED: &[u8] = b"guardian";
pub const BENEFICIARY_SEED: &[u8] = b"beneficiary";
pub const DELEGATE_SEED: &[u8] = b"delegate";

pub const ASSET_RULE_SEED: &[u8] = b"asset_rule";

pub const UNLOCK_SEED: &[u8] = b"unlock";
pub const APPROVAL_SEED: &[u8] = b"approval";

pub const DIST_SOL_SEED: &[u8] = b"dist_sol";
pub const DIST_SPL_SEED: &[u8] = b"dist_spl";

pub const DISPUTE_SEED: &[u8] = b"dispute";

pub const SUBSCRIPTION_SEED: &[u8] = b"sub";

pub const GUARDIAN_PROFILE_SEED: &[u8] = b"g_profile";
pub const GUARDIAN_BOND_SEED: &[u8] = b"g_bond";

pub const BPS_DENOMINATOR: u16 = 10_000;

pub const MAX_LABEL_LEN: usize = 16;
pub const DOC_URI_MAX: usize = 200;

pub const PROFILE_NAME_MAX: usize = 32;
pub const PROFILE_WEBSITE_MAX: usize = 100;

// Practical caps for on-chain index lists.
// Estate plans usually have small N; these keep account sizes bounded.
pub const MAX_GUARDIANS: usize = 50;
pub const MAX_BENEFICIARIES: usize = 50;
1.2 state.rs
Rust

use anchor_lang::prelude::*;
use crate::constants::*;

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
pub enum GuardianRole {
    Personal = 0,
    Professional = 1,
}

#[repr(u8)]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum AssetRuleMode {
    ProRata = 0,
    AssignAll = 1,
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

    pub treasury: Pubkey,          // SOL treasury receiver
    pub create_fee_lamports: u64,

    pub min_heartbeat_secs: u32,
    pub max_heartbeat_secs: u32,
    pub min_inactivity_secs: u32,
    pub max_inactivity_secs: u32,
    pub min_timelock_secs: u32,
    pub max_timelock_secs: u32,

    pub arbiter: Pubkey,

    // optional billing authority (if you want a separate key)
    pub billing_authority: Pubkey,

    pub version: u16,
}

impl GlobalConfig {
    pub const LEN: usize = 8
        + 32 + 1
        + 32 + 8
        + (4 * 6)
        + 32
        + 32
        + 2;
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

    pub guardian_threshold: u8,   // M
    pub guardians_count: u16,     // informational (mirrors index.guardians.len)
    pub beneficiaries_count: u16, // informational (mirrors index.beneficiaries.len)

    pub current_nonce: u64,

    pub panic_enabled: bool,

    pub doc_hash: [u8; 32],
    pub doc_uri_len: u16,
    pub doc_uri: [u8; DOC_URI_MAX],

    pub bump: u8,
}

impl Vault {
    pub const LEN: usize = 8
        + 8 + 32 + 8
        + 8 + 4 + 4
        + 4
        + 1
        + 1 + 2 + 2
        + 8
        + 1
        + 32 + 2 + DOC_URI_MAX
        + 1;
}

#[account]
pub struct VaultIndex {
    pub vault: Pubkey,

    // Sorted list of active guardians
    pub guardians: Vec<Pubkey>,       // <= MAX_GUARDIANS

    // Sorted list of active beneficiaries
    pub beneficiaries: Vec<Pubkey>,   // <= MAX_BENEFICIARIES

    pub updated_at_unix: i64,
}

impl VaultIndex {
    pub const LEN: usize = 8
        + 32
        + (4 + 32 * MAX_GUARDIANS)
        + (4 + 32 * MAX_BENEFICIARIES)
        + 8;
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
    pub label: [u8; MAX_LABEL_LEN],
    pub added_at_unix: i64,
    pub active: bool,
}

impl BeneficiaryEntry {
    pub const LEN: usize = 8 + 32 + 32 + 2 + MAX_LABEL_LEN + 8 + 1;
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
pub struct AssetRule {
    pub vault: Pubkey,
    pub mint: Pubkey,
    pub mode: AssetRuleMode,
    pub assigned_beneficiary: Pubkey, // used if AssignAll
    pub updated_at_unix: i64,
}

impl AssetRule {
    pub const LEN: usize = 8 + 32 + 32 + 1 + 32 + 8;
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

    pub approved_at_unix: i64,
    pub executable_at_unix: i64,

    pub bump: u8,
}

impl UnlockSession {
    pub const LEN: usize = 8
        + 32 + 8
        + 1
        + 32 + 8
        + 2 + 1
        + 8 + 8
        + 1;
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
pub struct DistributionSolSession {
    pub unlock: Pubkey,

    pub total_distributable: u64,
    pub paid_total: u64,

    pub cursor: u32,
    pub done: bool,

    pub initialized_at_unix: i64,

    pub bump: u8,
}
impl DistributionSolSession {
    pub const LEN: usize = 8 + 32 + 8 + 8 + 4 + 1 + 8 + 1;
}

#[account]
pub struct DistributionSplSession {
    pub unlock: Pubkey,
    pub mint: Pubkey,

    pub total_balance: u64,
    pub paid_total: u64,

    pub cursor: u32,
    pub done: bool,

    pub initialized_at_unix: i64,

    pub bump: u8,
}
impl DistributionSplSession {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 4 + 1 + 8 + 1;
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
    pub plan_id: u8,           // 0 free, 1 standard, 2 pro
    pub valid_until_unix: i64, // 0 means none
    pub updated_at_unix: i64,
}
impl Subscription {
    pub const LEN: usize = 8 + 32 + 1 + 8 + 8;
}

#[account]
pub struct GuardianProfile {
    pub guardian: Pubkey,
    pub display_name: [u8; PROFILE_NAME_MAX],
    pub website_uri: [u8; PROFILE_WEBSITE_MAX],
    pub kyc_level: u8,
    pub active: bool,
    pub updated_at_unix: i64,
}
impl GuardianProfile {
    pub const LEN: usize = 8 + 32 + PROFILE_NAME_MAX + PROFILE_WEBSITE_MAX + 1 + 1 + 8;
}

#[account]
pub struct GuardianBond {
    pub guardian: Pubkey,
    pub amount: u64,    // tracked principal (excludes rent)
    pub locked: bool,
    pub updated_at_unix: i64,
}
impl GuardianBond {
    pub const LEN: usize = 8 + 32 + 8 + 1 + 8;
}
1.3 errors.rs
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

    #[msg("Guardian not active")]
    GuardianNotActive,

    #[msg("Beneficiary not active")]
    BeneficiaryNotActive,

    #[msg("Too many guardians")]
    TooManyGuardians,

    #[msg("Too many beneficiaries")]
    TooManyBeneficiaries,

    #[msg("Invalid beneficiary share")]
    InvalidShare,

    #[msg("Total beneficiary shares must sum to 10,000 bps")]
    SharesNot10k,

    #[msg("Cannot modify plan while unlocking")]
    PlanLocked,

    #[msg("Inactivity threshold not reached")]
    UnlockNotEligible,

    #[msg("Unlock session wrong state")]
    UnlockWrongState,

    #[msg("Approval already exists")]
    AlreadyApproved,

    #[msg("Threshold not reached")]
    ThresholdNotReached,

    #[msg("Timelock not elapsed")]
    TimelockNotElapsed,

    #[msg("Unlock is disputed")]
    UnlockDisputed,

    #[msg("Invalid document URI length")]
    InvalidDocUriLen,

    #[msg("Invalid token account / mint")]
    InvalidTokenAccount,

    #[msg("Invalid asset rule")]
    InvalidAssetRule,

    #[msg("Distribution already done")]
    DistributionAlreadyDone,

    #[msg("Invalid batch parameters")]
    InvalidBatch,

    #[msg("Index mismatch (wrong ordering or missing entries)")]
    IndexMismatch,

    #[msg("Bond is locked")]
    BondLocked,

    #[msg("Insufficient bond balance")]
    BondInsufficient,

    #[msg("Math overflow")]
    MathOverflow,
}
1.4 events.rs
Rust

use anchor_lang::prelude::*;
use crate::state::*;

#[event]
pub struct ConfigInitialized { pub admin: Pubkey, pub treasury: Pubkey, pub ts: i64 }

#[event]
pub struct VaultCreated { pub vault: Pubkey, pub vault_id: u64, pub owner: Pubkey, pub ts: i64 }

#[event]
pub struct DocumentSet { pub vault: Pubkey, pub doc_hash: [u8; 32], pub doc_uri_len: u16, pub ts: i64 }

#[event]
pub struct GuardianAdded { pub vault: Pubkey, pub guardian: Pubkey, pub role: GuardianRole, pub ts: i64 }
#[event]
pub struct GuardianRemoved { pub vault: Pubkey, pub guardian: Pubkey, pub ts: i64 }
#[event]
pub struct GuardianThresholdSet { pub vault: Pubkey, pub threshold: u8, pub ts: i64 }

#[event]
pub struct BeneficiaryAdded { pub vault: Pubkey, pub beneficiary: Pubkey, pub share_bps: u16, pub ts: i64 }
#[event]
pub struct BeneficiaryUpdated { pub vault: Pubkey, pub beneficiary: Pubkey, pub share_bps: u16, pub active: bool, pub ts: i64 }
#[event]
pub struct BeneficiaryRemoved { pub vault: Pubkey, pub beneficiary: Pubkey, pub ts: i64 }

#[event]
pub struct AssetRuleSet { pub vault: Pubkey, pub mint: Pubkey, pub mode: AssetRuleMode, pub assigned_beneficiary: Pubkey, pub ts: i64 }

#[event]
pub struct SolDeposited { pub vault: Pubkey, pub owner: Pubkey, pub lamports: u64, pub ts: i64 }
#[event]
pub struct SolWithdrawn { pub vault: Pubkey, pub owner: Pubkey, pub lamports: u64, pub ts: i64 }
#[event]
pub struct SplDeposited { pub vault: Pubkey, pub owner: Pubkey, pub mint: Pubkey, pub amount: u64, pub ts: i64 }
#[event]
pub struct SplWithdrawn { pub vault: Pubkey, pub owner: Pubkey, pub mint: Pubkey, pub amount: u64, pub ts: i64 }

#[event]
pub struct CheckIn { pub vault: Pubkey, pub by: Pubkey, pub ts: i64 }

#[event]
pub struct UnlockInitiated { pub vault: Pubkey, pub unlock: Pubkey, pub nonce: u64, pub initiated_by: Pubkey, pub ts: i64 }
#[event]
pub struct UnlockApproved { pub vault: Pubkey, pub unlock: Pubkey, pub guardian: Pubkey, pub approvals: u16, pub threshold: u8, pub ts: i64 }
#[event]
pub struct UnlockCancelled { pub vault: Pubkey, pub unlock: Pubkey, pub ts: i64 }

#[event]
pub struct PanicFrozen { pub vault: Pubkey, pub ts: i64 }
#[event]
pub struct Unfrozen { pub vault: Pubkey, pub ts: i64 }

#[event]
pub struct DisputeOpened { pub unlock: Pubkey, pub opened_by: Pubkey, pub note_hash: [u8; 32], pub ts: i64 }
#[event]
pub struct DisputeResolved { pub unlock: Pubkey, pub status: DisputeStatus, pub ts: i64 }

#[event]
pub struct SolDistributionInitialized { pub unlock: Pubkey, pub total_distributable: u64, pub ts: i64 }
#[event]
pub struct SolDistributionBatchExecuted { pub unlock: Pubkey, pub start_index: u32, pub batch_size: u16, pub new_cursor: u32, pub ts: i64 }

#[event]
pub struct SplDistributionInitialized { pub unlock: Pubkey, pub mint: Pubkey, pub total_balance: u64, pub ts: i64 }
#[event]
pub struct SplDistributionBatchExecuted { pub unlock: Pubkey, pub mint: Pubkey, pub start_index: u32, pub batch_size: u16, pub new_cursor: u32, pub done: bool, pub ts: i64 }

#[event]
pub struct UnlockFinalized { pub vault: Pubkey, pub unlock: Pubkey, pub ts: i64 }

#[event]
pub struct SubscriptionSet { pub vault: Pubkey, pub plan_id: u8, pub valid_until_unix: i64, pub ts: i64 }

#[event]
pub struct GuardianProfileRegistered { pub guardian: Pubkey, pub ts: i64 }
#[event]
pub struct GuardianBondUpdated { pub guardian: Pubkey, pub amount: u64, pub locked: bool, pub ts: i64 }
1.5 utils.rs
Rust

use anchor_lang::prelude::*;
use crate::{errors::LegacyVaultError, constants::*};

pub fn now_ts() -> Result<i64> {
    Ok(Clock::get()?.unix_timestamp)
}

pub fn require_not_paused(paused: bool) -> Result<()> {
    require!(!paused, LegacyVaultError::Paused);
    Ok(())
}

pub fn bytes_to_fixed<const N: usize>(src: &[u8]) -> Result<[u8; N]> {
    require!(src.len() <= N, LegacyVaultError::InvalidDocUriLen);
    let mut out = [0u8; N];
    out[..src.len()].copy_from_slice(src);
    Ok(out)
}

pub fn sorted_insert(vec: &mut Vec<Pubkey>, key: Pubkey) {
    match vec.binary_search(&key) {
        Ok(_) => {} // already
        Err(i) => vec.insert(i, key),
    }
}

pub fn sorted_remove(vec: &mut Vec<Pubkey>, key: Pubkey) {
    if let Ok(i) = vec.binary_search(&key) {
        vec.remove(i);
    }
}

pub fn u128_mul_div_floor(a: u64, b: u64, denom: u64) -> Result<u64> {
    require!(denom != 0, LegacyVaultError::MathOverflow);
    let v = (a as u128)
        .checked_mul(b as u128).ok_or(LegacyVaultError::MathOverflow)?
        .checked_div(denom as u128).ok_or(LegacyVaultError::MathOverflow)?;
    Ok(v as u64)
}

pub fn rent_min_for(size: usize) -> Result<u64> {
    Ok(Rent::get()?.minimum_balance(size))
}

pub fn clamp_i64_add(a: i64, b: i64) -> Result<i64> {
    a.checked_add(b).ok_or_else(|| error!(LegacyVaultError::MathOverflow))
}
1.6 lib.rs (handlers + contexts)
This is the full program: all handlers and all contexts. Replace program id.

Rust

use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, Transfer},
};

pub mod constants;
pub mod state;
pub mod errors;
pub mod events;
pub mod utils;

use constants::*;
use state::*;
use errors::*;
use events::*;
use utils::*;

declare_id!("LeGaCyVaULt11111111111111111111111111111"); // replace

#[program]
pub mod legacyvault {
    use super::*;

    // =========================
    // Admin
    // =========================

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        treasury: Pubkey,
        create_fee_lamports: u64,
        min_heartbeat_secs: u32,
        max_heartbeat_secs: u32,
        min_inactivity_secs: u32,
        max_inactivity_secs: u32,
        min_timelock_secs: u32,
        max_timelock_secs: u32,
        arbiter: Pubkey,
        billing_authority: Pubkey,
    ) -> Result<()> {
        let cfg = &mut ctx.accounts.config;
        cfg.admin = ctx.accounts.admin.key();
        cfg.paused = false;
        cfg.treasury = treasury;
        cfg.create_fee_lamports = create_fee_lamports;

        cfg.min_heartbeat_secs = min_heartbeat_secs;
        cfg.max_heartbeat_secs = max_heartbeat_secs;
        cfg.min_inactivity_secs = min_inactivity_secs;
        cfg.max_inactivity_secs = max_inactivity_secs;
        cfg.min_timelock_secs = min_timelock_secs;
        cfg.max_timelock_secs = max_timelock_secs;

        cfg.arbiter = arbiter;
        cfg.billing_authority = billing_authority;

        cfg.version = 1;

        emit!(ConfigInitialized { admin: cfg.admin, treasury, ts: now_ts()? });
        Ok(())
    }

    pub fn set_paused(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
        require_keys_eq!(ctx.accounts.config.admin, ctx.accounts.admin.key(), LegacyVaultError::Unauthorized);
        ctx.accounts.config.paused = paused;
        Ok(())
    }

    pub fn set_arbiter(ctx: Context<SetArbiter>, arbiter: Pubkey) -> Result<()> {
        require_keys_eq!(ctx.accounts.config.admin, ctx.accounts.admin.key(), LegacyVaultError::Unauthorized);
        ctx.accounts.config.arbiter = arbiter;
        Ok(())
    }

    pub fn set_fees(ctx: Context<SetFees>, create_fee_lamports: u64) -> Result<()> {
        require_keys_eq!(ctx.accounts.config.admin, ctx.accounts.admin.key(), LegacyVaultError::Unauthorized);
        ctx.accounts.config.create_fee_lamports = create_fee_lamports;
        Ok(())
    }

    pub fn set_bounds(
        ctx: Context<SetBounds>,
        min_heartbeat_secs: u32,
        max_heartbeat_secs: u32,
        min_inactivity_secs: u32,
        max_inactivity_secs: u32,
        min_timelock_secs: u32,
        max_timelock_secs: u32,
    ) -> Result<()> {
        require_keys_eq!(ctx.accounts.config.admin, ctx.accounts.admin.key(), LegacyVaultError::Unauthorized);
        let cfg = &mut ctx.accounts.config;
        cfg.min_heartbeat_secs = min_heartbeat_secs;
        cfg.max_heartbeat_secs = max_heartbeat_secs;
        cfg.min_inactivity_secs = min_inactivity_secs;
        cfg.max_inactivity_secs = max_inactivity_secs;
        cfg.min_timelock_secs = min_timelock_secs;
        cfg.max_timelock_secs = max_timelock_secs;
        Ok(())
    }

    // =========================
    // Vault lifecycle
    // =========================

    pub fn create_vault(
        ctx: Context<CreateVault>,
        vault_id: u64,
        heartbeat_interval_secs: u32,
        inactivity_threshold_secs: u32,
        timelock_secs: u32,
        panic_enabled: bool,
    ) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require_not_paused(cfg.paused)?;

        require!(
            heartbeat_interval_secs >= cfg.min_heartbeat_secs && heartbeat_interval_secs <= cfg.max_heartbeat_secs,
            LegacyVaultError::InvalidBounds
        );
        require!(
            inactivity_threshold_secs >= cfg.min_inactivity_secs && inactivity_threshold_secs <= cfg.max_inactivity_secs,
            LegacyVaultError::InvalidBounds
        );
        require!(
            timelock_secs >= cfg.min_timelock_secs && timelock_secs <= cfg.max_timelock_secs,
            LegacyVaultError::InvalidBounds
        );

        // Anti-spam fee (SOL) paid to treasury (optional)
        if cfg.create_fee_lamports > 0 {
            let ix = anchor_lang::solana_program::system_instruction::transfer(
                &ctx.accounts.owner.key(),
                &cfg.treasury,
                cfg.create_fee_lamports,
            );
            anchor_lang::solana_program::program::invoke(
                &ix,
                &[
                    ctx.accounts.owner.to_account_info(),
                    ctx.accounts.treasury.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                ],
            )?;
        }

        let now = now_ts()?;

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
        v.current_nonce = 0;
        v.panic_enabled = panic_enabled;
        v.doc_hash = [0u8; 32];
        v.doc_uri_len = 0;
        v.doc_uri = [0u8; DOC_URI_MAX];
        v.bump = ctx.bumps.vault;

        // Initialize index
        let idx = &mut ctx.accounts.index;
        idx.vault = v.key();
        idx.guardians = vec![];
        idx.beneficiaries = vec![];
        idx.updated_at_unix = now;

        emit!(VaultCreated { vault: v.key(), vault_id, owner: v.owner, ts: now });
        Ok(())
    }

    pub fn close_vault(ctx: Context<CloseVault>) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require_not_paused(cfg.paused)?;

        let v = &mut ctx.accounts.vault;
        require_keys_eq!(v.owner, ctx.accounts.owner.key(), LegacyVaultError::Unauthorized);

        // Allow close only if Distributed or Active with no funds (best-effort; full balance checks are off-chain)
        require!(
            v.status == VaultStatus::Distributed || v.status == VaultStatus::Active,
            LegacyVaultError::UnlockWrongState
        );

        v.status = VaultStatus::Closed;
        Ok(())
    }

    // =========================
    // Documents
    // =========================

    pub fn set_document(ctx: Context<SetDocument>, doc_hash: [u8; 32], doc_uri: Vec<u8>) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require_not_paused(cfg.paused)?;

        let v = &mut ctx.accounts.vault;
        require_keys_eq!(v.owner, ctx.accounts.owner.key(), LegacyVaultError::Unauthorized);
        require!(v.status == VaultStatus::Active, LegacyVaultError::VaultNotActive);

        require!(doc_uri.len() <= DOC_URI_MAX, LegacyVaultError::InvalidDocUriLen);
        v.doc_hash = doc_hash;
        v.doc_uri_len = doc_uri.len() as u16;
        v.doc_uri = [0u8; DOC_URI_MAX];
        v.doc_uri[..doc_uri.len()].copy_from_slice(&doc_uri);

        emit!(DocumentSet { vault: v.key(), doc_hash, doc_uri_len: v.doc_uri_len, ts: now_ts()? });
        Ok(())
    }

    // =========================
    // Guardians
    // =========================

    pub fn add_guardian(ctx: Context<AddGuardian>, role: GuardianRole) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require_not_paused(cfg.paused)?;

        let v = &mut ctx.accounts.vault;
        require_keys_eq!(v.owner, ctx.accounts.owner.key(), LegacyVaultError::Unauthorized);
        require!(v.status == VaultStatus::Active, LegacyVaultError::VaultNotActive);

        // index capacity
        require!(ctx.accounts.index.guardians.len() < MAX_GUARDIANS, LegacyVaultError::TooManyGuardians);

        let now = now_ts()?;
        let entry = &mut ctx.accounts.guardian_entry;
        entry.vault = v.key();
        entry.guardian = ctx.accounts.guardian.key();
        entry.role = role;
        entry.added_at_unix = now;
        entry.active = true;

        // update index
        sorted_insert(&mut ctx.accounts.index.guardians, entry.guardian);
        ctx.accounts.index.updated_at_unix = now;

        v.guardians_count = ctx.accounts.index.guardians.len() as u16;

        emit!(GuardianAdded { vault: v.key(), guardian: entry.guardian, role, ts: now });
        Ok(())
    }

    pub fn remove_guardian(ctx: Context<RemoveGuardian>) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require_not_paused(cfg.paused)?;

        let v = &mut ctx.accounts.vault;
        require_keys_eq!(v.owner, ctx.accounts.owner.key(), LegacyVaultError::Unauthorized);
        require!(v.status == VaultStatus::Active, LegacyVaultError::VaultNotActive);

        // mark inactive then close (close in context)
        let entry = &mut ctx.accounts.guardian_entry;
        require!(entry.active, LegacyVaultError::GuardianNotActive);
        entry.active = false;

        let now = now_ts()?;
        sorted_remove(&mut ctx.accounts.index.guardians, entry.guardian);
        ctx.accounts.index.updated_at_unix = now;

        v.guardians_count = ctx.accounts.index.guardians.len() as u16;

        emit!(GuardianRemoved { vault: v.key(), guardian: entry.guardian, ts: now });
        Ok(())
    }

    pub fn set_guardian_threshold(ctx: Context<SetGuardianThreshold>, threshold: u8) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require_not_paused(cfg.paused)?;

        let v = &mut ctx.accounts.vault;
        require_keys_eq!(v.owner, ctx.accounts.owner.key(), LegacyVaultError::Unauthorized);
        require!(v.status == VaultStatus::Active, LegacyVaultError::VaultNotActive);

        // threshold must be <= active guardians count
        let n = ctx.accounts.index.guardians.len();
        require!(n > 0, LegacyVaultError::InvalidGuardianThreshold);
        require!(threshold >= 1 && (threshold as usize) <= n, LegacyVaultError::InvalidGuardianThreshold);

        v.guardian_threshold = threshold;

        emit!(GuardianThresholdSet { vault: v.key(), threshold, ts: now_ts()? });
        Ok(())
    }

    // =========================
    // Beneficiaries
    // =========================

    pub fn add_beneficiary(ctx: Context<AddBeneficiary>, share_bps: u16, label: [u8; MAX_LABEL_LEN]) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require_not_paused(cfg.paused)?;

        let v = &mut ctx.accounts.vault;
        require_keys_eq!(v.owner, ctx.accounts.owner.key(), LegacyVaultError::Unauthorized);
        require!(v.status == VaultStatus::Active, LegacyVaultError::VaultNotActive);

        require!(share_bps > 0 && share_bps <= BPS_DENOMINATOR, LegacyVaultError::InvalidShare);
        require!(ctx.accounts.index.beneficiaries.len() < MAX_BENEFICIARIES, LegacyVaultError::TooManyBeneficiaries);

        let now = now_ts()?;
        let entry = &mut ctx.accounts.beneficiary_entry;
        entry.vault = v.key();
        entry.beneficiary = ctx.accounts.beneficiary.key();
        entry.share_bps = share_bps;
        entry.label = label;
        entry.added_at_unix = now;
        entry.active = true;

        sorted_insert(&mut ctx.accounts.index.beneficiaries, entry.beneficiary);
        ctx.accounts.index.updated_at_unix = now;

        v.beneficiaries_count = ctx.accounts.index.beneficiaries.len() as u16;

        emit!(BeneficiaryAdded { vault: v.key(), beneficiary: entry.beneficiary, share_bps, ts: now });
        Ok(())
    }

    pub fn update_beneficiary(
        ctx: Context<UpdateBeneficiary>,
        share_bps: u16,
        label: [u8; MAX_LABEL_LEN],
        active: bool,
    ) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require_not_paused(cfg.paused)?;

        let v = &mut ctx.accounts.vault;
        require_keys_eq!(v.owner, ctx.accounts.owner.key(), LegacyVaultError::Unauthorized);
        require!(v.status == VaultStatus::Active, LegacyVaultError::VaultNotActive);

        require!(share_bps <= BPS_DENOMINATOR, LegacyVaultError::InvalidShare);

        let now = now_ts()?;
        let e = &mut ctx.accounts.beneficiary_entry;
        e.share_bps = share_bps;
        e.label = label;
        e.active = active;

        // Update index membership based on active
        if active {
            require!(ctx.accounts.index.beneficiaries.len() < MAX_BENEFICIARIES, LegacyVaultError::TooManyBeneficiaries);
            sorted_insert(&mut ctx.accounts.index.beneficiaries, e.beneficiary);
        } else {
            sorted_remove(&mut ctx.accounts.index.beneficiaries, e.beneficiary);
        }
        ctx.accounts.index.updated_at_unix = now;
        v.beneficiaries_count = ctx.accounts.index.beneficiaries.len() as u16;

        emit!(BeneficiaryUpdated { vault: v.key(), beneficiary: e.beneficiary, share_bps, active, ts: now });
        Ok(())
    }

    pub fn remove_beneficiary(ctx: Context<RemoveBeneficiary>) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require_not_paused(cfg.paused)?;

        let v = &mut ctx.accounts.vault;
        require_keys_eq!(v.owner, ctx.accounts.owner.key(), LegacyVaultError::Unauthorized);
        require!(v.status == VaultStatus::Active, LegacyVaultError::VaultNotActive);

        let e = &mut ctx.accounts.beneficiary_entry;
        require!(e.active, LegacyVaultError::BeneficiaryNotActive);
        e.active = false;

        let now = now_ts()?;
        sorted_remove(&mut ctx.accounts.index.beneficiaries, e.beneficiary);
        ctx.accounts.index.updated_at_unix = now;
        v.beneficiaries_count = ctx.accounts.index.beneficiaries.len() as u16;

        emit!(BeneficiaryRemoved { vault: v.key(), beneficiary: e.beneficiary, ts: now });
        Ok(())
    }

    /// Strong check: enforce active beneficiaries sum to 10k bps.
    /// Caller must pass ALL active BeneficiaryEntry accounts in remaining_accounts, in index order.
    pub fn assert_beneficiary_total_10k(ctx: Context<AssertBeneficiaryTotal10k>) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require_not_paused(cfg.paused)?;
        let v = &ctx.accounts.vault;
        require_keys_eq!(v.owner, ctx.accounts.owner.key(), LegacyVaultError::Unauthorized);
        require!(v.status == VaultStatus::Active, LegacyVaultError::VaultNotActive);

        let idx = &ctx.accounts.index;
        let n = idx.beneficiaries.len();
        require!(ctx.remaining_accounts.len() == n, LegacyVaultError::InvalidBatch);

        let mut total: u32 = 0;
        for i in 0..n {
            let ai = &ctx.remaining_accounts[i];
            let be: Account<BeneficiaryEntry> = Account::try_from(ai)?;
            require_keys_eq!(be.vault, v.key(), LegacyVaultError::IndexMismatch);
            require!(be.active, LegacyVaultError::BeneficiaryNotActive);
            require!(be.beneficiary == idx.beneficiaries[i], LegacyVaultError::IndexMismatch);
            total = total.checked_add(be.share_bps as u32).ok_or(LegacyVaultError::MathOverflow)?;
        }
        require!(total == BPS_DENOMINATOR as u32, LegacyVaultError::SharesNot10k);
        Ok(())
    }

    // =========================
    // Asset rules
    // =========================

    pub fn set_asset_rule(ctx: Context<SetAssetRule>, mode: AssetRuleMode) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require_not_paused(cfg.paused)?;
        let v = &ctx.accounts.vault;
        require_keys_eq!(v.owner, ctx.accounts.owner.key(), LegacyVaultError::Unauthorized);
        require!(v.status == VaultStatus::Active, LegacyVaultError::VaultNotActive);

        // If AssignAll, require assigned_beneficiary exists in index
        if mode == AssetRuleMode::AssignAll {
            require!(
                ctx.accounts.index.beneficiaries.binary_search(&ctx.accounts.assigned_beneficiary.key()).is_ok(),
                LegacyVaultError::InvalidAssetRule
            );
        }

        let now = now_ts()?;
        let r = &mut ctx.accounts.asset_rule;
        r.vault = v.key();
        r.mint = ctx.accounts.mint.key();
        r.mode = mode;
        r.assigned_beneficiary = ctx.accounts.assigned_beneficiary.key();
        r.updated_at_unix = now;

        emit!(AssetRuleSet {
            vault: v.key(),
            mint: r.mint,
            mode,
            assigned_beneficiary: r.assigned_beneficiary,
            ts: now
        });
        Ok(())
    }

    pub fn clear_asset_rule(ctx: Context<ClearAssetRule>) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require_not_paused(cfg.paused)?;
        let v = &ctx.accounts.vault;
        require_keys_eq!(v.owner, ctx.accounts.owner.key(), LegacyVaultError::Unauthorized);
        require!(v.status == VaultStatus::Active, LegacyVaultError::VaultNotActive);
        // close handled in context
        Ok(())
    }

    // =========================
    // Deposits / withdrawals
    // =========================

    pub fn deposit_sol(ctx: Context<DepositSol>, lamports: u64) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require_not_paused(cfg.paused)?;
        let v = &ctx.accounts.vault;
        require_keys_eq!(v.owner, ctx.accounts.owner.key(), LegacyVaultError::Unauthorized);
        require!(v.status == VaultStatus::Active, LegacyVaultError::VaultNotActive);

        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.owner.key(),
            &ctx.accounts.vault.key(),
            lamports,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.owner.to_account_info(),
                ctx.accounts.vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        emit!(SolDeposited { vault: v.key(), owner: v.owner, lamports, ts: now_ts()? });
        Ok(())
    }

    pub fn withdraw_sol(ctx: Context<WithdrawSol>, lamports: u64) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require_not_paused(cfg.paused)?;
        let v = &mut ctx.accounts.vault;
        require_keys_eq!(v.owner, ctx.accounts.owner.key(), LegacyVaultError::Unauthorized);
        require!(v.status == VaultStatus::Active, LegacyVaultError::VaultNotActive);

        // Disallow withdrawals if unlocking
        // (status already Active ensures)

        let rent_min = rent_min_for(Vault::LEN)?;
        let vault_lamports = **v.to_account_info().try_borrow_lamports()?;
        require!(vault_lamports.saturating_sub(rent_min) >= lamports, LegacyVaultError::MathOverflow);

        **v.to_account_info().try_borrow_mut_lamports()? -= lamports;
        **ctx.accounts.owner.to_account_info().try_borrow_mut_lamports()? += lamports;

        emit!(SolWithdrawn { vault: v.key(), owner: v.owner, lamports, ts: now_ts()? });
        Ok(())
    }

    pub fn deposit_spl(ctx: Context<DepositSpl>, amount: u64) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require_not_paused(cfg.paused)?;
        let v = &ctx.accounts.vault;
        require_keys_eq!(v.owner, ctx.accounts.owner.key(), LegacyVaultError::Unauthorized);
        require!(v.status == VaultStatus::Active, LegacyVaultError::VaultNotActive);

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.owner_ata.to_account_info(),
                    to: ctx.accounts.vault_ata.to_account_info(),
                    authority: ctx.accounts.owner.to_account_info(),
                }
            ),
            amount
        )?;

        emit!(SplDeposited { vault: v.key(), owner: v.owner, mint: ctx.accounts.mint.key(), amount, ts: now_ts()? });
        Ok(())
    }

    pub fn withdraw_spl(ctx: Context<WithdrawSpl>, amount: u64) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require_not_paused(cfg.paused)?;
        let v = &ctx.accounts.vault;
        require_keys_eq!(v.owner, ctx.accounts.owner.key(), LegacyVaultError::Unauthorized);
        require!(v.status == VaultStatus::Active, LegacyVaultError::VaultNotActive);

        let signer_seeds: &[&[&[u8]]] = &[&[
            VAULT_AUTH_SEED,
            ctx.accounts.vault.key().as_ref(),
            &[ctx.bumps.vault_auth],
        ]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_ata.to_account_info(),
                    to: ctx.accounts.owner_ata.to_account_info(),
                    authority: ctx.accounts.vault_auth.to_account_info(),
                },
                signer_seeds,
            ),
            amount
        )?;

        emit!(SplWithdrawn { vault: v.key(), owner: v.owner, mint: ctx.accounts.mint.key(), amount, ts: now_ts()? });
        Ok(())
    }

    // =========================
    // Liveness
    // =========================

    pub fn check_in(ctx: Context<CheckIn>) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require_not_paused(cfg.paused)?;
        let v = &mut ctx.accounts.vault;
        require_keys_eq!(v.owner, ctx.accounts.owner.key(), LegacyVaultError::Unauthorized);
        require!(v.status == VaultStatus::Active, LegacyVaultError::VaultNotActive);

        v.last_checkin_unix = now_ts()?;
        emit!(CheckIn { vault: v.key(), by: v.owner, ts: v.last_checkin_unix });
        Ok(())
    }

    pub fn add_liveness_delegate(ctx: Context<AddLivenessDelegate>) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require_not_paused(cfg.paused)?;
        let v = &ctx.accounts.vault;
        require_keys_eq!(v.owner, ctx.accounts.owner.key(), LegacyVaultError::Unauthorized);
        require!(v.status == VaultStatus::Active, LegacyVaultError::VaultNotActive);

        let now = now_ts()?;
        let d = &mut ctx.accounts.delegate_entry;
        d.vault = v.key();
        d.delegate = ctx.accounts.delegate.key();
        d.added_at_unix = now;
        d.active = true;
        Ok(())
    }

    pub fn remove_liveness_delegate(ctx: Context<RemoveLivenessDelegate>) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require_not_paused(cfg.paused)?;
        let v = &ctx.accounts.vault;
        require_keys_eq!(v.owner, ctx.accounts.owner.key(), LegacyVaultError::Unauthorized);
        require!(v.status == VaultStatus::Active, LegacyVaultError::VaultNotActive);

        ctx.accounts.delegate_entry.active = false;
        Ok(())
    }

    pub fn delegate_check_in(ctx: Context<DelegateCheckIn>) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require_not_paused(cfg.paused)?;

        let v = &mut ctx.accounts.vault;
        require!(v.status == VaultStatus::Active, LegacyVaultError::VaultNotActive);

        let d = &ctx.accounts.delegate_entry;
        require!(d.active, LegacyVaultError::Unauthorized);
        require_keys_eq!(d.delegate, ctx.accounts.delegate.key(), LegacyVaultError::Unauthorized);

        v.last_checkin_unix = now_ts()?;
        emit!(CheckIn { vault: v.key(), by: ctx.accounts.delegate.key(), ts: v.last_checkin_unix });
        Ok(())
    }

    // =========================
    // Freeze
    // =========================

    pub fn panic_freeze(ctx: Context<PanicFreeze>) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require_not_paused(cfg.paused)?;

        let v = &mut ctx.accounts.vault;
        require_keys_eq!(v.owner, ctx.accounts.owner.key(), LegacyVaultError::Unauthorized);
        require!(v.panic_enabled, LegacyVaultError::Unauthorized);

        v.status = VaultStatus::Frozen;
        emit!(PanicFrozen { vault: v.key(), ts: now_ts()? });
        Ok(())
    }

    pub fn unfreeze(ctx: Context<Unfreeze>) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require_not_paused(cfg.paused)?;

        let v = &mut ctx.accounts.vault;
        require_keys_eq!(v.owner, ctx.accounts.owner.key(), LegacyVaultError::Unauthorized);
        require!(v.status == VaultStatus::Frozen, LegacyVaultError::VaultFrozen);

        v.status = VaultStatus::Active;
        emit!(Unfrozen { vault: v.key(), ts: now_ts()? });
        Ok(())
    }

    // =========================
    // Unlock lifecycle
    // =========================

    pub fn initiate_unlock(ctx: Context<InitiateUnlock>) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require_not_paused(cfg.paused)?;

        let now = now_ts()?;
        let v = &mut ctx.accounts.vault;

        require!(v.status == VaultStatus::Active, LegacyVaultError::VaultNotActive);
        require!(v.guardian_threshold >= 1, LegacyVaultError::InvalidGuardianThreshold);
        require!(v.status != VaultStatus::Frozen, LegacyVaultError::VaultFrozen);

        // check inactivity
        let eligible_at = clamp_i64_add(v.last_checkin_unix, v.inactivity_threshold_secs as i64)?;
        require!(now >= eligible_at, LegacyVaultError::UnlockNotEligible);

        // guardian entry must be active
        require!(ctx.accounts.guardian_entry.active, LegacyVaultError::GuardianNotActive);

        // create unlock session
        v.status = VaultStatus::Unlocking;
        v.current_nonce = v.current_nonce.checked_add(1).ok_or(LegacyVaultError::MathOverflow)?;

        let u = &mut ctx.accounts.unlock;
        u.vault = v.key();
        u.nonce = v.current_nonce;
        u.status = UnlockStatus::Proposed;
        u.initiated_by = ctx.accounts.guardian.key();
        u.initiated_at_unix = now;
        u.approvals = 0;
        u.threshold = v.guardian_threshold;
        u.approved_at_unix = 0;
        u.executable_at_unix = 0;
        u.bump = ctx.bumps.unlock;

        emit!(UnlockInitiated { vault: v.key(), unlock: u.key(), nonce: u.nonce, initiated_by: u.initiated_by, ts: now });
        Ok(())
    }

    pub fn approve_unlock(ctx: Context<ApproveUnlock>) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require_not_paused(cfg.paused)?;
        let now = now_ts()?;

        let v = &ctx.accounts.vault;
        require!(v.status == VaultStatus::Unlocking, LegacyVaultError::VaultNotUnlocking);

        let u = &mut ctx.accounts.unlock;
        require!(u.status == UnlockStatus::Proposed || u.status == UnlockStatus::Approved, LegacyVaultError::UnlockWrongState);

        require!(ctx.accounts.guardian_entry.active, LegacyVaultError::GuardianNotActive);

        // approval PDA init ensures uniqueness
        let appr = &mut ctx.accounts.approval;
        appr.unlock = u.key();
        appr.guardian = ctx.accounts.guardian.key();
        appr.approved_at_unix = now;

        u.approvals = u.approvals.checked_add(1).ok_or(LegacyVaultError::MathOverflow)?;

        if u.approvals >= u.threshold as u16 {
            u.status = UnlockStatus::Approved;
            u.approved_at_unix = now;
            u.executable_at_unix = clamp_i64_add(now, v.timelock_secs as i64)?;
        }

        emit!(UnlockApproved { vault: v.key(), unlock: u.key(), guardian: appr.guardian, approvals: u.approvals, threshold: u.threshold, ts: now });
        Ok(())
    }

    pub fn cancel_unlock(ctx: Context<CancelUnlock>) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require_not_paused(cfg.paused)?;

        let now = now_ts()?;
        let v = &mut ctx.accounts.vault;
        require_keys_eq!(v.owner, ctx.accounts.owner.key(), LegacyVaultError::Unauthorized);
        require!(v.status == VaultStatus::Unlocking, LegacyVaultError::VaultNotUnlocking);

        let u = &mut ctx.accounts.unlock;
        require!(u.status != UnlockStatus::Executed, LegacyVaultError::UnlockWrongState);

        u.status = UnlockStatus::Cancelled;
        v.status = VaultStatus::Active;

        emit!(UnlockCancelled { vault: v.key(), unlock: u.key(), ts: now });
        Ok(())
    }

    // =========================
    // Disputes
    // =========================

    pub fn open_dispute(ctx: Context<OpenDispute>, note_hash: [u8; 32]) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require_not_paused(cfg.paused)?;
        let now = now_ts()?;

        let v = &ctx.accounts.vault;
        require!(v.status == VaultStatus::Unlocking, LegacyVaultError::VaultNotUnlocking);

        let u = &mut ctx.accounts.unlock;
        require!(u.status == UnlockStatus::Approved || u.status == UnlockStatus::Proposed, LegacyVaultError::UnlockWrongState);

        u.status = UnlockStatus::Disputed;

        let d = &mut ctx.accounts.dispute;
        d.unlock = u.key();
        d.opened_by = ctx.accounts.opener.key();
        d.opened_at_unix = now;
        d.status = DisputeStatus::Open;
        d.note_hash = note_hash;

        emit!(DisputeOpened { unlock: u.key(), opened_by: d.opened_by, note_hash, ts: now });
        Ok(())
    }

    pub fn resolve_dispute_cancel(ctx: Context<ResolveDispute>) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require_not_paused(cfg.paused)?;
        require_keys_eq!(cfg.arbiter, ctx.accounts.arbiter.key(), LegacyVaultError::Unauthorized);

        let now = now_ts()?;
        let v = &mut ctx.accounts.vault;
        let u = &mut ctx.accounts.unlock;

        require!(u.status == UnlockStatus::Disputed, LegacyVaultError::UnlockWrongState);

        u.status = UnlockStatus::Cancelled;
        v.status = VaultStatus::Active;

        ctx.accounts.dispute.status = DisputeStatus::ResolvedCancel;

        emit!(DisputeResolved { unlock: u.key(), status: ctx.accounts.dispute.status, ts: now });
        Ok(())
    }

    pub fn resolve_dispute_proceed(ctx: Context<ResolveDispute>) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require_not_paused(cfg.paused)?;
        require_keys_eq!(cfg.arbiter, ctx.accounts.arbiter.key(), LegacyVaultError::Unauthorized);

        let now = now_ts()?;
        let u = &mut ctx.accounts.unlock;

        require!(u.status == UnlockStatus::Disputed, LegacyVaultError::UnlockWrongState);

        // return to Approved if approvals already reached; else Proposed
        if u.approvals >= u.threshold as u16 {
            u.status = UnlockStatus::Approved;
        } else {
            u.status = UnlockStatus::Proposed;
        }

        ctx.accounts.dispute.status = DisputeStatus::ResolvedProceed;

        emit!(DisputeResolved { unlock: u.key(), status: ctx.accounts.dispute.status, ts: now });
        Ok(())
    }

    // =========================
    // Distribution (SOL)
    // =========================

    pub fn init_distribution_sol_session(ctx: Context<InitDistributionSolSession>) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require_not_paused(cfg.paused)?;
        let now = now_ts()?;

        let v = &ctx.accounts.vault;
        require!(v.status == VaultStatus::Unlocking, LegacyVaultError::VaultNotUnlocking);

        let u = &ctx.accounts.unlock;
        require!(u.status == UnlockStatus::Approved, LegacyVaultError::UnlockWrongState);
        require!(now >= u.executable_at_unix, LegacyVaultError::TimelockNotElapsed);

        // total distributable = vault lamports - rent_min(Vault)
        let rent_min = rent_min_for(Vault::LEN)?;
        let vault_lamports = **ctx.accounts.vault.to_account_info().try_borrow_lamports()?;
        let distributable = vault_lamports.saturating_sub(rent_min);

        let s = &mut ctx.accounts.dist_sol;
        s.unlock = u.key();
        s.total_distributable = distributable;
        s.paid_total = 0;
        s.cursor = 0;
        s.done = distributable == 0;
        s.initialized_at_unix = now;
        s.bump = ctx.bumps.dist_sol;

        emit!(SolDistributionInitialized { unlock: u.key(), total_distributable: distributable, ts: now });
        Ok(())
    }

    /// Remaining accounts per item (2 per beneficiary in batch):
    /// - BeneficiaryEntry PDA (read-only)
    /// - Beneficiary wallet (writable)
    pub fn execute_distribution_sol_batch(ctx: Context<ExecuteDistributionSolBatch>, start_index: u32, batch_size: u16) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require_not_paused(cfg.paused)?;
        let now = now_ts()?;

        let v = &mut ctx.accounts.vault;
        require!(v.status == VaultStatus::Unlocking, LegacyVaultError::VaultNotUnlocking);

        let u = &ctx.accounts.unlock;
        require!(u.status == UnlockStatus::Approved, LegacyVaultError::UnlockWrongState);
        require!(now >= u.executable_at_unix, LegacyVaultError::TimelockNotElapsed);

        let idx = &ctx.accounts.index;
        let total = idx.beneficiaries.len() as u32;
        require!(total > 0, LegacyVaultError::InvalidBatch);

        let s = &mut ctx.accounts.dist_sol;
        require!(!s.done, LegacyVaultError::DistributionAlreadyDone);
        require!(start_index == s.cursor, LegacyVaultError::InvalidBatch);

        let bs = batch_size as u32;
        require!(bs > 0, LegacyVaultError::InvalidBatch);
        require!(start_index < total, LegacyVaultError::InvalidBatch);

        let end = (start_index + bs).min(total);
        let actual = end - start_index;

        // remaining_accounts must be 2*actual
        require!(ctx.remaining_accounts.len() == (2 * actual) as usize, LegacyVaultError::InvalidBatch);

        // Pay out floor amounts, remainder goes to last beneficiary overall (index == total-1)
        for j in 0..actual {
            let global_i = start_index + j;
            let be_ai = &ctx.remaining_accounts[(2 * j) as usize];
            let bw_ai = &ctx.remaining_accounts[(2 * j + 1) as usize];

            let be: Account<BeneficiaryEntry> = Account::try_from(be_ai)?;
            require!(be.active, LegacyVaultError::BeneficiaryNotActive);
            require_keys_eq!(be.vault, v.key(), LegacyVaultError::IndexMismatch);
            require_keys_eq!(be.beneficiary, idx.beneficiaries[global_i as usize], LegacyVaultError::IndexMismatch);
            require_keys_eq!(bw_ai.key(), be.beneficiary, LegacyVaultError::IndexMismatch);
            require!(bw_ai.is_writable, LegacyVaultError::Unauthorized);

            let mut pay = u128_mul_div_floor(
                s.total_distributable,
                be.share_bps as u64,
                BPS_DENOMINATOR as u64
            )?;

            // last beneficiary gets remainder
            if global_i == total - 1 {
                let remainder = s.total_distributable
                    .checked_sub(s.paid_total)
                    .ok_or(LegacyVaultError::MathOverflow)?;
                pay = remainder;
            } else {
                // ensure we don't overpay due to rounding + batch ordering
                // (paid_total tracked ensures remainder correct at end)
            }

            if pay > 0 {
                **v.to_account_info().try_borrow_mut_lamports()? -= pay;
                **bw_ai.try_borrow_mut_lamports()? += pay;
                s.paid_total = s.paid_total.checked_add(pay).ok_or(LegacyVaultError::MathOverflow)?;
            }
        }

        s.cursor = end;
        if s.cursor >= total {
            s.done = true;
        }

        emit!(SolDistributionBatchExecuted {
            unlock: u.key(),
            start_index,
            batch_size: actual as u16,
            new_cursor: s.cursor,
            ts: now
        });

        Ok(())
    }

    // =========================
    // Distribution (SPL)
    // =========================

    pub fn init_distribution_spl_session(ctx: Context<InitDistributionSplSession>) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require_not_paused(cfg.paused)?;
        let now = now_ts()?;

        let v = &ctx.accounts.vault;
        require!(v.status == VaultStatus::Unlocking, LegacyVaultError::VaultNotUnlocking);

        let u = &ctx.accounts.unlock;
        require!(u.status == UnlockStatus::Approved, LegacyVaultError::UnlockWrongState);
        require!(now >= u.executable_at_unix, LegacyVaultError::TimelockNotElapsed);

        let bal = ctx.accounts.vault_ata.amount;

        let s = &mut ctx.accounts.dist_spl;
        s.unlock = u.key();
        s.mint = ctx.accounts.mint.key();
        s.total_balance = bal;
        s.paid_total = 0;
        s.cursor = 0;
        s.done = bal == 0;
        s.initialized_at_unix = now;
        s.bump = ctx.bumps.dist_spl;

        emit!(SplDistributionInitialized { unlock: u.key(), mint: s.mint, total_balance: bal, ts: now });
        Ok(())
    }

    /// Remaining accounts per item (3 per beneficiary in batch):
    /// - BeneficiaryEntry PDA (read-only)
    /// - Beneficiary wallet (read-only)
    /// - Beneficiary ATA for mint (writable)
    pub fn execute_distribution_spl_batch(ctx: Context<ExecuteDistributionSplBatch>, start_index: u32, batch_size: u16) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require_not_paused(cfg.paused)?;
        let now = now_ts()?;

        let v = &ctx.accounts.vault;
        require!(v.status == VaultStatus::Unlocking, LegacyVaultError::VaultNotUnlocking);

        let u = &ctx.accounts.unlock;
        require!(u.status == UnlockStatus::Approved, LegacyVaultError::UnlockWrongState);
        require!(now >= u.executable_at_unix, LegacyVaultError::TimelockNotElapsed);

        let idx = &ctx.accounts.index;
        let total = idx.beneficiaries.len() as u32;
        require!(total > 0, LegacyVaultError::InvalidBatch);

        let s = &mut ctx.accounts.dist_spl;
        require!(!s.done, LegacyVaultError::DistributionAlreadyDone);
        require!(start_index == s.cursor, LegacyVaultError::InvalidBatch);

        let bs = batch_size as u32;
        require!(bs > 0, LegacyVaultError::InvalidBatch);
        require!(start_index < total, LegacyVaultError::InvalidBatch);

        let end = (start_index + bs).min(total);
        let actual = end - start_index;

        require!(ctx.remaining_accounts.len() == (3 * actual) as usize, LegacyVaultError::InvalidBatch);

        let signer_seeds: &[&[&[u8]]] = &[&[
            VAULT_AUTH_SEED,
            ctx.accounts.vault.key().as_ref(),
            &[ctx.bumps.vault_auth],
        ]];

        for j in 0..actual {
            let global_i = start_index + j;

            let be_ai = &ctx.remaining_accounts[(3*j) as usize];
            let bw_ai = &ctx.remaining_accounts[(3*j + 1) as usize];
            let ata_ai = &ctx.remaining_accounts[(3*j + 2) as usize];

            let be: Account<BeneficiaryEntry> = Account::try_from(be_ai)?;
            require!(be.active, LegacyVaultError::BeneficiaryNotActive);
            require_keys_eq!(be.vault, v.key(), LegacyVaultError::IndexMismatch);
            require_keys_eq!(be.beneficiary, idx.beneficiaries[global_i as usize], LegacyVaultError::IndexMismatch);
            require_keys_eq!(bw_ai.key(), be.beneficiary, LegacyVaultError::IndexMismatch);

            // Validate ATA fields
            let ata: Account<TokenAccount> = Account::try_from(ata_ai)?;
            require_keys_eq!(ata.owner, be.beneficiary, LegacyVaultError::InvalidTokenAccount);
            require_keys_eq!(ata.mint, ctx.accounts.mint.key(), LegacyVaultError::InvalidTokenAccount);

            let mut pay = u128_mul_div_floor(
                s.total_balance,
                be.share_bps as u64,
                BPS_DENOMINATOR as u64
            )?;

            if global_i == total - 1 {
                let remainder = s.total_balance
                    .checked_sub(s.paid_total)
                    .ok_or(LegacyVaultError::MathOverflow)?;
                pay = remainder;
            }

            if pay > 0 {
                token::transfer(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info(),
                        Transfer {
                            from: ctx.accounts.vault_ata.to_account_info(),
                            to: ata.to_account_info(),
                            authority: ctx.accounts.vault_auth.to_account_info(),
                        },
                        signer_seeds,
                    ),
                    pay
                )?;
                s.paid_total = s.paid_total.checked_add(pay).ok_or(LegacyVaultError::MathOverflow)?;
            }
        }

        s.cursor = end;
        if s.cursor >= total {
            s.done = true;
        }

        emit!(SplDistributionBatchExecuted {
            unlock: u.key(),
            mint: ctx.accounts.mint.key(),
            start_index,
            batch_size: actual as u16,
            new_cursor: s.cursor,
            done: s.done,
            ts: now
        });

        Ok(())
    }

    pub fn finalize_unlock(ctx: Context<FinalizeUnlock>) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require_not_paused(cfg.paused)?;
        let now = now_ts()?;

        let v = &mut ctx.accounts.vault;
        require!(v.status == VaultStatus::Unlocking, LegacyVaultError::VaultNotUnlocking);

        let u = &mut ctx.accounts.unlock;
        require!(u.status == UnlockStatus::Approved, LegacyVaultError::UnlockWrongState);

        // Remaining accounts must include:
        // - dist_sol session (already in accounts)
        // - all dist_spl sessions that should be considered complete (as Account<DistributionSplSession>)
        require!(ctx.accounts.dist_sol.done, LegacyVaultError::ThresholdNotReached);

        for ai in ctx.remaining_accounts.iter() {
            let ds: Account<DistributionSplSession> = Account::try_from(ai)?;
            require_keys_eq!(ds.unlock, u.key(), LegacyVaultError::Unauthorized);
            require!(ds.done, LegacyVaultError::ThresholdNotReached);
        }

        u.status = UnlockStatus::Executed;
        v.status = VaultStatus::Distributed;

        emit!(UnlockFinalized { vault: v.key(), unlock: u.key(), ts: now });
        Ok(())
    }

    // =========================
    // Subscription (full build)
    // =========================

    pub fn set_subscription(ctx: Context<SetSubscription>, plan_id: u8, valid_until_unix: i64) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require_not_paused(cfg.paused)?;
        // allow admin OR billing authority
        require!(
            ctx.accounts.authority.key() == cfg.admin || ctx.accounts.authority.key() == cfg.billing_authority,
            LegacyVaultError::Unauthorized
        );

        let now = now_ts()?;
        let sub = &mut ctx.accounts.subscription;
        sub.vault = ctx.accounts.vault.key();
        sub.plan_id = plan_id;
        sub.valid_until_unix = valid_until_unix;
        sub.updated_at_unix = now;

        emit!(SubscriptionSet { vault: ctx.accounts.vault.key(), plan_id, valid_until_unix, ts: now });
        Ok(())
    }

    pub fn renew_subscription(ctx: Context<RenewSubscription>, plan_id: u8, add_secs: i64, fee_lamports: u64) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require_not_paused(cfg.paused)?;
        let now = now_ts()?;

        // Collect fee in SOL to treasury
        if fee_lamports > 0 {
            let ix = anchor_lang::solana_program::system_instruction::transfer(
                &ctx.accounts.payer.key(),
                &cfg.treasury,
                fee_lamports,
            );
            anchor_lang::solana_program::program::invoke(
                &ix,
                &[
                    ctx.accounts.payer.to_account_info(),
                    ctx.accounts.treasury.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                ],
            )?;
        }

        let sub = &mut ctx.accounts.subscription;
        sub.vault = ctx.accounts.vault.key();
        sub.plan_id = plan_id;

        let base = if sub.valid_until_unix > now { sub.valid_until_unix } else { now };
        sub.valid_until_unix = clamp_i64_add(base, add_secs)?;
        sub.updated_at_unix = now;

        emit!(SubscriptionSet { vault: ctx.accounts.vault.key(), plan_id, valid_until_unix: sub.valid_until_unix, ts: now });
        Ok(())
    }

    // =========================
    // Professional guardians
    // =========================

    pub fn register_guardian_profile(
        ctx: Context<RegisterGuardianProfile>,
        display_name: Vec<u8>,
        website_uri: Vec<u8>,
    ) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require_not_paused(cfg.paused)?;
        let now = now_ts()?;

        require!(display_name.len() <= PROFILE_NAME_MAX, LegacyVaultError::InvalidDocUriLen);
        require!(website_uri.len() <= PROFILE_WEBSITE_MAX, LegacyVaultError::InvalidDocUriLen);

        let p = &mut ctx.accounts.profile;
        p.guardian = ctx.accounts.guardian.key();
        p.display_name = bytes_to_fixed::<PROFILE_NAME_MAX>(&display_name)?;
        p.website_uri = bytes_to_fixed::<PROFILE_WEBSITE_MAX>(&website_uri)?;
        // do not set kyc_level here (admin does)
        if p.updated_at_unix == 0 {
            p.kyc_level = 0;
            p.active = true;
        }
        p.updated_at_unix = now;

        emit!(GuardianProfileRegistered { guardian: p.guardian, ts: now });
        Ok(())
    }

    pub fn set_guardian_kyc_level(ctx: Context<SetGuardianKycLevel>, level: u8, active: bool) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require_not_paused(cfg.paused)?;
        require_keys_eq!(cfg.admin, ctx.accounts.admin.key(), LegacyVaultError::Unauthorized);

        let now = now_ts()?;
        let p = &mut ctx.accounts.profile;
        p.kyc_level = level;
        p.active = active;
        p.updated_at_unix = now;
        Ok(())
    }

    // =========================
    // Bonds (SOL-based)
    // =========================

    pub fn create_or_topup_guardian_bond(ctx: Context<CreateOrTopupGuardianBond>, lamports: u64) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require_not_paused(cfg.paused)?;
        let now = now_ts()?;

        // Transfer lamports into bond account (PDA)
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.guardian.key(),
            &ctx.accounts.bond.key(),
            lamports,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.guardian.to_account_info(),
                ctx.accounts.bond.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        let b = &mut ctx.accounts.bond;
        b.guardian = ctx.accounts.guardian.key();
        b.amount = b.amount.checked_add(lamports).ok_or(LegacyVaultError::MathOverflow)?;
        b.updated_at_unix = now;

        emit!(GuardianBondUpdated { guardian: b.guardian, amount: b.amount, locked: b.locked, ts: now });
        Ok(())
    }

    pub fn set_bond_locked(ctx: Context<SetBondLocked>, locked: bool) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require_not_paused(cfg.paused)?;
        require!(
            ctx.accounts.admin.key() == cfg.admin || ctx.accounts.admin.key() == cfg.arbiter,
            LegacyVaultError::Unauthorized
        );

        let now = now_ts()?;
        let b = &mut ctx.accounts.bond;
        b.locked = locked;
        b.updated_at_unix = now;
        emit!(GuardianBondUpdated { guardian: b.guardian, amount: b.amount, locked: b.locked, ts: now });
        Ok(())
    }

    pub fn withdraw_guardian_bond(ctx: Context<WithdrawGuardianBond>, lamports: u64) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require_not_paused(cfg.paused)?;
        let now = now_ts()?;

        let b = &mut ctx.accounts.bond;
        require_keys_eq!(b.guardian, ctx.accounts.guardian.key(), LegacyVaultError::Unauthorized);
        require!(!b.locked, LegacyVaultError::BondLocked);

        // ensure bond PDA retains rent min
        let rent_min = rent_min_for(GuardianBond::LEN)?;
        let bal = **ctx.accounts.bond.to_account_info().try_borrow_lamports()?;
        require!(bal.saturating_sub(rent_min) >= lamports, LegacyVaultError::BondInsufficient);
        require!(b.amount >= lamports, LegacyVaultError::BondInsufficient);

        **ctx.accounts.bond.to_account_info().try_borrow_mut_lamports()? -= lamports;
        **ctx.accounts.guardian.to_account_info().try_borrow_mut_lamports()? += lamports;

        b.amount = b.amount.checked_sub(lamports).ok_or(LegacyVaultError::MathOverflow)?;
        b.updated_at_unix = now;

        emit!(GuardianBondUpdated { guardian: b.guardian, amount: b.amount, locked: b.locked, ts: now });
        Ok(())
    }

    pub fn slash_guardian_bond(ctx: Context<SlashGuardianBond>, lamports: u64) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require_not_paused(cfg.paused)?;
        require_keys_eq!(cfg.arbiter, ctx.accounts.arbiter.key(), LegacyVaultError::Unauthorized);

        let now = now_ts()?;
        let b = &mut ctx.accounts.bond;

        let rent_min = rent_min_for(GuardianBond::LEN)?;
        let bal = **ctx.accounts.bond.to_account_info().try_borrow_lamports()?;
        require!(bal.saturating_sub(rent_min) >= lamports, LegacyVaultError::BondInsufficient);
        require!(b.amount >= lamports, LegacyVaultError::BondInsufficient);

        **ctx.accounts.bond.to_account_info().try_borrow_mut_lamports()? -= lamports;
        **ctx.accounts.treasury.to_account_info().try_borrow_mut_lamports()? += lamports;

        b.amount = b.amount.checked_sub(lamports).ok_or(LegacyVaultError::MathOverflow)?;
        b.updated_at_unix = now;

        emit!(GuardianBondUpdated { guardian: b.guardian, amount: b.amount, locked: b.locked, ts: now });
        Ok(())
    }
}

// ============================================================
// Contexts
// ============================================================

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(init, payer = admin, space = GlobalConfig::LEN, seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, GlobalConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    /// CHECK: treasury system account
    #[account(mut)]
    pub treasury: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetPaused<'info> {
    #[account(mut, seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, GlobalConfig>,
    pub admin: Signer<'info>,
}
#[derive(Accounts)]
pub struct SetArbiter<'info> {
    #[account(mut, seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, GlobalConfig>,
    pub admin: Signer<'info>,
}
#[derive(Accounts)]
pub struct SetFees<'info> {
    #[account(mut, seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, GlobalConfig>,
    pub admin: Signer<'info>,
}
#[derive(Accounts)]
pub struct SetBounds<'info> {
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

    /// CHECK: PDA authority for token accounts
    #[account(seeds = [VAULT_AUTH_SEED, vault.key().as_ref()], bump)]
    pub vault_auth: UncheckedAccount<'info>,

    #[account(
        init,
        payer = owner,
        space = VaultIndex::LEN,
        seeds = [INDEX_SEED, vault.key().as_ref()],
        bump
    )]
    pub index: Account<'info, VaultIndex>,

    #[account(mut)]
    pub owner: Signer<'info>,

    /// CHECK
    #[account(mut, address = config.treasury)]
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseVault<'info> {
    #[account(seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, GlobalConfig>,
    #[account(mut)]
    pub vault: Account<'info, Vault>,
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
pub struct AddGuardian<'info> {
    #[account(seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, GlobalConfig>,
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    #[account(mut, seeds = [INDEX_SEED, vault.key().as_ref()], bump)]
    pub index: Account<'info, VaultIndex>,

    #[account(
        init,
        payer = owner,
        space = GuardianEntry::LEN,
        seeds = [GUARDIAN_SEED, vault.key().as_ref(), guardian.key().as_ref()],
        bump
    )]
    pub guardian_entry: Account<'info, GuardianEntry>,

    /// CHECK
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
    #[account(mut, seeds = [INDEX_SEED, vault.key().as_ref()], bump)]
    pub index: Account<'info, VaultIndex>,

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
    #[account(seeds = [INDEX_SEED, vault.key().as_ref()], bump)]
    pub index: Account<'info, VaultIndex>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct AddBeneficiary<'info> {
    #[account(seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, GlobalConfig>,
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    #[account(mut, seeds = [INDEX_SEED, vault.key().as_ref()], bump)]
    pub index: Account<'info, VaultIndex>,

    #[account(
        init,
        payer = owner,
        space = BeneficiaryEntry::LEN,
        seeds = [BENEFICIARY_SEED, vault.key().as_ref(), beneficiary.key().as_ref()],
        bump
    )]
    pub beneficiary_entry: Account<'info, BeneficiaryEntry>,

    /// CHECK
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
    #[account(mut, seeds = [INDEX_SEED, vault.key().as_ref()], bump)]
    pub index: Account<'info, VaultIndex>,

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
    #[account(mut, seeds = [INDEX_SEED, vault.key().as_ref()], bump)]
    pub index: Account<'info, VaultIndex>,

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
pub struct AssertBeneficiaryTotal10k<'info> {
    #[account(seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, GlobalConfig>,
    pub vault: Account<'info, Vault>,
    #[account(seeds = [INDEX_SEED, vault.key().as_ref()], bump)]
    pub index: Account<'info, VaultIndex>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetAssetRule<'info> {
    #[account(seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, GlobalConfig>,
    pub vault: Account<'info, Vault>,
    #[account(seeds = [INDEX_SEED, vault.key().as_ref()], bump)]
    pub index: Account<'info, VaultIndex>,
    pub mint: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = owner,
        space = AssetRule::LEN,
        seeds = [ASSET_RULE_SEED, vault.key().as_ref(), mint.key().as_ref()],
        bump
    )]
    pub asset_rule: Account<'info, AssetRule>,

    /// CHECK
    pub assigned_beneficiary: UncheckedAccount<'info>,

    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClearAssetRule<'info> {
    #[account(seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, GlobalConfig>,
    pub vault: Account<'info, Vault>,
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [ASSET_RULE_SEED, vault.key().as_ref(), mint.key().as_ref()],
        bump,
        close = owner
    )]
    pub asset_rule: Account<'info, AssetRule>,
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
    pub vault: Account<'info, Vault>,

    /// CHECK
    #[account(seeds = [VAULT_AUTH_SEED, vault.key().as_ref()], bump)]
    pub vault_auth: UncheckedAccount<'info>,

    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(mut, associated_token::mint = mint, associated_token::authority = owner)]
    pub owner_ata: Account<'info, TokenAccount>,

    #[account(init_if_needed, payer = owner, associated_token::mint = mint, associated_token::authority = vault_auth)]
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
    pub vault: Account<'info, Vault>,

    /// CHECK
    #[account(seeds = [VAULT_AUTH_SEED, vault.key().as_ref()], bump)]
    pub vault_auth: UncheckedAccount<'info>,

    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(init_if_needed, payer = owner, associated_token::mint = mint, associated_token::authority = owner)]
    pub owner_ata: Account<'info, TokenAccount>,

    #[account(mut, associated_token::mint = mint, associated_token::authority = vault_auth)]
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
    pub vault: Account<'info, Vault>,

    #[account(
        init,
        payer = owner,
        space = LivenessDelegate::LEN,
        seeds = [DELEGATE_SEED, vault.key().as_ref(), delegate.key().as_ref()],
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
    pub vault: Account<'info, Vault>,
    #[account(
        mut,
        seeds = [DELEGATE_SEED, vault.key().as_ref(), delegate.key().as_ref()],
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
    #[account(seeds = [DELEGATE_SEED, vault.key().as_ref(), delegate.key().as_ref()], bump)]
    pub delegate_entry: Account<'info, LivenessDelegate>,
    pub delegate: Signer<'info>,
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
pub struct OpenDispute<'info> {
    #[account(seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, GlobalConfig>,
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
pub struct InitDistributionSolSession<'info> {
    #[account(seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, GlobalConfig>,
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    pub unlock: Account<'info, UnlockSession>,
    #[account(
        init,
        payer = payer,
        space = DistributionSolSession::LEN,
        seeds = [DIST_SOL_SEED, unlock.key().as_ref()],
        bump
    )]
    pub dist_sol: Account<'info, DistributionSolSession>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExecuteDistributionSolBatch<'info> {
    #[account(seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, GlobalConfig>,
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    pub unlock: Account<'info, UnlockSession>,
    pub index: Account<'info, VaultIndex>,
    #[account(mut, seeds = [DIST_SOL_SEED, unlock.key().as_ref()], bump)]
    pub dist_sol: Account<'info, DistributionSolSession>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitDistributionSplSession<'info> {
    #[account(seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, GlobalConfig>,
    pub vault: Account<'info, Vault>,
    pub unlock: Account<'info, UnlockSession>,

    /// CHECK
    #[account(seeds = [VAULT_AUTH_SEED, vault.key().as_ref()], bump)]
    pub vault_auth: UncheckedAccount<'info>,

    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = payer,
        space = DistributionSplSession::LEN,
        seeds = [DIST_SPL_SEED, unlock.key().as_ref(), mint.key().as_ref()],
        bump
    )]
    pub dist_spl: Account<'info, DistributionSplSession>,

    #[account(
        associated_token::mint = mint,
        associated_token::authority = vault_auth
    )]
    pub vault_ata: Account<'info, TokenAccount>,

    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExecuteDistributionSplBatch<'info> {
    #[account(seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, GlobalConfig>,

    pub vault: Account<'info, Vault>,

    /// CHECK
    #[account(seeds = [VAULT_AUTH_SEED, vault.key().as_ref()], bump)]
    pub vault_auth: UncheckedAccount<'info>,

    pub unlock: Account<'info, UnlockSession>,
    pub index: Account<'info, VaultIndex>,

    pub mint: Account<'info, Mint>,

    #[account(mut, seeds = [DIST_SPL_SEED, unlock.key().as_ref(), mint.key().as_ref()], bump)]
    pub dist_spl: Account<'info, DistributionSplSession>,

    #[account(mut, associated_token::mint = mint, associated_token::authority = vault_auth)]
    pub vault_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct FinalizeUnlock<'info> {
    #[account(seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, GlobalConfig>,
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub unlock: Account<'info, UnlockSession>,
    pub dist_sol: Account<'info, DistributionSolSession>,
    // remaining accounts: DistributionSplSession accounts
}

#[derive(Accounts)]
pub struct SetSubscription<'info> {
    #[account(seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, GlobalConfig>,
    pub vault: Account<'info, Vault>,
    #[account(
        init_if_needed,
        payer = payer,
        space = Subscription::LEN,
        seeds = [SUBSCRIPTION_SEED, vault.key().as_ref()],
        bump
    )]
    pub subscription: Account<'info, Subscription>,
    pub authority: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RenewSubscription<'info> {
    #[account(seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, GlobalConfig>,
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
    /// CHECK
    #[account(mut, address = config.treasury)]
    pub treasury: UncheckedAccount<'info>,
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
pub struct SetGuardianKycLevel<'info> {
    #[account(seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, GlobalConfig>,
    pub admin: Signer<'info>,
    #[account(mut)]
    pub profile: Account<'info, GuardianProfile>,
}

#[derive(Accounts)]
pub struct CreateOrTopupGuardianBond<'info> {
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

#[derive(Accounts)]
pub struct SetBondLocked<'info> {
    #[account(seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, GlobalConfig>,
    pub admin: Signer<'info>,
    #[account(mut)]
    pub bond: Account<'info, GuardianBond>,
}

#[derive(Accounts)]
pub struct WithdrawGuardianBond<'info> {
    #[account(seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, GlobalConfig>,
    #[account(mut)]
    pub bond: Account<'info, GuardianBond>,
    #[account(mut)]
    pub guardian: Signer<'info>,
}

#[derive(Accounts)]
pub struct SlashGuardianBond<'info> {
    #[account(seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, GlobalConfig>,
    pub arbiter: Signer<'info>,
    #[account(mut)]
    pub bond: Account<'info, GuardianBond>,
    /// CHECK
    #[account(mut, address = config.treasury)]
    pub treasury: UncheckedAccount<'info>,
}
2) TypeScript SDK (transaction builders + distribution batching)
This SDK assumes you have an Anchor Program instance for LegacyVault (IDL generated).

2.1 sdk/legacyvault/pdas.ts
TypeScript

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
2.2 sdk/legacyvault/types.ts
TypeScript

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
2.3 sdk/legacyvault/tx.ts (core tx builders)
TypeScript

import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import BN from "bn.js";
import {
  approvalPda, assetRulePda, beneficiaryEntryPda, configPda, delegateEntryPda,
  distSolPda, distSplPda, guardianBondPda, guardianEntryPda, guardianProfilePda,
  indexPda, subscriptionPda, unlockPda, vaultAuthPda, vaultPda,
} from "./pdas";

export async function ixCreateVault(args: {
  program: Program;
  owner: PublicKey;
  vaultId: bigint;
  heartbeatSecs: number;
  inactivitySecs: number;
  timelockSecs: number;
  panicEnabled: boolean;
}) {
  const { program, owner, vaultId } = args;
  const [cfg] = configPda(program.programId);
  const [vault] = vaultPda(program.programId, owner, vaultId);
  const [vaultAuth] = vaultAuthPda(program.programId, vault);
  const [index] = indexPda(program.programId, vault);

  // treasury is read from config on-chain, but the context expects it; easiest is fetch config
  const cfgAcc: any = await program.account.globalConfig.fetch(cfg);
  const treasury = cfgAcc.treasury as PublicKey;

  return program.methods
    .createVault(
      new BN(vaultId.toString()),
      args.heartbeatSecs,
      args.inactivitySecs,
      args.timelockSecs,
      args.panicEnabled
    )
    .accounts({
      config: cfg,
      vault,
      vaultAuth,
      index,
      owner,
      treasury,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function ixAddBeneficiary(args: {
  program: Program;
  owner: PublicKey;
  vault: PublicKey;
  beneficiary: PublicKey;
  shareBps: number;
  label16: number[]; // length 16
}) {
  const [cfg] = configPda(args.program.programId);
  const [index] = indexPda(args.program.programId, args.vault);
  const [be] = beneficiaryEntryPda(args.program.programId, args.vault, args.beneficiary);

  return args.program.methods
    .addBeneficiary(args.shareBps, args.label16)
    .accounts({
      config: cfg,
      vault: args.vault,
      index,
      beneficiaryEntry: be,
      beneficiary: args.beneficiary,
      owner: args.owner,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function ixUpdateBeneficiary(args: {
  program: Program;
  owner: PublicKey;
  vault: PublicKey;
  beneficiary: PublicKey;
  shareBps: number;
  label16: number[];
  active: boolean;
}) {
  const [cfg] = configPda(args.program.programId);
  const [index] = indexPda(args.program.programId, args.vault);
  const [be] = beneficiaryEntryPda(args.program.programId, args.vault, args.beneficiary);

  return args.program.methods
    .updateBeneficiary(args.shareBps, args.label16, args.active)
    .accounts({
      config: cfg,
      vault: args.vault,
      index,
      beneficiaryEntry: be,
      beneficiary: args.beneficiary,
      owner: args.owner,
    })
    .instruction();
}

export async function ixAddGuardian(args: {
  program: Program;
  owner: PublicKey;
  vault: PublicKey;
  guardian: PublicKey;
  role: number; // enum
}) {
  const [cfg] = configPda(args.program.programId);
  const [index] = indexPda(args.program.programId, args.vault);
  const [ge] = guardianEntryPda(args.program.programId, args.vault, args.guardian);

  return args.program.methods
    .addGuardian(args.role)
    .accounts({
      config: cfg,
      vault: args.vault,
      index,
      guardianEntry: ge,
      guardian: args.guardian,
      owner: args.owner,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function ixSetGuardianThreshold(args: {
  program: Program;
  owner: PublicKey;
  vault: PublicKey;
  threshold: number;
}) {
  const [cfg] = configPda(args.program.programId);
  const [index] = indexPda(args.program.programId, args.vault);

  return args.program.methods
    .setGuardianThreshold(args.threshold)
    .accounts({
      config: cfg,
      vault: args.vault,
      index,
      owner: args.owner,
    })
    .instruction();
}

export async function ixDepositSpl(args: {
  program: Program;
  owner: PublicKey;
  vault: PublicKey;
  mint: PublicKey;
  amount: BN;
}) {
  const [cfg] = configPda(args.program.programId);
  const [vaultAuth] = vaultAuthPda(args.program.programId, args.vault);

  const ownerAta = getAssociatedTokenAddressSync(args.mint, args.owner);
  const vaultAta = getAssociatedTokenAddressSync(args.mint, vaultAuth, true);

  return args.program.methods
    .depositSpl(args.amount)
    .accounts({
      config: cfg,
      vault: args.vault,
      vaultAuth,
      mint: args.mint,
      owner: args.owner,
      ownerAta,
      vaultAta,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"),
      systemProgram: SystemProgram.programId,
      rent: PublicKey.default,
    })
    .instruction();
}

export async function ixInitiateUnlock(args: {
  program: Program;
  vault: PublicKey;
  guardian: PublicKey;
  nonce: bigint; // caller usually fetches vault.currentNonce and adds 1
}) {
  const [cfg] = configPda(args.program.programId);
  const [ge] = guardianEntryPda(args.program.programId, args.vault, args.guardian);
  const [unlock] = unlockPda(args.program.programId, args.vault, args.nonce);

  return args.program.methods
    .initiateUnlock()
    .accounts({
      config: cfg,
      vault: args.vault,
      guardianEntry: ge,
      unlock,
      guardian: args.guardian,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function ixApproveUnlock(args: {
  program: Program;
  vault: PublicKey;
  unlock: PublicKey;
  guardian: PublicKey;
}) {
  const [cfg] = configPda(args.program.programId);
  const [ge] = guardianEntryPda(args.program.programId, args.vault, args.guardian);
  const [approval] = approvalPda(args.program.programId, args.unlock, args.guardian);

  return args.program.methods
    .approveUnlock()
    .accounts({
      config: cfg,
      vault: args.vault,
      guardianEntry: ge,
      unlock: args.unlock,
      approval,
      guardian: args.guardian,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function ixInitDistSol(args: {
  program: Program;
  vault: PublicKey;
  unlock: PublicKey;
  payer: PublicKey;
}) {
  const [cfg] = configPda(args.program.programId);
  const [distSol] = distSolPda(args.program.programId, args.unlock);

  return args.program.methods
    .initDistributionSolSession()
    .accounts({
      config: cfg,
      vault: args.vault,
      unlock: args.unlock,
      distSol,
      payer: args.payer,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function ixInitDistSpl(args: {
  program: Program;
  vault: PublicKey;
  unlock: PublicKey;
  mint: PublicKey;
  payer: PublicKey;
}) {
  const [cfg] = configPda(args.program.programId);
  const [vaultAuth] = vaultAuthPda(args.program.programId, args.vault);
  const [distSpl] = distSplPda(args.program.programId, args.unlock, args.mint);
  const vaultAta = getAssociatedTokenAddressSync(args.mint, vaultAuth, true);

  return args.program.methods
    .initDistributionSplSession()
    .accounts({
      config: cfg,
      vault: args.vault,
      unlock: args.unlock,
      vaultAuth,
      mint: args.mint,
      distSpl,
      vaultAta,
      payer: args.payer,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}
2.4 sdk/legacyvault/distribute.ts (batch builders)
This is the part that actually builds the remaining accounts lists correctly using VaultIndex ordering.

TypeScript

import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import BN from "bn.js";
import { beneficiaryEntryPda, configPda, distSolPda, distSplPda, indexPda, vaultAuthPda } from "./pdas";

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

  const index: any = await program.account.vaultIndex.fetch(indexAddr);
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

  const index: any = await program.account.vaultIndex.fetch(indexAddr);
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



