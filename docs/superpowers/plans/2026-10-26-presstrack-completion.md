# PressTrack Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Complete PressTrack with the confirmed Figma UI, authenticated MongoDB backend, real delivery/accounting workflows and private Groq chat.

**Architecture:** Preserve the React/Vite frontend. Add a single TypeScript Express API using the MongoDB driver, with server-enforced society and role scopes shared by REST handlers and assistant tools. Keep financial calculations deterministic and invoice history immutable.

**Tech Stack:** Existing React, React Router, Tailwind, TypeScript and Vite; proposed Express, MongoDB driver, Zod, Argon2, Vitest, Supertest, Testing Library and Playwright. Use native fetch for Groq and native CSS for simple motion.

**Spec:** [PressTrack-Design.md](PressTrack-Design.md). Read it before implementation. Architecture and policy defaults are proposals pending review.

**Estimated effort:** 15 milestones, roughly 12–20 focused engineer-days including integration and visual verification; revise after baseline dependency checks. This is a planning range, not an execution deadline.

## Status and prerequisites

Repository cloned at commit `e17eeba0d57a0260c325a1f4675a92b1c6271746`. Reference and role limits confirmed. Atlas Project 0 / Cluster0 discovered read-only. No product code changed. Dependencies not installed; Node 24.19.0 is available but npm is absent from PATH. A bundled pnpm exists but do not silently replace the repository's declared npm workflow.

The immediate prerequisite is restoring npm, followed by registry/version checks and installing the root application. Do not install or deploy the Figma export as the production app. This draft can be refined without product code changes; execution starts after design review. Copies of these documents should go under `docs/superpowers/specs/2026-10-26-presstrack-design.md` and `docs/superpowers/plans/2026-10-26-presstrack-completion.md` when adopting the plan in the repository.

## Global constraints

- Every collection and repository operation is scoped by societyId; personal/assignment constraints are added before querying.
- Money uses integer minor units and a society currency with a defined exponent, initially INR / 2.
- Use society-local date-only service dates and an explicit IANA timezone, default Asia/Kolkata for initial setup.
- Groq requests originate only on the server using GROQ_API_KEY and GROQ_MODEL, never VITE-prefixed secrets.
- Issued lines retain delivery date, quantity, applied price/rule and currency.

## Review focus

| Failure mode | Required proof | Owner |
|---|---|---|
| Cross-user, cross-society and guessed thread IDs | Reject API, export and chat access even with prompt injection | 2, 12 |
| Dates around cutoff, leap years and subscription boundaries | Exact eligible dates; no timezone drift or duplicate paused days | 4 |
| Two invoice/payment submissions or retry after timeout | One financial effect, auditable replay or 409 | 7 |
| Carrier reassignment or member removal during a session | Old access revoked and no stale data reused in chat | 2, 6, 12 |
| Interrupted motion and network failure while saving | No trapped focus, hidden active overlay or false success | 8–13 |

## File and interface map

Paths below are relative to the cloned `Project/` repository. Existing pages stay thin. New server files live under `server/`; browser features under `src/features/`; shared JSON contracts under `shared/`.

`server/app.ts` produces `createApp(deps): Express`; `server/index.ts` owns startup/shutdown. `server/db/connect.ts` owns Mongo connection/index setup. `server/auth/scope.ts` produces `requireScope(session, membership): AccessScope`, containing server-verified userId, societyId, role, residentId/staffId. Repositories consume this object and never accept unscoped access.

`shared/contracts.ts` contains public DTOs, roles, DateOnly, YearMonth and minor-unit money; avoid exporting raw database documents. `server/domain/schedule.ts` produces `getServiceDates(subscription, publication, pauses, range, policy): DateOnly[]`; `pricing.ts` produces `resolvePrice(publication, date): ResolvedPrice`; `billing.ts` produces `buildInvoiceDraft(deliveries, adjustments, fees): InvoiceDraft`.

`server/chat/tools.ts` produces `buildTools(scope): AuthorizedToolSet`; `server/chat/service.ts` produces `answerMessage(scope, threadId, text, signal): Promise<ChatReply>`. `src/services/api.ts` is the credentialed typed client; feature services consume DTOs rather than Mongo types.

## Execution cycle

For every behavior milestone: write the named failing tests, run the focused suite and record failure, implement the listed contract, rerun until passing, then commit only that milestone's files. Proposed scripts below must be added in Task 1. No baseline checks have run yet.

