# Claude Code Prompt: Rally Web Platform

> **Usage:** Place this file alongside `CLAUDE.md`, `RULES.md`, and `SOUL.md` in the project root. Claude Code reads `CLAUDE.md` automatically; it references this spec.

---

## ⚠️ SECURITY

All secrets live in `.env.local` on the VPS. Never committed to git. See `.env.example` for the full list. If a Cloudflare API key or any credential has ever been exposed in plaintext (chat, commit, log), rotate it immediately.

---

## System Prompt

You are building Rally Web — the browser-based platform for Rally, a dealership operating system. This is production software used by real people at real dealerships. It replaces paper logs, radio chatter, and "ask around the lot."

Rally Web has **four distinct portals**:

| Portal | Subdomain | Port | Audience | Purpose |
|--------|-----------|------|----------|---------|
| **Staff App** | `app.rally.vin` | 3001 | All 7 roles | Daily operations, scanning, inventory, AI tools |
| **Dealer Portal** | `{slug}.rally.vin` | 3004 | Dealer group staff | White-labeled per dealer group |
| **Management Console** | `manage.rally.vin` | 3002 | GMs, Principals | Store ops, analytics, user/role mgmt |
| **Super Admin** | `admin.rally.vin` | 3003 | System owner | God-mode: every tenant, config, metric |

**Do not start coding until you have read this entire document.**

---

## Part 1: Infrastructure

### System Diagram

```
┌─────────────────────────────────────────────────┐
│                   CLOUDFLARE                     │
│         DNS + CDN + DDoS Proxy (orange cloud)    │
│                                                  │
│  app.rally.vin ──────┐                           │
│  manage.rally.vin ───┤                           │
│  admin.rally.vin ────┤──→ VPS IP (proxied)       │
│  {slug}.rally.vin ───┘                           │
│  api.rally.vin ──────────→ VPS IP (proxied)      │
└──────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────┐
│            VPS — Ubuntu 24.04 + Plesk            │
│         12 vCore / 24GB RAM / 720GB NVMe         │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │  NGINX (managed by Plesk)                  │  │
│  │  Reverse proxy: subdomain → localhost:PORT │  │
│  │  SSL: Let's Encrypt origin certs           │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌─────────────┐ ┌─────────────┐ ┌───────────┐  │
│  │ staff:3001  │ │ manage:3002 │ │ admin:3003│  │
│  │ 4 instances │ │ 2 instances │ │ 1 instance│  │
│  └─────────────┘ └─────────────┘ └───────────┘  │
│  ┌─────────────┐ ┌──────────────────────────┐   │
│  │ portal:3004 │ │ api.rally.vin (existing)  │   │
│  │ 2 instances │ │ PHP/Node VPS API          │   │
│  └─────────────┘ └──────────────────────────┘   │
│                                                  │
│  PM2 — process manager, cluster mode             │
└──────────────────────────────────────────────────┘
```

### Why This Architecture

- **Cloudflare = DNS + CDN only.** Not hosting. Orange-cloud proxied for DDoS protection, static asset caching, and hiding the origin IP.
- **Plesk = Nginx + SSL + vhosts.** When a new tenant is provisioned, the system creates a Cloudflare DNS record AND a Plesk vhost via their respective APIs.
- **PM2 = Process management.** Cluster mode for high-traffic apps (staff: 4 instances), auto-restart, log rotation, zero-downtime reload.
- **Same box as api.rally.vin.** The existing Rally VPS API runs here. Web apps call it via `localhost` — zero network latency.
- **Full Node.js runtime.** No edge restrictions, no serverless cold starts, no adapter hacks. Next.js App Router runs exactly as designed.

### Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 App Router (full Node.js) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| Components | @rally/ui (custom, no shadcn/Radix) |
| Icons | Lucide React |
| State | Zustand (client) + RSC (server) |
| Real-time | Firestore onSnapshot |
| Auth | Firebase Auth |
| Database | Cloud Firestore |
| Maps | Mapbox GL JS |
| Charts | Recharts |
| Tables | TanStack Table |
| Forms | React Hook Form + Zod |
| Monorepo | Turborepo + pnpm |
| Hosting | VPS (Ubuntu 24.04 + Plesk) |
| Process Mgr | PM2 (cluster mode) |
| Reverse Proxy | Nginx (Plesk-managed) |
| CDN / DNS | Cloudflare (proxy + DNS API) |
| SSL | Let's Encrypt (Plesk) + Cloudflare edge |
| NFC (web) | Web NFC API (Chrome Android, QR fallback) |

