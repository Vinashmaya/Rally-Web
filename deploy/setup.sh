#!/bin/bash
# Rally Web — First-Time VPS Setup
# Run once on a fresh Ubuntu 24.04 + Plesk VPS
set -euo pipefail

echo "Rally Web — VPS Setup"
echo "====================="

# Check for root
if [ "$(id -u)" -ne 0 ]; then
  echo "Error: Run as root"
  exit 1
fi

# Install Node.js 22 LTS via NodeSource
echo "[1/7] Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# Install pnpm
echo "[2/7] Installing pnpm..."
npm install -g pnpm@latest

# Install PM2
echo "[3/7] Installing PM2..."
npm install -g pm2

# Clone repo
echo "[4/7] Cloning repository..."
mkdir -p /var/www
cd /var/www
if [ ! -d "rally-web" ]; then
  git clone https://github.com/Vinashmaya/Rally-Web.git rally-web
fi
cd rally-web

# Install dependencies
echo "[5/7] Installing dependencies..."
pnpm install --frozen-lockfile

# Build
echo "[6/7] Building..."
pnpm turbo build

# Start PM2 processes
echo "[7/7] Starting PM2..."
mkdir -p logs
pm2 start deploy/ecosystem.config.js
pm2 save
pm2 startup

echo ""
echo "Setup complete!"
echo "Next steps:"
echo "  1. Configure Nginx vhosts via Plesk (see deploy/nginx/ templates)"
echo "  2. Set up .env.local with production secrets"
echo "  3. Configure Cloudflare DNS records"
echo "  4. Request Let's Encrypt certs via Plesk"
echo ""
pm2 status
