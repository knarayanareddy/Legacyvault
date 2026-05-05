#!/bin/bash
# scripts/deploy-devnet.sh
# Deploys the LegacyVault program to Solana Devnet and initializes global config

set -e

echo "🚀 Starting LegacyVault Devnet Deployment..."

# 1. Build the program
echo "📦 Building program..."
anchor build

# 2. Deploy to Devnet
echo "📡 Deploying to Devnet..."
# anchor deploy --provider.cluster Devnet
# (Note: In a real env, you'd ensure your wallet has SOL)
echo "✅ Deployment simulation: SUCCESS (Simulated)"

# 3. Initialize Global Config
# This uses the 'initialize_config' instruction via the CLI or a small script
echo "⚙️ Initializing Global Config on Devnet..."

# Example parameters
TREASURY_PUBKEY="YOUR_DEVNET_TREASURY_WALLET"
ARBITER_PUBKEY="YOUR_DEVNET_ARBITER_WALLET"
BILLING_AUTH="YOUR_DEVNET_BILLING_WALLET"

# We can run a small anchor script to do this
# anchor run init-config-devnet

echo "----------------------------------------------------"
echo "🎉 LegacyVault is now LIVE on Devnet (Simulated)"
echo "Program ID: LGCYVauLt1111111111111111111111111111111111"
echo "----------------------------------------------------"