### Monorepo Structure

```
rally-web/
├── apps/
│   ├── staff/                    # app.rally.vin — port 3001
│   │   ├── app/
│   │   │   ├── (auth)/           # Login, signup, forgot password
│   │   │   ├── (dashboard)/      # Role-specific dashboards
│   │   │   ├── inventory/        # Vehicle browser, detail, filters
│   │   │   ├── scan/             # Web NFC + QR scanning
│   │   │   ├── activity/         # Real-time activity feed
│   │   │   ├── lists/            # Multi-list management
│   │   │   ├── fleet/            # Fleet GPS map view
│   │   │   ├── battery/          # Battery health reports
│   │   │   ├── crm/              # CRM search + customer detail
│   │   │   ├── ai/               # AI sales assistant chat
│   │   │   ├── translate/        # Live translation
│   │   │   ├── cards/            # Digital business cards
│   │   │   ├── settings/         # User preferences
│   │   │   └── api/              # API routes (full Node.js runtime)
│   │   └── middleware.ts
│   │
│   ├── manage/                   # manage.rally.vin — port 3002
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   ├── (dashboard)/
│   │   │   ├── users/            # Staff management
│   │   │   ├── stores/           # Store configuration
│   │   │   ├── inventory/        # Aging reports, oversight
│   │   │   ├── activity/         # Analytics, heatmaps
│   │   │   ├── performance/      # Scorecards, leaderboards
│   │   │   ├── fleet/            # Fleet + battery overview
│   │   │   ├── nfc/              # Tag inventory
│   │   │   ├── crm/              # CRM integration settings
│   │   │   ├── lists/            # All staff lists
│   │   │   ├── reports/          # Exportable reports
│   │   │   ├── settings/         # Store settings, branding
│   │   │   ├── billing/
│   │   │   └── api/
│   │   └── middleware.ts          # Require GM+ role
│   │
│   ├── admin/                    # admin.rally.vin — port 3003
│   │   ├── app/
│   │   │   ├── (auth)/           # 2FA required
│   │   │   ├── (dashboard)/      # System overview + server metrics
│   │   │   ├── tenants/          # Dealer groups + provisioning
│   │   │   ├── users/            # All users system-wide
│   │   │   ├── vehicles/         # All vehicles across tenants
│   │   │   ├── activity/         # System-wide feed
│   │   │   ├── fleet/            # All fleet devices
│   │   │   ├── nfc/              # All tags system-wide
│   │   │   ├── integrations/     # DMS + CRM health
│   │   │   ├── ai/               # Model mgmt, knowledge base
│   │   │   ├── dns/              # Cloudflare subdomain mgmt
│   │   │   ├── billing/          # Revenue, subscriptions
│   │   │   ├── logs/             # Audit trail
│   │   │   ├── feature-flags/
│   │   │   ├── system/           # PM2 status, server health, crons
│   │   │   └── api/
│   │   └── middleware.ts          # Require superAdmin
│   │
│   └── portal/                   # {slug}.rally.vin — port 3004
│       ├── app/
│       │   ├── (auth)/
│       │   ├── (dashboard)/
│       │   └── [...catchAll]/     # Dynamic tenant-resolved routing
│       └── middleware.ts          # Resolve tenant from Host header
│
├── packages/
│   ├── ui/                       # @rally/ui — design system
│   ├── firebase/                 # @rally/firebase — client + admin SDK
│   ├── services/                 # @rally/services — business logic
│   ├── infra/                    # @rally/infra — Cloudflare DNS + Plesk API
│   └── config/                   # @rally/config — shared Tailwind, TS, ESLint
│
├── deploy/
│   ├── ecosystem.config.js       # PM2 config (all 4 apps)
│   ├── deploy.sh                 # git pull → install → build → reload
│   ├── setup.sh                  # First-time VPS setup (Node, PM2, certs)
│   └── nginx/                    # Vhost config templates
│
├── turbo.json
├── package.json
├── pnpm-workspace.yaml
├── .env.example
├── CLAUDE.md
├── RULES.md
└── SOUL.md
```