### 1. Establish a reproducible application and test baseline

**Files:** modify `package.json`, `.gitignore`, `vite.config.ts`, `eslint.config.js`; create `server/tsconfig.json`, `vitest.config.ts`, `playwright.config.ts`, `.env.example`, `server/config/env.ts`, `server/config/env.test.ts`.

- [ ] Restore npm using the available Node installation; verify npm --version. Check the manifest's existing version ranges against the registry before selecting replacements. Preserve intended compatible majors unless evidence requires a change.
- [ ] Run npm install, record resolved versions in the root package-lock.json and run existing build/lint. Record baseline failures separately from new ones. Keep the nested reference excluded from production compilation and feature tests.
- [ ] Add dev:server, dev:all, build:server, typecheck, test, test:integration and test:e2e scripts. Retain existing frontend scripts; configure /api proxy in Vite.
- [ ] Test missing/invalid MONGODB_URI and session configuration cause startup failure, and GROQ_API_KEY never enters public config. Implement env parsing; .env.example contains placeholders only. Ignore .env files while retaining .env.example.
- [ ] Verify build, lint, typecheck and a real test run; commit the verified baseline. Never claim tests pass because the runner found zero tests.

### 2. Implement identity, sessions and the access boundary

**Files:** create `server/app.ts`, `server/index.ts`, `server/auth/{passwords,sessions,scope,routes,invitations}.ts`, `server/auth/access.integration.test.ts`, `shared/contracts.ts`; modify `src/hooks/useAuth.tsx`, `src/pages/SignIn.tsx`, `src/app/AppRouter.tsx`.

**Contract:** GET /api/v1/auth/session returns authorized user/membership DTO or 401; POST /auth/login creates opaque session; POST /auth/logout revokes it. AccessScope is constructed only after verifying membership. Invitation acceptance cannot select a different role or society.

- [ ] Test invalid credentials, expiry, logout, CSRF rejection, role escalation, guessed resident IDs and society switching. Assert resident A cannot read resident B and staff cannot read invoices.
- [ ] Implement hashed passwords, session storage/cookies and login rate limits. Add one-time admin bootstrap and single-use invitation acceptance; no demo password fallback.
- [ ] Test membership removal immediately invalidates protected access; staff reassignment is re-evaluated on each resource request.
- [ ] Wire protected routes and sign-in/logout/expired-session states. Persist return location safely to a local route only.
- [ ] Run auth integration tests against an isolated test database, browser sign-in flow and typecheck; commit.

### 3. Persist the catalog, residents and subscriptions

**Files:** create `server/db/{connect,indexes}.ts`, `server/features/{residents,publications,staff,subscriptions}/{repository,routes}.ts`, `server/features/entities.integration.test.ts`, `shared/schemas.ts`, `src/services/api.ts`.

**Contract:** paginated GET and validated POST/PATCH endpoints for each entity. Subscription DTO includes residentId, publicationId, startDate, endDate, quantity and effective versions. All repository signatures require AccessScope.

- [ ] Test invalid dates/prices/quantity, cross-society references, duplicate active subscriptions, archived references and pagination limits.
- [ ] Implement tenant indexes, validated CRUD, optimistic revisions and archive semantics. Do not physically delete financial history.
- [ ] Add credentialed client with typed errors, cancellation and 401 handling; retry reads only unless the mutation has an idempotency key.
- [ ] Configure a least-privilege staging database account and narrow network access; keep credentials out of source. Do not alter existing cluster data blindly.
- [ ] Run entity/isolation tests and confirm server restart retains synthetic records; commit.

### 4. Implement scheduling, pricing and pause policy

**Files:** create `server/domain/{schedule,pricing,dates}.ts`, corresponding `.test.ts` files; create `server/features/pauses/{repository,routes}.ts`.

**Contract:** getServiceDates returns unique sorted date-only values; resolvePrice returns `{amountMinor,currency,ruleId}` with specific-date > weekday > month > effective base precedence.

- [ ] Write fixtures for all seven demo schedules. Assert February 2028 daily count=29 and February 2027 count=28; monthly day 31 yields no February issue.
- [ ] Test inclusive start/exclusive end and merged pauses. For daily October 2026, subscription [Oct 10, Oct 20) minus pause [Oct 12, Oct 15) yields 7 service dates.
- [ ] Test price precedence using 100 base, 120 month, 150 Sunday, 200 explicit Sunday date: expected 200. Reject conflicting rules of equal priority.
- [ ] Implement approved cutoff policy and effective-dated prices; test local-time boundary immediately before/at/after cutoff. Surface late effective dates to users.
- [ ] Run domain tests without a database and pause API tests with all roles; commit.

