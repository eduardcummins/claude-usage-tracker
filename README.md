# Cluse

Cluse shows how much of your 5-hour and weekly Claude limits you've used, and lets you know when they reset. The Mac helper reads your usage on the computer (the same login Claude Code already has) and publishes a usage report about every 10 minutes. The phone reads that report over HTTPS. It does not sign in to Claude, and it does not need the ntfy app.

The numbers are Claude’s own figures: the 5-hour session and the weekly limit. When the account also returns a model-specific weekly limit, that is shown too. The app does not read chats or files.

## Connect the phone

You need the helper running on the Mac first (see [Mac helper](#mac-helper)), and the installed app (the steps are under [Build and install](#build-and-install)). Expo Go works for the screen while `npx expo start` is running. The home screen widget exists only in the installed Android app.

A new install from the Play Store opens a short setup. It explains that the phone does not sign in to Claude, then shows one command.

Mac, in Terminal:

```bash
curl -fsSL https://raw.githubusercontent.com/eduardcummins/claude-usage-tracker/main/helper/bootstrap-mac.sh | bash
```

Windows, in PowerShell:

```powershell
irm https://raw.githubusercontent.com/eduardcummins/claude-usage-tracker/main/helper/bootstrap-windows.ps1 | iex
```

Those commands download this project from GitHub. They only work after the repository is public. Node.js 20 or newer has to be installed first. The command prints `Phone topic:`, a QR code, and saves a larger code at `~/.claude-usage-alert/topic.html`.

1. Run the command for your computer, or, if the helper is already installed, run `node helper/cli.js --init`.
2. Open Cluse.
3. Paste that topic and tap **Save**, or tap **Scan QR code**.
4. Allow notifications when the phone asks.

The topic is a password for the usage percentages. Anyone who knows it can read them. It is stored on the phone and on the Mac. It is not written into this project.

The phone reads `https://ntfy.sh/<topic>-data/json?poll=1&since=12h`. The helper publishes the snapshot to that `-data` topic. Polling the topic without `-data` only shows reset alerts, so it looks empty when no limit has reset. Reset times on the phone are shown in the phone’s local time.

After a report arrives, the screen shows the percents, the reset times, and when the report was last updated. Pull down, or tap **Check now**, to read again. If the newest report is more than about 30 minutes old, the screen says the computer may be asleep. The last numbers stay on screen.

A helper that is already installed does not need to be reinstalled for the phone to see these reports. It already publishes them to the `-data` topic, and ntfy.sh caches each one for about 12 hours. This copy of the helper also sends `Cache: yes`. Reinstall only if you want that explicit header.

### Reset notifications

When a check succeeds, the app sets a notification for each reset time. That notification is stored on the phone. It can fire while Cluse is closed.

The app also checks again in the background. Android and iPhone choose when that happens. The soonest Android will allow is about 15 minutes, and it is often later. A phone in battery saver, or an app that has been force-stopped, may not run the check until you open Cluse. The scheduled reset notification does not depend on that background check.

On Android 12 and newer, exact alarms need a setting: **Settings → Apps → Cluse → Alarms & reminders → Allow**.

### Android home screen widget

1. Save the topic and open the app once, so the numbers are saved.
2. Long-press the home screen.
3. Tap **Widgets**.
4. Add **Cluse**.

The widget shows a horizontal bar for the 5-hour session and one for the weekly limit. A marker sits at the current percent, and each bar has the percent and the reset countdown. It follows the phone’s light or dark theme. Tapping it opens the app. It updates when the app checks, and Android may also refresh it about every 30 minutes.

There is no iPhone widget in this version.

## Build and install

The app name on the phone is **Cluse**. The Android package id is still `com.eduardcummins.claudeusage`, so a new build can replace the copy already installed. Do not change that package id if you want the upgrade to keep the same install.

These commands run on a computer, in this project folder. They upload the project to Expo’s build servers. They do not upload your Claude login.

### An APK you install yourself

This replaces the APK already on the phone when `android.versionCode` in `mobile/app.json` is higher than the installed copy. It is already set to `8`.

```bash
cd mobile
npm install
npx eas-cli@latest login
npm run build:android
```

`npm run build:android` runs:

```bash
npx eas-cli@latest build --platform android --profile preview
```

That profile builds an APK. When the build page shows a finished build, open the link on the Android phone and install it. If Android asks, allow the browser to install unknown apps.

### A file for the Play Store

```bash
cd mobile
npm install
npx eas-cli@latest login
npm run build:play
```

`npm run build:play` runs:

```bash
npx eas-cli@latest build --platform android --profile production
```

That profile builds an Android App Bundle (`.aab`), which is what Play Console accepts. Download the file from the Expo build page and upload it in Play Console. The listing text, the data-safety answers, and the screenshot notes are in [docs/play-console.md](docs/play-console.md).

The privacy policy is [docs/privacy.html](docs/privacy.html). It is written so it can be published with GitHub Pages. In the repo on GitHub: **Settings → Pages → Deploy from a branch → `main` → `/docs`**. The address is:

```text
https://eduardcummins.github.io/claude-usage-tracker/privacy.html
```

That address works only after Pages is enabled and this file is on `main`.

A later upload needs a higher `android.versionCode` in `mobile/app.json`. Add 1, then build again.

### iPhone

An iPhone install still needs either the Apple Developer Program (99 USD per year) for TestFlight, or a free Xcode install that expires after 7 days. From `mobile`:

```bash
npm run build:ios
```

That is `npx eas-cli@latest build --platform ios --profile production --auto-submit`. The first time, sign in with the Apple ID on the paid developer membership when the command asks. `ios.buildNumber` in `mobile/app.json` is `"2"`. Raise it by 1 before each later upload.

The free 7-day install, with the phone plugged into a Mac:

```bash
cd mobile
npm install
npx expo run:ios --device --configuration Release
```

Turn on Developer Mode on the iPhone first (Settings → Privacy & Security → Developer Mode). In Xcode, sign in with the Apple ID and choose the Personal Team.

### Expo Go

Expo Go still works for trying the screen. The widget is not in Expo Go.

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with the iPhone camera or with Expo Go on Android. The phone and the computer need to be on the same Wi-Fi. This project uses Expo SDK 57, so Expo Go has to be a current version from the store.

## What can go wrong

**Save says the topic is not valid.**  
Paste the phone topic only, or the full `https://ntfy.sh/<topic>` URL. A topic ending in `-data` is accepted; the app strips that suffix and reads the data topic itself.

**The screen says there is no report yet.**  
The Mac sends one about every 10 minutes whenever it is awake. Run `node helper/cli.js` once on the Mac and tap **Check now**.

**Polling the topic in a browser returns nothing.**  
Usage updates are on `<topic>-data`, not on the topic you pasted. The pasted topic is for reset alerts. The app adds `-data` itself. ntfy.sh keeps messages for about 12 hours, so the app asks for `since=12h` and uses the newest snapshot.

**The numbers say the Mac may be asleep.**  
The last report is more than about 30 minutes old. Wake the Mac. The last percents stay on screen.

**A reset time arrived and the phone stayed quiet.**  
Allow notifications for Cluse. On Android 12 or newer, also allow Alarms & reminders. Then open the app once so it can set the alarms again.

**The widget is blank or still asks for a topic.**  
Open Cluse, wait until the meters appear, then add the widget again if it was added before the first report.

**A new APK will not install over the old one.**  
The package id must stay `com.eduardcummins.claudeusage`, and `android.versionCode` must be higher than the installed app. Do not delete the old app first if you want to keep the saved topic.

## Encrypted ntfy

`--init` creates a topic and an AES-256-GCM key. The pairing QR carries both, plus the server URL. The default server is `helper/ntfy.json` (`https://ntfy.sh`). The computer encrypts each snapshot and publishes it to `<topic>-data`. ntfy stores ciphertext. The phone decrypts with the key from the code. Reset alerts are scheduled on the phone. A plain `cu-` topic with no key still publishes readable percentages, so an existing install keeps working until it is re-paired with `--init --rotate`.

## Play Store

The prepared answers are in [docs/play-console.md](docs/play-console.md). Two limits are worth knowing before you pay for a Play account:

- The helper’s usage check is not a published public API. The phone stops getting new numbers if Anthropic changes that endpoint. The listing should say so.
- Do not use the Claude or Anthropic name, or the Claude asterisk, as the store name or the icon. The name to use is **Cluse**. The icon is an original gauge.

Play Console costs 25 USD once. The signup page can show that fee in local currency.

## Mac helper

The helper reads usage on a computer that already has Claude Code installed, and publishes it for the phone.

You need Node.js 20 or newer (`node -v`). On a Mac the helper reads the Claude Code login from the macOS Keychain. On Windows the file is `%USERPROFILE%\.claude\.credentials.json`. On Linux it is `~/.claude/.credentials.json`.

```bash
node helper/cli.js --doctor
node helper/cli.js --init
```

`--doctor` prints the usage and does not contact the phone. `--init` creates a private ntfy topic. That topic is a password for the usage percentages. It is stored on the computer, not in this repo. Do not commit it.

The phone does not need the ntfy app. Scan the pairing code, or paste it. A plain cu- topic still works. Usage is published to the topic with `-data` on the end. Reset alerts stay on the phone:

```bash
node helper/cli.js --test-alert
```

Keep it running on a Mac:

```bash
bash helper/install-mac.sh
```

Stop it with `node helper/cli.js uninstall-mac`. Logs are in `~/Library/Logs/claude-usage-alert.log`. A visible window instead of the login item:

```bash
node helper/cli.js --watch
```

Windows, in PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File helper\install-windows.ps1
```

The scheduled task `ClaudeUsageAlert` runs through a small launcher, `%USERPROFILE%\.plan-pace\run-hidden.vbs`, so no window appears. Running the install or bootstrap command again replaces the task.

To remove everything (the task, `%USERPROFILE%\.plan-pace` and `%USERPROFILE%\.claude-usage-alert`), run this in PowerShell:

```powershell
irm https://raw.githubusercontent.com/eduardcummins/claude-usage-tracker/main/helper/uninstall-windows.ps1 | iex
```

From a copy of this repo, `powershell -ExecutionPolicy Bypass -File helper\uninstall-windows.ps1` does the same. Node.js and Claude Code are not touched.

Linux:

```bash
bash helper/install-linux.sh
```

The helper checks about every 10 minutes while you are logged in and the computer is awake. A reset is reported when the reset time moves forward. The first check does not alert.

**`--doctor` says you are not logged in.** Open Claude Code, sign in with your Claude subscription, send one message, and try again. An API key has no 5-hour usage window.

**`--doctor` says the login refresh was rejected.** Sign in to Claude Code again. The helper does not delete that login.

## Tests

```bash
npm test --prefix helper
npm test --prefix mobile
```

`npm test --prefix mobile` includes one check that publishes a sample report to a throwaway ntfy.sh topic and reads it back with the app’s poll code. The other tests do not contact Anthropic or ntfy, and they do not need a login.

## Accounts and money

| Goal | What you create | Cost |
| --- | --- | --- |
| Use Cluse on Android, installed from a link | The free Expo account at [expo.dev/signup](https://expo.dev/signup), if you do not already have one | $0. The free plan includes 15 Android builds a month. A free build waits in the slow queue. |
| Put it on Google Play | A Play Console account, plus the Expo account for the build | 25 USD once for Play. The Expo free plan is enough for the build. |
| iPhone TestFlight | The Expo account and the Apple Developer Program | 99 USD per year for Apple. |
| iPhone, free, expires in 7 days | The Apple ID already on the phone, and Xcode | $0. Install again from the Mac after 7 days. |

An Expo Starter plan is 19 USD per month. Get it only if that month’s 15 Android builds are already used.

The EAS project is already linked in `mobile/app.json` (`owner` `edcrypto`, project `claude-usage`). That project id is not a password. Do not put a Claude token, an ntfy topic, or a keystore password in the repo.

The Android preview APK command is `npm run build:android` in `mobile/`. The Play Store file is an Android App Bundle from `npm run build:play`, which uses the `production` profile in `mobile/eas.json` (`buildType` `app-bundle`). `android.versionCode` is `8`. The app version is `1.2.0`.
