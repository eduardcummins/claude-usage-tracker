# Google Play listing for Plan Pace

Use this when filling in Play Console. The app id stays `com.eduardcummins.claudeusage` so an install can replace the APK already on the phone. The store name should not.

## Policy risks to read before you submit

- The phone does not call Anthropic. A helper on the user’s computer reads usage the way Claude Code does, at `https://api.anthropic.com/api/oauth/usage`, and publishes percentages to an ntfy topic. That usage endpoint is not a documented public API. If it changes, the helper stops publishing until it is updated. Say that in the listing. Do not describe it as an official Anthropic integration.
- Do not put Claude, Anthropic, or the Claude asterisk mark in the store name, icon, or screenshots. Those are Anthropic’s trademarks. The icon in this repo is an original terracotta gauge on a cream background.
- The Android package id still contains the word `claude` (`com.eduardcummins.claudeusage`). Changing it makes a different app, and the APK already installed on the phone would not update in place. Leave it for that upgrade. If a later Play review objects to the package id, a new package id is a new store listing.
- The topic the user pastes is a bearer secret for the usage percentages. The listing should not ask users to publish that topic.

## Safe store name

**Plan Pace**

## Short description

80 characters is the limit. This one is 62:

```text
Shows how much of your AI plan is used, and when it resets.
```

## Full description

```text
Plan Pace shows two meters on your phone: the current session and the week. Each meter shows the percent used and when it resets. You can get a notification when a limit resets. On Android, a home screen widget shows both meters.

A small helper on your computer reads the plan you already use and publishes the percentages. On the phone, paste the topic the helper prints and tap Save. The ntfy app is not required. Plan Pace does not read chats or files, and it does not send your usage to the person who published the app.

Plan Pace is not affiliated with the company that provides the plan. The figures come from the same account usage check that the plan’s own tools use. That check is not a published public API, so it can change.
```

## Privacy policy URL

After GitHub Pages is enabled for this repo (branch `main`, folder `/docs`):

```text
https://eduardcummins.github.io/claude-usage-tracker/privacy.html
```

The page is `docs/privacy.html`.

## Screenshots

Play asks for at least two phone screenshots. Use 1080×1920 PNG files.

1. The meter screen after a successful check: 5-hour percent, weekly percent, and the reset times.
2. The same screen in dark mode.
3. Optional: the Android home screen with the Plan Pace widget.

Leave the words Claude and Anthropic out of the images. The in-app footer says the app is not affiliated with Anthropic; crop above that line if you want the screenshot to avoid the name.

Feature graphic, if Play asks for one: 1024×500, cream background (`#faf9f5`), the terracotta gauge, and the words “Plan Pace”.

## Data safety form

Answer from what the app actually does.

| Question | Answer |
| --- | --- |
| Does the app collect or share any of the required user data types? | The phone stores the ntfy topic the user pastes and the usage percentages it reads from that topic. Those requests go to ntfy.sh (or the server in a pasted URL). The developer does not receive them. The phone does not send a Claude login. |
| Is all of the data collected by your app encrypted in transit? | Yes. The requests use HTTPS. |
| Do you provide a way for users to request that their data be deleted? | Yes. Remove topic in the app deletes the topic and the saved usage from the phone. Uninstalling deletes the rest. There is no Plan Pace account. The Claude account is deleted on claude.ai, which the privacy policy states. |
| Location | No. |
| Personal info (name, email, address, phone) | Not collected by the app. |
| Financial info | No. |
| Messages, photos, audio, files, contacts, calendar | No. |
| App activity | Usage percentages and reset times are stored on the device and read from the user’s ntfy topic. They are not sent to the developer. |
| Device or other IDs | No. |
| Data shared with third parties | The phone requests the cached usage message from the ntfy server the user chose (normally ntfy.sh). It is not sold and it is not used for advertising. |

If the form’s “account deletion” link is required, use the privacy policy URL. The policy explains in-app sign-out and points Claude account deletion to claude.ai.

## Content rating

The app shows numbers and local notifications. It has no violence, no user-generated public content, no chat, and no ads. Answer the questionnaire to match that.

## Permissions the build is expected to keep

- `INTERNET` — read the usage report from the ntfy topic.
- `POST_NOTIFICATIONS` — local reset alerts. The notifications library adds this.
- `SCHEDULE_EXACT_ALARM` — fire the reset alert at the reset time. `USE_EXACT_ALARM` is blocked. Play restricts that permission to clock and calendar apps.
- `RECEIVE_BOOT_COMPLETED` — the notifications library reschedules alarms after a reboot.
- `VIBRATE` and `WAKE_LOCK` may appear because the notifications and background libraries use them.

Blocked on purpose: overlay windows (`SYSTEM_ALERT_WINDOW`), storage, photos, video, and audio.

`usesNonExemptEncryption` is false. The app uses ordinary HTTPS and the phone’s standard secure storage.

## Version already set for the next install

`mobile/app.json` is version `1.1.0`, Android `versionCode` 4, iOS build number `2`. `versionCode` 4 is higher than the preview APK already installed, so the new package can replace it.
