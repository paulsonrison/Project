# Simple Upload, Language and AI Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Track the checkboxes below. This is a proposed implementation plan, not a record of applied fixes or deployment approval.

**Goal:** Give a newspaper delivery owner one clear way to upload records, a properly centered dialog, a right-aligned language control, and simple first-use/settings choices for language and AI service.

**Architecture:** Keep the existing React/Vite interface, Express server, MongoDB, tenant authorization and transactional import preview/commit engine. Replace the separate Excel/AI entry interfaces with one upload workflow. Extract files locally, keep customer details inside PressTrack, and use the selected Groq credential only for sanitized structure and newspaper-field interpretation.

**Tech stack:** Existing React, TypeScript, Tailwind CSS, native dialog, MongoDB, Zod, ExcelJS, Groq, Vitest and Playwright. Add only the parsers demonstrated necessary by fixtures: CSV/TSV parser, DOCX text reader, PDF text/raster reader and local OCR. Verify dependency compatibility and license/provenance before installation; no OCR/vision capability is assumed from the current API key alone.

**User decision, 27 October 2026:** Show a short review before saving. The upload should read and match fields automatically; it must not silently save uncertain data or overwrite existing records. The earlier restriction against sending customer personal details to AI providers remains in force.

## Evidence and explanations

Baseline inspected: deployed source branch `feat/presstrack-complete`, local commit `0ea3f0a`. The two supplied screenshots show a Customers page with separate Excel and AI actions, an oversized slogan, the language selector between the title and date, and an upload dialog anchored at the top-left.

| Issue | Confirmed source evidence | Planned correction |
|---|---|---|
| Multiple upload-related buttons | `src/features/workspace/EntityView.tsx` renders both `ExcelWizard` and `AiEntry` for Customers, in addition to manual Add customer | One Upload file action; retain Add customer for manual entry |
| Dialog in the corner | `Dialog.tsx` uses `showModal()`; `.editor-dialog` sets width/height but no explicit centering; Tailwind `preflight.css` resets all margins to zero | Explicit viewport positioning and centering, independent of browser default margins; test the resulting bounding box |
| Language control in the middle | `AppShell.tsx` renders title, selector and date as three children under `justify-content: space-between` | Title on the left, one right-aligned action group with the language control at its far right |
| Wordy operational screens | `Screens.tsx` passes promotional descriptions into `EntityView` as the main heading; the shell repeats a tagline, route label and decorative footer | Literal page names and short instructions; remove repeated slogans from signed-in workflows |
| File support is currently Excel-only | `server/imports/routes.ts` accepts `.xlsx` only; `AiEntry` is a separate structured form, not a general document reader | Format detection and bounded local extractors feeding one shared preview |
| AI choice is not configurable per business | `server/config/env.ts` reads a single environment Groq key; current language preference is browser/per-owner local storage | Business-scoped AI preference and encrypted optional owner key; user-scoped persisted language |

The dialog diagnosis is strongly supported by the screenshot and CSS reset. During implementation, capture computed styles and browser geometry to prove the fix rather than claiming that `showModal()` itself is defective.

## Proposed product design

### 1. Simple operational pages

Customers page: heading **Customers**, search field, customer count, **Add customer** and **Upload file**. Newspapers uses **Newspapers**, **Add newspaper**, **Upload file**. Upload is a single secondary action adjacent to the manual Add action, not a separate row of competing methods.

Remove “Every doorstep. Every reader.”, “The newspaper desk”, “Your desk”, “A clear page”, numbered decorative ribbons and recurring motivational footers from signed-in work screens. Keep the brand name. Review public onboarding copy as well, replacing metaphors such as “Take your place at the desk” with “Sign in”. Preserve instructions that prevent wrong bills or data loss; shorten them and show them beside the relevant action.

Suggested replacement copy:

