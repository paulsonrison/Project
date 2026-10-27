# Newspaper Owner Workflow — Deployed App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Use checkboxes to track progress. Proposed design; do not interpret workspace confirmation as design approval or permission to publish unfinished features.

**Goal:** Extend the deployed PressTrack pilot with contextual Excel imports, reviewed AI entry, date-bounded newspaper rates, three languages and an owner-only delivery workflow.

**Architecture:** Retain the deployed React/Vite frontend, Express API, MongoDB transactions, society-scoped authorization, opaque sessions, revision checks, daily delivery snapshots and invoice ledger. Add the requested workflows to those services. Preserve existing bills and database identifiers; do not replace MongoDB or rebuild authentication.

**Tech stack:** Existing React, TypeScript, Express 5, MongoDB driver, Zod, Vitest, Playwright and Groq integration. Proposed additions: ExcelJS, a maintained multipart parser with bounded file handling, and i18next/react-i18next. Verify current official documentation and compatibility before installation.

**Spec:** The product requirements, workbook semantics, language requirements, example calculations and research comparison in [the original requirements draft](2026-10-26-newspaper-owner-workflow.md) remain applicable. This document supersedes its architecture, implementation file paths, foundation tasks, deployment unknowns and estimate wherever they conflict.

## Confirmed deployment baseline