### PM2 Ecosystem

```javascript
// deploy/ecosystem.config.js
module.exports = {
  apps: [
    { name: 'rally-staff',   cwd: './apps/staff',   script: 'node_modules/.bin/next', args: 'start -p 3001', instances: 4, exec_mode: 'cluster', max_memory_restart: '1G' },
    { name: 'rally-manage',  cwd: './apps/manage',  script: 'node_modules/.bin/next', args: 'start -p 3002', instances: 2, exec_mode: 'cluster', max_memory_restart: '512M' },
    { name: 'rally-admin',   cwd: './apps/admin',   script: 'node_modules/.bin/next', args: 'start -p 3003', instances: 1, max_memory_restart: '512M' },
    { name: 'rally-portal',  cwd: './apps/portal',  script: 'node_modules/.bin/next', args: 'start -p 3004', instances: 2, exec_mode: 'cluster', max_memory_restart: '512M' },
  ],
};
```

### Deploy Script

```bash
#!/bin/bash
# deploy/deploy.sh
set -e
cd /var/www/rally-web
git pull origin main
pnpm install --frozen-lockfile
pnpm turbo build
pm2 reload deploy/ecosystem.config.js
echo "✅ Deployed. $(date)"
pm2 status
```

### Nginx Routing (Plesk-managed)

```nginx
# Fixed subdomains → specific apps
server { server_name app.rally.vin;    location / { proxy_pass http://127.0.0.1:3001; } }
server { server_name manage.rally.vin; location / { proxy_pass http://127.0.0.1:3002; } }
server { server_name admin.rally.vin;  location / { proxy_pass http://127.0.0.1:3003; } }

# Wildcard catch-all → portal app (tenant resolution in Next.js middleware)
server { server_name *.rally.vin;      location / { proxy_pass http://127.0.0.1:3004; } }
```

All vhosts include standard proxy headers (Host, X-Real-IP, X-Forwarded-For, X-Forwarded-Proto, WebSocket upgrade).

---

## Part 2: Design System — @rally/ui

### Design Direction

**Industrial command center meets luxury automotive.** Porsche digital cockpit crossed with a Bloomberg terminal. Dark, dense, information-rich — never cluttered. Designed for people on asphalt in 95°F heat who need to find a car in 3 seconds.

### Color Tokens

```typescript
export const colors = {
  rally: {
    gold: '#D4A017', goldLight: '#E8C547', goldDim: '#A67C13', goldMuted: '#3D3209',
  },
  surface: {
    base: '#09090B', raised: '#111114', overlay: '#18181B', border: '#27272A', borderHover: '#3F3F46',
  },
  text: {
    primary: '#FAFAFA', secondary: '#A1A1AA', tertiary: '#71717A', disabled: '#52525B', inverse: '#09090B',
  },
  status: { success: '#22C55E', warning: '#EAB308', error: '#EF4444', info: '#3B82F6' },
  activity: {
    showVideo: '#3B82F6', testDrive: '#8B5CF6', offLot: '#F97316',
    fueling: '#22C55E', runCharge: '#06B6D4', sold: '#EF4444', available: '#22C55E',
  },
  battery: { healthy: '#22C55E', warning: '#EAB308', critical: '#EF4444' },
} as const;
```

### Typography: Geist + Geist Mono (loaded locally via next/font)
### Spacing: 4px base grid matching iOS AppSpacing
### StockHero: 2.5rem / 800 weight / mono — the signature element

### Responsive Strategy

| Breakpoint | Layout | Navigation | Target |
|-----------|--------|------------|--------|
| < 640px | Single column | Bottom tab bar | Phone on the lot |
| 640–1024px | Two-column | Collapsible sidebar | Tablet at desk |
| > 1024px | Full dashboard, split views | Persistent sidebar | Desktop in office |

---

## Part 3: Role-Based Interfaces

### 7 Roles + Super Admin