| Current | Replacement |
|---|---|
| Every doorstep. Every reader. | Customers |
| Add using Excel / Add with AI | Upload file |
| Add the first record to get your paper round moving. | Add a customer or upload a file. |
| Exact public payload for Groq | Information sent to AI |
| Replace selected scope | Replace selected records |
| Your morning, organized. / Create your workspace. | Set up your business |

Use 16px body text, readable labels, 44px minimum touch targets and restrained uppercase styling. Retain the cream, black and red identity. Keep customer-entered names and addresses unchanged in every language. Do not globally shrink text to fit Malayalam labels.

Avoid a navigation rewrite in this change: simplify captions and group secondary operational links only where the audit proves duplication. Preserve routes, bills, calendar access and existing user permissions.

### 2. Header language switching and transitions

Create a header action group with `margin-inline-start: auto`. Put the optional date before the language control; the control is the last visible item at the upper-right. On narrow screens, hide the nonessential date before moving or clipping the language control.

Use a compact accessible control showing the selected native language: **English**, **हिन्दी**, **മലയാളം**. Open a small anchored picker with the three choices and a clear selected state. Use native select if a custom picker does not justify its keyboard complexity; do not install an animation library for this control.

Set exact motion tokens initially to 160ms for the picker and 180ms for dialog opacity/short 4–8px movement. Honor reduced motion immediately. Do not remount the page, discard form state, reload data, move keyboard focus or animate every text node when language changes. A screen-reader announcement of the selected language is sufficient.

Store the authenticated user's choice on the server and cache it locally. First-use explicit selection overrides browser detection; otherwise initialize from the existing saved user preference, then supported browser language, then English. Keep the same choice in Settings and the header. Never let one account's saved choice replace another account's preference after a shared-device login.

### 3. Centered, accessible dialogs

Keep native `<dialog>` and `showModal()`. Explicitly set viewport-fixed positioning, inline/block inset and auto margins so CSS resets cannot pin it to a corner. Desktop: centered, width `min(680px, calc(100vw - 32px))`, max height `calc(100dvh - 32px)`. Small screens: 16px viewport gutter, full available width, internal scrolling with title/close and final action kept reachable.

Do not use an initial centering transform that is overwritten by the entry animation. Preserve the existing print stylesheet's static statement behavior. Restore focus to the opening button, support Escape, prevent background interaction/scrolling, and keep an accessible title and close label. Clicking the backdrop may close a pristine dialog; an in-progress upload/review must not be lost without an explicit discard choice. Network jobs must not depend on an animation-end event.

### 4. One upload workflow

The ordinary path is **Upload file → Reading file… → Check details → Save**. The app detects the format and interprets columns/content automatically. The user should not choose Excel versus AI, understand a model name or configure field mappings for a clear file.

The review shows “12 customers ready · 2 need attention”, a compact editable table/card list, and **Save 12 customers**. Show the source row/page or image crop only when needed to resolve an uncertain value. Do not display internal IDs, JSON, provider prompts, schema names or confidence percentages.

For ambiguous cases ask one concrete question, such as “Does MM mean Malayala Manorama?” A valid customer name/phone/address alone is insufficient to guess the correct household. Shared phones are allowed; match existing records using stable IDs where supplied or show possible matches. Recognized newspaper abbreviations map to the business's actual newspaper catalog, not a global hardcoded list.

Default to adding new records. If existing records appear, show a short choice: **Add new**, **Update matching records**, or **Choose individually**. Keep replacement/removal inside an explicit secondary action, with an impact summary and confirmation. Never infer deletion from an omitted row. Rate changes require a verified effective date; an absent end date means until changed. The existing immutable invoice and tenant protections remain unchanged.

The current page determines the target record type. If a file mixes customer tables with newspaper definitions, identify both and tell the user which records will be imported; do not silently discard a section. Resolve any missing newspaper catalog entries first, then resume the customer preview. This release reuses single-entity transactional batches rather than inventing an untested mixed-entity commit path.

