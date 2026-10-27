# Newspaper Owner Workflow Implementation Plan

> **Deployment correction, 26 October 2026:** The user confirmed Paulson's Render workspace. Render deploys `feat/presstrack-complete`, not `main`. The deployment-grounded replacement plan is [2026-10-26-newspaper-owner-deployed-app.md](2026-10-26-newspaper-owner-deployed-app.md). Use that document for implementation. The foundation assumptions, file mapping and estimate below were based on `main` and are superseded; this document is retained as the detailed product requirements and research reference.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking. This is a proposed plan, not an approved design or authorization to publish unfinished changes.

**Goal:** Make PressTrack practical for one newspaper delivery owner managing customers, Excel uploads, changing prices, delivery exceptions, and monthly collections in English, Hindi, or Malayalam.

**Architecture:** Extend the root React app and its existing design tokens. Add a server API and persistent relational database; the server owns validation, imports, historical rates, billing, and optional AI calls. All entry methods produce the same validated change preview before saving.

**Tech stack:** Existing React 19, TypeScript 6, Vite 8, Tailwind 4, React Router 8. Proposed additions: Express, PostgreSQL with migrations, Zod, ExcelJS, i18next/react-i18next, Vitest and Playwright. Check current official documentation and compatibility before installing additions; these dependencies are proposals, not existing capabilities.

**Spec:** The product specification below is embedded in this draft. Finalize it against the deployed service and approve it before feature implementation.

## Evidence and scope

Repository: https://github.com/paulsonrison/Project, inspected at commit `e17eeba`, 26 October 2026.

The root `package.json` builds `src/` using Vite. `src/pages/Residents.tsx`, `Settings.tsx`, `Billing.tsx` and `Calendar.tsx` are placeholders. `src/components/navigation/Navigation.tsx` is also a placeholder. `src/app/AppRouter.tsx` exposes `/delivery-boy`. No backend, persistent schema, authentication, Excel parser, or runnable test suite is configured. `tests/test.tsx` is empty. The README is partly stale: PageLayout already derives its heading from the route.

`DesignDemoFromFigma/Newspaper Management Software/src/App.tsx` contains a separate demo with sample records, schedules, price exceptions and in-memory React state. It is a reference, not evidence that the deployed root app implements these features. Do not migrate fake demo residents or sample prices into production. Confirm Render's branch, root directory, build command and service type before selecting an implementation target.

Requested skills informed this draft: Ooh Shiny for accessible workflow design; Karpathy guidelines for explicit assumptions and focused changes; Superpowers for design, task breakdown and verification; I Have ADHD for short steps and visible progress. Claude Octopus instructions were inspected, but its multi-provider specification workflow was not executed; this document does not claim Octopus consensus or provider validation.

## Product specification

### 1. Owner workflow and interface

One owner logs into their own business and manages customers directly. Keep business ownership isolation even though delivery staff management is removed. Replace staff navigation with Today, Customers, Newspapers, Bills and Settings; keep the calendar accessible from Today. Retire `/delivery-boy` with a redirect to Today. Remove staff assignments from forms, templates and onboarding. If production has staff-linked data, preserve historical references during migration rather than deleting records blindly.

Reuse the cream, black and red design. Prefer readable mobile cards, 44px action targets, visible field labels and one primary action per step. Preserve keyboard focus, screen-reader status announcements and errors that do not rely on color. Verify 360px, 768px and desktop layouts plus 200% zoom. Avoid uppercase styling on Hindi and Malayalam text. Offer clear empty states: add newspapers first, then customers, then review today's delivery list.

### 2. Excel workflows

“Add using Excel” first asks which data: Newspapers & Rates or Customers & Subscriptions. If records exist, choose Add new, Update existing, Remove selected, or Replace selected scope before generating the workbook. The user downloads the prepared workbook, fills it, uploads it, reviews changes and confirms Save. Interpret “decrypt” as parse and map normal spreadsheets; password-protected workbooks require the user to provide an unlocked copy.

