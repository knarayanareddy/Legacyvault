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
pub struct CheckInEvent { pub vault: Pubkey, pub by: Pubkey, pub ts: i64 }

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
