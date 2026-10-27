# Execution ledger — simple uploads and settings

Approved plan: `docs/superpowers/plans/2026-10-27-simple-upload-settings-ui.md`.

The user approved implementation and deployment on 27 October 2026, adding a requirement to reduce the crowded sidebar and use tabs. Work branch: `feat/simple-upload-settings`, based on `0ea3f0a` of the current deployed branch. Preserve current bills, rates, records and privacy decisions.

## Decisions

- Five owner sidebar destinations: Today, Customers, Newspapers, Bills, Settings. Related screens use route-based page tabs; old deep links remain valid.
- One Upload file action per applicable entity page. Automatic local extraction and sanitized AI interpretation lead to a short review before Save.
- Default included AI remains selected; custom Groq keys are optional, server-encrypted and tenant-scoped. Header and settings language choices share server preferences.
- Customer personal data, original files and unredacted OCR text must never be sent to Groq. Custom keys do not waive privacy.
- Supported formats are enabled only after adapter and resource verification. Local OCR requires locally bundled language data and a deployment resource gate; no personal documents go to cloud vision.

## Work tracking

1. Dialog/header/plain language/five-item navigation and page tabs: complete.
2. Preferences, key encryption and first-use settings: complete.
3. Local file extraction and security fixtures: complete.
4. Upload jobs, normalization/privacy, review and save: complete.
5. Integration/visual verification, review and existing-service deployment: complete.

Release evidence follows.
## Verification — 27 October 2026

Implemented the five-destination navigation and related page tabs, centered responsive dialogs, right-aligned language control, simple copy, first-use/settings preferences, encrypted optional Groq keys, and unified uploads with editable review before saving.

Supported files: XLSX, CSV, TSV, TXT, DOCX, PDF and PNG/JPEG/WebP. Up to 10 MB; bounded pages, rows, pixels and processing time. Unsupported/encrypted formats are rejected. Bundled English/Hindi/Malayalam OCR runs locally. AI receives canonical field names/counts only; no customer values, files or OCR text. Ambiguous information remains for the owner to check.

Verification: 31 test files / 100 tests passed; seven browser tests passed, including mobile/tablet/desktop dialog geometry, five navigation destinations, upload review, language persistence and optional key settings. Frontend/server type checks, lint and production builds passed. Synthetic three-language OCR completed locally in 2.57 seconds with peak process memory around 214 MB; production Linux behavior is additionally checked by CI. Source review fixes have regression tests.

Render configuration merged only the new encryption master and OCR settings; existing credentials preserved. Secret values were not written to repository files or displayed. Deployment and read-only hosted verification completed. No new live customer/financial write tests performed under the earlier one-off test permission.

## Release

PR #27 merged as 35dbf99a1753928d6d46a26bc8035cacb0c8172d after Linux CI passed all checks (100 tests and seven browser scenarios, including bundled OCR). Render deploy dep-dbg8fbsipgvc73er6k70 became live at 2026-10-27 11:16 UTC. Hosted app and bundle return 200; /api/health returns ready after database ping; private preferences/upload endpoints return 401 anonymously. Served bundle includes unified uploads, both AI choices, all three locales and new tabs. Production dependency audit: zero reported vulnerabilities.

Hosted write/OCR resource smoke was not repeated; OCR was exercised locally and in Linux CI. Source review's final sample-download busy-lock finding was reproduced, fixed and verified by the focused UI test before the green release CI.