| Mode | Downloaded workbook | Upload meaning |
|---|---|---|
| Add new | Blank entry rows, examples in a separate instructions sheet, current newspaper reference list | Create only; flag duplicates, never silently overwrite |
| Update existing | Selected current records, stable IDs and record versions | Update listed values only; omitted rows remain unchanged |
| Remove selected | Current selected records plus a Remove? column defaulting to No | Archive only rows explicitly marked Yes after impact review |
| Replace selected scope | Complete snapshot of the chosen scope plus explicit keep/remove choices | Reconcile that scope only; show every deletion separately; prevent accidental empty replacement |

Use `Instructions`, `Data`, `Newspapers`, and versioned metadata sheets. Add a `Rates` or `Subscriptions` sheet where needed. Include template ID, schema version, export timestamp, business scope and record versions. Hidden metadata improves matching but is untrusted: validate every ID and scope on the server. Keep internal IDs locked against casual edits while remembering sheet protection is not authorization.

Simple customer headers:

`Sl. No. | Customer ID | Name | Number | Address/Flat | Area/Building | Start Date | Subscription: MM | Subscription: HD | Subscription: MB`

Use one column per known newspaper, showing short code and full name in instructions. Cell values are quantities: 1 = one copy, 2 = two copies. For Add, blank means no subscription. For Update, blank means unchanged and 0 explicitly stops that paper from the selected effective date. Ending a subscription must never remove historical deliveries. For Replace, require the user to acknowledge the full quantity snapshot semantics before download and again in the preview. Advanced per-paper schedules and dates belong in `Subscriptions`, keyed by customer and newspaper IDs.

Codes are unique per business and stable. MM may mean Malayala Manorama, HD The Hindu, and MB Mathrubhumi, but these are examples, never universal mappings. A sheet labelled MD when the business uses MB requires review, not an automatic guess. Distinguish editions such as Hindu Kochi and Hindu Delhi with separate IDs/codes. If no newspapers exist, guide the user to create them first or stage newspapers and customer subscriptions in the same import.

Rate headers:

`Newspaper ID | Code | Newspaper | Edition/City | Pricing Basis | Amount (INR) | From Date | To Date (optional) | Weekdays (optional) | Source/Note`

Use real Excel dates with ISO `YYYY-MM-DD` instructions. Reject ambiguous text dates rather than guessing month/day order. Keep phone and flat numbers as text; preserve +91, leading zeros, Malayalam and Hindi names. Phone numbers are not unique household IDs: families may share them. Match by stable customer ID; uncertain name/phone/address matches require review.

All modes show row-level errors and an editable mapping preview. Blocking errors prevent the batch from committing; provide an error workbook with row, column and correction guidance. A repeated commit token must return the existing result, not add duplicates. Detect edits made after download using record versions and ask users to resolve conflicts.

Reject macros, encrypted files, formula-dependent input, unsupported types and oversized archives. Proposed initial limits: 10MB compressed file, 50MB expanded contents, 5,000 data rows; benchmark before release. Treat exported user strings beginning with spreadsheet formula characters as literal text. Never evaluate uploaded formulas or follow external workbook links.

### 3. Date-effective rates and daily history

Store money in integer paise. Store effective dates as India-local calendar dates, independent of browser timezone. UI From and To dates are inclusive; internal intervals use `[validFrom, validToExclusive)`, with a null end meaning until changed. A new rate beginning 16 October closes the preceding open-ended rate at 16 October internally. A finite temporary rate resumes a previously known rate only if the replacement operation explicitly preserves it; otherwise show a gap requiring resolution.

Rates belong to a newspaper edition and pricing basis, with weekday applicability where needed. A second overlapping rule at the same specificity is a conflict, never last-upload-wins. Specific-date overrides take precedence over weekday overrides, then the general effective rate. Show the resulting calendar before saving. Support future changes and explicit retrospective corrections; never guess missing past rates from today's price.

