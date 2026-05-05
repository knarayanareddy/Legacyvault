import { useState, useCallback, useEffect } from 'react';
import type { VaultState, Guardian, Beneficiary, VaultDocument, DistributionBatch } from '../types';
import {
  mockVault, mockGuardians, mockBeneficiaries, mockDocuments,
  mockDistributionBatches, mockNotifications, mockActivity
} from '../data/mockData';
import { useLegacyVault } from './useLegacyVault';
import { PublicKey } from '@solana/web3.js';

export function useVaultState() {
  const { program, wallet } = useLegacyVault();
  const [vault, setVault] = useState<VaultState>(mockVault);
  const [guardians, setGuardians] = useState<Guardian[]>(mockGuardians);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>(mockBeneficiaries);
  const [documents] = useState<VaultDocument[]>(mockDocuments);
  const [distributionBatches, setDistributionBatches] = useState<DistributionBatch[]>(mockDistributionBatches);
  const [notifications] = useState(mockNotifications);
  const [activity] = useState(mockActivity);
  const [selectedMints, setSelectedMints] = useState<Record<string, boolean>>({});
  const [createMissingAtas, setCreateMissingAtas] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  const toggleBeneficiaryActive = useCallback((id: string) => {
    setBeneficiaries(prev => prev.map(b =>
      b.id === id ? { ...b, active: !b.active } : b
    ));
  }, []);

  const updateBeneficiaryShare = useCallback((id: string, shareBps: number) => {
    setBeneficiaries(prev => prev.map(b =>
      b.id === id ? { ...b, shareBps } : b
    ));
  }, []);

  const toggleGuardianApproval = useCallback(async (id: string) => {
    if (program && wallet) {
      try {
        const guardian = guardians.find(g => g.id === id);
        if (!guardian) return;

        const [vaultPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("vault"), wallet.publicKey.toBuffer(), Buffer.from([0])],
          program.programId
        );

        const [unlockPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("unlock"), vaultPda.toBuffer(), Buffer.from([0, 0, 0, 0, 0, 0, 0, 0])], // nonce 0
          program.programId
        );

        const [approvalPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("approval"), unlockPda.toBuffer(), new PublicKey(guardian.pubkey).toBuffer()],
          program.programId
        );

        const [guardianEntryPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("guardian"), vaultPda.toBuffer(), new PublicKey(guardian.pubkey).toBuffer()],
          program.programId
        );

        await program.methods
          .approveUnlock()
          .accounts({
            vault: vaultPda,
            unlockSession: unlockPda,
            approval: approvalPda,
            guardianEntry: guardianEntryPda,
            guardian: wallet.publicKey,
          })
          .rpc();
          
        console.log("On-chain approval successful");
      } catch (err) {
        console.error("On-chain approval failed:", err);
      }
    }

    setGuardians(prev => prev.map(g =>
      g.id === id ? { ...g, approved: !g.approved, approvalTime: !g.approved ? Date.now() : null } : g
    ));
  }, [program, wallet, guardians]);

  const initiateUnlock = useCallback(async () => {
    if (program && wallet) {
      try {
        const [vaultPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("vault"), wallet.publicKey.toBuffer(), Buffer.from([0])],
          program.programId
        );

        const [unlockPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("unlock"), vaultPda.toBuffer(), Buffer.from([0, 0, 0, 0, 0, 0, 0, 0])],
          program.programId
        );

        const [guardianEntryPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("guardian"), vaultPda.toBuffer(), wallet.publicKey.toBuffer()],
          program.programId
        );

        await program.methods
          .initiateUnlock()
          .accounts({
            vault: vaultPda,
            unlockSession: unlockPda,
            guardianEntry: guardianEntryPda,
            guardian: wallet.publicKey,
          })
          .rpc();
          
        console.log("On-chain unlock initiated");
      } catch (err) {
        console.error("On-chain unlock initiation failed:", err);
      }
    }

    setVault(prev => ({
      ...prev,
      state: 'unlocking' as const,
      timelockStart: Date.now(),
    }));
  }, [program, wallet]);

  const cancelUnlock = useCallback(async () => {
    if (program && wallet) {
      try {
        const [vaultPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("vault"), wallet.publicKey.toBuffer(), Buffer.from([0])],
          program.programId
        );

        const [unlockPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("unlock"), vaultPda.toBuffer(), Buffer.from([0, 0, 0, 0, 0, 0, 0, 0])],
          program.programId
        );

        await program.methods
          .cancelUnlock()
          .accounts({
            vault: vaultPda,
            unlockSession: unlockPda,
            owner: wallet.publicKey,
          })
          .rpc();
          
        console.log("On-chain unlock cancelled");
      } catch (err) {
        console.error("On-chain unlock cancellation failed:", err);
      }
    }

    setVault(prev => ({
      ...prev,
      state: 'locked' as const,
      timelockStart: null,
    }));
  }, [program, wallet]);

  const freezeVault = useCallback(async () => {
    if (program && wallet) {
      try {
        const [vaultPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("vault"), wallet.publicKey.toBuffer(), Buffer.from([0])],
          program.programId
        );

        await program.methods
          .panicFreeze()
          .accounts({
            vault: vaultPda,
            owner: wallet.publicKey,
          })
          .rpc();
          
        console.log("On-chain vault frozen");
      } catch (err) {
        console.error("On-chain freeze failed:", err);
      }
    }

    setVault(prev => ({
      ...prev,
      state: prev.state === 'frozen' ? 'locked' : 'frozen' as const,
    }));
  }, [program, wallet]);

  const performCheckIn = useCallback(async () => {
    if (program && wallet) {
      try {
        // Find vault PDA (placeholder logic)
        const [vaultPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("vault"), wallet.publicKey.toBuffer(), Buffer.from([0])], // using vault_id 0
          program.programId
        );

        await program.methods
          .checkIn()
          .accounts({
            vault: vaultPda,
            owner: wallet.publicKey,
          })
          .rpc();
        
        console.log("On-chain check-in successful");
      } catch (err) {
        console.error("On-chain check-in failed:", err);
      }
    }

    setVault(prev => ({
      ...prev,
      lastCheckIn: Date.now(),
    }));
  }, [program, wallet]);

  const toggleMintSelection = useCallback((mint: string) => {
    setSelectedMints(prev => ({ ...prev, [mint]: !prev[mint] }));
  }, []);

  const processDistribution = useCallback((batchId: string) => {
    setDistributionBatches(prev => prev.map(b =>
      b.id === batchId ? { ...b, status: 'processing' as const } : b
    ));
    setTimeout(() => {
      setDistributionBatches(prev => prev.map(b =>
        b.id === batchId ? {
          ...b,
          status: 'completed' as const,
          txSignature: `${Math.random().toString(36).substring(2, 8)}...${Math.random().toString(36).substring(2, 6)}`
        } : b
      ));
    }, 2000);
  }, []);

  const processAllDistributions = useCallback(() => {
    setDistributionBatches(prev => prev.map(b => ({ ...b, status: 'processing' as const })));
    setTimeout(() => {
      setDistributionBatches(prev => prev.map(b => ({
        ...b,
        status: 'completed' as const,
        txSignature: `${Math.random().toString(36).substring(2, 8)}...${Math.random().toString(36).substring(2, 6)}`
      })));
    }, 3000);
  }, []);

  useEffect(() => {
    async function fetchVault() {
      if (program && wallet) {
        try {
          const [vaultPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("vault"), wallet.publicKey.toBuffer(), Buffer.from([0])],
            program.programId
          );

          const vaultAccount = await program.account.vault.fetch(vaultPda);
          
          setVault(prev => ({
            ...prev,
            pubkey: vaultPda.toBase58(),
            state: vaultAccount.status.active ? 'locked' : 
                   vaultAccount.status.unlocking ? 'unlocking' : 
                   vaultAccount.status.frozen ? 'frozen' : 'distributed',
            lastCheckIn: vaultAccount.lastCheckinUnix.toNumber() * 1000,
            inactivityThreshold: vaultAccount.inactivityThresholdSecs,
            timelockDuration: vaultAccount.timelockSecs,
            guardianThreshold: vaultAccount.guardianThreshold,
            totalGuardians: vaultAccount.guardiansCount,
            totalBeneficiaries: vaultAccount.beneficiariesCount,
          }));
        } catch (err) {
          console.warn("Could not fetch on-chain vault, using mocks:", err);
        }
      }
    }
    fetchVault();
  }, [program, wallet]);

  const daysSinceCheckIn = Math.floor((Date.now() - vault.lastCheckIn) / 86400000);
  const inactivityDays = Math.floor(vault.inactivityThreshold / 86400);
  const checkInHealth = daysSinceCheckIn < inactivityDays * 0.5 ? 'healthy' : daysSinceCheckIn < inactivityDays * 0.8 ? 'warning' : 'danger';
  const approvedGuardians = guardians.filter(g => g.approved).length;
  const unlockReady = approvedGuardians >= vault.guardianThreshold;
  const totalValue = 103701;

  return {
    vault, guardians, beneficiaries, documents, distributionBatches,
    notifications, activity, selectedMints, createMissingAtas, activeTab,
    setActiveTab, setCreateMissingAtas,
    toggleBeneficiaryActive, updateBeneficiaryShare,
    toggleGuardianApproval, initiateUnlock, cancelUnlock, freezeVault,
    performCheckIn, toggleMintSelection, processDistribution, processAllDistributions,
    daysSinceCheckIn, inactivityDays, checkInHealth, approvedGuardians,
    unlockReady, totalValue, setVault,
  };
}
