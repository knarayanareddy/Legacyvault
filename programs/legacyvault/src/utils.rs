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
