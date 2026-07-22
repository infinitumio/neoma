#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# neoma — one-shot setup for macOS / Linux.
# Goes from a fresh clone to a running app: checks Node, installs
# dependencies, builds the production bundle, opens your browser, and serves.
#
#   ./start.sh            # build + serve (production)
#   PORT=5050 ./start.sh  # use a different port
#
set -euo pipefail

PORT="${PORT:-4173}"
URL="http://localhost:${PORT}"

# Always run from the repository root (where this script lives).
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "neoma — one-shot setup"
echo "======================"

# 1. Node.js must be present and recent enough.
if ! command -v node >/dev/null 2>&1; then
  echo "✗ Node.js is not installed."
  echo "  Install Node 20 or newer (LTS) from https://nodejs.org/ and run ./start.sh again."
  exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "✗ Node $(node -v) found, but neoma needs Node 20 or newer."
  echo "  Update from https://nodejs.org/ (or 'nvm install 20') and run ./start.sh again."
  exit 1
fi
echo "✓ Node $(node -v)"

# 2. Install dependencies (skip if already present).
if [ -d node_modules ]; then
  echo "✓ Dependencies already installed (delete node_modules to reinstall)"
else
  echo "→ Installing dependencies…"
  if [ -f package-lock.json ]; then
    npm ci
  else
    npm install
  fi
fi

# 3. Build the production bundle.
echo "→ Building…"
npm run build

# 4. Open the browser once the server has had a moment to start.
open_browser() {
  sleep 2
  if command -v open >/dev/null 2>&1; then
    open "$URL"
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL"
  fi
}
open_browser >/dev/null 2>&1 &

# 5. Serve the built app (blocks until Ctrl+C).
echo ""
echo "✓ neoma is running at ${URL}"
echo "  Press Ctrl+C to stop."
echo ""
exec npm run preview -- --port "${PORT}" --strictPort
