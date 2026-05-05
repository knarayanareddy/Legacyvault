#!/bin/bash
# scripts/audit-prepare.sh
# Automated security and readiness check for LegacyVault Protocol

set -e

echo "----------------------------------------------------"
echo "🔍 LegacyVault Protocol: Production Audit Prep"
echo "----------------------------------------------------"

# 1. Rust Security Audit
echo "[1/4] Auditing Rust Dependencies (Crates)..."
if command -v cargo-audit &> /dev/null; then
    cargo audit
else
    echo "⚠️ cargo-audit not installed. Skipping. (Install with: cargo install cargo-audit)"
fi

# 2. Node.js Security Audit
echo "[2/4] Auditing Node.js Dependencies (pnpm)..."
pnpm audit --prod

# 3. Smart Contract Security Suite
echo "[3/4] Running On-Chain Security Test Suite..."
# Note: Requires local validator or devnet RPC
if command -v anchor &> /dev/null; then
    anchor test tests/security.ts
else
    echo "⚠️ Anchor CLI not found. Skipping on-chain tests."
fi

# 4. Static Analysis (Rust)
echo "[4/4] Running Clippy for Program Code..."
cd programs/legacyvault
cargo clippy -- -D warnings
cd ../..

echo "----------------------------------------------------"
echo "✅ Audit Prep Complete. Review findings above."
echo "----------------------------------------------------"
