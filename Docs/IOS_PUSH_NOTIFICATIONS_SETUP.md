# iOS Push Notifications Setup

This app already contains the client-side push flow:

- it requests notification permission in [app/webview.tsx](app/webview.tsx)
- it calls `getExpoPushTokenAsync(...)`
- it posts the token to `POST /api/push-tokens`

The missing part for iOS is usually the Apple/EAS credential setup.

## What the `.p8` file is for

The `AuthKey_82F397ZKZU.p8` file is your Apple Push Notification service key.
It is not added to the app code. It must be uploaded to Apple/EAS credentials so Expo can send iOS push notifications for this bundle identifier:

- `com.sentinelintelligencesystems.rems`

## Setup steps

1. Make sure this app is built with EAS, not Expo Go.
2. Upload the APNs key in EAS credentials for the iOS app.
3. Use the Apple Team ID that owns the app.
4. Rebuild the iOS app after the key is uploaded.
5. Install the rebuilt app on a physical iPhone or iPad.

## Recommended EAS flow

Run:

```bash
eas credentials -p ios
```

Then choose the iOS app for this project and upload the APNs key when prompted.

You will need:

- the `.p8` file contents
- the APNs Key ID: `82F397ZKZU`
- your Apple Team ID

If you prefer the Expo dashboard, go to the project credentials page and add the APNs key under iOS push credentials.

## Build and test

After credentials are configured, rebuild:

```bash
eas build -p ios --profile production
```

Then on a real device:

- sign in so the app has a JWT
- open the screen that mounts [app/webview.tsx](app/webview.tsx)
- watch for `[Push] Expo push token:` in the logs
- confirm your backend receives `POST /api/push-tokens`

## Common gotchas

- Push tokens do not work in the iOS simulator.
- Expo Go is not enough for this flow; use a development or production build.
- The backend still needs to send notifications through Expo push service or APNs.
- If `projectId` is missing, `getExpoPushTokenAsync(...)` can fail; this project already stores it in `app.json` under `extra.eas.projectId`.
