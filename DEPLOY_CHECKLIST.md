# Pre-Deploy Checklist — Rally Web (post-swarm)

Generated 2026-04-27 after the audit-fix swarm landed ~3,500 lines of new code
across 4 apps and 4 packages. None of it has been typechecked, built, or
deployed. This checklist is the path to ship.

Severity tags: **BLOCKER** = will break prod / will reject deploy. **HIGH** =
will break a feature. **MEDIUM** = will cause confusion or follow-up work.
**LOW** = polish.

---

## 0. Before you do anything else

- [ ] **BLOCKER** — `cd /Users/treyadcox/Desktop/_Rally_Dev/projects/Rally-Web`
- [ ] **BLOCKER** — `git status` — confirm you're on `main` (or whichever branch you ship from), uncommitted changes are exactly what you expect, no stray files in the diff.

## 1. Clean up things the sandbox couldn't

- [ ] **HIGH** — `rm -rf apps/admin/app/api/debug-auth/`. The route was reduced to a 404 stub but the directory should be gone. Confirm with `ls apps/admin/app/api/` afterward.
- [ ] **MEDIUM** — Add to `.gitignore`: `2026-*-this-session-is-being-continued-*.txt`, `SECRETS.rtfd/`, `SECRETS 2.rtfd/`. These shouldn't be tracked even pre-launch.

## 2. Install + lockfile refresh

- [ ] **BLOCKER** — `pnpm install`. New deps across 5 package.jsons:
  - `apps/staff`: `@anthropic-ai/sdk`, `qrcode`, `@types/qrcode`, `@zxing/browser`, `@zxing/library`, `passkit-generator`, `mapbox-gl`, `@types/mapbox-gl`
  - `apps/admin`: `stripe`, `mapbox-gl`, `@types/mapbox-gl`
  - `apps/manage`: `stripe`, `pdfkit`, `@types/pdfkit`, `mapbox-gl`, `@types/mapbox-gl`
  - `packages/infra`: `stripe`
  - `packages/ui`: firebase peer dep added
- [ ] **MEDIUM** — Bump `@anthropic-ai/sdk` to latest before install: `pnpm add -F @rally/staff @anthropic-ai/sdk@latest`. The pinned `^0.32.1` is from 2024; the chat route uses `event.type === 'content_block_delta'`, `event.type === 'message_delta'`, `event.type === 'message_start'`, and `sdkStream.finalMessage()`. These exist in 0.32+ but the API has evolved. Run a quick smoke against the chat route before deploying — the failure mode is silent (delta events not matching, empty response).
- [ ] **BLOCKER** — Commit the updated `pnpm-lock.yaml`. The VPS deploy uses `--frozen-lockfile`; an out-of-date lockfile will fail the deploy.

## 3. Typecheck + build (locally)

- [ ] **BLOCKER** — `pnpm turbo typecheck`. The swarm wrote disjoint code in 10 scopes — TS errors at cross-package boundaries are the most likely failure. If errors surface:
  - `crmCustomerSchema` was extended; consumers may need updates beyond the staff CRM detail page
  - `Modal` was lifted to `@rally/ui`; check the three admin pages don't have leftover local imports
  - `ImpersonationHandoff` and `ImpersonationBanner` are new exports from `@rally/ui` — apps consuming them must have firebase as a direct dep (manage and admin do; staff does)
- [ ] **BLOCKER** — `pnpm turbo build`. If typecheck passes but build fails, the most likely culprits are: `'use client'` boundaries violated, server-only imports in client files, or env var resolution at build time.

## 4. Firestore rules — test in emulator BEFORE pushing

The new rules are deny-by-default with a multi-layer fallback (custom claims → user-doc lookup). Deploying them blind will lock users out if any assumption is wrong.

- [ ] **BLOCKER** — `firebase emulators:start --only firestore`. Then run a smoke test for each role + tenant combo:
  - Salesperson at dealership A: can read own dealership's `vehicles`, `vehicleActivities`, `crmCustomers`. Cannot read another dealership's. Cannot delete activities.
  - Porter at dealership A: can update vehicle status. Cannot delete vehicles.
  - GM at dealership A: can update users, can delete vehicles in own dealership.
  - Super admin (with `superAdmin: true` claim or in `system/superAdmins`): can read everything.
  - Cross-tenant write attempt: should fail.
- [ ] **HIGH** — Verify the iOS app's existing token shape matches what the rules expect. iOS users today carry `dealershipId` in their user doc but **may not** have `setCustomUserClaims` ever called for them. The rules fall back to `users/{uid}` doc lookup in that case; verify a real iOS user can still read their tenant.

## 5. Set up super admins

The `isSuperAdmin()` rule check looks for either `request.auth.token.superAdmin == true` OR a `system/superAdmins` doc with `uids: [...]`. The `SUPER_ADMIN_UIDS` env var is **only** read by `auth-guard.ts` server-side — it is not visible to Firestore rules.

- [ ] **BLOCKER** — For each super admin UID currently in `SUPER_ADMIN_UIDS` env var, run: `node scripts/setup-super-admin.js <uid>`. This sets the `superAdmin: true` claim AND revokes their refresh tokens so they re-auth with the new claim.
- [ ] **MEDIUM** — Alternative: write the list once to `system/superAdmins` doc as `{ uids: ["uid1", "uid2"] }` from the Firebase console. Less ideal because it's outside the script.

## 6. Env vars on the VPS