| Role | Level | Portals | Dashboard Focus |
|------|-------|---------|-----------------|
| Super Admin | 0 | admin, manage, staff | System health, all tenants, server metrics |
| Dealer Principal | 1 | manage, staff | Multi-store overview, revenue |
| General Manager | 2 | manage, staff | KPIs, team perf, inventory health |
| Sales Manager | 3 | staff (+limited manage) | Team activity, conversion funnel |
| Salesperson | 4 | staff | My deals, hot list, customers, AI tools |
| Porter | 5 | staff | Movement queue, low battery, fueling |
| Detailer | 6 | staff | Detail queue, vehicle prep |
| Service Manager | 7 | staff | Service lane, ROs |

Each role sees a different default dashboard. See wireframes in full spec.

---

## Part 4: Subdomain Provisioning (Cloudflare DNS + Plesk Vhost)

### Flow (Atomic — Rule 19)

```
1. Validate slug (alphanumeric + hyphens, 3-32 chars, not reserved)
2. Check Firestore — slug not already taken
3. Cloudflare API → Create A record: {slug}.rally.vin → VPS_IP (proxied)
4. Plesk API → Create subdomain vhost → proxy to 127.0.0.1:3004
5. Plesk → Issue Let's Encrypt cert for origin SSL
6. Firestore → Seed groups/{groupId}/config/subdomain
7. Firebase Auth → Create principal user account
8. Firestore → Write to auditLog
```

**Rollback:** If step 4 fails, delete DNS record from step 3. If step 6 fails, delete vhost and DNS record. No orphans.

### Cloudflare API (Scoped Token — DNS:Edit only)

```typescript
// packages/infra/cloudflare.ts
const headers = { 'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' };

export async function createDnsRecord(name: string, content: string) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${process.env.CLOUDFLARE_ZONE_ID}/dns_records`, {
    method: 'POST', headers,
    body: JSON.stringify({ type: 'A', name, content, proxied: true, ttl: 1 }),
  });
  if (!res.ok) throw new Error(`Cloudflare: ${JSON.stringify((await res.json()).errors)}`);
  return (await res.json()).result;
}
```

### Plesk API

```typescript
// packages/infra/plesk.ts
const headers = { 'X-API-Key': process.env.PLESK_API_KEY!, 'Content-Type': 'application/json' };