Remove the old Excel/AI buttons and their upload dialogs after feature parity is verified. Preserve the existing template-download backend as a secondary **Download sample** link if useful; downloading a template must not be a prerequisite. Retire superseded entry endpoints only after checking their callers and tests; do not delete shared Excel parsers, validation or commit services.

### 5. Supported files, automatic interpretation and privacy

“Any file” is the user-facing intent, not an unlimited technical guarantee. Initial target formats:

| Input | Local processing before any provider call | Acceptance boundary |
|---|---|---|
| XLSX | Existing safe workbook reader, relaxed template dependency, sheet/header discovery | No macros/formulas/external links; current custom templates still work |
| CSV, TSV, TXT | Decode text, detect delimiter/header/record boundaries | Preserve leading zeros, quoted newlines, Indian phone formats and Unicode |
| Text PDF | Extract positioned text and page references | Identify tables without assuming PDF text order equals table order |
| DOCX | Extract paragraphs and tables as data | Never execute embedded content or render untrusted HTML |
| PNG, JPEG, WebP; scanned PDF | Local OCR with English/Hindi/Malayalam fixtures and source coordinates | Enable only after OCR quality and deployment resource gates pass |

Legacy XLS, ODS, DOC, archives, executables, audio/video, encrypted/corrupt files and unknown formats need an honest localized message and a useful conversion suggestion; do not silently send them to a model or claim they imported. Add formats through adapters only when actual customer examples justify them. Content signature and extension must agree. One upload can contain several logical tables, but no automatic merge of unrelated businesses or sheets.

Start with bounded limits: 10MB per file, 5,000 data rows, 100,000 cells, 20 text-PDF pages, 5 OCR pages, a 90-second job budget and one concurrent OCR job per instance. These are proposed release limits requiring measured staging validation; a large image must also have a decoded-pixel cap. Check bounds before building a large in-memory workbook or raster image. Retain the existing expanded-archive checks and reject decompression bombs. Avoid adding an always-on paid worker without approval.

Privacy is a hard boundary: **never send original files, unredacted OCR text, customer names, phone numbers, addresses, flat numbers, account IDs or owner API keys to Groq as model input.** A user-supplied key does not waive this restriction. Local extraction produces private values stored in a job-local token map. The AI may receive safe field labels/types, opaque tokens and explicitly allowed public newspaper/rate/date information. Rejoin private values locally after validating the structured result.

Redaction based only on phone regexes is insufficient: names/addresses and unlabeled scans are harder to classify. Build provider payloads from an allowlist, not “raw text minus detected secrets”. If an unfamiliar document cannot be interpreted under that boundary, keep it local and show the specific uncertain fields for correction. Do not promise fully automatic interpretation of every unlabeled scan while also promising zero personal-data export. Direct cloud vision on customer documents is excluded under the current privacy decision, even though Groq offers vision-capable models.

Use AI where it adds value: recognizing table roles and header aliases, understanding nonpersonal newspaper/date descriptions, suggesting safe newspaper-code matches and preparing canonical records. It must not invent unreadable names, amounts, dates or subscription choices. Protect against instructions embedded in documents; the model receives data with a strict schema and no write tools.

Use a job state model: `uploaded → extracting → interpreting → needs-review → saving → completed`, with `failed` and `cancelled` terminal alternatives. Authenticated endpoints return short localized states. A retry uses the same job/batch identity; repeated Save must not duplicate records. Delete original files and private token maps on completion/cancellation/expiry, with a proposed maximum 24-hour lifetime. Store only necessary audit/source provenance with committed records. Ephemeral Render storage is acceptable only with explicit restart recovery: interrupted uncommitted jobs ask for re-upload; never report a vanished job as saved.

### 6. First-use and Settings

After the first successful owner login, show one centered **Set up your business** panel containing only:

1. **Language:** English / हिन्दी / മലയാളം, using the current supported preference as the initial selection.
2. **AI service:** **Use included AI** selected by default; **Use my own API key** as the alternative.
3. **Continue**.

