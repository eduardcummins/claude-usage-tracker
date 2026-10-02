# Plan Pace

Plan Pace is a phone app that shows how much of your Claude plan is used, and when it resets. The phone signs in itself. It does not need a computer running in the background, and it does not need the ntfy app.

The numbers are the plan’s own figures: the 5-hour session and the weekly limit. When the account also returns a model-specific weekly limit, that is shown too. The app does not read chats or files.

A computer helper is still in this repo. It is optional. Use it only if you want the computer to publish the same numbers to ntfy. The phone does not need that.

## Connect the phone

You need the installed app (the steps are under [Build and install](#build-and-install)), or Expo Go while `npx expo start` is running on a computer. The home screen widget exists only in the installed Android app.

The sign-in page cannot jump straight back into this app. Claude only allows its own app to receive that redirect. Plan Pace uses the same manual step as Claude Code’s own command-line login: the website shows a code, and you paste it.

1. Open Plan Pace.
2. Tap **Open sign-in page**.
3. Sign in on that page with the Claude account whose plan you want to see.
4. The page shows a code. Copy the whole code. If it has a `#` in it, copy that part as well.
5. Return to Plan Pace, paste the code into the box, and tap **Connect**.
6. Allow notifications when the phone asks.

The code works once. It expires after about 10 minutes. If Connect fails, tap **Open sign-in page** again and paste the new code. Do not reuse an old one.

The login is stored in the phone’s secure storage. It is not written into this project, and it is not sent to the person who published the app. Sign out deletes it from the phone.

After that, the screen shows the percents and the reset times in your phone’s time zone. Pull down, or tap **Check now**, to refresh.

### Reset notifications

When a check succeeds, the app sets a notification for each reset time. That notification is stored on the phone. It can fire while Plan Pace is closed.

The app also checks again in the background. Android and iPhone choose when that happens. The soonest Android will allow is about 15 minutes, and it is often later. A phone in battery saver, or an app that has been force-stopped, may not run the check until you open Plan Pace. The scheduled reset notification does not depend on that background check.

On Android 12 and newer, exact alarms need a setting: **Settings → Apps → Plan Pace → Alarms & reminders → Allow**.

### Android home screen widget

1. Connect the account and open the app once, so the numbers are saved.
2. Long-press the home screen.
3. Tap **Widgets**.
4. Add **Plan Pace**.

The widget shows the 5-hour percent and the weekly percent, with the reset times. Tapping it opens the app. It updates when the app checks, and Android may also refresh it about every 30 minutes.

There is no iPhone widget in this version.

## Build and install

The app name on the phone is **Plan Pace**. The Android package id is still `com.eduardcummins.claudeusage`, so a new build can replace the copy already installed. Do not change that package id if you want the upgrade to keep the same install.

These commands run on a computer, in this project folder. They upload the project to Expo’s build servers. They do not upload your Claude login.

### An APK you install yourself

This replaces the APK already on the phone when `android.versionCode` in `mobile/app.json` is higher than the installed copy. It is already set to `3`.

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

**Connect says the sign-in expired, or the code was rejected.**  
Tap **Open sign-in page** again. Paste the new code straight away. An old code cannot be used twice.

**The page shows a code with a # in the middle.**  
Paste all of it. The part after `#` is checked so a code from a different sign-in attempt is refused.

**The phone says it could not reach Claude.**  
Check the phone’s internet connection, then tap **Check now**.

**The app says Claude asked it to slow down.**  
Wait, then tap **Check now**. The last numbers stay on screen.

**The meters stay empty after Connect.**  
The code may have been for a different sign-in attempt. Open the sign-in page from the app, not from an old browser tab, and paste that code.

**A reset time arrived and the phone stayed quiet.**  
Allow notifications for Plan Pace. On Android 12 or newer, also allow Alarms & reminders. Then open the app once so it can set the alarms again.

**The widget is blank or still says to sign in.**  
Open Plan Pace, wait until the meters appear, then add the widget again if it was added before the first successful check.

**The report on screen is marked old.**  
A background check has not run. Open the app. Battery saver and force-stop both delay background checks.

**A new APK will not install over the old one.**  
The package id must stay `com.eduardcummins.claudeusage`, and `android.versionCode` must be higher than the installed app. Do not delete the old app first if you want to keep the saved login.

## Play Store

The prepared answers are in [docs/play-console.md](docs/play-console.md). Two limits are worth knowing before you pay for a Play account:

- The usage check is not a published public API. The app can break if Anthropic changes that endpoint. The listing should say so.
- Do not use the Claude or Anthropic name, or the Claude asterisk, as the store name or the icon. The name to use is **Plan Pace**. The icon is an original gauge.

Play Console costs 25 USD once. The signup page can show that fee in local currency.

## Optional computer helper

Skip this section if the phone is signed in. The helper is a separate way to read usage on a computer that already has Claude Code installed, and to post it to an ntfy topic.

You need Node.js 20 or newer (`node -v`). On a Mac the helper reads the Claude Code login from the macOS Keychain. On Windows the file is `%USERPROFILE%\.claude\.credentials.json`. On Linux it is `~/.claude/.credentials.json`.

```bash
node helper/cli.js --doctor
node helper/cli.js --init
```

`--doctor` prints the plan usage and does not contact the phone. `--init` creates a private ntfy topic. That topic is a password for the usage percentages. It is stored on the computer, not in this repo. Do not commit it.

Install ntfy on the phone and subscribe to that topic if you want those alerts. Then:

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

Remove it with `Unregister-ScheduledTask -TaskName ClaudeUsageAlert -Confirm:$false`.

Linux:

```bash
bash helper/install-linux.sh
```

The helper checks about every 10 minutes while you are logged in and the computer is awake. A reset is reported when the reset time moves forward. The first check does not alert.

**`--doctor` says you are not logged in.** Open Claude Code, sign in with the Claude plan, send one message, and try again. An API key has no 5-hour plan window.

**`--doctor` says the login refresh was rejected.** Sign in to Claude Code again. The helper does not delete that login.

## Tests

```bash
npm test --prefix helper
npm test --prefix mobile
```

The tests do not contact Anthropic or ntfy, and they do not need a login.

## Accounts and money

| Goal | What you create | Cost |
| --- | --- | --- |
| Use Plan Pace on Android, installed from a link | The free Expo account at [expo.dev/signup](https://expo.dev/signup), if you do not already have one | $0. The free plan includes 15 Android builds a month. A free build waits in the slow queue. |
| Put it on Google Play | A Play Console account, plus the Expo account for the build | 25 USD once for Play. The Expo free plan is enough for the build. |
| iPhone TestFlight | The Expo account and the Apple Developer Program | 99 USD per year for Apple. |
| iPhone, free, expires in 7 days | The Apple ID already on the phone, and Xcode | $0. Install again from the Mac after 7 days. |

An Expo Starter plan is 19 USD per month. Get it only if that month’s 15 Android builds are already used.

The EAS project is already linked in `mobile/app.json` (`owner` `edcrypto`, project `claude-usage`). That project id is not a password. Do not put a Claude token, an ntfy topic, or a keystore password in the repo.
