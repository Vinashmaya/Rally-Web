# Rally Web Platform

The browser-based operating system for automotive dealerships. Four portals, seven user roles, multi-tenant architecture, real-time data sync with the [Rally iOS app](https://github.com/Vinashmaya/rally-ios).

**Domain:** [rally.vin](https://rally.vin)
**Status:** Pre-production (all apps built, DNS configured, pending VPS deploy)
**Last Updated:** February 2026

---

## Architecture

```
Rally-Web/
  apps/
    staff/        → app.rally.vin     :3001   Salesperson & lot staff portal
    manage/       → manage.rally.vin  :3002   Dealer group management console
    admin/        → admin.rally.vin   :3003   Super admin system dashboard
    portal/       → *.rally.vin       :3004   Customer-facing dealer portal
  packages/
    ui/           → @rally/ui         Design system (25 components, dark mode only)
    firebase/     → @rally/firebase   Client SDK, Firestore hooks, typed models
    services/     → @rally/services   Auth store, permissions, tenant resolution
    infra/        → @rally/infra      Cloudflare DNS + Plesk vhost provisioning
    config/       → @rally/config     Shared TypeScript, Tailwind, ESLint configs
  deploy/
    ecosystem.config.js               PM2 process manager (9 instances total)
    deploy.sh                         Zero-downtime deploy script
    setup.sh                          First-time VPS bootstrap
    nginx/                            Reverse proxy templates (4 vhosts)
  scripts/
    setup-super-admin.js              Firestore seed script
```

**200 source files. 32,000 lines of TypeScript. 57 pages across 4 apps.**

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, full Node.js runtime — no edge) |
| Language | TypeScript (strict mode, no `any`, no `@ts-ignore`) |
| Styling | Tailwind CSS v4 (dark mode only, gold-on-black) |
| Auth & DB | Firebase Auth + Firestore (shared backend with iOS app) |
| State | Zustand (client), React Server Components (server) |
| Tables | TanStack Table |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Maps | Mapbox GL JS |
| Icons | Lucide React |
| Fonts | Geist + Geist Mono (loaded locally via next/font) |
| Monorepo | Turborepo + pnpm workspaces |
| Process Mgr | PM2 (cluster mode, zero-downtime reload) |
| VPS | Ubuntu 24.04 + Plesk (12 vCore, 24GB RAM, 720GB NVMe) |
| CDN / DNS | Cloudflare (DNS API + proxy, orange-clouded) |
| SSL | Let's Encrypt via Plesk (origin) + Cloudflare edge (Full Strict) |

---

## Apps

### Staff Portal — `app.rally.vin` (17 pages)

The daily driver for salespeople, porters, and lot managers.

| Page | Description |
|------|-------------|
| Dashboard | KPIs, recent activity, quick actions |
| Inventory | Vehicle grid with search, filters, sort |
| Vehicle Detail | StockHero, photos, specs, activity overlay |
| Activity Feed | Real-time activity stream with filters |
| Lists | Multi-list manager with create/share |
| Scan | NFC/barcode scanner with smart actions |
| Fleet | GPS map with tracked vehicle sidebar |
| Battery | Battery health reports with color-coded bars |
| CRM | Customer search with enriched cards |
| AI | AI assistant chat interface |
| Translate | Live translation (coming soon) |
| Cards | Digital business cards with Wallet preview |
| Settings | Profile, preferences, notifications |
| Login | Firebase email/password auth |

### Management Console — `manage.rally.vin` (13 pages)

Dealer group operations for managers and owners.

| Page | Description |
|------|-------------|
| Dashboard | Group KPIs, store comparison, fleet health |
| Users | Employee roster with role management |
| User Detail | Individual user profile, activity, permissions |
| Invite | Role-based invitation with Zod validation |
| Inventory | Cross-store inventory with store badges |
| Performance | Analytics with hourly heatmap, trends |
| Reports | Export center for scheduled reports |
| Stores | Multi-store management with config |
| Settings | Group preferences, billing, integrations |

### Super Admin — `admin.rally.vin` (18 pages)

System-wide control for platform operators.

| Page | Description |
|------|-------------|
| Dashboard | System KPIs, audit log, server health |
| Tenants | Tenant list with status, search, filters |
| Create Tenant | Atomic provisioning (DNS + Plesk + Firestore) |
| Tenant Detail | Store management, suspend/delete |
| Users | Cross-tenant user list |
| Vehicles | All vehicles across all tenants |
| Activity | System-wide activity feed |
| DNS | Cloudflare DNS record management |
| Feature Flags | Per-tenant feature flag CRUD |
| Integrations | Integration health dashboard |
| AI | Model config + knowledge base |
| Billing | Revenue, subscriptions, MRR tracking |
| Logs | Audit trail viewer (timeline layout) |
| System | PM2 status, server metrics, maintenance mode |

### Dealer Portal — `*.rally.vin` (9 pages)

Customer-facing storefront, one subdomain per tenant.

| Page | Description |
|------|-------------|
| Landing | Tenant-branded public page |
| Dashboard | Inventory summary, activity, KPIs |
| Inventory | Vehicle browsing with filters |
| Vehicle Detail | Full specs, photos, StockHero |
| Activity | Tenant activity feed |
| Settings | Profile and preferences |

---

## Shared Packages

### `@rally/ui` — Design System
25 components: `Button`, `Card`, `Badge`, `Input`, `DataTable`, `VehicleCard`, `StockHero`, `ActivityBadge`, `Sidebar`, `AppShell`, `Toast`, `Skeleton`, `EmptyState`, `FilterBar`, `CommandPalette`, `OfflineBanner`, `DateRangePicker`, `ListCard`, `Avatar`, `StatusBadge`, `StatChart`, `RallyBarChart`, `RelativeTime`, `ScanSheet`

Design tokens: gold (#D4A017) = interactive, dark base (#09090B), 4px spacing grid, Geist Mono for stock numbers.

### `@rally/firebase` — Data Layer
Firebase client initialization with lazy-guard pattern for SSR safety. Typed Firestore hooks (`useVehicles`, `useVehicle`, `useActivities`, `useUsers`, `useVehicleLists`). Document types matching iOS app schema exactly.

### `@rally/services` — Business Logic
Zustand auth store, permission resolver (3-layer: middleware → server → client), tenant resolution, super admin utilities.

### `@rally/infra` — Infrastructure Automation
Cloudflare DNS API client, Plesk vhost API client, atomic tenant provisioning with rollback (Rule 19).

### `@rally/config` — Shared Config
TypeScript base config, Tailwind CSS v4 config, ESLint config.

---

## Quick Start

```bash
# Install dependencies
pnpm install

# Build all apps
pnpm turbo build

# Dev mode (all apps in parallel)
pnpm turbo dev

# Dev mode (single app)
pnpm --filter @rally/staff dev
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill in values:

```bash
cp .env.example .env.local
```

| Variable | Required | Used By |
|----------|----------|---------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Yes | All apps |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Yes | All apps |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Yes | All apps |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Yes | All apps |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Yes | All apps |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Yes | All apps |
| `CLOUDFLARE_API_TOKEN` | Yes | Admin |
| `CLOUDFLARE_ZONE_ID` | Yes | Admin |
| `SUPER_ADMIN_UIDS` | Yes | All apps |
| `FIREBASE_ADMIN_*` | For provisioning | Admin |
| `PLESK_API_*` | For provisioning | Admin |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | For fleet map | Staff |
| `VINCUE_API_KEY` | For DMS sync | Staff |

---

## Deployment

The platform runs on a dedicated VPS with Plesk. **No Vercel. No Cloudflare Pages. No serverless.**

### First-Time Setup

```bash
# SSH to VPS as root
ssh root@66.179.189.87

# Run setup script
./deploy/setup.sh
```

This installs Node.js 22, pnpm, PM2, clones the repo, builds all apps, and starts PM2 processes.

### Subsequent Deploys

```bash
./deploy/deploy.sh
```

Flow: `git pull` → `pnpm install --frozen-lockfile` → `pnpm turbo build` → `pm2 reload`

### PM2 Process Layout

| App | Port | Instances | Mode | Memory Limit |
|-----|------|-----------|------|-------------|
| rally-staff | 3001 | 4 | Cluster | 1GB |
| rally-manage | 3002 | 2 | Cluster | 512MB |
| rally-admin | 3003 | 1 | Fork | 512MB |
| rally-portal | 3004 | 2 | Cluster | 512MB |

Total: 9 instances, ~4GB RAM budget (of 24GB available).

### DNS (Cloudflare)

| Record | Type | Target | Proxy |
|--------|------|--------|-------|
| app.rally.vin | A | 66.179.189.87 | Proxied |
| manage.rally.vin | A | 66.179.189.87 | Proxied |
| admin.rally.vin | A | 66.179.189.87 | Proxied |
| *.rally.vin | A | 66.179.189.87 | Proxied (via provisioning) |

---

## Firebase Integration

The web platform reads and writes to the **same Firestore collections** as the Rally iOS app (project: `guess-63e3d`). Document shapes, field names, and timestamp formats match exactly. Any schema change must be backwards-compatible with existing iOS clients.

### Key Collections

```
Firestore:
├── groups/{groupId}                   # Dealer groups
│   └── stores/{storeId}              # Individual stores
├── employees/{uid}                    # Cross-group identity
│   └── memberships/{groupId-storeId} # Store assignments
├── users/{uid}                        # Legacy user profiles
├── vehicles/{vin}                     # Vehicle documents
├── vehicleActivities/{vin}            # Real-time activity sessions
├── vehicleLists/{listId}             # Multi-list documents
│   └── items/{vin}                   # List items
└── system/config                      # Feature flags, broadcast
```

---

## Design Rules

- **Dark mode only.** No light theme. No toggle.
- **Gold (#D4A017) means interactive.** If it's gold, it's clickable.
- **StockHero** for stock numbers — 40pt bold monospace. Always.
- **4px spacing grid.** Values from design tokens only.
- **Loading → Skeleton.** Never spinner-only. Never blank.
- **Errors → Toast.** Never swallowed silently.
- **Real-time → onSnapshot.** Never polling. Never manual refresh.

---

## Related

- [Rally iOS](https://github.com/Vinashmaya/rally-ios) — Native iOS app (Swift/SwiftUI)
- [rally.vin](https://rally.vin) — Product landing page

---

## License

Proprietary. All rights reserved. Rally is a product of Trey Adcox.

---

*Rally Web Platform — February 2026*
*VPS (Ubuntu 24.04 + Plesk) | Cloudflare DNS + CDN | PM2 process management*
