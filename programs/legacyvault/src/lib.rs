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

declare_id!("LGCYVauLt1111111111111111111111111111111111");

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
    pub fn assert_beneficiary_total_10k<'info>(ctx: Context<'_, '_, 'info, 'info, AssertBeneficiaryTotal10k<'info>>) -> Result<()> {
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

        let vault_key = ctx.accounts.vault.key();
        let signer_seeds: &[&[&[u8]]] = &[&[
            VAULT_AUTH_SEED,
            vault_key.as_ref(),
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
        emit!(CheckInEvent { vault: v.key(), by: v.owner, ts: v.last_checkin_unix });
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
        emit!(CheckInEvent { vault: v.key(), by: ctx.accounts.delegate.key(), ts: v.last_checkin_unix });
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
    pub fn execute_distribution_sol_batch<'info>(ctx: Context<'_, '_, 'info, 'info, ExecuteDistributionSolBatch<'info>>, start_index: u32, batch_size: u16) -> Result<()> {
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
    pub fn execute_distribution_spl_batch<'info>(ctx: Context<'_, '_, 'info, 'info, ExecuteDistributionSplBatch<'info>>, start_index: u32, batch_size: u16) -> Result<()> {
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

        let vault_key = ctx.accounts.vault.key();
        let signer_seeds: &[&[&[u8]]] = &[&[
            VAULT_AUTH_SEED,
            vault_key.as_ref(),
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

    pub fn finalize_unlock<'info>(ctx: Context<'_, '_, 'info, 'info, FinalizeUnlock<'info>>) -> Result<()> {
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

        let bal = **ctx.accounts.bond.to_account_info().try_borrow_lamports()?;
        let b = &mut ctx.accounts.bond;

        require_keys_eq!(b.guardian, ctx.accounts.guardian.key(), LegacyVaultError::Unauthorized);
        require!(!b.locked, LegacyVaultError::BondLocked);

        // ensure bond PDA retains rent min
        let rent_min = rent_min_for(GuardianBond::LEN)?;
        require!(bal.saturating_sub(rent_min) >= lamports, LegacyVaultError::BondInsufficient);
        require!(b.amount >= lamports, LegacyVaultError::BondInsufficient);

        b.amount = b.amount.checked_sub(lamports).ok_or(LegacyVaultError::MathOverflow)?;
        b.updated_at_unix = now;

        let guardian_key = b.guardian;
        let amount = b.amount;
        let locked = b.locked;
        drop(b);

        **ctx.accounts.bond.to_account_info().try_borrow_mut_lamports()? -= lamports;
        **ctx.accounts.guardian.to_account_info().try_borrow_mut_lamports()? += lamports;

        emit!(GuardianBondUpdated { guardian: guardian_key, amount, locked, ts: now });
        Ok(())
    }

    pub fn slash_guardian_bond(ctx: Context<SlashGuardianBond>, lamports: u64) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require_not_paused(cfg.paused)?;
        require_keys_eq!(cfg.arbiter, ctx.accounts.arbiter.key(), LegacyVaultError::Unauthorized);

        let now = now_ts()?;

        let bal = **ctx.accounts.bond.to_account_info().try_borrow_lamports()?;
        let rent_min = rent_min_for(GuardianBond::LEN)?;
        let b = &mut ctx.accounts.bond;

        require!(bal.saturating_sub(rent_min) >= lamports, LegacyVaultError::BondInsufficient);
        require!(b.amount >= lamports, LegacyVaultError::BondInsufficient);

        b.amount = b.amount.checked_sub(lamports).ok_or(LegacyVaultError::MathOverflow)?;
        b.updated_at_unix = now;

        let guardian_key = b.guardian;
        let amount = b.amount;
        let locked = b.locked;
        drop(b);

        **ctx.accounts.bond.to_account_info().try_borrow_mut_lamports()? -= lamports;
        **ctx.accounts.treasury.to_account_info().try_borrow_mut_lamports()? += lamports;

        emit!(GuardianBondUpdated { guardian: guardian_key, amount, locked, ts: now });
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

        #[account(mut)]
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

    #[account(mut)]
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

    #[account(mut)]
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

    #[account(mut)]
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