### 5. Build the residents and settings workflows

**Files:** modify `src/pages/{Residents,Settings}.tsx`; create `src/features/residents/{ResidentsView,ResidentForm,SubscriptionEditor}.tsx`, `src/features/settings/{PublicationForm,StaffForm,SocietySettings}.tsx`, `src/features/residents/ResidentsView.test.tsx`.

- [ ] Render reference-matched tables, filters, paper assignment dialogs and effective dates using real API DTOs.
- [ ] Test save validation, API failure with retained form data, archive confirmation and server conflict recovery.
- [ ] Implement role-specific own-account views so residents do not load the society resident list. Staff gets only route-authorized records.
- [ ] Verify empty/new society, long names, multiple papers, archived publication and responsive forms.
- [ ] Run component/browser checks, compare against the reference and commit.

### 6. Implement daily manifests and delivery operations

**Files:** create `server/features/deliveries/{service,routes,repository}.ts`, `server/features/routes/{service,routes}.ts`, `server/features/complaints/routes.ts`, `server/features/deliveries/delivery.integration.test.ts`; modify `src/pages/DeliveryBoy.tsx`; create `src/features/deliveries/{Manifest,StopList,OutcomeForm}.tsx`.

**Contract:** manifest(date) creates/reads jobs idempotently; outcome(jobId,revision,status,reason) records an audited event and returns the current job. Route writes require revision; stale revision returns 409.

- [ ] Test repeated/concurrent manifest generation yields one job per subscription/date; paused and publication-cancelled jobs cannot be delivered without an explicit override.
- [ ] Test staff sees only assigned stops; substitute assignments apply only to their dates; reassigned staff loses access immediately.
- [ ] Implement delivered/missed outcomes, same-day redelivery resolution, complaint review and publication shortages. Snapshot required route/address data for history.
- [ ] Add per-paper quantity totals, unassigned-route warnings, printable manifests and mobile outcome controls. Failed saves stay visibly pending.
- [ ] Run delivery/route/complaint tests and a browser staff workflow; commit.

### 7. Implement invoice and payment accounting

**Files:** create `server/domain/billing.ts`, `server/domain/billing.test.ts`, `server/features/billing/{service,routes,repository}.ts`, `server/features/payments/{service,routes}.ts`, `server/features/billing/accounting.integration.test.ts`.

**Contract:** POST /billing/runs with YearMonth and Idempotency-Key creates drafts only after unresolved jobs are addressed; issueInvoice freezes lines; recordPayment creates ledger/allocation entries transactionally; reversePayment creates a reversal.

- [ ] Test 3 delivered issues at 100 minor units = 300; accepted missed/pause dates add zero; 2 copies multiply line quantity; pending delivery blocks finalization.
- [ ] Test an issued invoice retains old prices after catalog edits. Post-issue complaints create explicit adjustment records.
- [ ] Test concurrent generation produces one invoice; identical idempotency replay returns the original result; same key/different payload returns 409. Crash/retry must not leave half-created allocations.
- [ ] Implement integer ledger: invoice 1000, payment 400 -> remaining 600; next payment 700 -> paid plus 100 unapplied credit; reversing the first payment reopens the correct balance. Test failed transactions roll back.
- [ ] Verify against isolated replica-set/staging Mongo transactions, not mocks alone; commit.

### 8. Build billing screens and printable statements

**Files:** modify `src/pages/Billing.tsx`; create `src/features/billing/{BillsView,InvoiceDetails,PaymentForm,StatementPrint}.tsx`, `src/styles/print.css`, `tests/e2e/billing.spec.ts`.

- [ ] Implement month filters, bill draft/issue actions, itemized delivery/rate references, partial balances, payment references, reversals and credits.
- [ ] Restrict all controls and queries by role. Staff must never fetch billing payloads; residents receive own invoices only.
- [ ] Verify print shows society, resident, dates, currency, fees, adjustments, payments and outstanding balance without navigation chrome.
- [ ] Test interrupted saves and duplicate clicks; render server errors without changing balances optimistically.
- [ ] Complete a month-close and reversal browser flow, verify printed layout and commit.

