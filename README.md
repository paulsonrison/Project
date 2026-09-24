# PressTrack

Newspaper delivery management system for apartment complexes and housing societies. Manages subscribers, delivery routes, monthly billing, and payment tracking.

> **Status:** Routing scaffold and design system complete. All feature pages are stubs. No business logic, backend, or auth yet.

---

## What It Does

- **Subscribers** — register residents, assign newspapers and delivery boys, set route order
- **Newspaper catalog** — flexible per-publication schedules (daily, weekdays, weekends, specific days, monthly, annual) with base price, monthly price overrides, and day/date price exceptions
- **Monthly billing** — auto-generate bills per subscriber based on actual delivery days × per-issue price; mark paid/unpaid
- **Calendar** — see day-by-day delivery schedule for any month; spot price exceptions at a glance
- **Delivery boys** — manage staff, their routes, and resident assignments
- **Currency** — configurable symbol (₹ / $ / € / £ or custom)

---

## Current State

Routing, layout shell, and design system are in place. Every feature page (`/residents`, `/billing`, `/calendar`, `/delivery-boy`, `/settings`) renders a placeholder `<p>` tag — no UI or logic has been built yet.

The `PageHeader` component is functional (shows the page title and today's date). The design system (`theme.css` + `components.css`) is complete with a full library of CSS utility classes ready to use.

There is no backend, no database, and no authentication.

---

## Tech Stack

| | |
|---|---|
| Framework | React 19.2 |
| Build tool | Vite 8.3 |
| Language | TypeScript 6.0 |
| Styling | Tailwind CSS v4.3 (via Vite plugin — no `tailwind.config.js`) |
| Routing | React Router v8.4 |
| Linter | ESLint 10 (flat config — typescript-eslint, react-hooks, react-refresh) |
| Package manager | npm |

No UI component library, state management, data-fetching, form library, or test runner is installed.

---

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint
npm run lint
```

---

## Project Structure (Current)

```
src/
├── app/
│   ├── App.tsx                        # Root — wraps AppRouter in BrowserRouter
│   └── AppRouter.tsx                  # All routes, layout grouping, catch-all redirect
├── components/
│   ├── layout/
│   │   └── AppLayout.tsx              # Shell for layout-wrapped routes: Nav + Header + Outlet
│   ├── header/
│   │   ├── PageHeader.tsx             # Title + formatted date (functional)
│   │   └── PublicHeader.tsx           # Empty
│   ├── navigation/
│   │   └── Navigation.tsx             # Stub — returns <p>Navigation</p>
│   └── common/
│       └── CustomComponents.tsx       # Empty
├── pages/                             # All stubs — each returns a single <p> tag
│   ├── home.tsx
│   ├── SignIn.tsx
│   ├── AboutUs.tsx
│   ├── ContactUs.tsx
│   ├── Billing.tsx
│   ├── Calendar.tsx
│   ├── DeliveryBoy.tsx
│   ├── Settings.tsx
│   └── Residents.tsx
├── styles/
│   ├── index.css                      # Imports components.css + theme.css
│   ├── theme.css                      # All design tokens (@theme block)
│   └── components.css                 # Full component class library (@layer components)
├── context/
│   └── context.tsx                    # Empty
├── hooks/
│   └── useAuth.tsx                    # Empty
├── features/
│   └── auth/
│       └── auth.tsx                   # Empty
├── services/
│   └── scervice.tsx                   # Empty
├── config/
│   └── config.tsx                     # Empty
├── routes/
│   └── rout.tsx                       # Empty
├── utils/
│   └── util.tsx                       # Empty
└── main.tsx                           # Entry point — StrictMode + mounts App
```

---

## Routing

| Path | Component | Layout |
|---|---|---|
| `/home` | `Home` | none |
| `/signin` | `SignIn` | none |
| `/about-us` | `AboutUs` | none |
| `/contact-us` | `ContactUs` | none |
| `/residents` | `Residents` | `AppLayout` |
| `/billing` | `Billing` | `AppLayout` |
| `/calendar` | `Calendar` | `AppLayout` |
| `/delivery-boy` | `DeliveryBoy` | `AppLayout` |
| `/settings` | `Settings` | `AppLayout` |
| `*` | redirect → `/home` | — |

`AppLayout` renders the sidebar navigation, page header, and an `<Outlet>` for the active route.

---

## Design System

All tokens are CSS custom properties defined in `src/styles/theme.css` via Tailwind v4's `@theme {}` block. Component classes are in `src/styles/components.css` as `@layer components`.

**Colors**
- Background: `#F2ECD9` (warm newsprint cream)
- Primary: `#111111` (near-black)
- Accent / danger: `#BF1E1E` (deep red — nav active state, CTAs, focus rings, warnings)
- Muted foreground: `#5A5240`

**Typography**
- `--font-ui`: Libre Franklin — labels, headings, uppercase tracking
- `--font-body`: Lora — body copy
- `--font-mono`: DM Mono — numbers, dates, IDs

**Shape** — zero border-radius across all tokens (`--radius: 0px`). Sharp, editorial aesthetic.

**Component class library** (ready to use, nothing wired yet):
- Buttons: `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-save`, `.btn-cancel`, `.btn-icon`
- Inputs: `.input`, `.input-cell`, `.input-select`, `.input-group`, `.input-prefix`
- Form: `.field`, `.field-label`, `.section-head`
- Checkbox, radio, toggle pill
- Modal: `.modal-overlay`, `.modal`, `.modal-header`, `.modal-body`
- Data table: `.table-wrap`, `.table-header-row`, `.table-header-cell`, `.table-row`, `.table-cell`
- Stat bar: `.stat-bar`, `.stat-cell`, `.stat-label`, `.stat-value`
- Badges: `.badge`, `.badge-paid`, `.badge-due`, `.badge-route`
- Calendar: `.cal-cell`, `.cal-cell-today`, `.cal-dot`
- Nav: `.nav-item`, `.nav-item-active`
- Empty state: `.empty-state`, `.empty-state-title`
- Drag handle: `.drag-handle`

---

## Target Project Structure (Planned)

```
src/
├── app/
│   ├── App.tsx
│   └── AppRouter.tsx
├── components/
│   ├── ui/              # Reusable primitives: Button, Modal, Field, Input, etc.
│   ├── layout/          # AppLayout, sidebar shell
│   ├── header/          # PageHeader, PublicHeader
│   ├── navigation/      # Sidebar Navigation
│   ├── calendar/        # CalendarView, CalendarDayPanel
│   ├── residents/       # ResidentsView, ResidentRow, PapersDialog
│   ├── billing/         # BillsView, BillDetailModal
│   └── settings/        # SettingsView, PaperFormModal, DeliveryBoyForm
├── pages/               # Thin route entry points
├── hooks/
│   ├── useBilling.ts    # Bill generation and payment logic
│   └── useSchedule.ts   # Delivery day calculation and price resolution
├── types/
│   └── index.ts         # Paper, Resident, DeliveryBoy, Bill, Subscription, etc.
├── lib/
│   └── billing.ts       # calcBill, priceOnDay, getDeliveryDays helpers
├── services/            # Backend API calls (once backend exists)
├── context/             # React context providers
├── styles/
│   ├── index.css
│   ├── theme.css
│   └── components.css
└── main.tsx
```

---

## Implementation Roadmap

### Phase 1 — Feature UI (in-memory state only)
- [ ] Implement `Navigation` sidebar — links to all routes, active state styling
- [ ] Fix `PageHeader` — make `title` dynamic per route instead of hardcoded
- [ ] Implement `Residents` page — list, add, edit, delete; assign papers and delivery boys
- [ ] Implement `Settings` page — newspaper catalog, delivery boy management, currency config
- [ ] Implement `Calendar` page — monthly grid with delivery dots and day-panel detail
- [ ] Implement `Billing` page — bill list, auto-generate, mark paid/unpaid
- [ ] Implement `DeliveryBoy` page — staff list, route assignment
- [ ] Implement `Home` — dashboard summary / landing
- [ ] Implement `SignIn` page — form shell (no auth yet)

### Phase 2 — Refactor & Stabilize
- [ ] Define all types in `types/index.ts` (Paper, Resident, DeliveryBoy, Bill, etc.)
- [ ] Extract billing logic into `lib/billing.ts` and `hooks/useBilling.ts`
- [ ] Extract schedule logic into `hooks/useSchedule.ts`
- [ ] Extract shared UI into `components/ui/`
- [ ] Set up path aliases (`@/components`, `@/hooks`, `@/types`, etc.)
- [ ] Fix `scervice.tsx` filename typo → `service.ts`
- [ ] Write unit tests for billing logic (`calcBill`, `priceOnDay`, `getDeliveryDays`)
- [ ] Add a test runner (e.g. Vitest)

### Phase 3 — Backend & Persistence
- [ ] Choose backend (Node/Express, Next.js API routes, Supabase, or PocketBase)
- [ ] Database schema: societies, residents, papers, delivery boys, bills, subscriptions
- [ ] REST or tRPC API layer
- [ ] Replace in-memory state with API calls + loading/error states

### Phase 4 — Authentication
- [ ] Society admin login (email + password or OAuth)
- [ ] Role-based access (admin vs read-only)
- [ ] Protected routes

### Phase 5 — Production Features
- [ ] Bill export — print-friendly / PDF per resident
- [ ] Subscription date ranges — start/stop dates per resident–paper pair
- [ ] Holiday management — skip deliveries on specified dates
- [ ] Delivery confirmation — mobile view for delivery boys to mark deliveries
- [ ] Notifications — WhatsApp / SMS payment reminders
- [ ] Multi-society support

---

## Business Logic Reference

### Billing Calculation

For a given resident + month:

1. Determine delivery days using the paper's schedule
2. For each delivery day, resolve the price:
   - Check for a **specific-date exception** first
   - Then check for a **day-of-week exception**
   - Then check for a **monthly price override**
   - Fall back to the paper's **base price**
3. Sum all resolved prices → bill total

### Schedule Types

| Schedule | Delivers on |
|---|---|
| `daily` | Every day |
| `weekdays` | Monday–Friday |
| `weekends` | Saturday–Sunday |
| `sundays` | Sundays only |
| `specific` | Selected days of week (e.g. Wednesday, Friday) |
| `monthly` | One specific day each month (e.g. the 1st) |
| `annual` | One specific date each year |

---

## Known Issues / TODOs

- `AppLayout.tsx` — `PageHeader` title is hardcoded to `"Residents"` for all routes; needs to be dynamic
- `services/scervice.tsx` — typo in filename
- Fonts (`Libre Franklin`, `Lora`, `DM Mono`) are declared in `theme.css` but not loaded anywhere — no `<link>` tags in `index.html` and no `@import` in CSS

---

## License

Private — not yet licensed.
