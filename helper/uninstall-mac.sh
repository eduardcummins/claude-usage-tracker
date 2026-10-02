#!/bin/bash
# Removes the Cluse helper from this Mac: the background check, the downloaded
# helper, its settings and its logs. Run either of:
#   curl -fsSL https://raw.githubusercontent.com/eduardcummins/claude-usage-tracker/main/helper/uninstall-mac.sh | bash
#   bash helper/uninstall-mac.sh
# Node.js and Claude Code are not touched.
set -uo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This command is for a Mac. On Windows, use uninstall-windows.ps1."
  exit 1
fi

LABEL="com.claude-usage-alert"
PLIST="${HOME}/Library/LaunchAgents/${LABEL}.plist"
DOMAIN="gui/$(id -u)"

if launchctl print "${DOMAIN}/${LABEL}" >/dev/null 2>&1; then
  launchctl bootout "${DOMAIN}/${LABEL}" >/dev/null 2>&1 || true
  echo "Stopped the background check ${LABEL}."
fi
if [[ -f "$PLIST" ]]; then
  rm -f "$PLIST"
  echo "Deleted $PLIST"
fi

# Stop a check that was already running from the downloaded helper.
pkill -f "${HOME}/.plan-pace/" >/dev/null 2>&1 || true

for p in \
  "${HOME}/.plan-pace" \
  "${HOME}/.claude-usage-alert" \
  "${HOME}/Library/Logs/claude-usage-alert.log" \
  "${HOME}/Library/Logs/claude-usage-alert.err.log"; do
  if [[ -e "$p" ]]; then
    rm -rf "$p"
    if [[ -e "$p" ]]; then
      echo "Could not delete $p."
    else
      echo "Deleted $p"
    fi
  fi
done

echo "Cluse helper removed from this Mac. Your Claude Code login was not changed."
