-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vault" (
    "id" TEXT NOT NULL,
    "vaultPubkey" TEXT NOT NULL,
    "ownerWallet" TEXT NOT NULL,
    "vaultIdU64" TEXT,
    "status" TEXT NOT NULL,
    "lastCheckinUnix" BIGINT,
    "heartbeatIntervalSecs" INTEGER,
    "inactivityThresholdSecs" INTEGER,
    "timelockSecs" INTEGER,
    "guardianThreshold" INTEGER,
    "panicEnabled" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guardian" (
    "id" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "guardian" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Guardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Beneficiary" (
    "id" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "beneficiary" TEXT NOT NULL,
    "shareBps" INTEGER NOT NULL,
    "label" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Beneficiary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnlockSession" (
    "id" TEXT NOT NULL,
    "unlockPubkey" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "nonceU64" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "initiatedBy" TEXT NOT NULL,
    "initiatedAtUnix" BIGINT NOT NULL,
    "approvals" INTEGER NOT NULL,
    "threshold" INTEGER NOT NULL,
    "approvedAtUnix" BIGINT,
    "executableAtUnix" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnlockSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "unlockId" TEXT NOT NULL,
    "guardian" TEXT NOT NULL,
    "approvedAtUnix" BIGINT NOT NULL,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistributionSolSession" (
    "id" TEXT NOT NULL,
    "unlockId" TEXT NOT NULL,
    "totalDistributable" BIGINT NOT NULL,
    "paidTotal" BIGINT NOT NULL,
    "cursor" INTEGER NOT NULL,
    "done" BOOLEAN NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistributionSolSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistributionSplSession" (
    "id" TEXT NOT NULL,
    "unlockId" TEXT NOT NULL,
    "mint" TEXT NOT NULL,
    "totalBalance" BIGINT NOT NULL,
    "paidTotal" BIGINT NOT NULL,
    "cursor" INTEGER NOT NULL,
    "done" BOOLEAN NOT NULL,

    CONSTRAINT "DistributionSplSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisputeCase" (
    "id" TEXT NOT NULL,
    "unlockId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "openedBy" TEXT NOT NULL,
    "openedAtUnix" BIGINT NOT NULL,
    "noteHashHex" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "DisputeCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "planId" INTEGER NOT NULL,
    "validUntilUnix" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuardianProfile" (
    "id" TEXT NOT NULL,
    "guardian" TEXT NOT NULL,
    "displayName" TEXT,
    "websiteUri" TEXT,
    "kycLevel" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuardianProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuardianBond" (
    "id" TEXT NOT NULL,
    "guardian" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "locked" BOOLEAN NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuardianBond_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventLog" (
    "id" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "slot" BIGINT NOT NULL,
    "programId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "dataJson" JSONB NOT NULL,
    "blockTime" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndexerCursor" (
    "id" TEXT NOT NULL,
    "lastSlot" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndexerCursor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedTx" (
    "signature" TEXT NOT NULL,
    "slot" BIGINT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedTx_pkey" PRIMARY KEY ("signature")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "docHashHex" TEXT NOT NULL,
    "uri" TEXT,
    "uriLen" INTEGER NOT NULL,
    "tsUnix" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetRule" (
    "id" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "mint" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "assignedBeneficiary" TEXT NOT NULL,
    "tsUnix" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_wallet_key" ON "User"("wallet");

-- CreateIndex
CREATE UNIQUE INDEX "Session_jti_key" ON "Session"("jti");

-- CreateIndex
CREATE UNIQUE INDEX "Vault_vaultPubkey_key" ON "Vault"("vaultPubkey");

-- CreateIndex
CREATE UNIQUE INDEX "Guardian_vaultId_guardian_key" ON "Guardian"("vaultId", "guardian");

-- CreateIndex
CREATE UNIQUE INDEX "Beneficiary_vaultId_beneficiary_key" ON "Beneficiary"("vaultId", "beneficiary");

-- CreateIndex
CREATE UNIQUE INDEX "UnlockSession_unlockPubkey_key" ON "UnlockSession"("unlockPubkey");

-- CreateIndex
CREATE UNIQUE INDEX "Approval_unlockId_guardian_key" ON "Approval"("unlockId", "guardian");

-- CreateIndex
CREATE UNIQUE INDEX "DistributionSolSession_unlockId_key" ON "DistributionSolSession"("unlockId");

-- CreateIndex
CREATE UNIQUE INDEX "DistributionSplSession_unlockId_mint_key" ON "DistributionSplSession"("unlockId", "mint");

-- CreateIndex
CREATE UNIQUE INDEX "DisputeCase_unlockId_key" ON "DisputeCase"("unlockId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_vaultId_planId_key" ON "Subscription"("vaultId", "planId");

-- CreateIndex
CREATE UNIQUE INDEX "GuardianProfile_guardian_key" ON "GuardianProfile"("guardian");

-- CreateIndex
CREATE UNIQUE INDEX "GuardianBond_guardian_key" ON "GuardianBond"("guardian");

-- CreateIndex
CREATE UNIQUE INDEX "EventLog_signature_key" ON "EventLog"("signature");

-- CreateIndex
CREATE UNIQUE INDEX "Document_vaultId_docHashHex_key" ON "Document"("vaultId", "docHashHex");

-- CreateIndex
CREATE UNIQUE INDEX "AssetRule_vaultId_mint_key" ON "AssetRule"("vaultId", "mint");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guardian" ADD CONSTRAINT "Guardian_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "Vault"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Beneficiary" ADD CONSTRAINT "Beneficiary_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "Vault"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnlockSession" ADD CONSTRAINT "UnlockSession_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "Vault"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_unlockId_fkey" FOREIGN KEY ("unlockId") REFERENCES "UnlockSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributionSolSession" ADD CONSTRAINT "DistributionSolSession_unlockId_fkey" FOREIGN KEY ("unlockId") REFERENCES "UnlockSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributionSplSession" ADD CONSTRAINT "DistributionSplSession_unlockId_fkey" FOREIGN KEY ("unlockId") REFERENCES "UnlockSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeCase" ADD CONSTRAINT "DisputeCase_unlockId_fkey" FOREIGN KEY ("unlockId") REFERENCES "UnlockSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "Vault"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "Vault"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetRule" ADD CONSTRAINT "AssetRule_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "Vault"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
