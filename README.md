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
- On the phone: **Expo Go** (the dashboard) and **ntfy** (alerts when the phone is locked). Both are free.
  - iPhone: App Store, search for Expo Go and for ntfy.
  - Android: Play Store, or F-Droid for ntfy. Search for the same names.

You do not need a Mac developer account, an Expo account, or a server of your own.

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

Expo Go loads the app from your Mac. Leave `npx expo start` running while you want the dashboard. The ntfy alerts keep working after you stop it.

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
Same Wi-Fi, Mac firewall allows Node, and `npx expo start` is still running.

## Tests

```bash
npm test --prefix helper
npm test --prefix mobile
```

The helper tests include a dry run, a sample reset, Keychain-versus-file login selection, and a refresh that keeps the rest of the login file. They do not contact Anthropic or ntfy.

## Config

`--init` writes `~/.claude-usage-alert/config.json` on the computer. It is not part of this project. Do not copy it into the repo. You can set `ntfyServer` there if you run your own ntfy server, and `ntfyToken` if that server needs a token. `timeZone` defaults to `Europe/London`.
