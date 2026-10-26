# Free deployment

The application serves the built frontend and API from one Node process. `render.yaml` requests a **free** Render web service; it creates no paid database or disk. Reuse the existing free MongoDB Atlas cluster with a dedicated application database and least-privilege readWrite user. Groq usage is subject to its own account limits; never enable paid capacity without the owner's approval.

## Deploy

1. Connect the Render integration/account and connect this repository. Select the feature branch for a pilot, or merge a reviewed PR before using main. Apply the Render Blueprint and confirm the service plan remains Free.
2. Supply MONGODB_URI as a secret. Set APP_ORIGIN to the exact HTTPS Render service URL with no path. Set GROQ_API_KEY as a secret and GROQ_MODEL to a currently available tool-capable model. No secret uses a VITE_ prefix. Never commit `.env` files.
3. Configure Atlas access to the service's published outbound addresses using the narrowest supported rules. Do not open 0.0.0.0/0 as a workaround. Verify readiness at `/api/health`.
4. Open the live HTTPS page and create the first society account. New workspaces are isolated; resident/staff invitations are created by their society admin. Invite links expire after 48 hours and should be shared privately by the admin.
5. Verify sign-in, persistence across restart, one delivery/invoice/payment cycle and a scoped chat answer before using real records.

Free Render services currently sleep after 15 idle minutes and may take about a minute to wake. Local filesystem changes are not persistent; all application records/sessions live in MongoDB. Source: https://render.com/docs/free (checked 2026-10-26). This is suitable for a pilot; availability and quotas remain subject to the provider. No always-on promise is made.

## Recovery and privacy

Confirm actual Atlas-tier backup/export support before entering real data. Perform an encrypted export and restoration rehearsal in a separate database; record operator, timestamp and restored record counts. Do not assume automatic backups on a free cluster. Deployment rollback restores code, not database changes: preserve compatible schemas and back up before migrations.

Sessions are server-side opaque tokens with seven-day expiry. Credentials use salted scrypt; no plaintext password is stored. Failed login attempts and chat requests are rate-limited. Restrict logs to request IDs/error types. Chat data sent to Groq is an authorized, minimal projection; review Groq Data Controls before enabling real accounts. Chat messages expire after 30 days and users can delete their conversation history.

Current limitations must be verified against `docs/implementation-status.md` before production. Browser printing supplies statements. No live online payment processing or external SMS/WhatsApp provider is configured. The system records manual payments only. Contact page directs users to their local society contact instead of pretending to send messages.
