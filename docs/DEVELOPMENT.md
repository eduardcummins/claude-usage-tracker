# Developing Cluse

The project has two parts:

- `helper/`: a Node.js (20+) command-line helper that runs on the computer. It reads Claude usage with the Claude Code login already there (the macOS Keychain on a Mac, `%USERPROFILE%\.claude\.credentials.json` on Windows, `~/.claude/.credentials.json` on Linux) and publishes it to ntfy.
- `mobile/`: the Expo (SDK 57) app for the phone, with the Android home screen widgets.

## How the data gets to the phone

`node helper/cli.js --init` creates an ntfy topic and an AES-256-GCM key. The pairing code (and its QR code) carries the topic, the key and the server URL. The default server is in `helper/ntfy.json` (`https://ntfy.sh`).

About every 10 minutes the helper encrypts a usage snapshot and publishes it to `<topic>-data` with `Cache: yes`. ntfy only stores the ciphertext, for about 12 hours. The phone reads `https://ntfy.sh/<topic>-data/json?poll=1&since=12h`, decrypts the newest snapshot, and schedules the reset notifications on the phone itself. The phone never contacts Anthropic and never holds a Claude login.

An older plain `cu-` topic with no key still works, but its percentages are readable by anyone who knows the topic. Re-pair with `--init --rotate` to get an encrypted one.

The usage figures come from `https://api.anthropic.com/api/oauth/usage`, the same check Claude Code uses. It is not a documented public API.

## Helper commands

From a copy of this repo:

```bash
node helper/cli.js --doctor        # print your usage; sends nothing
node helper/cli.js --init          # create a topic and key, show the pairing code
node helper/cli.js --init --rotate # replace the topic and key (re-pair the phone)
node helper/cli.js --test-alert    # send an encrypted test message
node helper/cli.js --watch         # check in a terminal window instead of the background
node helper/cli.js                 # one check and publish
node helper/cli.js --help
```

The settings live in `~/.claude-usage-alert/` (`config.json`, `state.json`). They contain the topic and key, so never commit them.

Background checks:

| Computer | Install | Remove |
| --- | --- | --- |
| Mac | `bash helper/install-mac.sh` (launchd agent `com.claude-usage-alert`, logs in `~/Library/Logs/claude-usage-alert.log`) | `bash helper/uninstall-mac.sh` removes everything; `node helper/cli.js uninstall-mac` only removes the agent |
| Windows | `powershell -ExecutionPolicy Bypass -File helper\install-windows.ps1` (scheduled task `ClaudeUsageAlert`, run hidden through `%USERPROFILE%\.plan-pace\run-hidden.vbs`) | `powershell -ExecutionPolicy Bypass -File helper\uninstall-windows.ps1` |
| Linux | `bash helper/install-linux.sh` | |

The one-line bootstrap commands in the README download the `main` branch into `~/.plan-pace/src`, then run `--init` and the installer. Running one again updates the helper and keeps the existing topic.

If `--doctor` says you are not logged in, open Claude Code, sign in with your Claude subscription, send one message and try again. An API key has no 5-hour usage window.

## Tests

```bash
npm test --prefix helper
npm install --prefix mobile && npm test --prefix mobile
```

One mobile test publishes a sample report to a throwaway ntfy.sh topic and reads it back. The other tests do not contact Anthropic or ntfy and need no login.

## Running and building the app

```bash
cd mobile
npm install
npx expo start              # try the screens in Expo Go (no widgets)
npx eas-cli@latest login
npm run build:android       # installable APK (EAS "preview" profile)
npm run build:play          # Android App Bundle for Google Play ("production" profile)
```

The Android package id is `com.eduardcummins.claudeusage` and must not change, or installs will not update in place. Raise `android.versionCode` in `mobile/app.json` before each new upload.

The privacy policy is `docs/privacy.html`, published with GitHub Pages from `main` / `docs`. Notes for the Play Console listing are in [play-console.md](play-console.md). The store images are in `docs/play/`.
