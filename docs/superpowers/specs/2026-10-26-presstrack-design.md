# PressTrack completion design

Date: 2026-10-26. Status: proposed architecture; implementation approval pending.

## Confirmed scope

Complete https://github.com/paulsonrison/Project as a newspaper delivery management application. The user confirmed the bundled `DesignDemoFromFigma/Newspaper Management Software` is the design reference and accepted role-based chat access: residents see their own account, delivery staff see assigned delivery details, admins see their own society's records.

## Repository evidence

Inspected main commit `e17eeba0d57a0260c325a1f4675a92b1c6271746`. The repository is cloned to `Project/` in this workspace. Root application uses React 19, TypeScript, Vite, React Router, Tailwind and custom CSS tokens. Feature pages and navigation are stubs. Auth, hooks, services and context files are empty; `tests/test.tsx` is empty and no test runner is configured. The package name `express` does not mean an Express backend exists.

The bundled Figma demo has resident, calendar, billing, settings, public-page and login components, seed data, scheduling helpers and in-memory state in one large App.tsx. It is a behavioral and visual reference, not production persistence or authentication. Root PageLayout already derives its title from the URL; the README's hardcoded-title claim is stale. Percentage sidebar width and w-screen content need responsive correction.

Atlas inspection found Project 0 / Cluster0, free tier, Azure India Central, idle. No application database credentials, collection contents, or backup behavior were verified. No database or access-list changes were made.

## Goals and boundaries

Deliver authenticated, society-isolated persistence; usable reference-matched screens; delivery and billing workflows; a private read-only Groq assistant; deployment and recovery documentation. Preserve the existing framework and newspaper visual identity. Do not ship demo credentials, simulated successful contact submissions, fabricated assistant answers or seeded residents as real data.

Online payments, WhatsApp/SMS, supplier procurement, route optimization and AI-driven writes are separate integrations, not prerequisites for recording manual payments and deliveries. Provide print-friendly bills; PDF generation can follow if browser print is insufficient. The first release is online-first; do not claim offline delivery synchronization.

## Approaches considered

1. **Recommended: retain React/Vite and add one TypeScript Express API with the MongoDB driver.** Preserves existing work and accommodates Atlas, domain logic and Groq with one server authorization boundary. Requires deploying the API and configuring sessions.
2. Move to a full-stack React framework. Could colocate server rendering and routes but adds migration work without solving any current requirement better.
3. Ship the Figma demo using local storage. Fast for a demonstration, unsuitable for private user data, concurrent operations and reliable accounts.

Approach 1 is the author's recommendation, not a user-approved architecture decision. Deploy UI and API under one origin where possible. Use a Vite /api development proxy. Keep separate frontend and server TypeScript configurations.

## Identity and authorization

Membership contains userId, societyId, role and optional linked residentId or staffId. An authenticated request selects an active membership by validating it server-side. A client-supplied society or resource ID never establishes access.

| Role | Allowed data and actions |
|---|---|
| Admin | Manage only their society's catalog, residents, staff, subscriptions, routes, delivery exceptions, invoices and payments |
| Resident | Read their linked account, subscriptions, deliveries, bills and payments; submit their own pause requests and delivery complaints |
| Delivery staff | Read assigned route stops and minimal contact/instruction fields; record outcomes for authorized service dates; no resident balances or broad resident search |

Use hashed passwords, opaque server sessions in HttpOnly cookies, production Secure cookies, SameSite policy and CSRF/origin protection for mutations. Rate-limit login and chat. Bootstrap the first admin through a documented one-time server procedure; invitation tokens are expiring, single-use and hashed at rest. No public self-assignment of admin or staff roles. Session expiry, password changes and membership removal revoke access. Password reset needs a chosen verified email provider before enabling its UI; until then document administrator-assisted recovery.

Every collection and repository operation is scoped by societyId; personal/assignment constraints are added before querying. Cross-society IDs return 404. Privileged operations are explicitly role-checked. Chat history is private to the authenticated user and society, even between admins.

## Domain rules proposed for the first release

Use society-local date-only service dates and an explicit IANA timezone, default Asia/Kolkata for initial setup. Store audit instants in UTC. Money uses integer minor units and a society currency with a defined exponent, initially INR / 2. Currency becomes immutable once financial records exist; changing the symbol cannot relabel existing amounts.

