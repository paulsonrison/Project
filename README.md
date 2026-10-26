# PressTrack

A newspaper delivery desk for housing societies: residents, subscriptions, carrier rounds, delivery outcomes, holiday pauses, invoices, manual payments and a private account assistant.

## Local development

Use Node 24 and npm. Run `npm ci`, copy `.env.example` to `.env`, and supply a MongoDB replica-set URI plus APP_ORIGIN. Run `npm run dev:all`; the frontend is on port 5173 and proxies `/api` to port 3001. For an isolated synthetic-data preview, run `node node_modules/tsx/dist/cli.mjs tests/dev-server.ts` and Vite on 127.0.0.1:5173. This test preview resets with its disposable database.

Create a new society workspace through sign-up. It creates an isolated administrator membership, not access to any existing society. Administrators create residents/staff and issue private 48-hour invitation links. Linked residents see their own records; staff see current assigned stops and cannot access finances. Account recovery/email delivery and multi-membership selection require further setup before a general public launch.

## Workflows

- Add residents, staff and publications in the catalog, then assign dated subscriptions and route order.
- Prepare a daily manifest. Record delivered, partial, missed or publisher-cancelled outcomes. Holiday pauses apply prospectively with the stated 18:00 cutoff.
- Close a billing month only after all eligible delivery dates are reconciled. Generate draft bills, issue them, and record manual payments or credits. Ledger reversals preserve original entries; applying available credit is explicit.
- Use `/chat` for read-only account questions. GROQ_API_KEY is a server secret and GROQ_MODEL selects an available tool-capable model. Tools apply server identity scope; records and history are private to a user and society.

Money is stored in INR minor units. Service dates use Asia/Kolkata; audit timestamps use UTC. Existing subscription history is preserved by stopping and replacing subscriptions when paper/quantity changes. No card data, automated online payments or SMS/WhatsApp messages are processed.

## Verify

`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run build:server`.

`npm run test:e2e` uses a disposable MongoDB replica set and Chromium (`npx playwright install chromium` first). Integration tests download an official MongoDB test binary on first run. Windows may require permission for local subprocesses. CI runs the same checks on Linux.

## Deployment

See [free Render deployment](docs/deployment.md) and `render.yaml`. The service plan is Free and the built frontend/API share one origin. Configure MongoDB and Groq secrets in the host, not Git. No production deployment or Atlas backup coverage is implied by these files.

The bundled Figma export remains under `DesignDemoFromFigma/` as the confirmed visual/behavioral reference. The production app uses its editorial cream, black and red identity with responsive navigation and reduced-motion support. Pixel-identical comparison across every reference state has not been completed.

See [implementation status](docs/implementation-status.md) for verified coverage and remaining launch work.