export async function createSubdomain(slug: string) {
  const res = await fetch(`${process.env.PLESK_API_URL}/cli/subdomain/call`, {
    method: 'POST', headers,
    body: JSON.stringify({ params: ['--create', `${slug}.rally.vin`, '-www-root', `/var/www/vhosts/rally.vin/${slug}`] }),
  });
  if (!res.ok) throw new Error(`Plesk: ${await res.text()}`);
}
```

---

## Part 5: Firestore Schema Extensions

Existing iOS schema unchanged. Web adds:

- `groups/{groupId}/config/` — branding, subdomain, integrations, features, subscription
- `groups/{groupId}/stores/{storeId}/analytics/` — daily/weekly/monthly rollups
- `system/` — global config, health, server status, billing
- `auditLog/{logId}` — immutable action log (actor, target, metadata, timestamp)
- `featureFlags/{flagId}` — key, enabled, per-tenant overrides, rollout percentage

---

## Part 6: Key Flows

1. **Web NFC Scan → Vehicle Detail:** FAB → ScanSheet → NDEFReader (Chrome) or QR fallback → vehicle detail → SmartActionMenu
2. **Manager Onboards Salesperson:** manage.rally.vin → Users → Invite → Firebase Auth + Firestore user doc + welcome email
3. **Super Admin Onboards Dealer Group:** admin.rally.vin → Tenants → Create → Cloudflare DNS + Plesk vhost + Firestore seed + principal account
4. **Command Palette (Cmd+K):** Global search across vehicles, customers, users, pages, actions — role-filtered, tenant-scoped

---

## Part 7: Super Admin Deep Dive (admin.rally.vin)

- **Tenants:** List, create (DNS+Plesk+Firestore), suspend, delete (soft, 30-day recovery), impersonate
- **DNS & Server:** All subdomains with health, PM2 process status, CPU/RAM/disk, Nginx connections
- **Feature Flags:** CRUD, per-tenant overrides, rollout percentage, usage analytics
- **Integration Health:** Vincue, DriveCentric, eLead, Ghost, Kahu — response times, error rates
- **AI & KB:** Vehicle knowledge base editor, model config, conversation logs, usage metrics
- **Audit Logs:** Immutable, filterable, exportable, 2-year retention
- **System:** Firebase viewer, env var reference, cron status, maintenance mode, broadcast message

---

## Part 8: Management Console Deep Dive (manage.rally.vin)

- **Users:** Invite, edit roles, deactivate, bulk CSV import, per-user activity log
- **Inventory:** Aging reports, stale alerts, photo audit, price drop log, sold archive
- **Performance:** Scorecards, leaderboard, time-in-status, peak hours heatmap, week-over-week
- **Store Settings:** Hours, lot config, NFC tag inventory, CRM/DMS connections, branding
- **Reports:** Daily/weekly auto-emails, export CSV/PDF, scheduled reports

---

## Part 9: Implementation Sequence

### Sprint 1: Foundation (Week 1-2)
- Monorepo scaffold, PM2 config, Nginx vhosts, deploy script
- @rally/ui: tokens + all primitives + layout components
- @rally/firebase: client, admin, auth, typed Firestore, listeners
- @rally/services: TenantContext, PermissionResolver
- Auth flow, AppShell layout, role-based middleware

### Sprint 2: Staff App Core (Week 3-4)
- Inventory browser, vehicle detail, activity tracking, multi-list
- Role dashboards (salesperson, porter, sales manager)
- Command palette, Web NFC + QR scanning

### Sprint 3: Management Console (Week 5-6)
- Manager dashboard, user management, performance analytics
- Aging reports, store settings, report export

### Sprint 4: Super Admin (Week 7-8)
- System dashboard, tenant CRUD (DNS+Plesk+Firestore)
- Feature flags, integration health, audit logs
- PM2/server monitoring, AI/KB management

### Sprint 5: Portal + Polish (Week 9-10)
- Tenant portal (Host header → slug → config), branding
- Fleet map, battery reports, CRM, AI chat, business cards
- Cross-browser, accessibility, performance optimization

---

## Part 10: Critical Details

### Real-Time: Firestore onSnapshot everywhere activity/lists/fleet change. <1s sync with iOS.
### Offline: enableMultiTabIndexedDbPersistence — native browser IndexedDB.
### Performance: FCP <1.2s, LCP <2.5s, SSR <200ms (localhost), 60fps scroll at 400+ vehicles.
### Accessibility: WCAG 2.1 AA, keyboard nav, screen reader, 4.5:1 contrast.

---

## Environment Variables

```env
# Firebase Client (NEXT_PUBLIC_)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin (server-only)
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=

# Cloudflare (scoped token — DNS:Edit on rally.vin only)
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ZONE_ID=

# Plesk (vhost automation)
PLESK_API_URL=
PLESK_API_KEY=

# VPS
VPS_IP=

# Mapbox
NEXT_PUBLIC_MAPBOX_TOKEN=

# Rally VPS API (same box)
RALLY_API_URL=http://127.0.0.1:PORT
RALLY_API_KEY=

# External APIs
VINCUE_API_KEY=
KAHU_API_KEY=
GHOST_API_KEY=

# Access Control
SUPER_ADMIN_UIDS=uid1,uid2
```

---

## Design Commandments

1. Dark mode only. Gold on black.
2. Information density over whitespace. Density ≠ clutter.
3. Stock number is the hero. StockHero: 40pt bold monospace.
4. Gold means interactive. Not gold = not clickable.
5. Animations are earned. Transitions and skeletons only.
6. Mobile = lot. Desktop = office. Same data, different density.
7. Real-time is the killer feature. Snapshot listeners everywhere.
8. Cmd+K is the power user's best friend.
9. Errors are visible. Toast on failure. Never silent catch.
10. Sound like Rally. "Scan", "Drive", "Hold", "Sold".

---

*Rally Web — February 2026 • VPS (Ubuntu 24.04 + Plesk) • Cloudflare DNS + CDN • PM2*
