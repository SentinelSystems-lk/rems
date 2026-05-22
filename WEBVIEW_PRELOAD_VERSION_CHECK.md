# WebView Preload Version Check Spec

## Goal

Before the app opens the WebView screen, check whether the website has changed since the last app session. If the website version changed, refresh or reopen the WebView with the newest content before the user sees stale pages.

## Current Problem

The WebView is currently mounted and can stay alive across navigation, which is good for performance. But if the website changes, the app can keep showing old content because the WebView source is still using cached page state.

## Requested Behavior

Move the update check to app startup or to a screen before the WebView opens.

The app should:

1. Load a small version file from the website.
2. Compare the current version with the last saved version.
3. If the version changed, clear or bypass cached WebView content and then open the WebView.
4. If the version is the same, open the WebView normally.

## Recommended Version File

Use a fixed endpoint on the website, for example:

- `https://your-domain.com/version.json`
- `https://your-domain.com/webview-version.txt`

### Example JSON

```json
{
  "version": "2026-05-22-01"
}
```

### Example plain text

```txt
2026-05-22-01
```

## App Flow

### On App Start

1. App starts.
2. App fetches the version file.
3. App compares the version to the stored value in local storage.
4. If different, app updates the stored version and forces a fresh WebView load.
5. If same, app continues to WebView normally.

### On Foreground Resume

1. App returns to foreground.
2. App checks the version file again.
3. If version changed, refresh WebView or remount it with a cache-busting URL.

## Suggested Implementation Notes

### Where to run the check

Run the version check before routing into the WebView screen, ideally in:

- the root layout,
- a splash/loading gate screen,
- or the home route before redirecting to `/webview`.

### What to store locally

Save the last seen version in local storage, for example:

- `webview_site_version_monitoring`
- `webview_site_version_maintainance`

### What to do when version changes

One of these options:

- Remount WebView with a new `key`.
- Append a cache-busting query string like `?v=VERSION`.
- Clear only the WebView state that should be invalidated.

## Recommended Behavior for This Project

Because the WebView should stay mounted for smoother navigation, the best pattern is:

- keep the WebView mounted during normal app use,
- but check the version before opening it,
- and only force a reload when the version file changes.

## Acceptance Criteria

- The app checks the version file before entering the WebView screen.
- The app does not show stale cached website content after a new website deployment.
- The WebView does not reload on every navigation or every app resume unless the version actually changed.
- The implementation works for both `monitoring` and `maintainance` modes if both use separate site URLs.

## Notes for the Web Team

If possible, the website should expose one stable version file that is updated on each deployment.

If the site already has a build pipeline, the version file should be generated automatically during deploy so the app can detect real changes reliably.