Daily history has two layers: effective rate intervals for all dates, and durable daily entries recording date, newspaper, customer, quantity, delivery status, resolved rate in paise, rate revision ID and source. A daily-rate API expands intervals for non-delivery dates and future dates; distinguish projected rates from billed snapshots. Persist daily delivery charges idempotently with a unique business/customer/newspaper/date key. This supplies daily history without creating unbounded future rows.

Example test, not a real newspaper price: October has ₹6 per copy on days 1–15 and ₹7 from day 16; a daily subscriber receiving all 31 copies owes ₹202. If delivery pauses on 20–22 October, inclusive, the paper charge is ₹181. Two copies cost ₹362. Service fees, opening dues and payments are separate ledger items.

Support daily issue prices and explicitly agreed fixed monthly plans as different pricing bases. A fixed monthly amount must not silently become an issue rate. Proposed monthly plan rule: prorate by active calendar days divided by actual days in month, with round-half-up once per line; show and confirm the rule when configuring the plan. A price change creates separate period segments. Waived holidays/leave and service-fee policy must be explicit, not inferred from competitor claims. Publisher prepaid schemes are not equivalent to an owner collecting monthly dues; defer scheme accounting until actual terms are available.

Finalized invoice lines retain the exact daily charges and calculation version. Retrospective price corrections show affected draft and finalized bills. Recalculate drafts only after confirmation; adjust finalized invoices through an auditable debit/credit entry, never silently rewrite them. Existing payments remain attached to their original ledger entries.

### 4. AI-assisted entry

Offer “Describe what to add” and “Help match this spreadsheet.” Example: “Add Anu at flat B-12, one MM and one Hindu from 1 November.” The server returns structured proposed changes with evidence and unresolved fields. Use the same validation, preview and commit path as Excel and manual entry.

Standard template mapping is deterministic and free of AI dependency. AI may suggest mappings for older spreadsheets and interpret English, Hindi, Malayalam or mixed text. It cannot invent missing rates, resolve ambiguous editions, delete customers or commit changes autonomously. Highlight inferred values and require explicit confirmation for dates, prices and destructive operations. Never promise that a model's confidence score guarantees accuracy.

Provider calls happen only on the server with a key from its runtime environment. Never put an API key in a `VITE_` variable. Minimize transmitted customer details: header mapping generally needs headers and synthetic or redacted examples, not an entire customer workbook. Apply timeouts, request limits, structured response validation and redacted logs. Treat spreadsheet text as data, not instructions. If AI is unavailable or unconfigured, manual entry and template imports remain usable.

### 5. Practical Indian delivery and billing

Each household can take multiple titles, quantities and weekday schedules. Support a mid-month start/stop, temporary leave with automatic resumption, paper-specific holidays, non-publication, missed delivery and extra copies. Do not equate an Indian public holiday with newspaper non-publication automatically. Preserve history when a customer changes address or stops subscribing. Opening balances, partial cash/UPI receipts, overpayments and credits belong in the ledger; an uploaded “paid” label is not proof of a payment.

Today shows the owner's area/building/flat order, paper quantities and pauses. Offer “Confirm today's round” with visible exceptions rather than requiring hundreds of taps; scheduled delivery is not proof of actual delivery. Unconfirmed days must be resolved before bill finalization. Show paper-wise bundle totals derived from subscriptions. Avoid route optimization, staff payroll, scrap recycling and customer portals in this release.

### 6. Languages

Provide a visible selector: English / हिन्दी / മലയാളം. Persist locale per owner with a local pre-login preference; use `en-IN`, `hi-IN`, `ml-IN`, INR and `Asia/Kolkata` for display. All navigation, forms, validation errors, import instructions, preview labels, dates, empty states and bills must use message keys. Store canonical identifiers and error codes on the server, not translated strings.