### 9. Build the operational calendar

**Files:** modify `src/pages/Calendar.tsx`; create `src/features/calendar/{CalendarView,CalendarDayPanel}.tsx`, `tests/e2e/calendar.spec.ts`.

- [ ] Implement monthly reference layout with planned/delivered/missed/paused labels and a day panel backed by the same delivery service used for billing.
- [ ] Show subscription/price changes, publication cancellations and pause ranges with text as well as color.
- [ ] Test month boundaries, leap-year navigation, role-filtered details and no duplicate jobs when revisiting dates.
- [ ] Verify keyboard day selection, mobile day agenda and loading/error states.
- [ ] Run calendar end-to-end flow and domain regression tests; commit.

### 10. Complete shared UI, public pages and responsive navigation

**Files:** modify `src/components/navigation/Navigation.tsx`, `src/components/layout/{PageLayout,PublicLayout}.tsx`, `src/components/header/{PageHeader,PublicHeader}.tsx`, `src/pages/{home,AboutUs,ContactUs}.tsx`, `src/styles/{theme,components,index}.css`, `index.html`; create focused `src/components/ui/` primitives.

- [ ] Replace stub navigation with active route links and mobile drawer; replace percentage sidebar/w-screen layout with bounded responsive columns.
- [ ] Port confirmed reference hierarchy, typography and controls; use existing tokens. Render genuine dashboard counts and next tasks for each role.
- [ ] Complete public informational pages. Contact page uses a configured real destination/channel or explicitly shows contact details; never fake a sent confirmation.
- [ ] Implement accessible dialog primitives with focus trap/restoration, escape dismissal and clear disabled/saving states. Load fonts with fallbacks.
- [ ] Check 375px, 768px and 1440px widths plus 200% zoom; compare screenshots with the rendered local design reference; commit.

### 11. Implement authorized chat data tools

**Files:** create `server/chat/{toolSchemas,tools,tools.test}.ts`, `server/chat/tools.integration.test.ts`.

**Contract:** buildTools(scope) exposes only allowed read functions. JSON arguments contain dates/status/limits, never tenant identity, unrestricted filters, query operators or raw database commands.

- [ ] Test getMyInvoices/resident A returns only A; staff has no financial tool; getSocietySummary/admin cannot aggregate another society.
- [ ] Reuse scoped repositories and deterministic invoice/ledger totals. Apply record caps, schemas, minimal field projections and source references.
- [ ] Test hostile record text, forged IDs, Mongo operators and date ranges outside supported bounds cannot expand scope.
- [ ] Verify access after reassignment and membership removal; never cache authorization across messages.
- [ ] Run tool unit/integration tests; commit.

### 12. Implement Groq conversation service and private storage

**Files:** create `server/chat/{groq,service,routes,repository,prompts}.ts`, `server/chat/chat.integration.test.ts`; extend server environment schema.

**Contract:** POST /chat/messages accepts `{threadId?,text}` and returns `{threadId,messageId,text,references,dataAsOf}`. Thread reads/deletes require both owner and society. Unauthorized thread IDs return 404.

- [ ] Write provider-mocked tests for cross-user history, general/out-of-scope questions, missing records, fabricated tool names and prompt injection. Assert no denied operation reaches a repository.
- [ ] Implement bounded local tool loop with 4 rounds, 100 records/tool, 12 turns, 4,000 input characters and 30-second timeout. Validate all model-generated arguments before execution.
- [ ] Keep identity enforcement outside prompts. Send only needed authorized data to Groq; generate record references from actual tool output; never expose internal errors or keys.
- [ ] Add limits, cancellation, sanitized logs, configurable retention and user deletion. Test 429, provider timeout, disconnected client and partial failure; do not store a fabricated successful answer.
- [ ] Run mocked suite and one authorized staging Groq smoke test using server-only secret injection; inspect the browser bundle for secret/config leakage; commit.

### 13. Build the chat page and purposeful motion

**Files:** create `src/pages/Chat.tsx`, `src/features/chat/{ChatView,MessageList,Composer,SourceReference}.tsx`, `src/features/chat/chat.test.tsx`, `tests/e2e/chat.spec.ts`; modify router/navigation and CSS motion tokens.