The API key input appears only for the second choice. For clarity label it **Groq API key** in that expanded section and link to provider instructions there. A common delivery owner does not need to understand API configuration to start using the included service. Existing users see this once after rollout; completing or explicitly accepting defaults persists an onboarding version so it does not reappear on every login.

Settings exposes the same Language and AI service controls, plus **Test key**, **Replace key**, and **Remove key** when applicable. The saved key is never returned to the browser; show only “Key saved”. Invalid custom keys leave existing saved settings unchanged and show “This key could not be verified.” A custom-key failure must not silently fall back to the included key or change billing expectations. Explain provider charges only beside the optional custom-key choice, in one sentence.

Initial scope is Groq keys only, matching the deployed provider. Do not add arbitrary provider URLs or imply that an OpenAI/Gemini key works in this field. If included AI is unavailable or its allowance is reached, show one useful retry/correction path; keep the selected source visible in Settings and never ask ordinary users for the default server key.

Owner-provided keys are scoped to the business and managed only by its admin. Encrypt at rest with AES-256-GCM, unique nonces, authenticated tenant/provider context and a versioned encryption envelope. Keep the master key in a new server-only Render environment secret, never in MongoDB or a `VITE_` variable. Authenticate/decrypt only in server code, redact logs/traces/errors, and ensure default and custom paths use the same resolver for import AI and account assistance. With no encryption secret, keep default mode working and reject custom-key storage clearly. Define key rotation and deletion before enabling production storage.

## Alternatives and recommendation

| Approach | Tradeoff | Decision |
|---|---|---|
| One upload, local extraction, sanitized AI and short review | More extraction work, preserves privacy and existing billing safeguards | Recommended; matches user's review decision |
| Send every original file directly to a vision model | Convenient for scans, exports customer details | Excluded by the user's privacy instruction |
| Keep separate Excel and AI workflows | Smaller change, retains the duplicate controls/confusion | Rejected by this request |

## Global constraints

- Planning only in this turn; do not change product code, secrets, production settings or deploy until this plan is approved.
- Keep existing rate history, invoice snapshots, transaction guards, owner permissions and review/commit idempotency.
- One Upload file action per applicable page; one language control in the header action group; manual Add remains available.
- No customer personal data or original customer documents cross the model boundary; custom keys do not change that rule.
- Default AI is selected initially; personal keys are optional, encrypted, tenant-scoped and never exposed back to the browser.
- Use plain English/Hindi/Malayalam copy, current design tokens and native/CSS interactions; no framework migration or animation dependency by default.

## Review focus

1. A reset stylesheet, entry animation or print rule must not move a modal out of the viewport or break focus recovery.
2. Switching languages during an upload or editing must preserve the file/job, correction state, focus and private tokens.
3. Mixed-format/mixed-language files must not silently swap household identities or discard existing subscriptions.
4. Unknown document text must not bypass the personal-data allowlist or become provider instructions.
5. A custom-key failure, concurrent settings edit or retry must not use another business's credential or duplicate committed records.

## Implementation tasks

Each task uses a meaningful failing test, a minimal implementation, a passing focused check and a reviewed commit. Filenames marked new are proposed; the existing files listed above were inspected. Keep work on an implementation branch; use the approved plan and preserve current financial behavior.

### Task 1: Fix dialog placement and consolidate visible actions

**Modify:** `src/components/common/Dialog.tsx`, `src/styles/workspace.css`, `src/features/workspace/EntityView.tsx`.
**Create:** `tests/e2e/dialog-layout.spec.ts`, initial `src/features/imports/UploadDialog.tsx` shell.

**Interface:** `UploadDialog({entity:'residents'|'publications', onSaved:()=>void})` owns the only Upload file action. The shell must not advertise unimplemented formats before the adapters are enabled.

