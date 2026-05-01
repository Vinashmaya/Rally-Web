# RULES.md — Rally Web Platform

> Non-negotiable. Every agent, every task, every commit.

---

## Rule 0: Read the Spec First

`PROMPT.md` is the source of truth. If you're building the inventory page, read Part 3 (role-based interfaces) AND Part 6 (interaction flows) AND Part 10 (performance requirements) before writing a single component.

---

## Rule 1: Shared Packages Are the Foundation

Nothing gets built in an app until the corresponding package code exists.

| Need | Package | Not In |
|------|---------|--------|
| A button | `@rally/ui` | `apps/staff/components/` |
| A Firestore query | `@rally/firebase` | `apps/manage/lib/` |
| Permission check | `@rally/services` | Component file inline |
| Cloudflare DNS call | `@rally/infra` | API route directly |
| Plesk vhost creation | `@rally/infra` | Shell script inline |

If you're about to create a utility function in an app directory, stop. It probably belongs in a package.

---

## Rule 2: Firebase Is Shared — Don't Break iOS

The web apps read and write to the same Firestore collections as the iOS app. Every document shape, every field name, every timestamp format must match exactly. If you add a field, it must be optional so existing iOS clients don't break. If you rename a field, you've broken production.

Test: After any Firestore schema change, verify the iOS app still works by reading the same document from both platforms.

---

## Rule 3: Mobile-First, Desktop-Required

Every component is built mobile-first in Tailwind (base styles = mobile), then enhanced with `sm:`, `md:`, `lg:` breakpoints. But "mobile-first" does not mean "desktop is an afterthought."

Test at three widths before any component is considered done:
- 375px (iPhone SE — smallest supported)
- 768px (iPad portrait)
- 1440px (standard desktop)

---

## Rule 4: Dark Mode Only — No Exceptions

There is no light theme. There is no theme toggle. There is no `prefers-color-scheme` media query. Gold on black. White text on dark zinc. Green/red/blue for status. That's the palette.

---

## Rule 5: Type Everything

Zod schemas for every API response. TypeScript interfaces for every component prop. Firestore document types in `@rally/firebase/types.ts`. No `any`. No `as unknown as`. No `@ts-ignore`.

---

## Rule 6: Server Components by Default

Every component is a React Server Component unless it needs event handlers, React hooks, browser APIs, or Firestore snapshot listeners. Mark Client Components with `'use client'`. Keep them small — push data fetching to the server, pass it down as props.

---

## Rule 7: Real-Time Is Non-Negotiable

Any data that can change (vehicle activity, list contents, fleet positions) must use Firestore `onSnapshot` listeners. No polling. No manual refresh buttons. When a salesperson starts a test drive on their iPhone, the web dashboard updates in <1 second.

---

## Rule 8: Role-Based Access at Three Layers

1. **Middleware** — blocks unauthorized route access before the page renders
2. **Server Components** — query only data the role is allowed to see
3. **Client Components** — hide UI elements the role can't interact with

All three layers must agree. Never rely on just hiding a button.

---

## Rule 9: Tenant Isolation Is Sacred

A user in Tenant A must never see data from Tenant B. Every Firestore query must be scoped to the active tenant's `groupId` and `storeId`. Super admin is the only exception — queries across tenants with tenant badges on every record.

---

## Rule 10: The Design System Is the API

Components in `@rally/ui` are the only way to render UI. No raw `<button>` tags. No inline `className="bg-zinc-900 p-4"` on divs that should be a `<Card>`. If a pattern appears twice, it becomes a component.

---

## Rule 11: Errors Are Visible

Every async operation has error handling that surfaces to the user via Toast. Network failures show an OfflineBanner. Firestore listener errors show a reconnecting indicator. API route failures return structured error responses with status codes. No silent `catch(() => {})`.

---

## Rule 12: Performance Budgets Are Hard Limits

| Metric | Limit |
|--------|-------|
| First Contentful Paint | < 1.2s |
| Largest Contentful Paint | < 2.5s |
| Route transition | < 300ms |
| Bundle size (per route) | < 150KB gzipped |
| SSR response (localhost) | < 200ms |

---

## Rule 13: Secrets Never Touch Git

`.env.local` is in `.gitignore`. Always. All secrets are environment variables on the VPS. `.env.example` documents what's needed without values. If you see a credential in source code, that's a stop-the-line event.

---

## Rule 14: Accessibility Is Not Optional

Every interactive element has a visible focus ring. Every image has alt text. Every form input has a label. Tab order follows visual order. Color is never the only indicator. `prefers-reduced-motion` disables animations. Test with keyboard-only navigation before any page is done.

---

## Rule 15: One Sprint at a Time

The implementation sequence in `PROMPT.md` Part 9 is the plan. Sprint 1 (foundation) must be complete before Sprint 2 (staff app) begins.

---

## Rule 16: Every Page Has Four States

1. **Loading** — Skeleton placeholders matching the final layout shape
2. **Empty** — Illustrated empty state with a clear CTA
3. **Data** — Normal populated state
4. **Error** — Inline error message or full-page error with retry

No page renders blank while loading.

---

## Rule 17: The iOS App Is the Reference Implementation

When there's ambiguity about how a feature should work, the iOS app is authoritative. Same data model. Same activity states. Same smart action logic. Same permission rules. Differences in UX affordances are expected. Differences in business logic are bugs.

---

## Rule 18: VPS Deployment Discipline

- **Build on the VPS:** `pnpm turbo build` — all four apps built in the Turborepo pipeline
- **PM2 manages processes:** `pm2 reload ecosystem.config.js` — zero-downtime restarts
- **Nginx routes traffic:** Plesk manages vhosts. Each subdomain points to the correct PM2 port.
- **Cloudflare proxies everything:** All DNS records are orange-clouded. The VPS IP is never exposed.
- **Deploy script is the only way to deploy:** `deploy/deploy.sh` — git pull, install, build, reload. No manual `next build` on the server.
- **Logs live in PM2:** `pm2 logs rally-staff` — not random console output. Structured logging.
- **Never SSH and edit files directly.** All changes go through git.

---

## Rule 19: Subdomain Provisioning Is Atomic

When creating a new tenant subdomain, the full flow must be atomic:
1. Create Cloudflare DNS record
2. Create Plesk vhost
3. Seed Firestore tenant config
4. Create principal user account
5. Log to audit trail

If step 2 fails, roll back step 1 (delete DNS record). If step 3 fails, roll back steps 1 and 2. No half-provisioned tenants. No orphaned DNS records. No Plesk vhosts pointing to nothing.

---

## Rule 20: Ship Incrementally

Staff app for salesperson role is the first milestone. Not all four portals simultaneously. Not all seven roles simultaneously. Ship → test with real users → iterate → expand.

---

*Rally Web Rules — February 2026*
*VPS (Ubuntu 24.04 + Plesk) • Cloudflare DNS + CDN • PM2 process management*
