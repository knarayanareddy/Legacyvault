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

    pub treasury: Pubkey,
    pub create_fee_lamports: u64,

    pub min_heartbeat_secs: u32,
    pub max_heartbeat_secs: u32,
    pub min_inactivity_secs: u32,
    pub max_inactivity_secs: u32,
    pub min_timelock_secs: u32,
    pub max_timelock_secs: u32,

    pub arbiter: Pubkey,

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

    pub guardian_threshold: u8,
    pub guardians_count: u16,
    pub beneficiaries_count: u16,

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
    pub guardians: Vec<Pubkey>,

    // Sorted list of active beneficiaries
    pub beneficiaries: Vec<Pubkey>,

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
    pub assigned_beneficiary: Pubkey,
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
    pub plan_id: u8,
    pub valid_until_unix: i64,
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
    pub amount: u64,
    pub locked: bool,
    pub updated_at_unix: i64,
}
impl GuardianBond {
    pub const LEN: usize = 8 + 32 + 8 + 1 + 8;
}