Subscriptions have inclusive starts, exclusive ends, quantity, schedule and effective price history. Pause intervals are inclusive start/exclusive end, may be paper-specific and merge overlaps. Default pause policy: submitted before 18:00 local time on the preceding day; later requests take effect on the next eligible day and show the effective date before submission. Admin overrides require a reason. These cutoff and credit defaults require business approval before launch.

Price resolution retains the demo's precedence: specific date > weekday > month override > effective base price. Changes have effective dates; past bills retain snapshots. For day 31 in a shorter month and February 29 in a non-leap year, proposed behavior is to skip rather than move the issue date, with a visible configuration explanation.

Delivery jobs are unique per society, subscription and service date. States: pending, delivered, missed, publication-cancelled, paused. A failed attempt may be resolved by same-day redelivery, with an event history rather than a duplicate charge. Undelivered unresolved jobs cannot silently become charges. At month close admins resolve pending jobs explicitly. Approved pauses, publisher cancellations and accepted missed-delivery claims produce no per-issue charge. Complaints can be pending/accepted/rejected; rejection requires a reason. Already-issued bills receive an adjustment, not silent recalculation.

The first pricing model is per delivered issue with optional effective-dated delivery fees. Fixed monthly subscription plans require a separate billing mode before enabling them; do not interpret a monthly per-issue override as a flat monthly plan. Taxes are not inferred: establish applicable rules before enabling tax lines.

Invoices move draft -> issued -> partially-paid/paid, or void through a recorded operation. Issued lines retain delivery date, quantity, applied price/rule and currency. Prevent duplicate invoice runs using a unique society/resident/month key and idempotency records; transactionally create invoice and billed-delivery references. Payments use an immutable ledger with allocation, reference and reversal entries. A reversal reopens balances; overpayments remain unapplied credit. Never use a mutable paid boolean as the accounting source. No card details are stored.

Residents and papers with history are archived, not physically deleted. Moving address or changing carrier affects future routes and preserves delivery history. Route reorder uses optimistic revision checks to prevent silent concurrent overwrites. Daily manifests include totals per publication, staff coverage gaps and printable stop lists. Staff substitutions are date-bounded and audited.

## Data and API boundaries

Collections: users, sessions, societies, memberships, invitations, residents, publications, staff, subscriptions, pauses, routeAssignments, deliveryJobs, deliveryEvents, complaints, invoices, payments, paymentAllocations, adjustments, chatThreads, chatMessages, auditEvents, idempotencyKeys. Enforce unique membership, job and invoice keys; tenant/date indexes; expiry indexes for sessions and invitations. Validate all writes. Store only minimal account information in logs.

REST prefix `/api/v1`: auth/session; societies/current; invitations; residents; publications; staff; subscriptions; pauses; routes; deliveries; complaints; billing/runs; invoices; payments; adjustments; chat/threads; chat/messages. IDs and dates are schema-validated. List endpoints are paginated. Errors use `{error:{code,message,requestId}}`. Mutations with financial or delivery duplication risk take an Idempotency-Key. Concurrency conflicts return 409.

## Private assistant

Add protected `/chat`. Groq requests originate only on the server using GROQ_API_KEY and GROQ_MODEL, never VITE-prefixed secrets. Verify the chosen model supports local tool calls at implementation time. No unrestricted Mongo queries, web search, code execution or mutation tools.

Allowlisted tools: getMyAccountSummary, listMySubscriptions, listMyDeliveries, listMyInvoices, listMyPayments, getMyRoute, getSocietySummary. The server injects identity scope; tool arguments accept bounded dates/status, not arbitrary user/society IDs or database operators. Expose only tools permitted for that role. Admin tools are still society-scoped; staff tools exclude financial information. Use deterministic database aggregation for sums and balances.

Every factual account answer includes a reference to authorized records and data timestamp. Ask for clarification on ambiguous periods; say when records are missing. Reject unrelated general questions and requests for someone else's data. User and record text are untrusted context, never instructions that broaden access. Enforce scope and thread ownership on every call, including resumed conversations. Scope history by membership and revalidate access after assignment or role changes. Redact unnecessary addresses, phone numbers and financial identifiers before provider requests.

Proposed limits: 4,000 input characters, 12 retained conversation turns, 4 tool rounds, 100 records per tool call, 30-second provider timeout, 10 messages/minute/user and a configurable society quota. Return clear rate-limit/unavailable responses; retry only safe transient reads with bounded attempts. Users can delete their history; proposed retention is 30 days, subject to approval. Document provider data controls before production.

## Interface and motion

