# Implementation and verification status

Updated 2026-10-26. This is a verified pilot implementation, not a claim that all production acceptance criteria in the design have been completed.

## Implemented

- Existing React/Vite architecture retained with newspaper-style tokens, loaded fonts, responsive navigation, landing/sign-in pages, dashboard, resident/catalog/staff CRUD, subscription routes, calendar, daily manifests, pauses, billing, payments, complaints, pricing and private chat pages.
- TypeScript API and MongoDB persistence with opaque sessions, salted scrypt, server-verified memberships, tenant filters, resident ownership, current staff assignments, cross-origin mutation rejection, input validation and optimistic revisions. New-society registration is isolated; admin invitations link residents and carriers. This is an explicit change from the design's initial bootstrap-only assumption.
- Seven publication schedule types, date-specific/weekday/monthly price precedence, effective price changes, subscription boundaries and prospective pauses. Delivered/partial/missed/cancelled outcomes, missing-manifest reconciliation, transactional invoice snapshots, manual payment/reversal ledger, credit notes and explicit credit reallocation.
- Groq read-only local tools, role-specific tool list, server-injected identity, strict tool arguments, bounded context, record references, user-owned history, deletion and 30-day message expiry. Live smoke test authenticated the supplied key and used qwen/qwen3.8-27b after the original model was unavailable. Authorized synthetic balance and unrelated-question refusal both succeeded. Key was not saved.
- Free Render Blueprint, one-origin frontend/API deployment, CI verification and setup/recovery documentation. No paid service was selected.

## Verification completed

18 backend/unit tests passed, including disposable MongoDB replica-set integration covering separate societies, invitation roles, private thread ownership, stale revisions, foreign references, pauses after manifest generation, partial quantities, invoice idempotency, payment credits/reversals, explicit reallocation and current-carrier access revocation. Two browser tests passed for public navigation/mobile overflow and registration -> persistent resident -> private chat error recovery -> reduced-motion mobile navigation. Frontend/server builds, typecheck and lint passed. Runtime dependency audit reported zero known vulnerabilities. These checks do not establish exhaustive correctness or accessibility conformance.

Independent code review found stale future job snapshots, stale carrier authorization, implicit credit consumption, delivery reads outside the invoice transaction, archive-date handling, inaccessible price edits, missing pagination and absent chat context. Fixes and regression tests were added. Review follow-up is recorded in the execution ledger.

## Remaining launch work

1. Pilot deployment is live at https://presstrack-paulson.onrender.com on Render Free in Singapore, from commit 45db8aa. GitHub branch is pushed and PR #25 is open as a draft. Auto-deployment is off.
2. A dedicated Atlas user with readWrite on presstrack is configured. Existing Singapore network rules allowed access without additional broadening. Live /api/health returned ready; public pages returned 200, anonymous resident access 401 and cross-origin mutation 403. Authenticated persistence/restart verification with a real user remains separate.
3. Rehearse backup/export restoration on the actual Atlas tier, code rollback and the authenticated hosted session flow. Public HTTPS landing and signup pages were verified. Free hosting sleeps and is subject to provider quotas.
4. Review all reference screen states against the rendered Figma export. The visual identity is preserved, but pixel-identical parity, a complete accessibility audit and exhaustive touch/keyboard/motion coverage are not claimed.
5. Confirm business-specific pause/credit/fee policies before real billing. Initial currency/timezone are INR/Asia-Kolkata. Fixed monthly plans, automated delivery fees/taxes, multi-society switching, password recovery/email provider, offline carrier sync, PDF download beyond browser printing and external SMS/online payments remain separate or unfinished work. Date-bounded substitute assignments are currently represented through dated replacement subscriptions; there is no dedicated substitution scheduler. Paper/quantity/resident changes after delivery history require stopping and replacing a subscription. Bulk assignment and drag reorder are not included.

Do not describe this as the entire original 15-milestone production plan being complete. It is a substantial tested pilot, with the items above explicitly outstanding.