Excel headers can be localized while stable metadata maps columns across languages. A workbook downloaded in Malayalam must remain importable after switching to English. Preserve names and addresses as entered. Use fonts with tested Devanagari and Malayalam support, including bill exports. Have native speakers review financial and destructive-action wording; AI translations alone are insufficient release evidence.

## Research comparison

A focused sample was researched, not every newspaper-management article. Product pages describe vendor claims, not independently audited backend behavior. None of these sources establishes actual local publication rates or proves that a specific feature already exists in this repository.

| Source inspected | Relevant evidence | Decision for PressTrack |
|---|---|---|
| [Indian distribution case study, Kamble et al., 2017](https://thescipub.com/pdf/ajassp.2017.478.495.pdf) | Examines delivery to independent houses and apartment clusters under morning time constraints | Area/building/flat ordering; multiple titles per household; retain manual route order |
| [Paperwala](https://paperwala.co.in/) | Advertises vacation pauses, multiple physical publications, daily itemized records and monthly UPI billing | Adopt pause/resume and explainable daily billing; exclude its marketplace and recycling scope |
| [DailyTx](https://dailytx.in/) | Describes recurring deliveries, route order, delivered/skip actions, invoice preview/finalization and cash/UPI collections | Adopt delivery confirmation and locked invoice lifecycle; omit team and multi-business management |
| [Tech MunimJi](https://techmunimji.com/) | Adjacent daily-service product describes multilingual entry, vacations, collections and Excel/PDF reporting | Adopt localized workflows and legible exports; offline editing is a later feature unless field trials prove essential |

Vitaran's Play Store listing surfaced in search, but direct retrieval failed; it is not a foundation for this plan. DAM's rate-change article and Zopnote's newspaper page also failed direct retrieval. Do not portray those as fully reviewed sources. The 2017 study informs delivery structure, not today's prices or national market statistics.

## Global constraints

- Keep the existing React app and design tokens; do not replace the framework or ship the Figma demo as the production app without verifying the deployment target.
- Every business query is owner-scoped; every write is authorized server-side. Upload metadata never establishes ownership.
- INR amounts use integer paise; business dates use `Asia/Kolkata`; finalized bills remain immutable.
- Manual, Excel and AI entry share validation and a preview/commit boundary; no model writes directly to the database.
- Keep secrets out of browser bundles, tracked files, plans and logs. No production migration or deploy occurs as part of this planning deliverable.

## Review focus

- Stale or tampered exports: prevent cross-business writes and accidental overwrite of newer records.
- Blank cells, omitted rows and empty replacement: never cause implicit deletion in update mode.
- Month boundaries, leap days and Sunday prices: resolve the right daily amount without timezone drift.
- Backdated rates affecting paid bills: retain settled history and issue traceable adjustments.
- Mixed-language headers and shared phones: preserve identities and surface ambiguous matches.

## Implementation tasks

Each task follows this cycle: add the listed failing tests, run them to confirm failure, implement the defined interface, rerun until passing, review the diff and commit only its files. New filenames below are proposals; existing filenames are confirmed by repository inspection. Do not invent test results.

### Task 1: Establish the production foundation

**Modify:** `package.json`, `.gitignore`, `README.md`, `src/features/auth/auth.tsx`, `src/hooks/useAuth.tsx`, `src/app/AppRouter.tsx`.
**Create:** `server/app.ts`, `server/config.ts`, `server/db.ts`, `server/auth.ts`, `server/migrations/001_owner_core.sql`, `.env.example`, `tests/integration/ownership.test.ts`, `vitest.config.ts`.

**Interfaces:** `requireOwner(request): OwnerContext`; database operations require `businessId`; `GET /api/health` exposes health without secrets. Configure secure server sessions and one owner account per business; avoid introducing staff roles. Select the established authentication provider if deployment inspection reveals one; otherwise propose a maintained session/password implementation before building login.

- [ ] Inspect Render service branch/root/build/start configuration and existing data before adding migrations. Confirm PostgreSQL provisioning and cost if no database exists.
- [ ] Add meaningful auth tests: unauthenticated access is rejected; owner A cannot read/write owner B records; sessions expire and mutation requests reject invalid origins.
- [ ] Implement persistent owners/businesses, customers, newspapers, subscriptions and version fields; add secure server configuration and a migration runner.
- [ ] Configure `npm test`, `npm run test:integration` and `npm run test:e2e` with Vitest/Playwright. Verify ownership tests, build and lint; document local setup and commit.

### Task 2: Implement historical rates and billing

**Create:** `server/migrations/002_rates_ledger.sql`, `server/rates/{service,routes}.ts`, `server/billing/{daily-charge,invoice,ledger}.ts`, `src/features/newspapers/RateHistory.tsx`, `tests/unit/rates.test.ts`, `tests/integration/billing.test.ts`.
**Modify:** `src/pages/Settings.tsx`, `src/pages/Billing.tsx`, `src/pages/Calendar.tsx`.

**Interfaces:** `resolveRate(businessId, newspaperId, date): ResolvedRate | MissingRate`; `previewRateChange(input): RateChangePreview`; `confirmRound(input, idempotencyKey): DailyCharge[]`; `finalizeInvoice(businessId, customerId, month): Invoice`.

- [ ] Test October ₹202/₹181/₹362 examples, leap-day delivery, Sunday overrides, future/open-ended changes, finite-rate gaps, overlapping rules and missing historical rates.
- [ ] Add rate intervals/revisions, delivery-day snapshots, invoices, invoice lines, ledger payments/adjustments and unique idempotency keys. Keep subscription dates and pricing dates independent.
- [ ] Implement previewed interval splitting, rate history calendar, daily charge creation, monthly-plan segmentation/proration and invoice finalization.
- [ ] Test that changing a historic rate preserves a paid invoice; a compensating adjustment changes the ledger once. Verify missing delivery confirmation blocks finalization. Run focused tests/build/lint and commit.

### Task 3: Build customers and the owner's daily workflow

**Modify:** `src/pages/Residents.tsx`, `src/pages/home.tsx`, `src/pages/Calendar.tsx`, `src/components/navigation/Navigation.tsx`, `src/components/layout/PageLayout.tsx`, `src/app/AppRouter.tsx`.
**Create:** `server/customers/routes.ts`, `server/subscriptions/service.ts`, `server/deliveries/service.ts`, `src/features/customers/CustomerForm.tsx`, `src/features/deliveries/TodayRound.tsx`, `tests/integration/subscriptions.test.ts`, `tests/e2e/owner-round.spec.ts`.

**Interfaces:** `upsertSubscription(input, expectedVersion): Subscription`; `setPause(input): Pause`; `GET /api/deliveries?date=YYYY-MM-DD` returns ordered stops and newspaper totals.

- [ ] Test shared phone numbers, multiple editions, quantities, subscription start/stop, inclusive leave dates, auto-resume and address changes preserving old delivery records.
- [ ] Implement customer CRUD/archive, subscriptions, pauses, holidays and extra/missed copies with explicit effective dates.
- [ ] Build Today, owner route order and bundle totals; remove staff entry points and redirect the legacy route. Preserve any production historical links.
- [ ] Verify the owner can complete a round, record a partial payment and inspect remaining dues using keyboard and mobile widths. Run focused checks and commit.

### Task 4: Implement the shared change engine

**Create:** `server/imports/{types,validate,preview,commit,routes}.ts`, `server/migrations/003_import_batches.sql`, `src/features/imports/ChangePreview.tsx`, `tests/integration/import-commit.test.ts`.

**Interfaces:** `previewChanges(owner, normalizedRows, mode, scope): ChangePreview`; `commitChanges(owner, batchId, expectedVersions, idempotencyKey): ImportResult`. Preview includes creates, updates, archives, conflicts, skipped rows and monetary effects. Store the validated payload server-side with a preview hash/expiry; commit the identical reviewed version transactionally.

- [ ] Test all four modes, no-op updates, empty replacement rejection, explicit archive selection, stale versions, cross-owner IDs and repeat submission.
- [ ] Implement row validation and deterministic ID matching; show ambiguous candidates for manual resolution.
- [ ] Implement all-or-nothing commit with audit records and dependency checks. Recheck versions inside the transaction. Replacement must not cascade-delete delivery or bill history.
- [ ] Verify a failed row leaves the whole batch unchanged and a retry creates no duplicate entries. Run focused checks and commit.

### Task 5: Add contextual Excel download and upload

**Create:** `server/imports/{workbook,parse-workbook,column-map}.ts`, `src/features/imports/{ExcelWizard,MappingReview}.tsx`, `tests/unit/workbook.test.ts`, `tests/fixtures/imports/`, `tests/e2e/excel-import.spec.ts`.
**Modify:** `src/pages/Residents.tsx`, `src/pages/Settings.tsx`, `package.json`.

**Interfaces:** `buildWorkbook(owner, entity, mode, scope, locale): Buffer`; `parseWorkbook(buffer, templateVersion): ParsedWorkbook`; feed normalized results into Task 4, never a second write implementation.

- [ ] Add round-trip fixtures for Add/Update/Remove/Replace with existing records, renamed headers, added newspapers, obsolete exports, deleted metadata, unknown codes and localized text.
- [ ] Implement downloadable templates, complete current values in the appropriate modes, dropdown validation, frozen headers, clear date/quantity instructions and error workbook download.
- [ ] Implement safe parsing, deterministic aliases, resource limits and editable field mapping. Cover literal text export, formula rejection, malformed archives, ambiguous dates and leading-zero identifiers.
- [ ] Test the exact customer MM/HD/MB example, change locale between export/import, and verify blank-update versus zero-stop behavior. Test 5,000-row imports on staging and document measured duration/memory before release; commit.

### Task 6: Add optional AI entry

**Create:** `server/ai/{provider,schemas,routes}.ts`, `src/features/imports/AiEntry.tsx`, `tests/integration/ai-entry.test.ts`.
**Modify:** `.env.example`, server configuration, Customers/Newspapers entry actions.

**Interfaces:** `suggestChanges(owner, text, locale): ProposedChangeSet`; `suggestColumnMap(headers, redactedSamples): ProposedColumnMap`. Both produce proposals for Task 4 with unresolved fields, never direct commits.

- [ ] Mock provider responses for missing dates/rates, malformed JSON, prompt injection in a cell, duplicate customer names, ambiguous “Hindu”, mixed-language input and unavailable provider.
- [ ] Implement server-only provider configuration, response schemas, limits, timeouts and data minimization. Determine the actual provider/key name from authorized deployment configuration; do not assume the existing key is an OpenAI key.
- [ ] Add human-readable editable previews and warnings for inferred fields; keep deterministic imports usable during AI failures.
- [ ] Verify browser bundles and logs contain no secrets and no AI output bypasses validation. Run mocked focused tests; use a small authorized staging request for provider connectivity, then commit.

### Task 7: Complete language and accessibility support

**Create:** `src/i18n/{index,en,hi,ml}.ts`, `src/components/common/LanguageSwitcher.tsx`, `src/i18n/format.ts`, `tests/unit/locales.test.ts`, `tests/e2e/languages.spec.ts`.
**Modify:** `src/app/App.tsx`, `src/components/header/PageHeader.tsx`, all implemented feature screens, workbook generation and bill rendering.

**Interfaces:** `t(key, params)`, `formatMoney(paise, locale)`, `formatBusinessDate(date, locale)`; API returns stable error codes plus parameters.

- [ ] Test identical locale key coverage, selected-language persistence, fallback behavior, dates independent of machine timezone and cross-language workbook round trips.
- [ ] Translate every implemented user-facing flow, including errors and destructive-action summaries. Load suitable script fonts with fallback and update document language.
- [ ] Verify language switching preserves unsaved form/import state, identifiers, codes and quantities. Test long Malayalam labels and localized bill output.
- [ ] Obtain native Hindi/Malayalam review for billing and removal wording; record corrections. Run keyboard/mobile/zoom checks and focused tests, then commit.

### Task 8: Migrate, release and verify deployment

**Create:** `docs/deployment/owner-workflow-runbook.md`, migration scripts/tests for any discovered legacy data; add `render.yaml` only after confirming current Render resources and avoiding duplicate services.
**Modify:** production build/start configuration, README and `.env.example` based on the confirmed service.

- [ ] Record baseline production behavior and database backup; rehearse migration and restore on staging. If no backend exists, deploy the new API/database first and verify owner isolation before enabling data entry.
- [ ] Run `npm test`, `npm run test:integration`, `npm run test:e2e`, `npm run build`, `npm run lint`. Fix failures attributable to this work; explicitly record unrelated baseline failures.
- [ ] Configure runtime secrets on the server, database URL, allowed origins, sessions and SPA fallback. Verify deep links, HTTPS cookies, health checks and build output. Never expose AI keys through Vite configuration.
- [ ] Release behind independent switches for Excel and AI. Verify a controlled test business: download template, add/update/archive, change a mid-month rate, inspect daily history, finalize a bill and switch all languages. Do not put fake customers into a real owner's account.
- [ ] Monitor errors, import failures and billing discrepancies after release. Roll back the application if needed; prefer forward database fixes and preserve new writes. Restore backups only after assessing data loss and explicit authorization. Record the deployed revision, checks and unresolved limits.

## Setup and decisions before execution

1. Confirm which Render service and source directory are live. The root scaffold and nested demo are different apps.
2. Confirm or provision the persistent database and owner sign-in. No such infrastructure is established by repository evidence alone.
3. Confirm the actual AI provider and secret variable name. The Render connector available here can update secrets but cannot retrieve their values; an existing secret cannot be copied into `.env` through it. Keep `.env` ignored and provide only names/placeholders in `.env.example`; use a supported authorized local secret transfer if local AI calls are needed.
4. Approve monthly fixed-plan proration and any separately agreed service-fee/leave policy before charging real customers. Daily issue-rate calculation does not depend on that choice.
5. Approve the proposed design after reviewing the deployment findings. This draft has not passed Octopus multi-provider validation or a separate builder review; do not describe it as execution-ready until those missing project facts are resolved.

## Planning estimate

Budget roughly 15–25 engineering days for one implementer, including the missing backend, migrations, integration tests, translated workflows and staged rollout; allow 2–4 additional working days for native-language review and owner field trials, possibly overlapping. This is a planning range, not a delivery promise. Re-estimate after inspecting Render and confirming whether production uses the nested demo or root scaffold. Ship foundations and deterministic Excel before adding optional AI.

## Local setup verification, 26 October 2026

Repository cloned into the requested project folder. Root dependencies installed from `package-lock.json` using `npm ci` through a temporary npm runner because npm was not on PATH. Installation added 175 packages and reported three high-severity advisories; advisory details have not yet been investigated and no automatic dependency fixes were applied. The nested Figma demo's separate dependencies were not installed.

TypeScript `tsc -b` passed. Vite production build passed. Repository-wide ESLint failed on two existing `no-explicit-any` errors at lines 235 and 236 of the nested demo's `vite.config.ts`. No automated behavior tests exist in the configured root app, so a passing build is not evidence of working import/billing features. Only this planning document is a tracked-file addition; no product features or deployment changes were made.

Render listed Paul's single available team as `Paulson's workspace`; workspace confirmation is pending before service inspection. Secret values were not retrieved, printed or written locally. A real local `.env` remains unconfigured.
