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
pub const MAX_GUARDIANS: usize = 50;
pub const MAX_BENEFICIARIES: usize = 50;