- [ ] Add a browser regression that opens a real dialog at 360×800, 768×1024 and 1440×900; assert horizontal/vertical centering within 2px when content fits, all edges within the viewport when content scrolls, visible close/save controls and no page overflow. Confirm current corner placement fails this test.
- [ ] Add explicit centering, scroll bounds, labeled dialog/focus restoration and reduced-motion-safe entry/exit. Preserve printable statements and Escape behavior.
- [ ] Replace duplicate import actions with the unified entry shell; retain existing internals until the new workflow can replace them safely. Ensure exactly one upload action is visible per entity page.
- [ ] Run `npm run test:e2e -- tests/e2e/dialog-layout.spec.ts` and existing owner/Excel tests, inspect real desktop/mobile screenshots, then commit.

### Task 2: Build the header language control and plain-language screens

**Modify:** `src/features/workspace/{AppShell,EntityView,Screens,Dashboard,PublicScreens}.tsx`, `src/components/common/LanguageSwitcher.tsx`, `src/styles/workspace.css`, `src/i18n/{index,messages}.ts`.
**Create:** `tests/e2e/simple-interface.spec.ts`.

- [ ] Test that the language control is the rightmost header action, remains reachable at 360px and 200% zoom, and supports keyboard selection/reduced motion without losing an unsaved form or upload job.
- [ ] Introduce the header action group and small picker transitions. Remove decorative work-screen slogans/duplicated captions and simplify sign-in headings using the copy table.
- [ ] Translate every new caption/status/error in all three languages. Keep long financial explanations behind contextual Details rather than deleting the facts needed to avoid a wrong bill.
- [ ] Run language and interface browser tests; compare screenshots with the supplied problem screenshots. No clipped Malayalam labels or internal JSON/IDs should appear. Commit.

### Task 3: Add persisted preferences and optional encrypted owner keys

**Create:** `server/preferences/{schemas,crypto,service,routes}.ts`, `server/preferences/{crypto,service}.test.ts`, `server/preferences/routes.integration.test.ts`.
**Modify:** `server/app.ts`, `server/config/env.ts`, `server/db/connect.ts`, `src/services/api.ts`, `.env.example`.

**Interfaces:** `GET /api/v1/preferences` returns `{locale,onboardingVersion,ai:{source:'default'|'custom',provider:'groq',hasCustomKey}}`; `PATCH /preferences` saves validated locale/source with an expected revision. `POST /preferences/ai-key/test` validates a candidate key with a minimal nonpersonal request. `PUT /preferences/ai-key` stores an explicitly confirmed valid key; `DELETE /preferences/ai-key` removes it and explicitly selects default. `resolveAiCredential(scope): Promise<{source,key}>` is server-only.

- [ ] Add tests proving round-trip encryption, different nonces, tamper/wrong-tenant rejection, owner-only key management, cross-tenant denial and omission of ciphertext/key values from every response/log/error.
- [ ] Implement versioned encrypted envelopes and revision-safe preferences. Add a server-only `AI_KEY_ENCRYPTION_KEY` setting; keep default mode operational without it. Define/test rotation from one configured key version to another before changing live keys.
- [ ] Test that an invalid candidate never replaces a working saved key; custom failures never select default implicitly. Validate keys only at the fixed Groq endpoint and never log upstream authorization headers.
- [ ] Update `.env.example` with variable names/placeholders only; run focused integration tests and both typechecks, then commit. Production secret creation occurs at deployment time, not in the browser or plan.

### Task 4: Connect first-use setup and Settings

**Create:** `src/features/settings/{PreferencesPanel,FirstUseSetup}.tsx`.
**Modify:** `src/features/workspace/{AppShell,Screens}.tsx`, `src/i18n/index.ts`, `src/i18n/messages.ts`.
**Test:** `tests/e2e/preferences.spec.ts`.