- [ ] Add role-appropriate suggestions, private thread history, readable messages, authorized record links, cancel/retry and delete history.
- [ ] Display data timestamp and missing-data responses. Disable duplicate sends while preserving user draft on failure. Use text rendering or sanitized Markdown, never raw model HTML.
- [ ] Add 150ms control feedback and 200ms overlay transitions; animate opacity/transform only where they explain state. Respect prefers-reduced-motion; no extra animation dependency by default.
- [ ] Test focus, keyboard composer, screen-reader status, new messages without forced scroll, cancelled requests and interrupted overlay exits under reduced motion.
- [ ] Run resident/staff/admin chat flows plus cross-account attempts and mobile checks; commit.

### 14. Verify the complete business workflow

**Files:** create `tests/e2e/month-close.spec.ts`, `tests/e2e/isolation.spec.ts`, `tests/fixtures/scenarios.ts`, `docs/verification.md`.

- [ ] Seed synthetic societies A and B with admin/resident/staff identities; include overlapping names and guessed object IDs to expose accidental scoping gaps.
- [ ] Run onboarding -> subscription -> pause -> route assignment -> shortage/missed delivery -> complaint -> month close -> partial payment -> reversal -> assistant explanation.
- [ ] Test simultaneous invoice runs and stale route edits, leap dates, cancelled subscriptions, empty society, unavailable API and expired sessions.
- [ ] Run npm run build, build:server, lint, typecheck, test, test:integration and test:e2e. Record actual results and remaining failures; do not broaden tests without a new risk or change.
- [ ] Capture reference comparisons and normal/reduced-motion mobile/keyboard evidence, fix material failures and commit.

### 15. Prepare deployment, recovery and pilot handoff

**Files:** create `docs/{deployment,operations,privacy}.md`, deployment configuration for the chosen host and `.github/workflows/ci.yml`; update README.

- [ ] Document environment names, same-origin routing, TLS/cookies, sessions, health/readiness endpoints, database indexes, migration versioning and graceful shutdown.
- [ ] Confirm staging/prod DB separation, least-privilege access, chosen Atlas backup coverage and an actual restore rehearsal. Do not promise automated backups on an unverified tier.
- [ ] Configure Groq model and data controls, redact logs and validate chat quotas and history deletion. Record approved business policy values.
- [ ] Deploy to staging, rehearse data migration/rollback and repeat the critical browser flow. Production rollout follows a reviewed staging result and deployment authorization.
- [ ] Deliver setup commands, pilot login provisioning and known limitations. Commit docs/config; open a reviewable draft PR if implementation is later authorized.

## Required review fixes incorporated into execution

1. **Tasks 6–7: month completeness.** Add `reconcileMonth(scope, yearMonth)` to the billing service. Enumerate eligible subscription/date pairs, upsert missing jobs and block invoice issuance until all are reconciled. Integration test: never open a manifest for an eligible date; month close creates its pending job and refuses issuance until a delivery outcome is recorded.
2. **Tasks 6–8: partial quantities.** Persist orderedQuantity/deliveredQuantity/billableQuantity and partial status. Assert three copies ordered/two delivered at 100 minor units produces 200. Redelivery of the third produces a total of 300 before issue; event replay cannot add a fourth copy. Render shortage counts in manifests and invoice details. Post-issue corrections use adjustments.
3. **Tasks 7–8, 11–12: adjustment accounting.** Implement credit notes that immediately reduce the original invoice receivable; excess allocated payments move transactionally to unapplied credit through allocation reversals. Tests: invoice 1000/payment 400/credit 200 -> due 400; invoice 1000/payment 1000/credit 200 -> due 0/credit 200. Reverse the credit note through a debit entry; reopen due without silently consuming credit. Test retry/transaction rollback, statement display and assistant totals. Do not edit original invoice lines or payment entries.

A fresh design reviewer identified these three gaps; the rules above resolve them. This was a design review, not implementation verification.

## Design review and execution handoff

The user confirmed the bundled Figma reference and role-based chat limits. Remaining launch decisions: pause cutoff and credit policy, fees/fixed plans/taxes, chat retention and deployment destination. They do not prevent preparing tests and scoped persistence, but their dependent behavior must not launch with silently assumed policy.

Recommended execution is native implementation in this chat with focused verification at each milestone and a fresh whole-project review. A subagent-per-milestone approach offers earlier independent checks at additional context cost. Execution method is not yet selected. No external provider consensus, paid Octopus research or visual QA has been claimed.
