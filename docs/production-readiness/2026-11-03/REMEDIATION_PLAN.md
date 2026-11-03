# Legacyvault remediation plan

All steps are proposed. Use synthetic identities and valueless test assets; no application or chain commands were run in this review. Owner approval is required before using keys, accounts, a real deployment or beneficiary data.

## Dependency map

| Phase | Prerequisite | Exit |
|---|---|---|
| Baseline | Isolated tools and devnet/local validator decision | LV-T1 records artifacts and intended services |
| Confirmed defect | LV-T1 | LV-T2 resolves root Dockerfile ambiguity |
| Security/correctness | LV-T1 and threat model | LV-T3 proves invariants independently |
| Automation and UX | LV-T2 and LV-T3 | LV-T4 covers end-to-end and mock/live boundaries |
| Recovery and acceptance | LV-T4 and owner approvals | LV-T5 observes restore and release rollback |

### LV-T1 — Map runtime and reproduce (LV-1–LV-5)
Prerequisite: disposable environment; observed root manifests and Dockerfile.
1. Inventory service entry points, images, workspace graph, contract program IDs and configuration without exposing credentials.
2. Determine which Dockerfile each compose/build path actually uses and reproduce root parse failure in isolation.
3. Record current tests and migration behavior using synthetic data and an isolated database.
Deliverable: versioned topology and baseline. Verification: another maintainer reproduces the Dockerfile result and reviews build references.
- [ ] Root and service image paths are distinguished.
- [ ] No real keys or assets are needed for the baseline.

### LV-T2 — Correct build artifact (LV-1)
Prerequisite: LV-T1 and owner decision; observed `Dockerfile` and service Dockerfiles.
1. Trace intended role and compare with compose configuration.
2. Replace the malformed file with a correct minimal definition if needed, or retire it through a reviewed change if unused.
3. Build all supported images from clean sources with reproducible dependency inputs.
Deliverable: coherent build documentation and images. Verification: build each intended Docker context independently; a deliberately malformed instruction must fail its build gate.
- [ ] No documented build path references invalid Docker syntax.
- [ ] Image provenance and source revision are recorded.

### LV-T3 — Contract and service trust boundaries (LV-2)
Prerequisite: LV-T1; observed `programs/legacyvault/src/`, `api/src/`, `indexer/src/` and `notifier/src/` paths, source not yet reviewed.
1. Write a threat model and state-machine invariants for owners, beneficiaries, guardians, timing and token distribution.
2. Inspect every instruction's signer, account ownership, PDA, arithmetic and replay constraints; test unauthorized, duplicate and partial distribution cases against a local validator.
3. Verify SIWS nonce expiry, per-vault authorization, webhook authenticity, reorg replay, idempotent notification and secret isolation.
Deliverable: adversarial test suite and independent external audit. Verification: deliberately weaken an account constraint in a disposable branch and observe the negative test fail; reconcile chain and database state after replay.
- [ ] Independent contract review reports all critical findings resolved.
- [ ] Real account and cross-vault authorization negatives are observed.

### LV-T4 — Automated end-to-end and UX (LV-3, LV-4)
Prerequisites: LV-T2 and LV-T3; observed root and separate dashboard manifests.
1. Define explicit build/test scripts for contract, SDK, API, indexer and notifier and pin supported toolchains.
2. Exercise a synthetic vault lifecycle through chain, indexer, database and notifications, including duplicate events and process restarts.
3. Test each UI separately for wallet signing clarity, beneficiary confirmation, mock/live labeling, keyboard use and accessible error recovery.
Deliverable: meaningful CI and user-flow evidence. Verification: intentionally corrupt a transaction or event mapping and ensure the relevant test fails independently.
- [ ] Tests exercise real integration boundaries, not only mocked success.
- [ ] Mock values and irreversible signing are unambiguous to users.

### LV-T5 — Recovery and independent release acceptance (LV-5)
Prerequisite: LV-T4, owner and legal approval; observed database migrations and deployment configuration.
1. Specify signer custody, upgrade authority, database backup, migration and release approval responsibilities.
2. Restore a synthetic database and replay chain events into a clean indexer, comparing derived state with the chain.
3. Rehearse app rollback with schema compatibility and independently review all security and domain evidence.
Deliverable: restore and release record. Verification: observe restore and reconciliation, and verify no duplicate external notification is sent.
- [ ] Restore, replay and rollback are observed.
- [ ] Owner approves keys, platform, privacy and legal scope.

## Production acceptance and rollback

- [ ] External contract audit, cross-service authorization, domain review, UX and disaster-recovery evidence are approved before real funds.
- [ ] Pause transaction submission and notifications, return services to the last verified artifact, restore only compatible data and reconcile against finalized chain state. On-chain actions cannot simply be rolled back; escalation requires the approved authority and incident procedure.