- [ ] Test default-selected included AI, no key field in default mode, language preselection, explicit defaults acceptance, one-time onboarding version and persistence across reload/new login.
- [ ] Implement the single short first-use panel and the same reusable Settings controls. Fetch preferences without blocking core sign-in indefinitely; show a useful retry if saving settings fails.
- [ ] Test key paste/test/save/replace/remove, secret input clearing, browser-back behavior, two accounts on a shared browser and stale settings conflicts. Persist language server-side with the existing local fallback.
- [ ] Update `server/ai-entry/routes.ts` and `server/chat/routes.ts` to obtain keys through the same server resolver; pass the resulting config into existing services without returning the key. Run privacy/tenant tests and commit.

### Task 5: Build bounded local file extraction

**Create:** `server/uploads/{types,detect,extract,privacy,jobs,routes}.ts`, `server/uploads/extractors/{workbook,text,pdf,docx,image}.ts`, `server/uploads/{extract,privacy,jobs}.test.ts`, `tests/fixtures/uploads/`.
**Modify:** `server/app.ts`, `server/db/connect.ts`, `package.json`/lockfile only for chosen parsers.

**Interfaces:** `extractFile(file, limits): Promise<ExtractedDocument>` returns typed tables/text blocks with source coordinates, not HTML. `partitionForAi(document): {safeStructure,privateTokenMap,unresolved}` builds the allowlisted provider view. `POST /api/v1/uploads` creates a scoped job; `GET /uploads/:id` returns safe status/results; `DELETE /uploads/:id` cancels an uncommitted job. Return canonical error codes for translated UI messages.

- [ ] Build synthetic multilingual fixtures before choosing parsers: ordinary Excel, quoted CSV, UTF-8/BOM text, positioned PDF table, DOCX table, clear photo, rotated image, low-quality scan, malicious archive, encrypted document and wrong file extension.
- [ ] Test detection and resource bounds before expensive decompression/rasterization. Prove formulas, embedded scripts, external links and macros are never executed or fetched. Test leading zeros, multi-page table continuation and unrelated-table separation.
- [ ] Implement local extraction and private-token separation. Use synthetic names/phones/addresses in canary tests and assert their absence, plus original-file bytes, from every mocked provider request. Unknown free text remains local until safely classified.
- [ ] Benchmark English/Hindi/Malayalam OCR on staging within the current instance limits. Enable an image/scanned-PDF adapter only after measured memory/time/accuracy checks pass; otherwise report its real limitation and propose a separately approved infrastructure change. No paid resources are created silently.
- [ ] Test cancellation, TTL cleanup, restart/re-upload recovery and no partial business writes. Run extraction/privacy tests and commit.

### Task 6: Interpret documents automatically and provide the short review

**Create:** `server/uploads/{interpret,normalize}.ts`, `src/features/imports/{UploadProgress,UploadReview}.tsx`, `server/uploads/interpret.test.ts`, `tests/e2e/unified-upload.spec.ts`.
**Modify:** `src/features/imports/UploadDialog.tsx`, `server/imports/service.ts` only where necessary to consume canonical rows, existing AI service adapters and i18n dictionaries.

**Interfaces:** `interpretDocument(scope, safeStructure): Promise<Interpretation>` receives sanitized data and uses the chosen credential; `normalizeInterpretation(result, privateTokenMap): NormalizedImportInput` reconstructs customer fields locally. `POST /uploads/:id/preview` delegates to existing `createPreview`; confirmed save delegates to existing `commitPreview`, retaining the same batch ID and guards.

- [ ] Test automatic header aliases, Hindi/Malayalam headings, newspaper abbreviations and mixed customer/newspaper documents requiring explicit catalog resolution before the customer batch. Test unknown codes, ambiguous date formats, multiple customers sharing a phone, missing effective rates, prompt injection and model-invented private tokens.
- [ ] Implement strict structured model output and known-token verification. Keep straightforward extraction functional when AI is unavailable; show only the uncertain corrections needed, not a developer mapping wizard.
- [ ] Build progress/cancel/retry, the short editable review, source-linked corrections and an explicit Save button. Exactly zero customer records may exist before Save; rate changes/removals/replacements show their separate impact summary.
- [ ] Run the same file through a retry and repeated Save; verify one committed result. Test all supported enabled formats on both entity pages, all three languages, keyboard/mobile/reduced motion and interrupted uploads. Commit.

