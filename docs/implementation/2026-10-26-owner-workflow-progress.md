# Execution ledger — owner workflow

Approved plan: `docs/superpowers/plans/2026-10-26-newspaper-owner-deployed-app.md`.

Implementation branch: `feat/owner-excel-workflow`, based on `origin/feat/presstrack-complete` at `bb683ba`. Render currently runs `45db8aa`; the later baseline commit contains deployment documentation. Work stays in the requested project checkout on a dedicated branch. No destructive checkout/reset was used.

## Progress

1. Baseline: main's dependencies were replaced with the deployed branch's locked dependencies. Initial runtime dependency audit had no advisories. Existing eight MongoDB integration tests passed when allowed to launch the local disposable database; restricted execution caused MongoDB startup failure before assertions.
2. Owner workflow: implemented staff-free subscriptions, Today and catalog navigation, reviewed batch delivery confirmation; verification in progress.
3. Rates: bounded intervals, preview/commit, daily history and immutable billed snapshots implemented; new unit and transaction tests pass.
4. Imports: server-side reviewed changes, transactional commit, contextual workbook download/upload and four mode UI implemented; extended regression/security review in progress.
5. AI: reviewed Groq entry proposals implemented. The user explicitly restricted external requests to nonpersonal newspaper choices. Customer names, flats, addresses and phones stay on PressTrack's save path; the Groq endpoint rejects those fields. Existing chat now sends canonical intent plus numeric/date/status data instead of raw questions, private record fields or conversation history.
6. Languages: English/Hindi/Malayalam provider, translated screens, selector and font support implemented; browser verification in progress. Native-speaker review has not occurred.
7. Deployment: not yet published. Keep existing Render service, MongoDB and secrets. No local secret copied or exposed.

## Implementation choices

Keep society IDs as the business isolation key; admin is the owner. Preserve legacy staff and resident accounts/history instead of deleting them. Replacement uses an exported snapshot and explicit removal markers; missing rows are errors. Standard deterministic templates do not call AI. Localized workbook instructions retain canonical stable headers for cross-language round trips. Fixed monthly plans remain separate from per-issue month overrides and need agreed billing policy before activation.

## Checks to complete

- Full unit/integration suite, typecheck, frontend/server build and lint.
- Browser tests for owner, Excel and all languages; inspect mobile/desktop screenshots.
- Review dependency advisories introduced by workbook tooling.
- Review financial-data changes, deployment backups/migration compatibility and staged live smoke checks.

This ledger records work in progress, not a completion claim.

## Release verification — 27 October 2026

Owner, import and rate transaction suites passed. The complete suite reached 68 passing tests before the final debit/reversal and localized-assistant regression additions; final full rerun follows those additions. Six browser scenarios passed: public navigation, existing account flow, staff-free round, contextual Excel import, private-field separation in AI entry, and language switching with preserved form state. Frontend/server typechecks, builds and lint passed before the last reviewed billing fix; rerun required before commit.

Independent review found historical subscription matching, eager historical rate resolution, competing manual/import writes and a debit-reversal credit-cap edge case. Each was reproduced and fixed with regression coverage. Manual creates and import commits now share a tenant transaction guard. Added charges and credits retain original invoice totals, and debit reversal releases excess payment allocation without losing customer credit; reversals exceeding the original invoice credit cap are blocked.

A synthetic 5,000-row, 9-column workbook build+parse completed locally in 1.90 seconds, produced 223,712 bytes and used 234 MB RSS (139 MB additional). This measures local workbook processing only, not remote network/database performance or maximum-width files. Workbook tooling's vulnerable transitive UUID was overridden with compatible v11; subsequent package audit reported zero advisories.

Native-speaker review remains outstanding; uncommon dynamic errors fall back to English. Fixed monthly fee plans, an offline workflow and advanced per-customer schedule sheets are not part of this release. The pilot continues to use actual delivered copies and existing publication schedules. No destructive data backfill is required; interval migration happens only when an owner reviews and confirms a rate change. Database restore rehearsal remains an operational pilot requirement rather than a completed claim.

Final local release checks: **71 tests passed across 20 files**, frontend/server TypeScript checks passed, ESLint passed, frontend/server production builds passed, `git diff --check` passed, and production dependency audit reported **zero vulnerabilities**. Six browser tests passed before the final small credit/locale additions; final browser rerun is in progress. Independent scoped re-review approved the debit-reversal invariant and found no remaining blocking issue. The deploy branch remained at `bb683ba` when fetched immediately before integration.
