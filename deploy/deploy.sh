#!/bin/bash
# Rally Web — Production Deploy Script
# Usage: ./deploy/deploy.sh
# Runs on VPS at /var/www/rally-web
set -euo pipefail

DEPLOY_DIR="/var/www/rally-web"
LOG_DIR="${DEPLOY_DIR}/logs"

echo "=============================="
echo "Rally Web Deploy — $(date)"
echo "=============================="

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Pull latest code
echo "[1/5] Pulling latest code..."
cd "$DEPLOY_DIR"
git pull origin main

# Install dependencies (frozen lockfile = no modifications)
echo "[2/5] Installing dependencies..."
pnpm install --frozen-lockfile

# Build all apps via Turborepo
echo "[3/5] Building all apps..."
pnpm turbo build

# Reload PM2 processes (zero-downtime for cluster mode apps)
echo "[4/5] Reloading PM2 processes..."
pm2 reload deploy/ecosystem.config.js

# Verify
echo "[5/5] Verifying..."
pm2 status

echo ""
echo "Deploy complete. $(date)"
echo "=============================="
