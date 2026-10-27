# Owner workflow release runbook

Release target: existing `presstrack-paulson` web service in the user-confirmed Paulson's Render workspace. Keep the existing Free instance, MongoDB connection, server-side Groq secret and auto-deploy setting. Never apply a second Blueprint to create duplicate infrastructure.

## Compatible data changes

This release adds import templates/batches/audit records, rate previews, AI quotas, optional publication code/edition and bounded rate intervals. Existing society/customer/subscription identifiers, memberships, delivery snapshots, payments and invoice totals remain unchanged. Staff assignment becomes optional for new owner subscriptions; historical staff records/accounts remain protected. Legacy `/delivery-boy` links redirect to the owner round in the new navigation.

Startup creates indexes for new metadata and optional unique publication codes. Old records without a code are excluded from the partial index. No script rewrites existing prices or deletes customer/staff history during deploy. A versioned interval is saved only after the owner confirms a dated preview, and the UI explicitly warns about unknown historical coverage.

## Release steps

1. Run `npm test`, `npm run test:e2e`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run build:server` and `npm audit --omit=dev`. On this Windows development host the disposable test database requires permission to launch; limit Vitest database workers to two to avoid startup contention.
2. Push the verified implementation branch, create a reviewable PR targeting `feat/presstrack-complete`, and integrate only the tested revision. Render auto-deploy is off, so trigger exactly one deploy after the deployed branch contains that revision. Record the PR, commit and deploy ID.
3. Monitor that deploy to `live`; verify `/api/health`, frontend pages and the anonymous/cross-origin protections. Use a dedicated synthetic business for hosted write verification. Never run import replacement smoke tests against a real customer's business.
4. In the test business, create one publication, download/edit/upload a customer workbook, review and commit, inspect a date-bounded rate and daily history, and switch languages. Verify the Groq review payload contains only publication choices; private customer fields must not appear. An absent/unavailable provider must leave deterministic Excel and manual entry usable.
5. Record observed results in the implementation ledger. Do not interpret `live` alone as proof of business behavior, native translation quality or database restore readiness.

## Privacy and secrets

AI entry accepts only explicit publication codes, quantities and a start date, reconstructs public newspaper names on the server, shows the exact choices to the user and requires consent plus an unchanged payload hash. It validates model output against the reviewed choices; models never save records. Customer fields reach only the authenticated PressTrack import preview/commit endpoints. Existing read-only chat withholds raw user text/history and personal tool fields from the provider.

The server expects existing `MONGODB_URI`, `GROQ_API_KEY`, `GROQ_MODEL` and origin settings. Local `.env` is ignored; no real secret was retrieved through the connector or copied into the repository. Keep all keys out of Vite configuration/browser assets. Groq integration can be verified using synthetic newspaper choices on the hosted service without copying its secret locally.

## Recovery

Retain the previous live commit `45db8aa300ea1d0060d1e1549e97a5fa5975764f` as a code rollback reference. Code rollback does not undo imports, confirmed rates, payments or adjustments. Prefer a compatible forward fix; use a database backup restore only with explicit authorization and an assessment of intervening writes. Rehearse the actual Atlas-tier export/restore separately before relying on it for live financial records.

Native Hindi/Malayalam review and maximum-width import load testing remain pilot follow-ups. The local 5,000-row benchmark is not a guarantee of production memory/latency for every workbook.
