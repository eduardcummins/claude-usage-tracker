# Google Play listing for Plan Pace

Use this when filling in Play Console. The app id stays `com.eduardcummins.claudeusage` so an install can replace the APK already on the phone. The store name should not.

## Policy risks to read before you submit

- The usage request goes to `https://api.anthropic.com/api/oauth/usage`. That is the endpoint Claude Code uses. It is not a documented public API. Anthropic can change it, block it, or decide that a third-party app should not call it. If that happens, the installed app stops updating until the app is changed. Say that in the listing. Do not describe the endpoint as an official Anthropic integration.
- Do not put Claude, Anthropic, or the Claude asterisk mark in the store name, icon, or screenshots. Those are Anthropic’s trademarks. The icon in this repo is an original terracotta gauge on a cream background.
- The Android package id still contains the word `claude` (`com.eduardcummins.claudeusage`). Changing it makes a different app, and the APK already installed on the phone would not update in place. Leave it for that upgrade. If a later Play review objects to the package id, a new package id is a new store listing.
- The sign-in uses Claude Code’s public client id and the manual code page at `https://platform.claude.com/oauth/code/callback`. A phone cannot register its own redirect with that client, so the app cannot complete a silent return from the browser. The user copies the code. That is a real limitation, not a temporary shortcut.

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

You sign in once with the plan account you already have. The login stays on your phone. The app does not read chats or files, and it does not send your usage to the person who published the app.

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
| Does the app collect or share any of the required user data types? | Yes. The login token is sent to Anthropic so the app can sign in and read usage. Usage figures come back to the phone. The developer does not receive either one. |
| Is all of the data collected by your app encrypted in transit? | Yes. The requests use HTTPS. |
| Do you provide a way for users to request that their data be deleted? | Yes. Sign out in the app deletes the login and the saved usage from the phone. Uninstalling deletes the rest. There is no Plan Pace account. The Claude account is deleted on claude.ai, which the privacy policy states. |
| Location | No. |
| Personal info (name, email, address, phone) | Not collected by the app. The sign-in page is Anthropic’s. Plan Pace does not read the profile. |
| Financial info | No. |
| Messages, photos, audio, files, contacts, calendar | No. |
| App activity | Usage percentages and reset times are stored on the device and requested from Anthropic with the user’s login. They are not sent to the developer. |
| Device or other IDs | No. |
| Data shared with third parties | The login is sent to Anthropic (claude.com, platform.claude.com, console.anthropic.com, api.anthropic.com) because that is how the user reads their own plan. It is not sold and it is not used for advertising. |

If the form’s “account deletion” link is required, use the privacy policy URL. The policy explains in-app sign-out and points Claude account deletion to claude.ai.

## Content rating

The app shows numbers and local notifications. It has no violence, no user-generated public content, no chat, and no ads. Answer the questionnaire to match that.

## Permissions the build is expected to keep

- `INTERNET` — sign in and read usage.
- `POST_NOTIFICATIONS` — local reset alerts. The notifications library adds this.
- `SCHEDULE_EXACT_ALARM` — fire the reset alert at the reset time. `USE_EXACT_ALARM` is blocked. Play restricts that permission to clock and calendar apps.
- `RECEIVE_BOOT_COMPLETED` — the notifications library reschedules alarms after a reboot.
- `VIBRATE` and `WAKE_LOCK` may appear because the notifications and background libraries use them.

Blocked on purpose: overlay windows (`SYSTEM_ALERT_WINDOW`), storage, photos, video, and audio.

`usesNonExemptEncryption` is false. The app uses ordinary HTTPS and the phone’s standard secure storage.

## Version already set for the next install

`mobile/app.json` is version `1.1.0`, Android `versionCode` 2, iOS build number `2`. That is higher than the APK already installed, so the new package can replace it.
