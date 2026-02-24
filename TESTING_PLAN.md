# Rally Web — Comprehensive Testing Plan

> **Date:** 2026-02-24
> **Super Admin:** trey@rally.vin (UID: FMcjl4yfLXeWJ1O8TSUm3N7CpYh1)
> **VPS:** 66.179.189.87
> **DNS:** Cloudflare (zone 429fb845...) — app/manage/admin.rally.vin records LIVE

---

## Pre-Flight Checklist

Before any testing, complete these setup steps:

### 1. Firebase Credentials (BLOCKING)

The `.env` files in each app need Firebase credentials. Get these from Firebase Console:

1. Go to [Firebase Console](https://console.firebase.google.com) → Your Rally project
2. Project Settings → General → Your apps → Web app config
3. Fill in ALL apps' `.env` files:

```
NEXT_PUBLIC_FIREBASE_API_KEY=<from console>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<from console>
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<from console>
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<from console>
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<from console>
NEXT_PUBLIC_FIREBASE_APP_ID=<from console>
```

4. For the **admin app only**, also add Firebase Admin SDK credentials:
   - Firebase Console → Project Settings → Service accounts → Generate new private key
   - Copy `project_id`, `client_email`, and `private_key` into `apps/admin/.env`

### 2. Firestore Security Rules

Ensure your Firestore rules allow reads for authenticated users in the `groups/`, `vehicles/`, `activities/`, and `users/` collections.

### 3. Super Admin Custom Claim

Set the super admin custom claim on your Firebase Auth user:

```javascript
// Run this once via Firebase Admin SDK or Cloud Shell:
admin.auth().setCustomUserClaims('FMcjl4yfLXeWJ1O8TSUm3N7CpYh1', {
  role: 'superAdmin',
  email: 'trey@rally.vin'
});
```

### 4. VPS Setup (for deployment)

On 66.179.189.87:
- [ ] Node.js 20+ installed
- [ ] pnpm installed globally
- [ ] PM2 installed globally
- [ ] Plesk configured with Nginx reverse proxy
- [ ] Git repo cloned to `/var/www/rally-web`
- [ ] Nginx vhosts created for app/manage/admin.rally.vin → ports 3001/3002/3003
- [ ] Wildcard vhost `*.rally.vin` → port 3004
- [ ] Let's Encrypt SSL certs issued via Plesk

---

## Phase 1: Local Development Testing

Start each app individually and test at the specified URLs.

### Start Commands

```bash
# Terminal 1 — Staff App
cd apps/staff && pnpm dev

# Terminal 2 — Manage App
cd apps/manage && pnpm dev

# Terminal 3 — Admin App
cd apps/admin && pnpm dev

# Terminal 4 — Portal App
cd apps/portal && pnpm dev
```

Default dev ports: staff=3000, manage=3000 (change with `-p 3002`), admin=3000 (`-p 3003`), portal=3000 (`-p 3004`).

---

## Phase 2: Staff App (app.rally.vin)

### 2.1 Authentication
- [ ] Visit `/login` — login form renders with email + password
- [ ] Submit with valid Firebase credentials — redirects to dashboard
- [ ] Submit with invalid credentials — error message displayed
- [ ] Session persists across page refresh
- [ ] Sign out from `/settings` — redirects to `/login`
- [ ] Unauthenticated access to `/inventory` — redirects to `/login`

### 2.2 Dashboard (/)
- [ ] Page renders with role-specific dashboard content
- [ ] Loading skeleton appears before data loads
- [ ] KPI stat cards display with proper formatting (monospace numbers)
- [ ] Quick actions navigate to correct pages
- [ ] Responsive: test at 375px, 768px, 1440px

### 2.3 Inventory (/inventory)
- [ ] Vehicle grid renders with VehicleCard components
- [ ] Search filters by stock number, VIN, make/model
- [ ] FilterBar status chips filter correctly (All, Available, Test Drive, etc.)
- [ ] Click vehicle card → navigates to `/inventory/[vin]`
- [ ] Empty state shows when no vehicles match filter
- [ ] Grid responsive: 1 col mobile, 2 tablet, 3+ desktop

### 2.4 Vehicle Detail (/inventory/[vin])
- [ ] StockHero displays stock number in large bold monospace
- [ ] Vehicle info (YMM, VIN, color, price) renders correctly
- [ ] StatusBadge shows current status with correct color
- [ ] Activity history for this vehicle displays
- [ ] Back button returns to inventory
- [ ] 404 state for invalid VIN

### 2.5 Activity Feed (/activity)
- [ ] Activity items render with correct state colors
- [ ] Active activities show pulsing indicator
- [ ] Filter by activity type works
- [ ] Items grouped by date (Today, Yesterday, etc.)
- [ ] Real-time updates when Firestore data changes (if connected)

### 2.6 Lists (/lists)
- [ ] List cards render with vehicle counts
- [ ] Create new list flow works
- [ ] Add/remove vehicles from lists
- [ ] Color-coded list badges

### 2.7 Scan (/scan)
- [ ] ScanSheet renders with VIN input
- [ ] QR mode toggle works
- [ ] Manual VIN entry navigates to vehicle detail
- [ ] Web NFC prompt on Chrome Android (or graceful fallback)

### 2.8 Settings (/settings)
- [ ] Profile section shows user name, email, role
- [ ] Avatar renders with user photo or initials
- [ ] Preferences toggles disabled with "coming soon" note
- [ ] Current store info displays when active store exists
- [ ] Sign out button works

### 2.9 Fleet Map (/fleet)
- [ ] Map placeholder renders with Mapbox integration note
- [ ] Tracked vehicles sidebar shows 5 mock vehicles
- [ ] Status indicators (Moving, Parked, Offline) with correct colors
- [ ] Stats row shows correct counts

### 2.10 Battery Health (/battery)
- [ ] Summary cards show counts by health status
- [ ] Battery bars color-coded (green/yellow/red)
- [ ] Filter tabs (All, Critical, Warning, Healthy) work
- [ ] "Jump Start" button appears on critical vehicles

### 2.11 CRM (/crm)
- [ ] Search input filters customer list
- [ ] Customer cards show name, phone, source badge
- [ ] Interested vehicles shown as stock number badges
- [ ] Click shows "detail view coming soon" toast

### 2.12 AI Assistant (/ai)
- [ ] Chat interface renders with mock conversation
- [ ] User/AI bubbles styled correctly (gold/dark)
- [ ] Suggested prompt chips displayed
- [ ] Send button and input work (mock response)
- [ ] Beta badge visible

### 2.13 Live Translate (/translate)
- [ ] "Coming Soon" badge visible
- [ ] How it works 3-step cards render
- [ ] Language grid shows 8 languages
- [ ] "Notify Me" button toggles state

### 2.14 Digital Cards (/cards)
- [ ] Business card preview renders with Apple Wallet styling
- [ ] User info displayed (name, role, dealership)
- [ ] QR code placeholder visible
- [ ] Action buttons (Wallet, NFC, Copy Link) render
- [ ] Sharing stats displayed

### 2.15 Navigation
- [ ] Sidebar shows all 12+ nav items with correct icons
- [ ] Active item highlighted in gold
- [ ] Sidebar collapses to icons on smaller screens
- [ ] All nav links route correctly
- [ ] Rally branding visible in sidebar header

---

## Phase 3: Management Console (manage.rally.vin)

### 3.1 Dashboard (/)
- [ ] KPI stat cards render (active users, vehicles, activities, alerts)
- [ ] StatChart sparklines render
- [ ] Recent activity list displays
- [ ] Quick links navigate correctly

### 3.2 Users (/users)
- [ ] User cards render in grid with avatar, name, role badge
- [ ] Role filter chips work
- [ ] Search by name/email works
- [ ] Click "Invite User" → navigates to `/users/invite`

### 3.3 Invite User (/users/invite)
- [ ] Form renders with all fields (email, name, phone, role)
- [ ] Zod validation shows errors for invalid input
- [ ] Role selector dropdown works
- [ ] Submit shows success toast
- [ ] Back button returns to user list

### 3.4 User Detail (/users/[uid])
- [ ] User profile displays with avatar, role, status
- [ ] Permissions grid shows per-feature access
- [ ] Activity placeholder section visible

### 3.5 Inventory Oversight (/inventory)
- [ ] Status pipeline cards (Available, Active, Sold, etc.)
- [ ] Aging analysis with day ranges
- [ ] Stale vehicles highlighted
- [ ] Missing photos flagged

### 3.6 Performance (/performance)
- [ ] Leaderboard renders with team members
- [ ] Activity breakdown chart displays
- [ ] Peak hours heatmap renders
- [ ] Timeline chart shows daily counts

### 3.7 Reports (/reports)
- [ ] 6 report templates displayed
- [ ] DateRangePicker works
- [ ] Export buttons show placeholder toasts

### 3.8 Stores (/stores)
- [ ] Store cards with settings and feature flags
- [ ] Toggle switches render (disabled in mock mode)

### 3.9 Settings (/settings)
- [ ] Branding section, CRM integrations, notifications
- [ ] Sign out button works

---

## Phase 4: Super Admin (admin.rally.vin)

### 4.1 Dashboard (/)
- [ ] System KPIs: Total Tenants, Users, Vehicles, Uptime
- [ ] Recent audit log entries display
- [ ] Server health cards (CPU, RAM, Disk, PM2)
- [ ] Quick action buttons navigate correctly

### 4.2 Tenants (/tenants)
- [ ] DataTable lists all mock tenants
- [ ] Search by slug/name works
- [ ] Status filter chips work
- [ ] "Create Tenant" button → navigates to `/tenants/create`
- [ ] Row click → navigates to `/tenants/[groupId]`

### 4.3 Tenant Create (/tenants/create)
- [ ] Form validates all fields (Zod)
- [ ] Slug auto-generates from group name
- [ ] Slug preview shows `{slug}.rally.vin`
- [ ] Reserved slugs rejected (app, manage, admin, etc.)
- [ ] Submit shows provisioning progress steps
- [ ] Success state shows result details

### 4.4 Tenant Detail (/tenants/[groupId])
- [ ] Group info card with subdomain, plan, principal
- [ ] Stats row (users, stores, vehicles, activities)
- [ ] Stores list renders
- [ ] Suspend/Activate buttons work (toast)
- [ ] Delete requires slug confirmation input

### 4.5 System-Wide Users (/users)
- [ ] DataTable shows users across ALL tenants
- [ ] Tenant badge column distinguishes users
- [ ] Role filter works
- [ ] Search by name/email works

### 4.6 System-Wide Vehicles (/vehicles)
- [ ] DataTable shows vehicles across ALL tenants
- [ ] Status filter with activity colors
- [ ] Tenant badge column
- [ ] Stock numbers in monospace bold

### 4.7 System-Wide Activity (/activity)
- [ ] Activity feed across ALL tenants
- [ ] Tenant badge on each item
- [ ] Filter by type and tenant
- [ ] Date grouping works

### 4.8 DNS Management (/dns)
- [ ] DNS records table renders with all mock records
- [ ] Proxied status shown with cloud icon
- [ ] Search by record name
- [ ] Type filter (A, CNAME, Other)

### 4.9 Feature Flags (/feature-flags)
- [ ] Flag cards render with toggle switches
- [ ] Global enable/disable toggles work (toast)
- [ ] Rollout percentage bar renders
- [ ] Per-tenant overrides expand/collapse
- [ ] "Partial Rollout" warning badge appears when < 100%

### 4.10 Integrations (/integrations)
- [ ] Integration cards in 2-column grid
- [ ] Status dots (green/yellow/red/gray) correct
- [ ] Degraded/down statuses pulse
- [ ] "Test Connection" button shows loading then toast
- [ ] "Configure" button for unconfigured integrations

### 4.11 AI Management (/ai)
- [ ] Model config card with temperature, tokens
- [ ] Knowledge base categories with entry counts
- [ ] Usage metrics chart renders

### 4.12 Billing (/billing)
- [ ] Revenue KPIs (MRR, subscriptions, avg revenue, churn)
- [ ] Monthly revenue bar chart renders
- [ ] Subscription DataTable with plan badges

### 4.13 Audit Logs (/logs)
- [ ] Timeline entries with color-coded borders
- [ ] Action filter buttons work
- [ ] Date range picker works
- [ ] Search by actor/description
- [ ] Date grouping headers

### 4.14 System Health (/system)
- [ ] Server metric bars (CPU, RAM, Disk, Network)
- [ ] PM2 process table with all 4 apps
- [ ] Status badges (online/stopped)
- [ ] Restart/Stop buttons with confirmation
- [ ] Maintenance mode toggle
- [ ] Broadcast message input
- [ ] Cron jobs table

---

## Phase 5: Dealer Portal (*.rally.vin)

### 5.1 Landing Page (/)
- [ ] Rally branding displays
- [ ] Tenant name derived from slug
- [ ] "Sign In" button navigates to `/login`
- [ ] "Powered by Rally" footer

### 5.2 Login (/login)
- [ ] Email/password form renders
- [ ] Validation works
- [ ] Error state displays on bad credentials

### 5.3 Dashboard (/)
- [ ] Tenant name in welcome header
- [ ] 4 KPI cards render
- [ ] Inventory preview grid
- [ ] Recent activity list
- [ ] Quick links work

### 5.4 Inventory (/inventory)
- [ ] Vehicle grid renders
- [ ] FilterBar status chips work
- [ ] Search filters work
- [ ] Sort dropdown changes order
- [ ] Click → vehicle detail

### 5.5 Vehicle Detail (/inventory/[vin])
- [ ] StockHero with large stock number
- [ ] Photo gallery placeholder
- [ ] Full vehicle specs displayed
- [ ] Activity history for vehicle
- [ ] Hold info banner (if applicable)

### 5.6 Activity (/activity)
- [ ] Activity feed for this tenant only
- [ ] Filter by type works
- [ ] Active items at top with pulse
- [ ] Date grouping

### 5.7 Settings (/settings)
- [ ] Profile info displays
- [ ] Sign out works

### 5.8 Tenant Isolation
- [ ] Portal middleware extracts slug from Host header
- [ ] localhost falls back to "demo" slug
- [ ] Reserved subdomains (app, manage, admin) return null slug

---

## Phase 6: Cross-Cutting Tests

### 6.1 Responsive Design (ALL APPS)
Test at these widths:
- [ ] **375px** — iPhone SE (smallest supported)
- [ ] **768px** — iPad portrait
- [ ] **1440px** — Standard desktop
- [ ] Sidebar collapses to icon-only on narrow screens
- [ ] Cards stack to single column on mobile
- [ ] Touch targets minimum 44x44px

### 6.2 Dark Mode
- [ ] All pages dark theme — no white flashes
- [ ] Gold (#D4A017) only on interactive elements
- [ ] Sufficient contrast (4.5:1 minimum)
- [ ] No hardcoded light colors anywhere

### 6.3 Keyboard Navigation
- [ ] Tab order follows visual order on all pages
- [ ] Focus rings visible on all interactive elements
- [ ] Forms submittable via Enter key
- [ ] Sidebar navigable via keyboard

### 6.4 Error States
- [ ] Network error → OfflineBanner or Toast
- [ ] Invalid routes → 404 page
- [ ] API failures → Toast notification
- [ ] No silent `catch(() => {})` anywhere

### 6.5 Loading States
- [ ] Every page has Skeleton loading state
- [ ] No blank pages during data fetch
- [ ] Skeletons match final layout shape

### 6.6 Performance
- [ ] Full build completes in < 30s
- [ ] No route JS bundle > 150KB gzipped
- [ ] Static pages pre-rendered at build time
- [ ] Dynamic pages server-rendered on demand

---

## Phase 7: VPS Deployment Testing

### 7.1 Deploy
```bash
ssh user@66.179.189.87
cd /var/www/rally-web
git pull origin main
pnpm install --frozen-lockfile
pnpm turbo build
pm2 reload deploy/ecosystem.config.js
pm2 status
```

### 7.2 Verify Processes
- [ ] `pm2 status` shows all 4 apps online
- [ ] rally-staff: 4 instances, cluster mode, port 3001
- [ ] rally-manage: 2 instances, cluster mode, port 3002
- [ ] rally-admin: 1 instance, fork mode, port 3003
- [ ] rally-portal: 2 instances, cluster mode, port 3004

### 7.3 Verify Subdomains
- [ ] `https://app.rally.vin` loads Staff App
- [ ] `https://manage.rally.vin` loads Management Console
- [ ] `https://admin.rally.vin` loads Super Admin
- [ ] `https://rally.vin/api/health` returns OK
- [ ] SSL certificates valid (Cloudflare edge + Let's Encrypt origin)

### 7.4 Verify DNS
```bash
# Should resolve through Cloudflare
dig app.rally.vin +short
dig manage.rally.vin +short
dig admin.rally.vin +short
```

### 7.5 Health Checks
- [ ] `https://app.rally.vin/api/health` → 200 OK
- [ ] `https://manage.rally.vin/api/health` → 200 OK
- [ ] `https://admin.rally.vin/api/health` → 200 OK
- [ ] `https://portal-test.rally.vin/api/health` → 200 OK (if wildcard configured)

---

## Phase 8: Security Checklist

### Pre-Launch (Before Real Users)
- [ ] **Rotate Cloudflare API key** (exposed in this chat session)
- [ ] **Move credentials to `.env.local`** files (not committed)
- [ ] **Re-enable `.env` in `.gitignore`**
- [ ] **Verify Firestore rules** restrict cross-tenant data access
- [ ] **Verify middleware** blocks unauthorized role access
- [ ] **Check SUPER_ADMIN_UIDS** env var set correctly on VPS
- [ ] **SSL Full (Strict)** mode enabled in Cloudflare
- [ ] **No secrets in git history** — if found, rotate and force-push clean history

---

## Quick Reference

| App | Local URL | Production URL | Port |
|-----|-----------|---------------|------|
| Staff | http://localhost:3001 | https://app.rally.vin | 3001 |
| Manage | http://localhost:3002 | https://manage.rally.vin | 3002 |
| Admin | http://localhost:3003 | https://admin.rally.vin | 3003 |
| Portal | http://localhost:3004 | https://{slug}.rally.vin | 3004 |

| Credential | Status |
|-----------|--------|
| Cloudflare Zone ID | Configured |
| Cloudflare API Key | Configured (ROTATE BEFORE LAUNCH) |
| Super Admin UID | Configured (FMcjl4yfLXeWJ1O8TSUm3N7CpYh1) |
| Super Admin Email | trey@rally.vin |
| Firebase Client | TODO — needs credentials from Firebase Console |
| Firebase Admin | TODO — needs service account key |
| Plesk API | TODO — needs Plesk API key from VPS |
| Mapbox | TODO — needs token from Mapbox account |

---

*Rally Web Testing Plan — 2026-02-24*
*57 pages • 4 apps • 5 shared packages • 136 source files*
