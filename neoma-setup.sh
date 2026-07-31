#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# neoma — self-contained setup for macOS / Linux.
#
# Download THIS file on its own and run it: it fetches neoma, installs
# everything, builds it, opens your browser and serves the app. No cloning or
# other steps required.
#
#   chmod +x neoma-setup.sh && ./neoma-setup.sh
#   NEOMA_DIR=~/apps/neoma ./neoma-setup.sh   # choose where it lands
#
# The only prerequisite is Node.js 20+ (https://nodejs.org). Git is used if
# available; otherwise the project is downloaded as a zip.
set -euo pipefail

REPO_URL="https://github.com/infinitumio/neoma.git"
ZIP_URL="https://github.com/infinitumio/neoma/archive/refs/heads/main.zip"
DIR="${NEOMA_DIR:-neoma}"

echo "neoma — setup"
echo "============="

# 1. Node.js must be present and recent enough (fail early, before downloading).
if ! command -v node >/dev/null 2>&1; then
  echo "✗ Node.js is not installed."
  echo "  Install Node 20 or newer (LTS) from https://nodejs.org/ and run this again."
  exit 1
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "✗ Node $(node -v) found, but neoma needs Node 20 or newer."
  echo "  Update from https://nodejs.org/ (or 'nvm install 20') and run this again."
  exit 1
fi
echo "✓ Node $(node -v)"

# 2. Fetch the project (skip if it's already here).
if [ -f "$DIR/package.json" ]; then
  echo "✓ Using existing copy in ./$DIR"
elif command -v git >/dev/null 2>&1; then
  echo "→ Cloning neoma into ./$DIR …"
  git clone --depth 1 "$REPO_URL" "$DIR"
elif command -v curl >/dev/null 2>&1 && command -v unzip >/dev/null 2>&1; then
  echo "→ Downloading neoma into ./$DIR …"
  tmp="$(mktemp -d)"
  curl -fsSL -o "$tmp/neoma.zip" "$ZIP_URL"
  unzip -q "$tmp/neoma.zip" -d "$tmp"
  mv "$tmp"/neoma-* "$DIR"
  rm -rf "$tmp"
else
  echo "✗ Need either 'git', or 'curl' + 'unzip', to download neoma."
  echo "  Install git (https://git-scm.com) and run this again."
  exit 1
fi

# 3. Hand off to the project's own bootstrap (install + build + serve).
cd "$DIR"
echo "✓ Project ready in $(pwd)"
echo ""
exec bash ./start.sh
