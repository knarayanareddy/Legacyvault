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
