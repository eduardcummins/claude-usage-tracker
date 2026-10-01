# Claude usage alerts

A small helper for your computer and a plain phone app. The helper reads your Claude plan usage. The phone shows how much is used, when it resets (UK time), and recent checks. You get an alert when a limit resets.

Ed’s computer is a Mac, so that path is the one to follow first. Windows has its own steps. Linux is included, briefly.

## What the numbers are

The helper reads the same account usage that Claude Code’s `/usage` screen uses. It calls Claude’s usage endpoint with the login Claude Code already saved on this computer. It does not read chat logs, and it does not estimate usage from local files.

That matters. Tools such as `ccusage` can add up tokens in `~/.claude` and group them into 5-hour blocks. Those blocks start from the first message on that computer. They miss Claude on the web and on other devices, and the block end is not the plan’s real reset time. This helper uses the plan figures instead: the 5-hour session, the weekly all-models limit, and any model-specific weekly limit (for example Fable) when the account returns one.

There is no documented public API for these plan limits. The public Claude API rate limits are a different thing (requests per minute for an API key). The endpoint used here is the one Claude Code itself calls. Anthropic could change it. If `node helper/cli.js --doctor` starts failing, that is the first place to look.

Other limits:

- The numbers include the whole plan, not only this computer.
- They update about every 10 minutes, and only while the computer is awake and you are logged in.
- The phone shows UK time (`Europe/London`).
- Extra usage, if your plan has it, is shown in dollars. Claude reports that balance in cents (`100000` means `$1000`).
- A reset alert is sent when the reset time moves forward (a new window), including if the computer was asleep and only notices afterwards. The first check never alerts, because there is nothing earlier to compare.

## What you need

