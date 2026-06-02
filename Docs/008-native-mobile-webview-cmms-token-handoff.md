# 008 - Native Mobile WebView CMMS Token Handoff

## Goal

Make the mobile WebView load Work Orders as fast as the browser by ensuring the CMMS token is available before the page renders.

## What This App Uses

- CMMS token storage key: `cmms_auth_token`
- Live token source in the web app: `CmmsAuthContext`
- Work Orders fetch endpoint: `POST /api/work-orders/search`

## Recommended Native Mobile Flow

1. Complete SCADA login in the native app.
2. Request the CMMS mobile token.
3. Store the CMMS token in native secure storage.
4. Inject the token into the WebView before navigating to Work Orders.
5. Let the WebView write the token into `localStorage["cmms_auth_token"]`.
6. Dispatch a storage/update message so the React app can react immediately.
7. Only then open the Work Orders page.

## Best WebView Handoff Pattern

Use both of these paths:

- `window.localStorage.setItem("cmms_auth_token", token)`
- a native `injectJavaScript(...)` call to notify the page that the token is ready

This is important because:

- `localStorage` persists across refreshes
- the injected script can fire both `storage` and `cmms-auth-token-change` events so the React app updates immediately

## Example WebView Injection

If your native app controls the `WebView` ref, use a payload like this:

```js
webviewRef.current.injectJavaScript(`
  window.localStorage.setItem("cmms_auth_token", token);
  window.dispatchEvent(new StorageEvent("storage", {
    key: "cmms_auth_token",
    newValue: token,
    oldValue: null,
    storageArea: window.localStorage,
    url: window.location.href
  }));
  window.dispatchEvent(new Event("cmms-auth-token-change"));
  true;
`);
```

If you need a fallback for early boot, you can still inject JavaScript to write the token into `localStorage` and dispatch `storage` and `cmms-auth-token-change`.

## Performance Checklist

- Do not wait for the Work Orders screen to request its own token if the native app already has it.
- Pass the token before the Work Orders route mounts.
- Avoid repeated retries while waiting for token bootstrap.
- Prefetch the Work Orders screen after login if the user usually opens it first.
- Clear the CMMS token on native logout.
- Clear the CMMS token on expiry and force re-authentication.

## What The Web App Now Does

- Reads the live token from `CmmsAuthContext`
- Falls back to `localStorage` only for persistence
- Fetches assigned work orders as soon as the CMMS token exists
- Does not wait for the current-user profile before fetching the list

## Notes

- The Work Orders list should be server-scoped to the assigned user.
- The current CMMS user profile is still useful for permissions, labels, and detail actions.
- If the native app injects the token early, the web view should feel close to instant.
