#!/bin/bash
# Optional. Ed's computer is a Mac; this is here if the helper is ever used on Linux.
set -euo pipefail
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install Node 20 or newer, then run this again."
  exit 1
fi
if ! command -v systemctl >/dev/null 2>&1; then
  echo "systemd was not found. Run \`node $(dirname "$0")/cli.js --watch\` in a terminal instead."
  exit 1
fi
NODE="$(command -v node)"
CLI="$(cd "$(dirname "$0")" && pwd)/cli.js"
UNIT_DIR="${HOME}/.config/systemd/user"
mkdir -p "$UNIT_DIR"
cat > "$UNIT_DIR/claude-usage-alert.service" <<EOF
[Unit]
Description=Claude usage alert

[Service]
Type=oneshot
ExecStart="${NODE}" "${CLI}"
EOF
cat > "$UNIT_DIR/claude-usage-alert.timer" <<EOF
[Unit]
Description=Check Claude usage every 10 minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=10min
Persistent=true

[Install]
WantedBy=timers.target
EOF
systemctl --user daemon-reload
systemctl --user enable --now claude-usage-alert.timer
echo "Installed a user systemd timer. It checks every 10 minutes while you are logged in."
echo "Status: systemctl --user status claude-usage-alert.timer"