- Node.js 20 or newer. In a terminal, run `node -v`. If that fails, install the LTS build from [https://nodejs.org](https://nodejs.org).
- On the phone: **ntfy** (alerts when the phone is locked). It is free.
  - iPhone: App Store, search for ntfy.
  - Android: Play Store, or F-Droid. Search for ntfy.
- For the dashboard, use either **Expo Go** (free, and the Mac has to be running `npx expo start`) or the installed app from [Install the app on the phone](#install-the-app-on-the-phone).

The Expo Go path does not need an Expo account, an Apple Developer membership, or a server of your own. The installed app has its own accounts. Those are listed in that section, with the prices.

## 1. On the Mac

Open Terminal. Go to this project folder. The examples below assume you are in that folder.

### See your real usage

```bash
node helper/cli.js --doctor
```

You should see lines like `5-hour session: 42% used, resets in 2h 14m (... UK time)`. Nothing is sent to the phone.

On a Mac, the login is read from the macOS Keychain, which is where Claude Code stores it. A password prompt is not expected. If the command says you are not logged in, open Claude Code in VS Code, sign in with your Claude plan, send one message, and run `--doctor` again.

### Create the private phone topic

```bash
node helper/cli.js --init
```

It prints a topic that looks like `cu-` followed by a long string. Leave that window open, or copy the topic somewhere temporary. You will paste it into both phone apps.

The topic is a password. Anyone who knows it can see usage percentages and reset times. They cannot see chats, code, or your Claude login. The login never leaves the computer. To make a new topic later: `node helper/cli.js --init --rotate`, then update both phone apps.

### Send a test alert

Install ntfy on the phone first (step 2), subscribe to the topic, then:

```bash
node helper/cli.js --test-alert
```

The phone should buzz with “Test from your computer”.

### Keep the check running

```bash
bash helper/install-mac.sh
```

That installs a login item (a launchd agent). Every 10 minutes, while you are logged in to the Mac, it reads usage and updates the phone. It also runs once when you log in, and again after a restart. It does not run while the Mac is asleep. When the Mac wakes, the next check still sends an alert if a limit reset while it was asleep.

Logs:

```text
~/Library/Logs/claude-usage-alert.log
```

To stop it:

```bash
node helper/cli.js uninstall-mac
```

To try it in a terminal window instead of installing the background check:

```bash
node helper/cli.js --watch
```

Leave that window open. It checks every 10 minutes. Ctrl+C stops it.

## 2. On the iPhone or Android

### Alerts when the phone is locked (ntfy)

1. Open ntfy.
2. Leave the server as `ntfy.sh` unless you run your own.
3. Subscribe to the topic from `--init`. You can type it, or paste it.
4. Allow notifications when the phone asks.

That subscription is what rings when the phone is locked. The helper posts a quiet usage update on a second topic (`your-topic-data`) so the dashboard can read it. Subscribe ntfy only to the main topic, or the quiet updates will also show up in that list.

### The dashboard (Expo Go)

The phone and the Mac need to be on the same Wi-Fi.

On the Mac, in this project folder:

```bash
cd mobile
npm install
npx expo start
```

A QR code appears.

- iPhone: open the Camera app, scan the QR code, and open it in Expo Go. If the phone asks for local network access, allow it.
- Android: open Expo Go and scan the QR code from inside that app.

If the Mac asks whether to allow incoming connections for Node, allow it.

The first screen asks for the topic. Paste the same topic, then tap **Save and check**.

Expo Go loads the app from your Mac. Leave `npx expo start` running while you want the dashboard. The ntfy alerts keep working after you stop it. The installed app in [Install the app on the phone](#install-the-app-on-the-phone) does not use this server. It reads the same ntfy topic, and it keeps its own reset alarms.

If the phone cannot see the Mac, run `npx expo start --tunnel` instead. That fallback asks for a free Expo account. Same-Wi-Fi does not.

This project uses Expo SDK 57. If Expo Go says the project is too new, update Expo Go from the store.

## 3. Test that a reset alert arrives

Do these in order.

1. `node helper/cli.js --test-alert`  
   The ntfy app should notify you even if Claude Usage is closed.

2. With Claude Usage open in Expo Go, run:

   ```bash
   node helper/cli.js --mock --scenario before
   node helper/cli.js --mock --scenario after
   ```

   The first command publishes sample usage (about 86% of the 5-hour session). The second publishes a new window at about 4% and sends a real reset notification: “5-hour session reset”. Pull to refresh, or tap **Refresh**, if the screen has not updated. You should see the new percentage, the next UK reset time, and the alert text.

   These two commands do not use your real Claude login. They do publish to your real topic, so the phone will buzz.

3. On the phone, tap **Preview with sample data**, then **Simulate a reset**. That only changes the screen. On a phone it also posts a local notification. It does not contact your computer.

4. After a real check has succeeded, open Claude Usage once and allow notifications. The app schedules an alarm for each reset time it was given. That alarm fires even if Claude Usage is later closed. You may then get two alerts a few minutes apart: one from this app at the reset time, and one from ntfy when the Mac confirms the new window. Either one is enough.

A check you can run without sending anything:

```bash
node helper/cli.js --mock --dry-run
```

## Install the app on the phone

This puts **Claude Usage** on the home screen. After that, the phone reads the latest numbers from your ntfy topic on its own. It still schedules the local reset alarms. You can quit `npx expo start`. The helper on the Mac still has to run about every 10 minutes, or the numbers stop updating. The phone app does not talk to the Mac. It talks to ntfy.

Expo Go keeps working. Use it when you want to try a change on the phone before you build again.

The topic stays on the phone. You type it on the first screen. Do not put the topic, or an ntfy token, into `app.json`, `eas.json`, or git. The icon in the project is a placeholder.

### Accounts and what they cost

These are the prices Apple and Expo published for this setup. If a signup page shows a different price, the signup page is the one to follow.

| What you want | Accounts you create | Money |
| --- | --- | --- |
| An Android app you install from a link | A free account at [expo.dev/signup](https://expo.dev/signup) | $0. The free plan includes 15 Android builds and 15 iOS builds each calendar month. A free build uses the slow queue, so it can wait. |
| An iPhone app that stays installed | That same free Expo account, plus the [Apple Developer Program](https://developer.apple.com/programs/enroll/) | Apple charges 99 USD per year. The Expo free plan is enough for these builds. |
| An iPhone app with no Apple payment | The Apple ID already on the iPhone, and Xcode on the Mac | $0. Apple expires this install after 7 days. Plug the phone in and install again. |
| Google Play, only if you want it later | A Google Play Console account | 25 USD once. Skip this. The APK installs without it. |

An Expo Starter plan is 19 USD per month. Get it only if the free plan’s 15 builds for that platform are already used this month. One Android install uses one Android build. One iPhone TestFlight upload uses one iOS build.

### Android (install an APK)

The phone needs internet. It does not have to be on the same Wi-Fi as the Mac. You do not need Android Studio, a USB cable, or a Google developer account.

1. Create the free Expo account at [https://expo.dev/signup](https://expo.dev/signup). Use an email you can open. No card.

2. On the Mac, in this project folder:

```bash
cd mobile
npm install
npx eas-cli@latest login
npm run build:android
```

`npx eas-cli@latest login` asks for the Expo email and password. `npm run build:android` runs `npx eas-cli@latest build --platform android --profile preview`. That profile is in `mobile/eas.json`. It builds an APK and marks it for internal install, which means a direct download, not the Play Store.

3. The first time, answer the prompts like this:

   - Create an EAS project for this app? **Yes.** The command writes a project id into `mobile/app.json`. That id is not a password. Leave it in the file. Do not paste your ntfy topic into that file.
   - Generate a new Android keystore? **Yes.** Expo stores the keystore. A later APK can then install on top of this one. You do not create a keystore yourself.

4. Wait for the build. The terminal prints a page on expo.dev. Open it. When the build has finished, that page has a link and a QR code for the APK.

5. On the Android phone, open that link in Chrome, or scan the QR code. Download the file. Android asks before it installs an app that did not come from the Play Store. Allow installs from the browser when it asks. The screen usually says “Install unknown apps” or “Allow from this source”. Then open the downloaded file and install **Claude Usage**.

6. Open the app. Paste the topic from `node helper/cli.js --init`. Tap **Save and check**. Allow notifications.

7. On Android 12 and newer, a reset alarm at an exact time needs “Alarms & reminders” allowed for this app. If a reset time arrives and Claude Usage stays quiet, open Settings → Apps → Claude Usage → Alarms & reminders, and allow it. The ntfy app still alerts when the Mac posts the reset.

To install a newer copy later, add 1 to `android.versionCode` in `mobile/app.json` (it starts at 1), then from `mobile` run `npm run build:android` again and install the new APK over the old one. The saved topic remains if you do not delete the app first.

### iPhone

Apple does not offer a normal website download for an iPhone app. Pick one of the three paths below.

#### A. TestFlight (99 USD a year, stays installed)

This is the paid path with the least fiddling. TestFlight is Apple’s installer. Each upload works for 90 days, then you upload again. You do not register the phone’s hardware id. These steps do not put the app on the public App Store.

1. Enroll in the Apple Developer Program with the Apple ID that is already on the iPhone: [https://developer.apple.com/programs/enroll/](https://developer.apple.com/programs/enroll/). The fee is 99 USD for the year. Apple can take a day or two to approve a new membership. Wait until the account says you are a member.

2. On the iPhone, install **TestFlight** from the App Store.

3. On the Mac, log in to the Expo account from the Android steps (create it first if you skipped Android):

```bash
cd mobile
npm install
npx eas-cli@latest login
npm run build:ios
```

`npm run build:ios` runs `npx eas-cli@latest build --platform ios --profile production --auto-submit`. Expo’s servers compile the app and upload it to App Store Connect. This path does not need Xcode.

4. The first time, sign in to Apple when the command asks. Use the Apple ID on the Developer Program membership. Apple may show a verification code on the iPhone. Type that code into the terminal. When it asks to create a distribution certificate, a provisioning profile, or the App Store Connect app, say yes. The project turns off the push-notification setup prompt. If an older prompt still asks to set up push, say no. Locked-phone alerts come from the ntfy app. Reset alarms inside Claude Usage are local alarms on the phone.

5. Wait for the build to finish, then for Apple’s processing email. Processing is often a few minutes.

6. Open [https://appstoreconnect.apple.com](https://appstoreconnect.apple.com), select the app, and open the TestFlight tab. The project already answers Apple’s export question (`usesNonExemptEncryption` is false in `mobile/app.json`, because the app only uses ordinary HTTPS). If Apple still shows missing compliance, choose the answer that the app uses encryption only as part of HTTPS.

7. Under Internal Testing, create a group if you do not already have one, and add the email for your Apple ID. Open the invite on the iPhone. TestFlight installs Claude Usage.

8. Open Claude Usage, paste the topic, and allow notifications.

For a later upload, add 1 to `ios.buildNumber` in `mobile/app.json` (it starts at `"1"`), then run `npm run build:ios` again. App Store Connect rejects an upload that reuses a build number.

#### B. Ad hoc link (same 99 USD a year)

Use this when you want a direct install and you do not want TestFlight. The Apple Developer Program membership is still required. Expo’s cloud build cannot sign an iPhone app for a real device with a free Apple ID.

1. From `mobile`, after `npx eas-cli@latest login`:

```bash
npx eas-cli@latest device:create
```

2. On the iPhone, open the link that command prints and install the registration profile. That sends the phone’s device id to your Apple account. On a new or just-renewed membership, Apple can take 24 to 72 hours before that phone can install the app. If the build fails for that reason, wait, then run the build again.

3. Build the installable app:

```bash
npx eas-cli@latest build --platform ios --profile preview
```

Sign in to Apple if asked, and let it create the ad hoc profile. Only phones registered before this build can install it.

4. When the build page shows a finished build, open that link on the iPhone and install. If iOS blocks the launch, go to Settings → General → VPN & Device Management and trust the developer certificate.

A second iPhone needs `device:create` again and a new build.

#### C. Free Apple ID, installed from the Mac (expires in 7 days)

This uses Xcode’s free Personal Team. It does not use Expo’s build servers, and it does not need an Expo account. Apple’s published limits for a free account are:

- The install profile expires 7 days after it is created. The app then refuses to open until you install it again from the Mac.
- Up to 3 apps installed this way on the device, and up to 3 devices.
- The phone is plugged into the Mac for the install. After that, it reads ntfy on its own until the 7 days run out.

1. On the Mac, install **Xcode** from the App Store. Open Xcode once and wait until it finishes the extra components. The download is large.

2. In Xcode, open Settings (older Xcode calls this Preferences) → Accounts. Click **+**, choose Apple ID, and sign in with the Apple ID on the iPhone. The team line should end with “(Personal Team)”. This screen does not ask for a payment.

3. Plug the iPhone into the Mac with a cable. Unlock the phone. Tap Trust if the phone asks.

4. On the iPhone, open Settings → Privacy & Security → Developer Mode and turn it on. Restart if it asks. Developer Mode is on iOS 16 and newer. Plug the phone in again after the restart.

5. On the Mac, in this project folder:

```bash
cd mobile
npm install
npx expo run:ios --device --configuration Release
```

6. Choose the plugged-in iPhone, not a simulator. Choose the Personal Team when it asks. The command compiles the app and copies it to the phone, with the JavaScript included. Wait until the install finishes. You can stop the command after that. Leave `npx expo start` stopped. The home-screen app does not need it.

7. If the phone says the app is from an untrusted developer: Settings → General → VPN & Device Management → your Apple ID → Trust.

8. Open Claude Usage, paste the topic, and allow notifications.

If the command cannot find a team, or signing fails:

```bash
open ios/*.xcworkspace
```

In Xcode, select the blue project, then the app target, then Signing & Capabilities. Turn on “Automatically manage signing”. Set Team to the Personal Team. Run `npx expo run:ios --device --configuration Release` again.

When the app stops opening after 7 days, plug the phone in and run that same command again. Install over the existing app. If you delete the app first, the saved topic is gone and you paste it again.

The command creates an `ios` folder on the Mac. That folder is listed in `mobile/.gitignore`. Leave it out of git.

### After the app is installed

- The helper on the computer still publishes the topic. Section 1 is unchanged.
- ntfy on the phone, subscribed to that topic, is still the alert that fires when Claude Usage has not been opened.
- Type the topic into Claude Usage once. A new install does not copy the topic out of Expo Go.
- A change to the app’s screens reaches Expo Go while `npx expo start` is running. An installed copy needs a new build before it shows that change.

## Windows

The helper is the same Node program. The login file is `%USERPROFILE%\.claude\.credentials.json` (not the Mac Keychain).

In PowerShell, go to this project folder.

```powershell
node -v
node helper/cli.js --doctor
node helper/cli.js --init
node helper/cli.js --test-alert
```

Use the same phone steps as above. Start the dashboard from `mobile` with `npm install` and `npx expo start`.

To run the check every 10 minutes while you are logged in:

```powershell
powershell -ExecutionPolicy Bypass -File helper\install-windows.ps1
```

That creates a Task Scheduler task named `ClaudeUsageAlert`. It runs only in your Windows session, because that is where the Claude login is.

To remove it:

```powershell
Unregister-ScheduledTask -TaskName ClaudeUsageAlert -Confirm:$false
```

If you would rather not use Task Scheduler, leave a window open with:

```powershell
node helper/cli.js --watch
```

## Linux

```bash
node helper/cli.js --doctor
node helper/cli.js --init
bash helper/install-linux.sh
```

That adds a systemd user timer, every 10 minutes, while you are logged in. The login file is `~/.claude/.credentials.json`, or `$CLAUDE_CONFIG_DIR/.credentials.json` if you set that variable.

## If something goes wrong

**`--doctor` says you are not logged in.**  
Open Claude Code, sign in with the Claude plan (not only an API key), send one message, and try again. An API key has no 5-hour plan reset.

**`--doctor` says the login refresh was rejected.**  
Open Claude Code and sign in again. The helper refreshes the saved login the same way Claude Code does, and it uses a lock so two refreshes do not fight. It will not delete the login. If Claude Code and this helper refresh at the same moment, signing in again fixes it.

**The usage check says to slow down.**  
The helper backs off and keeps the last numbers. This is uncommon at a 10-minute interval. Do not lower the interval below 5 minutes.

**The phone got the test alert, but the dashboard is empty.**  
Tap Refresh. The dashboard reads the `-data` topic. `--test-alert` only writes the main topic, so the test buzzes without changing the percentages. Run `--mock --scenario before` or a real check to fill the dashboard.

**The dashboard says the report is old.**  
The Mac may be asleep, the background check may not be installed, or `--init` was not run before `install-mac.sh`. Run `node helper/cli.js` once in a terminal and read the message.

**Expo Go cannot connect.**  
Same Wi-Fi, Mac firewall allows Node, and `npx expo start` is still running. The installed app does not use that connection. It only needs the phone’s internet and the topic.

**Android will not open the APK.**  
Allow the browser to install unknown apps, then tap the download again. If Android says the package conflicts with an installed copy, add 1 to `android.versionCode` in `mobile/app.json`, build again, and install that APK.

**The iPhone cloud build asks for a paid Apple account.**  
TestFlight and the ad hoc link both need the Apple Developer Program (99 USD per year). The free install is the Xcode Personal Team path. It expires after 7 days.

## Tests

```bash
npm test --prefix helper
npm test --prefix mobile
```

The helper tests include a dry run, a sample reset, Keychain-versus-file login selection, and a refresh that keeps the rest of the login file. They do not contact Anthropic or ntfy.

## Config

`--init` writes `~/.claude-usage-alert/config.json` on the computer. It is not part of this project. Do not copy it into the repo. You can set `ntfyServer` there if you run your own ntfy server, and `ntfyToken` if that server needs a token. `timeZone` defaults to `Europe/London`.
