#!/usr/bin/env bash
# Rally Web — commit and push the swarm changes.
#
# Run from the repo root on your laptop (NOT the VPS):
#   ./deploy/commit-and-push.sh
#
# This script ONLY commits and pushes. It does NOT deploy to the VPS or
# push Firestore rules — those are separate manual steps documented at
# the bottom of this script and in DEPLOY_CHECKLIST.md.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "==> Working dir: $REPO_ROOT"

# ---------------------------------------------------------------------------
# 1. Clean up sandbox leftovers and stale git locks.
# ---------------------------------------------------------------------------
echo ""
echo "==> Removing stale .git/index.lock if present"
rm -f .git/index.lock

echo "==> Removing pnpm tmp leftovers from sandbox attempts"
rm -f _tmp_3_* 2>/dev/null || true

echo "==> Removing the stubbed debug-auth route (audit blocker, sandbox couldn't delete)"
rm -rf apps/admin/app/api/debug-auth

# ---------------------------------------------------------------------------
# 2. Confirm git identity. If your global identity is different from these
#    defaults, comment out these two lines.
# ---------------------------------------------------------------------------
git config user.email "trey@rally.vin"
git config user.name "Trey Adcox"

# ---------------------------------------------------------------------------
# 3. Stage all currently-tracked modifications.
# ---------------------------------------------------------------------------
echo ""
echo "==> Staging tracked modifications"
git add -u

# ---------------------------------------------------------------------------
# 4. Stage all swarm-created new files explicitly. This avoids `git add -A`
#    which would also pick up session transcripts, screenshots, SECRETS dirs,
#    and pnpm tmp files.
# ---------------------------------------------------------------------------
echo ""
echo "==> Staging new swarm files"

NEW_PATHS=(
  "apps/admin/app/(dashboard)/vehicles/[groupId]/"
  "apps/admin/app/api/admin/ai/"
  "apps/admin/app/api/admin/billing/"
  "apps/admin/app/api/admin/integrations/"
  "apps/admin/app/api/admin/users/[uid]/impersonate/"
  "apps/admin/app/api/auth/end-impersonation/"
  "apps/manage/app/(dashboard)/activity/"
  "apps/manage/app/(dashboard)/billing/"
  "apps/manage/app/(dashboard)/fleet/"
  "apps/manage/app/(dashboard)/lists/"
  "apps/manage/app/(dashboard)/nfc/"
  "apps/manage/app/api/billing/"
  "apps/manage/app/api/reports/"
  "apps/staff/app/(dashboard)/crm/[customerId]/"
  "apps/staff/app/api/cards/"
  "apps/staff/app/api/crm/"
  "packages/firebase/src/hooks/useAllVehicleLists.ts"
  "packages/firebase/src/hooks/useNfcTags.ts"
  "packages/infra/src/stripe.ts"
  "packages/ui/src/ImpersonationBanner.tsx"
  "packages/ui/src/ImpersonationHandoff.tsx"
  "packages/ui/src/Modal.tsx"
  "DEPLOY_CHECKLIST.md"
  "deploy/commit-and-push.sh"
)

for path in "${NEW_PATHS[@]}"; do
  if [[ -e "$path" ]]; then
    git add "$path"
  else
    echo "  WARN: missing $path"
  fi
done

# ---------------------------------------------------------------------------
# 5. Show the diff summary and confirm before committing.
# ---------------------------------------------------------------------------
echo ""
echo "==> Staged diff summary"
git diff --cached --stat | tail -30
echo ""
echo "Total files staged: $(git diff --cached --name-only | wc -l | tr -d ' ')"
echo ""
read -rp "Commit and push? [y/N] " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "Aborted. Index is staged; run 'git reset' to unstage."
  exit 0
fi

# ---------------------------------------------------------------------------
# 6. Commit.
# ---------------------------------------------------------------------------
echo ""
echo "==> Committing"
git commit -m "Wave 1+2 audit-fix swarm

Wave 1 (security + spec gaps):
- firestore.rules rewritten — deny-by-default, 7-role hierarchy, custom claim
  fallback to users/{uid} doc lookup
- Translate hidden from staff nav (page kept, deferred)
- Portal landing reads tenant logo + public-inventory feature flag
- Doc casing fixed for Linux deploy (CLAUDE.md / RULES.md / PROMPT.md)
- Admin DNS edit/delete wired through to Cloudflare API
- Admin tenant action menu — confirmation modals + type-to-confirm on deprovision
- Admin cross-tenant vehicle detail at vehicles/[groupId]/[vin]
- Manage portal: activity, fleet, nfc, lists pages built (per spec)
- Staff CRM customer detail page + proxy to api.rally.vin
- Feature flags page wired to existing API (toggle, overrides, rollout, CRUD)

Wave 2 (provider integrations + complex features):
- Anthropic AI chat — NDJSON streaming, VIN-context injection, usage logging
- Admin AI page reads real config + KB stats + usage charts
- Stripe (test mode) wired to admin + manage; customer create added to
  provisioning rollback chain
- Real QR scanner via @zxing/browser; real QR codes via qrcode
- Apple Wallet route returns 501 with setup hint until cert is provisioned
- System health: real os/PM2/disk reads, allow-listed pm2 reload/stop
- Integrations health: 7 parallel probes with 60s cache
- Impersonation: cross-subdomain ?ic= handoff, persistent banner, refresh-token
  revocation on end
- Reports export: CSV + PDF for all 6 manage report templates

Cleanups:
- Modal primitive lifted into @rally/ui (3 admin pages refactored)
- nfcTags composite index added
- crmCustomerSchema extended to match iOS shape
- revokeRefreshTokens wired into role change handler
- setup-super-admin.js sets superAdmin custom claim
- aiUsage Firestore rule (super-admin read, server-only write)
- .env.example: Apple Wallet vars, NEXT_PUBLIC_*_HOST, server-side MAPBOX_TOKEN
- debug-auth diagnostic endpoint removed

Manual deploy steps remain: pnpm install, typecheck, build, firebase deploy
for rules+indexes, deploy.sh on VPS. See DEPLOY_CHECKLIST.md."

# ---------------------------------------------------------------------------
# 7. Push.
# ---------------------------------------------------------------------------
echo ""
echo "==> Pushing to origin/main"
git push origin main

echo ""
echo "==> Done."
echo ""
echo "Next steps (NOT done by this script — see DEPLOY_CHECKLIST.md):"
echo "  1. pnpm install                          # locally, refresh lockfile"
echo "  2. pnpm turbo typecheck                  # locally, must pass"
echo "  3. pnpm turbo build                      # locally, must pass"
echo "  4. git add pnpm-lock.yaml && git commit -m 'lockfile refresh' && git push"
echo "  5. firebase emulators:start --only firestore  # smoke-test rules"
echo "  6. node scripts/setup-super-admin.js <uid>    # for each super admin"
echo "  7. firebase deploy --only firestore:rules,firestore:indexes"
echo "  8. ssh into VPS, set new env vars in .env.local, then ./deploy/deploy.sh"
echo "  9. Smoke-test app.rally.vin / manage.rally.vin / admin.rally.vin"