Rebuild the existing routes from the confirmed bundled demo using focused components, real API data and the existing CSS tokens. Preserve cream background, black editorial rules, red accents, sharp corners, Libre Franklin, Lora and DM Mono. Load fonts intentionally with fallbacks. Use existing CSS transitions before adding animation libraries.

Provide responsive sidebar/drawer navigation, clear page titles, filterable tables/cards, accessible dialogs and complete loading/empty/error/saving states. Chat includes prompt suggestions based on permitted data, response references, cancel/retry and a non-disruptive live status region. Keep keyboard focus stable during streaming and route changes.

Motion proposal: control feedback 150ms; overlays 200ms; short opacity/transform transitions. No transition:all or animated data-table reflow. Honor prefers-reduced-motion with immediate final states. Check keyboard operation, focus restoration, mobile touch, long content and interrupted dialog exits. Compare implemented screenshots with the local Figma export rendered at matching sizes; source inspection alone is not visual validation.

## Real-world comparison and evidence

These sources describe examples, not universal policies or local legal advice:

- NewsTeam terms describe holiday bill credits and same-day correction deliveries: https://www.newsteamgroup.co.uk/my-account/terms-of-service/
- Garners supports order changes, holiday stops, old bills and payments: https://www.garnersnews.co.uk/manage-my-account
- Garners requests 48 hours for a pause: https://www.garnersnews.co.uk/faqs
- Post-Gazette FAQ describes holds without credit, illustrating policy variation: https://ppgiservices.newscyclecloud.com/cmo/htm/faq.htm
- Groq local tool calling gives application code control of execution: https://console.groq.com/docs/tool-use/overview
- Groq data controls must be checked before production: https://console.groq.com/docs/your-data

The demo currently calculates scheduled issue totals without subscription validity, pauses or delivery outcomes, uses a paid boolean, and has no tenant isolation. Those gaps motivate the explicit domain rules above.

## Required accounting clarifications from review

Month close must enumerate every eligible subscription/date pair from effective history, create missing jobs and verify coverage before issuing bills. A date whose manifest was never opened cannot silently disappear. Missing and pending jobs block issuance until reconciled.

Delivery jobs also support partial status and store orderedQuantity, deliveredQuantity and billableQuantity. Enforce 0 <= billableQuantity <= deliveredQuantity <= orderedQuantity. Charge actual delivered copies. Three ordered/two received is partial and charges two copies. Redelivery adds only previously missing copies up to ordered quantity, using idempotent event keys; preserve event history.

Post-issue credits are immutable credit notes linked to the original invoice and immediately reduce its net receivable. If payment allocations exceed the new receivable, transactionally reverse the excess allocation into resident unapplied credit. Invoice 1000/payment 400/credit 200 leaves due 400. Invoice 1000/payment 1000/credit 200 leaves due 0 and unapplied credit 200. Reversing a credit note creates a debit adjustment and reopens that amount; applying available credit again requires an explicit audited allocation. Original invoice lines/payments remain unchanged. No automatic cash refunds or application to another invoice. Statements/chat show original charges, adjustments, allocations, credit and current due separately. These clarifications take precedence over simplified status descriptions earlier in this document.

## Completion and rollout

Completion means all shipped routes use persistent authorized data; critical domain and isolation tests pass; browser flows work across roles; screenshots match the reference; normal/reduced-motion keyboard and mobile checks pass; build/lint pass; environment, deployment, restore and rollback instructions are verified. No test, screenshot review, dependency installation or production readiness is claimed by this design document.

Roll out to a staging society using synthetic fixtures, rehearse a month close and payment reversal, verify backups/restore supported by the selected Atlas tier, then enable a pilot society. Do not infer backup coverage from the cluster existing. External messaging and live payment integrations remain off until separately configured and tested.

## Decisions and ownership

The user confirmed the reference and role-based access. Author proposes the architecture, date/billing defaults, online-first operation, read-only chat and limits. Business owner must approve pause cutoffs/credits, delivery fees, retention, fixed-plan requirements and any tax behavior before launch. The implementation engineer chooses compatible dependency versions after checking registry availability; no unsupported version upgrades or framework migration.

Decision dependencies: confirmed roles -> authorization -> data APIs -> chat; approved billing policy -> schedule/delivery engine -> invoice ledger; confirmed reference -> screen comparison. Atlas application credentials and restricted network access must be configured before integration tests against staging. Proposed decisions are recorded locally; no issue IDs or external tracker updates were fabricated.