User-authorized workspace: `Paulson's workspace` (`tea-dbfhacjrjlhs73b3um5g`). Service: `presstrack-paulson` (`srv-dbfid8rrjlhs73c6gdg0`), a Node web service in Singapore on the Free plan. [Live app](https://presstrack-paulson.onrender.com), [Render service](https://dashboard.render.com/web/srv-dbfid8rrjlhs73c6gdg0).

Render service configuration uses repository `https://github.com/paulsonrison/Project`, branch `feat/presstrack-complete`, repository root, build command `npm ci --include=dev && npm run build && npm run build:server`, start command `npm start`. Auto-deploy is off and no explicit HTTP health path is configured. Latest listed deploy `dep-dbfid9rrjlhs73c6gf1g` is `live` at commit `45db8aa300ea1d0060d1e1549e97a5fa5975764f`.

The cloned remote branch currently points to `bb683bab502d0d08afc32f77add580df1edb021e`. That differs from the live commit: compare the intervening changes before choosing a release baseline. These are Render metadata observations, not a fresh authenticated end-to-end health test.

Inspection of the remote branch confirms these existing files and capabilities:

| Area | Existing files and behavior | Required delta |
|---|---|---|
| Access/data | `server/app.ts`, `server/auth/routes.ts`, `server/auth/scope.ts`, `server/db/connect.ts`; society ownership, sessions, revisions and MongoDB | Reuse; add owner workflow policy and import authorization |
| Prices | `shared/contracts.ts`, `server/domain/rules.ts`, `server/features/schemas.ts`, `src/features/workspace/PricingEditor.tsx`; effective start-only history, specific-date/weekday/monthly overrides | Add bounded validity and daily history view without changing finalized bill snapshots |
| Operations | `server/features/operations.ts`, `server/domain/ledger.ts`; delivery reconciliation and transactional invoice/payment logic | Reuse for imports, round confirmation and retrospective adjustment previews |
| UI | `src/features/workspace/AppShell.tsx`, `Screens.tsx`, `EntityView.tsx`, `Dashboard.tsx`, `src/services/api.ts` | Integrate Excel actions and language selector into actual workspace screens |
| AI | `server/chat/routes.ts`, `server/chat/service.ts`, `server/config/env.ts` | Add separate reviewed entry proposals; preserve existing read-only account assistant |

`server/config/env.ts` expects `MONGODB_URI`, `MONGODB_DATABASE`, `APP_ORIGIN`, `PORT`, `NODE_ENV`, optional `GROQ_API_KEY` and `GROQ_MODEL`. Seeing these variable names in source does not confirm that each is configured in Render. No secret values were read. The available connector cannot retrieve them into a local `.env`.

## Global constraints

- Retain MongoDB, existing IDs, society scope, sessions and invoice/payment history. “Business” in the requirements means the current society tenant; no tenant rename migration is needed.
- All new endpoints use `/api/v1` and existing authorization/revision conventions. Retain `/api/health`.
- Prices already use integer minor units. Preserve that convention; never multiply existing paise by 100 during migration.
- Internal date ranges already use exclusive end dates. Convert inclusive Excel/UI To dates at the boundary and test pause/stop regressions.
- Standard Excel/manual entry works without AI. Groq creates proposals only; only explicit reviewed confirmation can mutate data.

## Review focus

1. The live commit differs from the remote branch tip: establish the tested release candidate before changing data.
2. Legacy history, overrides and bounded rates must resolve deterministically; missing history must not be invented.
3. Removing staff controls must also remove required staff IDs and authorization assumptions for owner-created subscriptions.
4. Stale/tampered spreadsheets and repeated commits must not overwrite newer data, cross tenants or duplicate charges.
5. Localization must preserve dates, identifiers, money and in-progress edits, including Excel round trips across languages.

## Task 1: Align with deployment and capture regression tests

**Inspect/modify:** existing `package.json`, `.env.example`, `.gitignore`, `server/app.integration.test.ts`, `server/domain/domain.test.ts`, `server/config/env.test.ts`, `docs/deployment.md`, `docs/implementation-status.md`.

- [ ] Compare live `45db8aa` with remote `bb683bab`; record changes and choose the release baseline. Preserve planning documents when moving to the feature branch; do not reset working files.
- [ ] Install the chosen branch's locked dependencies with `npm ci`. The prior install on main does not satisfy this branch's Express/MongoDB/test dependencies.
- [ ] Run existing `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run build:server`, `npm run test:e2e`; record fresh results. Earlier main build/lint results and the branch's implementation-status claims are not fresh verification of this baseline.
- [ ] Add baseline assertions for tenant isolation, unconfirmed-day finalization, price snapshots and invoice idempotency to the existing integration suite. Record the delta scope and commit.

## Task 2: Make delivery management owner-operated

**Modify:** `shared/contracts.ts`, `server/features/schemas.ts`, `server/features/operations.ts`, `server/auth/deliveryFilter.ts`, `server/features/memberships.ts`, `server/app.ts`, `src/features/workspace/{AppShell,Screens,EntityView}.tsx`, `src/app/AppRouter.tsx`, related integration/e2e tests.

**Interface:** Existing subscription writes accept `residentId`, `publicationId`, `quantity`, `routeOrder`, dates and revision without requiring `staffId` in owner mode. Existing society-admin scope acts as the owner; do not make authentication disappear.

- [ ] Add failing tests that an owner creates a subscription and confirms a delivery without a staff record; cross-society access still fails.
- [ ] Remove staff choices, staff invitation actions and navigation from the owner workflow. Redirect legacy staff links safely. Retain existing stored staff references as historical data; decide handling of existing staff logins during the pilot migration rather than deleting users.
- [ ] Adapt subscription reference checks, manifest snapshots and owner delivery filters. Keep resident access secure if existing resident accounts are retained; do not expand this release into a new customer portal.
- [ ] Test pauses, partial/missed copies, route order, bundle totals and paid-bill history. Run focused tests and owner browser flow, then commit.

## Task 3: Extend effective prices and daily history

**Modify:** `shared/contracts.ts`, `server/features/schemas.ts`, `server/domain/rules.ts`, `server/features/operations.ts`, `src/features/workspace/PricingEditor.tsx`, `server/domain/domain.test.ts`, `server/app.integration.test.ts`.
**Create:** `server/rates/{intervals,history,migrate}.ts`, `server/rates/intervals.test.ts`, `src/features/workspace/RateHistory.tsx`.

**Interfaces:** `resolvePrice(publication, date): number` remains the shared resolver; add `previewRateChange(scope, input): RateChangePreview` and a society-scoped daily-history endpoint. Include stable rate revision references in new delivery snapshots.

- [ ] Test ₹202/₹181/₹362 October examples, bounded temporary rates, open ends, overlap conflicts, Sunday overrides, missing historical coverage and inclusive displayed end dates.
- [ ] Version the pricing representation. Migrate start-only history into explicit intervals where supported by source dates; treat legacy monthlyPrices as per-issue overrides, never fixed monthly fees. Keep specific-date > weekday > monthly > effective-base precedence during migration; time-bound each rule type explicitly when requested.
- [ ] Implement interval preview/split/conflict detection and daily calendar history. Preserve existing delivery `priceMinor` and issued invoice snapshots; identify retrospective effects before writing adjustments.
- [ ] Add rollback-compatible MongoDB migration and dry-run report. Test pending future manifest reconciliation, paid-invoice immutability, draft correction and a repeated adjustment. Run focused tests and commit.

Fixed monthly plans are not implemented in the pilot according to its status document. Treat them as a separate, explicitly approved pricing addition; do not reinterpret the existing monthly per-issue overrides. The original draft's proration policy remains a proposal requiring business confirmation.

## Task 4: Implement previewed batch changes

**Create:** `server/imports/{types,validate,preview,commit,routes}.ts`, `server/imports/commit.integration.test.ts`, `src/features/imports/ChangePreview.tsx`.
**Modify:** `server/app.ts`, `server/db/connect.ts`, `server/features/schemas.ts`, `src/services/api.ts`.

**Interfaces:** `previewChanges(scope, rows, mode, selection): ChangePreview`; `commitChanges(scope, batchId, expectedRevisions, idempotencyKey): ImportResult`. A batch stores normalized reviewed data, expiry and payload hash; commit rechecks scope/revisions in a MongoDB transaction.

- [ ] Add failing integration tests for Add/Update/Remove/Replace, shared phones, blank-update cells, zero-stop subscriptions, omitted rows, empty replacement, stale revisions and foreign IDs.
- [ ] Reuse existing Zod schemas and domain functions. Extract only the minimal write service needed to avoid duplicating rules currently embedded in `server/app.ts` and operations routes.
- [ ] Implement all-or-nothing batch writes, audit entries, explicit scope replacement and retry idempotency. Introduce scoped unique indexes and test actual transaction behavior using the existing replica-set integration harness.
- [ ] Verify failed rows leave no changes and archives preserve historical invoices/deliveries. Run focused tests and commit.

## Task 5: Generate and import contextual Excel workbooks

**Create:** `server/imports/{workbook,parse,column-map}.ts`, `server/imports/workbook.test.ts`, `src/features/imports/{ExcelWizard,MappingReview}.tsx`, `tests/fixtures/imports/`, `tests/e2e/excel-import.spec.ts`.
**Modify:** existing workspace Customers/Newspapers screens, API upload helper and package manifests.

**Interfaces:** `buildWorkbook(scope, entity, mode, selection, locale): Buffer`; `parseWorkbook(buffer): ParsedWorkbook`; all writes flow through Task 4.

- [ ] Test the original draft's exact MM/HD/MB quantity headers and all four mode semantics. Add edition/code uniqueness and stable ID fixtures.
- [ ] Download existing rows for update/remove/replace, blank rows for add and current publication choices. Include instructions, safe text cells, date validation, versions and optional advanced subscriptions/rates sheets.
- [ ] Add a dedicated authenticated, origin-checked multipart route with bounded memory/expanded archive/row limits; do not raise the current global 32KB JSON limit to accept whole workbooks. Paginate database exports beyond the API's current 100-row page limit.
- [ ] Test formula and macro rejection, malformed archives, leading-zero phone/flat values, changed header mappings and stale templates. Provide editable previews and an error workbook. Benchmark 5,000 rows and commit.

## Task 6: Add reviewed Groq data-entry proposals

**Create:** `server/ai-entry/{routes,service,schemas}.ts`, `server/ai-entry/service.test.ts`, `src/features/imports/AiEntry.tsx`.
**Modify:** `server/app.ts`, existing server environment validation only if new settings are needed, and workspace entry actions.

**Interfaces:** `suggestEntry(scope, text, locale): ProposedChangeSet`; `suggestColumns(headers, redactedExamples): ProposedColumnMap`. Consume Task 4 for preview and commit.

- [ ] Test malformed responses, ambiguous paper names, missing price/date, mixed-language input, malicious spreadsheet instructions, provider timeout and absent key.
- [ ] Reuse server-side `GROQ_API_KEY`/model configuration and bounded provider-call patterns. Preserve the existing read-only chat tool boundary; create separate proposal endpoints rather than granting its account assistant mutation tools.
- [ ] Show all suggestions as editable proposals, highlighting uncertain fields; no price, date or identity is invented. Keep normal templates usable without a provider call.
- [ ] Verify secret-free browser assets, minimal transmitted data and that no model output bypasses validation. Mock provider tests; run a small authorized staging connectivity check only when configuration is available. Commit.

## Task 7: Localize and polish the complete workflow

**Create:** `src/i18n/{index,en,hi,ml,format}.ts`, `src/components/common/LanguageSwitcher.tsx`, `tests/e2e/languages.spec.ts`.
**Modify:** `src/features/workspace/AppShell.tsx`, workspace screens/forms, import templates, printable bills and shared API error presentation.

- [ ] Test locale-key parity, preference persistence and language switching without losing an import preview or unsaved form.
- [ ] Translate English/Hindi/Malayalam labels, validation messages, import instructions, date/rate history and bill wording. Retain canonical database values and existing society timezone.
- [ ] Test localized exports imported under another UI language; verify phones, IDs, quantities and paise remain unchanged. Check Devanagari/Malayalam fonts in browser and printed bills.
- [ ] Complete native-speaker review and keyboard/mobile/200%-zoom checks. Run focused tests and commit.

## Task 8: Rehearse migration and publish the tested release

**Modify:** existing `render.yaml`, `docs/deployment.md`, `docs/implementation-status.md`, CI and production configuration only as required. Do not create duplicate Render services or a replacement database.

- [ ] Rehearse legacy MongoDB rate/staff migration and restoration against a staging copy with appropriate handling of customer information. Confirm actual Atlas backup capability before promising a restore path.
- [ ] Run the full existing checks plus new import/rate/localization suites, frontend/server builds and a dependency audit. Record observed results, not inherited documentation claims.
- [ ] Verify existing environment names/server secrets, frontend same-origin routing and `/api/health`. Configure an explicit HTTP health path after verification. Keep auto-deploy off unless the owner requests a change.
- [ ] Deploy an explicitly identified tested commit to the existing service; monitor that exact deploy until live, then verify authenticated Excel changes, daily history, bills and all three locales on a controlled test account. Do not overwrite real customer records during smoke tests.
- [ ] Record the release revision, migration version, checks and rollback procedure. App rollback does not reverse MongoDB writes; use compatible forward fixes and preserve financial records.

## Verification and open items

Read-only Render service/deploy inspection and remote branch source inspection completed. No new deploy, secret update, database migration or local checkout switch was performed. Dependencies and build checks from the prior turn apply to main only; they must be repeated on the selected feature-branch baseline.

The detailed requirements draft is saved locally on main as an untracked planning document. Carry both plan documents onto the selected implementation branch before committing them. No repository or deployment mutation is needed merely to inspect the remote branch using `git show`.

Local `.env` is still unconfigured: the connector exposes no secret-value retrieval operation. Existing configuration identifies Groq as the expected provider, but does not prove the key is present/valid. Do not ask the user to paste a secret into chat. Use the existing Render runtime secret for hosted execution or an authorized secure local transfer for local AI tests.

Remaining product decision: approve this design, including the proposed four Excel mode semantics. Native translation review and fixed monthly plan/service-fee policy remain release dependencies if those pricing bases are enabled. This is a researched implementation draft, not an Octopus multi-provider validated specification.

**Estimate:** 8–15 engineering days for one implementer extending the confirmed pilot, plus 2–4 working days for native-language review and owner field trials, potentially overlapping. Re-estimate after testing the chosen baseline and measuring legacy-data migration needs.
