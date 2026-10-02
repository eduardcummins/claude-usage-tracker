# Google Play listing for Cluse

Use this when filling in Play Console. The app id stays `com.eduardcummins.claudeusage` so an install can replace the APK already on the phone. The store name should not.

## Policy risks to read before you submit

- The phone does not call Anthropic. A helper on the user’s computer reads usage the way Claude Code does, at `https://api.anthropic.com/api/oauth/usage`, and publishes percentages to an ntfy topic. That usage endpoint is not a documented public API. If it changes, the helper stops publishing until it is updated. Say that in the listing. Do not describe it as an official Anthropic integration.
- Do not put Claude, Anthropic, or the Claude asterisk mark in the store name, icon, or screenshots. Those are Anthropic’s trademarks. The icon in this repo is an original terracotta gauge on a cream background.
- The Android package id still contains the word `claude` (`com.eduardcummins.claudeusage`). Changing it makes a different app, and the APK already installed on the phone would not update in place. Leave it for that upgrade. If a later Play review objects to the package id, a new package id is a new store listing.
- The topic the user pastes is a bearer secret for the usage percentages. The listing should not ask users to publish that topic.

## Safe store name

**Cluse**

## Short description

80 characters is the limit.

```text
Session and weekly plan usage, and when each limit resets.
```

## Full description

```text
Cluse shows two rings: the 5-hour session and the weekly limit. Each one shows the percent used, a countdown, and the reset time in your local time. You can get a notification when a limit resets. On Android, a home screen widget shows a horizontal bar for each, with a marker at the current percent and the reset countdown.

The phone does not sign in. A small helper on your Mac or Windows computer reads the plan you already use there and publishes the percentages. The app’s first screen gives you one command to copy. It installs the helper and prints a topic. Paste that topic, or scan the QR code. The ntfy app is not required.

Cluse does not read chats or files, and it does not send your usage to the person who published the app. The camera is used only if you choose to scan the QR code. The picture is not saved.

Cluse is not affiliated with the company that provides the plan. The figures come from the same account usage check that the plan’s own tools use. That check is not a published public API, so it can change.
```

## Privacy policy URL

After GitHub Pages is enabled for this repo (branch `main`, folder `/docs`):

```text
https://eduardcummins.github.io/claude-usage-tracker/privacy.html
```

The page is `docs/privacy.html`.

## Screenshots

Play asks for at least two phone screenshots. Use 1080×1920 PNG files. Rendered copies are in `docs/play/`:

1. `phone-meters.png` — 5-hour and weekly rings, countdown, and local reset time.
2. `phone-meters-dark.png` — the same screen in dark mode.
3. `phone-onboarding.png` — the first-run explanation.
4. `phone-install.png` — the copy-paste helper command.
5. `feature-graphic.png` — 1024×500 feature graphic.

The same folder also has `phone-topic.png`, `phone-stale.png`, `phone-waiting.png`, `phone-error.png`, and `phone-help.png`. Phone shots are 1080×1920.

Home screen widget renders, light and dark, with the marker on each bar:

- `widget-250x140-light.png` and `widget-250x140-dark.png` — the smallest size, 250×140 dp.
- `widget-320x140-light.png` and `widget-320x140-dark.png` — a common 4×2 size. `widget-card.png` is the light copy.
- `widget-420x180-light.png` and `widget-420x180-dark.png` — a wider, taller size.

Each file is the widget at 3× with a margin so the rounded corners are visible. The Android widget picker image is `mobile/assets/widget-preview.png`.

Leave the words Claude and Anthropic out of the images except where the in-app footer already says the app is not affiliated. Crop above that line if a screenshot must avoid the name.

Feature graphic: `docs/play/feature-graphic.png`, 1024×500, cream background (`#faf9f5`), the terracotta gauge, and the words “Cluse”.

## Data safety form

Answer from what the app actually does.

| Question | Answer |
| --- | --- |
| Does the app collect or share any of the required user data types? | The phone stores the ntfy topic the user pastes and the usage percentages it reads from that topic. Those requests go to ntfy.sh (or the server in a pasted URL). The developer does not receive them. The phone does not send a Claude login. The camera is optional and is used only to scan a QR code; images are not stored or uploaded. |
| Is all of the data collected by your app encrypted in transit? | Yes. The requests use HTTPS. |
| Do you provide a way for users to request that their data be deleted? | Yes. Remove topic in the app deletes the topic and the saved usage from the phone. Uninstalling deletes the rest. There is no Cluse account. The Claude account is deleted on claude.ai, which the privacy policy states. |
| Location | No. |
| Personal info (name, email, address, phone) | Not collected by the app. |
| Photos and videos | Not collected. Camera permission is optional, requested only when the user taps Scan QR code, and the frames are not saved. |
| Financial info | No. |
| Messages, photos, audio, files, contacts, calendar | No. |
| App activity | Usage percentages and reset times are stored on the device and read from the user’s ntfy topic. They are not sent to the developer. |
| Device or other IDs | No. |
| Data shared with third parties | The phone requests the cached usage message from the ntfy server the user chose (normally ntfy.sh). It is not sold and it is not used for advertising. |

If the form’s “account deletion” link is required, use the privacy policy URL. The policy explains removing the topic in the app and points Claude account deletion to claude.ai.

## Content rating

The app shows numbers and local notifications. It has no violence, no user-generated public content, no chat, and no ads. Answer the questionnaire to match that.

## Permissions the build is expected to keep

- `INTERNET` — read the usage report from the ntfy topic.
- `CAMERA` — optional. Scan the topic QR code. `RECORD_AUDIO` is blocked.
- `POST_NOTIFICATIONS` — local reset alerts. The notifications library adds this.
- `SCHEDULE_EXACT_ALARM` — fire the reset alert at the reset time. `USE_EXACT_ALARM` is blocked. Play restricts that permission to clock and calendar apps.
- `RECEIVE_BOOT_COMPLETED` — the notifications library reschedules alarms after a reboot.
- `VIBRATE` and `WAKE_LOCK` may appear because the notifications and background libraries use them.

Blocked on purpose: overlay windows (`SYSTEM_ALERT_WINDOW`), storage, photos, video, and audio.

`usesNonExemptEncryption` is false. The app uses ordinary HTTPS and the phone’s standard secure storage.

## Version already set for the next install

`mobile/app.json` is version `1.2.0`, Android `versionCode` 6, iOS build number `2`. `versionCode` 6 is higher than the copy already installed, so the new package can replace it.

The Play upload is an Android App Bundle, not an APK. From `mobile`:

```bash
npm run build:play
```

That runs `npx eas-cli@latest build --platform android --profile production`. The `production` profile in `mobile/eas.json` sets `distribution` to `store` and `android.buildType` to `app-bundle`.