- [ ] **BLOCKER** — SSH to the VPS. `cd /var/www/rally-web && nano .env.local`.
- [ ] **BLOCKER** — Ensure all variables in `.env.example` have values **except** the ones you're deferring (Apple Wallet — see step 8, eLead health probe).
- [ ] **BLOCKER** — New required vars (these did not exist before this swarm):
  - `ANTHROPIC_API_KEY=sk-ant-...`
  - `STRIPE_SECRET_KEY=sk_test_...` (start with test mode)
  - `STRIPE_PUBLISHABLE_KEY=pk_test_...`
- [ ] **MEDIUM** — Optional but probably wanted:
  - `VINCUE_API_BASE`, `DRIVECENTRIC_API_BASE`, `KAHU_API_BASE`, `GHOST_API_BASE` — only if upstreams differ from the iOS-confirmed defaults
  - `ELEAD_HEALTH_URL` — leave empty until eLead exposes one; the integrations page will show "Not Configured" rather than fake green
  - `MAPBOX_TOKEN` — only if any API route geocodes server-side (none do today; safe to leave unset)
  - `NEXT_PUBLIC_*_HOST` — leave defaults unless you're on a staging subdomain

## 7. Deploy code

- [ ] **BLOCKER** — Commit and push: `git add -A && git commit -m "Rally Web swarm — Wave 1 + 2 fixes" && git push origin main`
- [ ] **BLOCKER** — SSH to the VPS. Run `./deploy/deploy.sh`. This does git pull → `pnpm install --frozen-lockfile` → `pnpm turbo build` → `pm2 reload deploy/ecosystem.config.js`.
  - If the build fails, the old PM2 processes keep running. Investigate the build log before declaring an incident.
- [ ] **HIGH** — `pm2 status` — confirm all four apps are `online`, instance counts match (rally-staff: 4, rally-manage: 2, rally-admin: 1, rally-portal: 2), restart count is 0.
- [ ] **HIGH** — `pm2 logs --lines 50` — scan for any startup errors or env-var warnings.

## 8. Deploy Firestore rules + indexes (separate step from code)

- [ ] **BLOCKER** — `firebase deploy --only firestore:rules,firestore:indexes`
- [ ] **HIGH** — Watch the deploy output for index-creation jobs. Composite index builds take 5–30 minutes for large collections; queries that need them will fail until builds finish.
  - New indexes: `nfcTags(dealershipId asc, lastScannedAt desc)`, `auditLogs(groupId asc, timestamp desc)`

## 9. Apple Wallet (deferred but on the punch list)

- [ ] **MEDIUM** — The Apple Wallet route returns 501 until you configure these. Until then, the staff Cards page surfaces the error to the user (it doesn't crash). To enable:
  1. Confirm Pass Type ID exists in the Apple Developer portal under your team.
  2. Generate the signer cert + key + WWDR cert.
  3. Either set the inline ENV vars (`APPLE_PASS_SIGNER_CERT=`, etc.) with PEM contents, or drop the files in `apps/staff/certs/` (or `/etc/rally/certs/`) and set the `*_PATH` vars.
  4. Restart staff: `pm2 reload rally-staff`.

## 10. Smoke tests (post-deploy)

- [ ] **BLOCKER** — `https://app.rally.vin` — log in as a salesperson at a real dealership. Confirm: dashboard renders, inventory list loads, vehicle detail loads, activity feed real-time-updates.
- [ ] **BLOCKER** — `https://manage.rally.vin` — log in as a GM. Confirm: dashboard, users list, the four new pages (activity, fleet, nfc, lists) all render with real data. Try CSV export from reports — should download.
- [ ] **BLOCKER** — `https://admin.rally.vin` — log in as super admin. Confirm: tenants list, system health (real PM2 numbers), integrations health (real probe results), feature flags toggle, billing list (Stripe data), AI page (real config + KB stats).
- [ ] **HIGH** — Impersonate a salesperson from admin → confirm landing on `app.rally.vin` with banner. Click "End impersonation" → returns to admin.
- [ ] **HIGH** — Open a vehicle on staff → AI chat → ask a question with VIN context → confirm streaming response from Claude.
- [ ] **HIGH** — Tap an NFC tag (or use the QR scanner) on a real iPhone → confirm vehicle detail loads.
- [ ] **MEDIUM** — Visit a tenant subdomain (e.g. `gallatin-cdjr.rally.vin`) → confirm tenant logo and feature-flag-gated public inventory CTA render correctly.

## 11. Rollback plan

If anything breaks badly:
- Code rollback: `git revert HEAD && git push && ./deploy/deploy.sh`. PM2 will reload to the previous build.
- Rules rollback: `firebase firestore:rules:rollback` is not a thing. Keep the previous rules file in git history; if the new rules lock users out, revert the file and `firebase deploy --only firestore:rules`. Index drops are slow and not recommended in a hurry.
- Stripe customer creation in tenant provisioning is wrapped in the rollback chain — a failed provision won't leave orphaned customers.

## 12. Things deliberately NOT in this deploy

These were caught in the audit, scoped out by you, or deferred by the swarm.
Tracking here so they don't get lost:

- Admin 2FA (your call — Sendblue later)
- Manage CRM page (item 22 — your call)
- Translate native page (deferred; nav entry hidden)
- Stripe webhook ingestion (`invoice.paid`, etc.) — TODO in `provision.ts`
- Scheduled report email delivery — TODO in `apps/manage/app/(dashboard)/reports/page.tsx`
- Maintenance / broadcast banner consumers — admin can write the docs; the apps still need to subscribe and render the banner
- `useFeatureFlag` consumer hook — agent skipped (optional)
- Secret rotation — your call (still pre-launch)

---

*Generated post-Wave-2. Update this file as items are checked off.*