### Task 7: Retire duplicate workflows and release in stages

**Modify:** `src/features/workspace/EntityView.tsx`, old import entry components/callers, existing browser tests, `docs/implementation-status.md`, `docs/deployment/owner-workflow-runbook.md`.

- [ ] Remove the old visible Excel/AI entry components after callers migrate. Keep reusable parsers, financial validation, useful sample download and compatibility endpoints where still needed; do not delete invoice/rate logic as UI cleanup.
- [ ] Run `npm test`, `npm run test:e2e`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run build:server`, `npm audit --omit=dev` and `git diff --check`. Confirm no credentials/private-canary values in frontend assets, persisted upload logs or provider captures.
- [ ] Verify visual acceptance against the user's screenshots: one upload button, centered dialog, rightmost language selector, short literal headings, first-use default AI selection and concise review. Inspect real screenshots at 360/768/1440px and 200% zoom; native-speaker review remains necessary for financial/key wording.
- [ ] Deploy to the existing Render service only after plan approval and implementation verification. Provision only the server-side encryption secret needed for custom keys; preserve the existing default key, database, free service and auto-deploy preference. Roll out unified uploads behind a reversible feature flag.
- [ ] Verify the released screens read-only first. Any hosted synthetic customer/billing/key-storage test must have authorization covering that new workflow; do not reuse the earlier one-off smoke-test permission for new sensitive key tests. Record exact revision, checks, enabled file adapters and any OCR limits. Rollback code/UI without deleting uploaded customer history or stored user settings.

## Acceptance checklist

1. One Upload file action replaces the Excel/AI choices; manual Add is still obvious. Dialog opens centrally and stays usable on mobile.
2. Language switching is at the header's right edge, has a short accessible transition and preserves current work; first-use/Settings use the same persisted choice.
3. Default AI is selected on first use. Owner keys are optional, tested, encrypted, tenant-isolated, removable and never exposed; all AI paths use the selected source.
4. Enabled common file formats are automatically read/matched, customer personal data stays local, and the user sees a short review before any save. Unsupported files get a useful localized message.
5. Existing bills, rate history, subscriptions and tenant protections pass their regression tests; ordinary work screens contain direct task labels rather than slogans or internal implementation text.

## References and skill application

The screenshots and inspected code are the primary UI references. Ooh Shiny's audit, accessibility and purposeful-motion guidance informed the design. Karpathy guidelines informed the limited scope and reuse of existing import/billing services. Superpowers informed the design/tasks/regression gates. I Have ADHD informed short steps, concise copy and a single next action.

Claude Octopus's installed guide was actually run with UTF-8 enabled; it identified `/octo:plan` and `/octo:council` as planning commands. No provider council, multi-model consensus or Octopus-generated implementation was run or claimed.

- [MDN native dialog documentation](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog): modal behavior and accessible interaction reference; our explicit layout must work alongside it.
- [Groq vision documentation](https://console.groq.com/docs/vision): vision is a model capability with supported inputs and limits, not permission to transmit customer documents. Cloud vision remains excluded under the current privacy rule.
- [Tesseract.js project](https://tesseract.projectnaptha.com/): local browser/Node OCR is a candidate; actual Hindi/Malayalam fixture quality and free-instance resource measurements are release gates, not proven capability in this app.

## Estimate and next action

Allow roughly **10–16 engineering days** for the unified privacy-preserving document pipeline, preferences/key lifecycle, UI corrections and verification; add **2–4 days** for representative OCR field trials and native-language review, potentially overlapping. Dialog/header/copy improvements can be delivered first in approximately **1–2 days** without waiting for every document adapter. Re-estimate after the OCR feasibility gate; do not represent this as a confirmed delivery date.

Next action: review the single-upload design and supported-format/privacy boundary. This turn changes planning documents only; no app, secret or deployment changes have been made.
