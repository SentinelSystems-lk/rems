# WebView Token Setup

This project already has the React Native side wired in [app/webview.tsx](app/webview.tsx). Use this guide to connect the web app login flow to the WebView token flow.

## What happens

1. The web app gets a JWT after login.
2. The web app sends the token to React Native with `window.ReactNativeWebView.postMessage(...)`.
3. React Native receives the token in `onMessage`, saves it in SecureStore under `jwt`, and schedules expiry cleanup if the token is a JWT.
4. When the screen opens again, React Native reads `jwt` from SecureStore and posts it back into the WebView.
5. The injected script in [app/webview.tsx](app/webview.tsx) stores the token in the page `localStorage` and dispatches an `rn-auth` event.

## Web app side

After login succeeds, send the token like this:

```js
window.ReactNativeWebView.postMessage(JSON.stringify({
  type: "auth",
  token: accessToken
}));
```

If your app also supports the older message format, this is already accepted too:

```js
window.ReactNativeWebView.postMessage(JSON.stringify({
  type: "TOKEN",
  token: accessToken
}));
```

## Reading the token in the web page

The injected script in [app/webview.tsx](app/webview.tsx) stores the token here:

```js
localStorage.getItem("jwt")
```

You can also listen for the auth event:

```js
window.addEventListener("rn-auth", (event) => {
  const token = event.detail;
  console.log("token received", token);
});
```

## React Native side

The current RN screen already does this:

- reads `jwt` from SecureStore in `postAuthToken()`
- posts it into the WebView with `webviewRef.current.postMessage(...)`
- accepts token messages in `onMessage`
- saves the token back to SecureStore

If you need to change the token key, update both places:

- SecureStore read/write key in [app/webview.tsx](app/webview.tsx)
- `localStorage.setItem("jwt", ...)` in the injected script

## Exact integration steps

1. Make sure login in the web app returns a JWT string.
2. After login success, call `window.ReactNativeWebView.postMessage(...)` with `{ type: "auth", token }`.
3. Leave the `onMessage` handler in [app/webview.tsx](app/webview.tsx) in place so the token is saved to SecureStore.
4. On page load, read `localStorage.getItem("jwt")` if you need the token immediately inside the web app.
5. If you want the web app to react as soon as RN injects the token, listen for `rn-auth`.

## Notes

- The token-expiry logic in [app/webview.tsx](app/webview.tsx) expects a JWT with an `exp` claim.
- If the token is not a JWT, the expiry timer will not work and should be removed or replaced.
- The maintenance URL is currently hardcoded in `getSourceUri(...)` for `mode === "maintainance"`.