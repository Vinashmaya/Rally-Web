# CLAUDE.md — Rally Web Platform

## Project Identity
Rally Web — the browser-based platform for Rally, a dealership operating system. Four portals (Staff, Dealer Portal, Management Console, Super Admin), seven user roles, multi-tenant via Cloudflare DNS subdomains, hosted on a dedicated VPS with Plesk.

## Required Reading (EVERY task)
Before doing ANY work, read these files in order:
1. `SOUL.md` — Agent team. Adopt the relevant persona.
2. `RULES.md` — Non-negotiable constraints. Violations are blockers.
3. `PROMPT.md` — Full system spec. The source of truth.

## Infrastructure (Non-Negotiable)
- **VPS:** Ubuntu 24.04 + Plesk Unlimited (12 vCore, 24GB RAM, 720GB NVMe)
- **Reverse Proxy:** Nginx managed by Plesk — routes subdomains to PM2 apps
- **Process Manager:** PM2 — cluster mode for staff app, all apps auto-restart
- **CDN / DNS:** Cloudflare — DNS management API + CDN proxy (orange cloud). **DNS and CDN only. Not hosting.**
- **SSL:** Let's Encrypt via Plesk (origin certs) + Cloudflare edge SSL (Full Strict mode)
- **No Vercel. No Cloudflare Pages. No serverless.** Everything runs on the VPS.

## Stack (Non-Negotiable)
- **Next.js 15 App Router** with TypeScript (strict mode) — full Node.js runtime, no edge restrictions
- **Tailwind CSS v4** — dark mode only, gold-on-black Rally brand
- **Lucide React** for icons — no other icon library
- **Firebase** (Auth + Firestore + Storage) — same backend as iOS app
- **Turborepo + pnpm** — monorepo management
- **Geist + Geist Mono** — fonts (loaded locally via next/font)
- **Mapbox GL JS** — maps (not Google Maps)
- **Zustand** — client state (not Redux, not Jotai, not Context for state)
- **TanStack Table** — data tables
- **React Hook Form + Zod** — forms and validation
- **Recharts** — charts

## App → Port Mapping
| App | Subdomain | Port | PM2 Instances |
|-----|-----------|------|---------------|
| Staff | `app.rally.vin` | 3001 | 4 (cluster) |
| Manage | `manage.rally.vin` | 3002 | 2 (cluster) |
| Admin | `admin.rally.vin` | 3003 | 1 |
| Portal | `*.rally.vin` (wildcard) | 3004 | 2 (cluster) |

## Conventions
- All components in `packages/ui/` — no component defined in an app that could be shared
- All Firebase logic in `packages/firebase/` — no direct Firestore calls in components
- All business logic in `packages/services/` — no business logic in components
- All infrastructure automation in `packages/infra/` — Cloudflare DNS + Plesk vhost APIs
- Server Components by default. Client Components only when needed (interactivity, hooks, listeners).
- Route handlers in `app/api/` for server-side proxy calls — full Node.js, no edge restrictions
- Middleware runs in full Node.js runtime (not edge) — can make any network call, read any env var
- Use `as const` for all constant objects
- Use Zod schemas for all API responses and form inputs
- No `any` types. No `@ts-ignore`. No `eslint-disable`.

## Design Rules
- Dark mode only. No light theme. No theme toggle.
- Gold (#D4A017) means interactive. If it's gold, it's clickable.
- `StockHero` component for stock numbers — 40pt bold monospace. Always.
- 4px spacing grid. Values from design tokens only.
- No magic numbers in Tailwind classes — use the Rally token classes.
- Loading states use Skeleton components, never spinner-only.
- Errors surface as Toast notifications — never swallowed silently.
- Real-time data uses Firestore snapshot listeners — never polling.

## Deployment
- Build: `pnpm turbo build` on VPS
- Run: `pm2 reload deploy/ecosystem.config.js`
- Deploy script: `deploy/deploy.sh` (pull → install → build → reload)
- Nginx vhosts managed by Plesk — new subdomains created via Plesk API
- DNS records managed via Cloudflare API (scoped token, DNS:Edit only)

## Agent Selection
Match the task to the correct agent from SOUL.md:
- Architecture/scaffolding → **MACK**
- Design system/UI components → **PIXEL**
- Firebase/data layer → **WIRE**
- Role-based logic/permissions → **ATLAS**
- API routes/external integrations → **BRIDGE**
- Cloudflare DNS/Plesk/PM2/deployment → **SYNC**
- Testing → **PROOF**
- Cross-cutting decisions → **MACK**

Announce which agent you're operating as at the start of every task.

## File Naming
- Components: `PascalCase.tsx`
- Hooks: `useCamelCase.ts`
- Utils: `camelCase.ts`
- Types: `camelCase.types.ts`
- Constants: `SCREAMING_SNAKE.ts` or inline `as const`
- Route files: Next.js conventions (`page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`)
- PM2 configs: `ecosystem.config.js`
- Nginx templates: `subdomain.conf`
- Deploy scripts: `deploy.sh`, `setup.sh`
