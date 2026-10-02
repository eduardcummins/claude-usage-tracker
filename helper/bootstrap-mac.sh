#!/bin/bash
# Downloads Cluse and prints the phone topic. Meant to be run with:
#   curl -fsSL https://raw.githubusercontent.com/eduardcummins/claude-usage-tracker/main/helper/bootstrap-mac.sh | bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This command is for a Mac. On Windows, use the PowerShell command from the app."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20 or newer is required."
  echo "Install it from https://nodejs.org and run this command again."
  exit 1
fi

major="$(node -p "Number(process.versions.node.split('.')[0])")"
if [[ "$major" -lt 20 ]]; then
  echo "Node.js 20 or newer is required. This Mac has $(node -v)."
  exit 1
fi

ROOT="${HOME}/.plan-pace/src"
ARCHIVE="$(mktemp)"
URL="https://github.com/eduardcummins/claude-usage-tracker/archive/refs/heads/main.tar.gz"

echo "Downloading the Cluse helper..."
if ! curl -fsSL "$URL" -o "$ARCHIVE"; then
  echo "Could not download the helper."
  echo "The GitHub project has to be public for this command to work."
  exit 1
fi

mkdir -p "$ROOT"
tar -xzf "$ARCHIVE" -C "$ROOT" --strip-components=1
rm -f "$ARCHIVE"

node "$ROOT/helper/cli.js" --init
node "$ROOT/helper/cli.js" install-mac
echo ""
echo "Done. Cluse works whenever this Mac is awake: it checks about every 10 minutes and lets you know when your limits reset."
echo "Scan the pairing code in Cluse. A topic that starts with cu- still works."
