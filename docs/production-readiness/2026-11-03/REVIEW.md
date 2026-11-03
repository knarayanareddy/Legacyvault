# Legacyvault review

## Scope and verdict

Prototype monorepo at `bea6fb7476d235de9e7b593ef0626418607d7fa7`. Runtime, Solana program, tests, builds and deployments were **not run**. This is not a smart-contract or custody audit. A root build artifact is visibly malformed, and safe handling of estate assets requires an independent, much deeper review before any valuable funds are used.

## Architecture and boundary

The inventory includes an Anchor program, TypeScript SDK, Express API, indexer, notifier, Prisma database, Next.js `web`, and a separate Vite `Legacyvaultdashboardbuild`. [Root package.json:5-20](https://github.com/knarayanareddy/Legacyvault/blob/bea6fb7476d235de9e7b593ef0626418607d7fa7/package.json#L5-L20) names six workspaces and development scripts. [Program manifest:1-5,18-21](https://github.com/knarayanareddy/Legacyvault/blob/bea6fb7476d235de9e7b593ef0626418607d7fa7/programs/legacyvault/Cargo.toml#L1-L21) describes a Solana digital-estate executor. Program instruction checks, actual asset transfers, authentication and connected UI wiring are outside the sample.

## Findings ledger

- **LV-1 — Medium, confirmed static:** [Dockerfile:1-14](https://github.com/knarayanareddy/Legacyvault/blob/bea6fb7476d235de9e7b593ef0626418607d7fa7/Dockerfile#L1-L14) begins with the quoted text ``for (let start = 0; start < beneficiaries.length; start += args.batchSize) {`` and ends at ``const ix = await args.program.methods``. Those are TypeScript fragments, not Docker directives. It therefore cannot serve as a valid Dockerfile in its sampled state. Determine whether it is intended to be used; restore an appropriate definition or explicitly retire it after tracing references. Service Dockerfiles are separate and uninspected.
- **LV-2 — High, unverified risk:** [programs/legacyvault/Cargo.toml:1-5,18-21](https://github.com/knarayanareddy/Legacyvault/blob/bea6fb7476d235de9e7b593ef0626418607d7fa7/programs/legacyvault/Cargo.toml#L1-L21) describes the program as ``description = "Solana-native Digital Estate Executor"`` and depends on `anchor-lang`, `anchor-spl` and `solana-program`, but sampled evidence covers only that manifest. There is no evidence here that signer, PDA, token ownership, timing, liveness and distribution invariants prevent unauthorized transfer. Require an independent Solana security audit and adversarial local-validator tests before real value.
- **LV-3 — Medium, confirmed static:** [package.json:13-20](https://github.com/knarayanareddy/Legacyvault/blob/bea6fb7476d235de9e7b593ef0626418607d7fa7/package.json#L13-L20) lists only ``"db:generate"``, ``"db:migrate"``, per-service `dev:*` commands and ``"dev": "pnpm -r --parallel dev"``; no root test or build gate appears in the sampled root manifest. The tree inventory contains no Actions workflow; other test tooling was not sampled. Add a contract-to-indexer end-to-end gate.
- **LV-4 — Medium, unverified risk:** [web/package.json:1-8](https://github.com/knarayanareddy/Legacyvault/blob/bea6fb7476d235de9e7b593ef0626418607d7fa7/web/package.json#L1-L8) identifies one app as ``"name": "web"`` with Next.js scripts, while [Legacyvaultdashboardbuild/package.json:1-10](https://github.com/knarayanareddy/Legacyvault/blob/bea6fb7476d235de9e7b593ef0626418607d7fa7/Legacyvaultdashboardbuild/package.json#L1-L10) identifies a separate app as ``"name": "react-vite-tailwind"`` with Vite `dev`, `build` and `preview` scripts. Collector inventory also lists `Legacyvaultdashboardbuild/src/data/mockData.ts`, but I did not independently inspect that file's contents. Whether live estate values and wallet actions are wired, or mock data is visibly labeled, was not checked. Avoid treating a dashboard build as evidence of real custody or transactions.
- **LV-5 — Medium, confirmed static:** [package.json:14-15](https://github.com/knarayanareddy/Legacyvault/blob/bea6fb7476d235de9e7b593ef0626418607d7fa7/package.json#L14-L15) exposes only development-oriented database commands: ``"db:generate": "pnpm -C db prisma generate"`` and ``"db:migrate": "pnpm -C db prisma migrate dev"``. That does not establish a safe production migration or restoration process. Define separately reviewed deployment and recovery procedures.

## Five-discipline assessment

**Code:** LV-1 is certain; contract semantics and cross-service consistency are unknown. **Automation:** no root behavior gate is declared; no historical runs were returned. **Operations:** chain reorg handling, indexer replay, notifier deduplication, signing-key custody, backup restoration and service observability are unverified. **OWASP/security:** SIWS replay and authorization, transaction construction, untrusted webhook input, injection, secret management, dependency integrity, encryption and privacy require tracing and negative testing. No exploit is asserted from filenames. **UI/UX:** wallet signing, beneficiary selection, irreversible actions, keyboard accessibility and mock/live distinction must be tested in each app independently.

## Blockers and decisions

Owner must specify devnet versus mainnet, asset custody and upgrade authorities, estate-law assumptions, privacy and recovery, signer access, notifications and release signing. Independent contract audit and domain/legal review are required before live assets; a successful devnet test would not replace them.

## Evidence and limitations

Independently inspected local materialized sources and exact ranges: `README.md:1`, `Cargo.toml:1-13`, `package.json:1-30`, `Legacyvaultdashboardbuild/package.json:1-30`, `api/package.json:1-25`, `db/package.json:1-18`, `indexer/package.json:1-22`, `notifier/package.json:1-22`, `sdk/package.json:1-33`, `web/package.json:1-23`, `programs/legacyvault/Cargo.toml:1-21`, and `Dockerfile:1-14`.

Collector metadata in `snapshot.json` records the same sampled totals for those 12 files, a 159-path repository tree, and no historical Actions runs returned. I did not independently inspect unsampled source files, deployed state, or any author reading beyond the ranges listed above. See [plan](REMEDIATION_PLAN.md).
