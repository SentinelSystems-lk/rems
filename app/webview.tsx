import React, { useEffect, useRef, useState } from "react";
import { AppState, BackHandler, Linking, Platform, Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";
import { StatusBar, StatusBarStyle } from "expo-status-bar";
import Constants from "expo-constants";
import { SafeAreaView } from "react-native-safe-area-context";
import WebView from "react-native-webview";
import { useLocalSearchParams, useRouter } from "expo-router";
import { usePreventRemove } from "@react-navigation/native";
import * as SplashScreen from "expo-splash-screen";
import { getBackendUrl, FORCE_PUSH_SYNC } from "./config";

type Mode = "monitoring" | "maintainance";

const HEADER_BG_COLOR = "#0b0b0b";

function getSourceUri(mode: string | string[] | undefined) {
  const normalizedMode = Array.isArray(mode) ? mode[0] : mode;
  if (normalizedMode === "maintainance") {
    // return "https://cmms.sentinel.lk";
    return "http://localhost:3000/login";
  }

  return "https://7s6i6.sentinel.lk/";
  // return "http://localhost:5173/";
}

function normalizeUrl(url: string | null | undefined) {
  if (typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";

  const embeddedHttpMatch = trimmed.match(/https?:\/{1,2}.*/i);
  const normalized = embeddedHttpMatch ? embeddedHttpMatch[0] : trimmed;

  if (normalized.startsWith("http:/") && !normalized.startsWith("http://")) {
    return normalized.replace(/^http:\//, "http://");
  }

  if (normalized.startsWith("https:/") && !normalized.startsWith("https://")) {
    return normalized.replace(/^https:\//, "https://");
  }

  return normalized;
}

function isLoginPath(path: string | undefined) {
  if (!path) return false;
  const normalizedPath = path.trim().replace(/\/+$/, "");
  return normalizedPath === "/login" || normalizedPath.endsWith("/login");
}

function shouldShowBackButton(urlOrPath: string | undefined) {
  if (!urlOrPath) return false;

  try {
    const parsed = new URL(urlOrPath);
    return isLoginPath(parsed.pathname);
  } catch {
    return isLoginPath(urlOrPath);
  }
}

function getForceDarkScript() {
  return `(function() {
    try {
      var originalMatchMedia = window.matchMedia;
      window.matchMedia = function(query) {
        if (query && query.indexOf('prefers-color-scheme') !== -1) {
          var darkMatches = query.indexOf('dark') !== -1;
          return {
            matches: darkMatches,
            media: query,
            onchange: null,
            addListener: function() {},
            removeListener: function() {},
            addEventListener: function() {},
            removeEventListener: function() {},
            dispatchEvent: function() { return false; }
          };
        }

        return originalMatchMedia.call(window, query);
      };

      var root = document.documentElement;
      if (root) {
        root.style.colorScheme = 'dark';
      }
    } catch (e) {}
  })(); true;`;
}

function decodeBase64Url(input: string) {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");

  try {
    const atobFn = (globalThis as any).atob;
    if (typeof atobFn === "function") {
      return atobFn(padded);
    }
  } catch {
    // fall through to manual decoder
  }

  try {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    let output = "";
    let index = 0;

    while (index < padded.length) {
      const enc1 = chars.indexOf(padded.charAt(index++));
      const enc2 = chars.indexOf(padded.charAt(index++));
      const enc3 = chars.indexOf(padded.charAt(index++));
      const enc4 = chars.indexOf(padded.charAt(index++));

      const chr1 = (enc1 << 2) | (enc2 >> 4);
      const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      const chr3 = ((enc3 & 3) << 6) | enc4;

      output += String.fromCharCode(chr1);
      if (enc3 !== 64) output += String.fromCharCode(chr2);
      if (enc4 !== 64) output += String.fromCharCode(chr3);
    }

    return output;
  } catch {
    return null;
  }
}

function decodeJwt(token: string) {
  try {
    const parts = token.split(".");
    console.log("[JWT] Parts count:", parts.length);
    const payload = parts[1];
    if (!payload) {
      console.log("[JWT] ❌ No payload found");
      return null;
    }
    console.log("[JWT] Payload segment length:", payload.length, "content:", payload.substring(0, 50) + "...");
    
    const decodedPayload = decodeBase64Url(payload);
    console.log("[JWT] Decoded payload:", decodedPayload ? decodedPayload.substring(0, 100) : "null");
    
    if (!decodedPayload) {
      console.log("[JWT] ❌ Decode failed");
      return null;
    }
    
    const parsed = JSON.parse(decodedPayload);
    console.log("[JWT] ✅ Parsed JWT, exp:", parsed.exp);
    return parsed;
  } catch (err) {
    console.log("[JWT] ❌ Exception:", err);
    return null;
  }
}

function getTokenExpiry(token: string) {
  const payload = decodeJwt(token);
  if (!payload || !payload.exp) return null;
  return (payload.exp as number) * 1000; // convert seconds to ms
}

function addCacheBuster(url: string, version: string) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("__wv_version", version);
    return parsed.toString();
  } catch {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}__wv_version=${encodeURIComponent(version)}`;
  }
}

export default function WebviewScreen() {
  const webviewRef = useRef<any>(null);
  const router = useRouter();
  const { mode, siteUrl } = useLocalSearchParams<{ mode?: Mode; siteUrl?: string }>();
  const sourceUri = normalizeUrl(getSourceUri(mode));
  const providedSiteUrl = Array.isArray(siteUrl) ? siteUrl[0] : siteUrl;
  const normalizedProvidedUrl = normalizeUrl(providedSiteUrl);
  const systemScheme = useColorScheme();

  const normalizedMode = Array.isArray(mode) ? mode[0] : mode;
  const showSelector = typeof normalizedMode === "undefined" || normalizedMode === null;
  const isMaintainance = normalizedMode === "maintainance";
  const isMonitoring = normalizedMode === "monitoring" || !isMaintainance;
  const [initialUrl, setInitialUrl] = useState(normalizedProvidedUrl || sourceUri);

  // oklch(0.145 0 0) → #171717 (React Native does not support oklch in StyleSheet)
  // Default safe area color: use pure black
  const [bgColor, setBgColor] = useState(HEADER_BG_COLOR);
  const [statusBarStyle, setStatusBarStyle] = useState<StatusBarStyle>(isMaintainance || isMonitoring ? "light" : systemScheme === "dark" ? "light" : "dark");
  const [showBackButton, setShowBackButton] = useState(shouldShowBackButton(sourceUri));
  const [preventRemove, setPreventRemove] = useState(true);
  const [currentUrl, setCurrentUrl] = useState(sourceUri);
  const tokenExpiryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const versionProbeRef = useRef<Promise<void> | null>(null);
  const restoreUrlRef = useRef<Promise<void> | null>(null);
  const currentUrlRef = useRef(currentUrl);
  const sourceUriRef = useRef(sourceUri);
  const normalizedModeRef = useRef(normalizedMode);
  const normalizedProvidedUrlRef = useRef(normalizedProvidedUrl);

  useEffect(() => {
    currentUrlRef.current = currentUrl;
  }, [currentUrl]);

  useEffect(() => {
    sourceUriRef.current = sourceUri;
  }, [sourceUri]);

  useEffect(() => {
    normalizedModeRef.current = normalizedMode;
  }, [normalizedMode]);

  useEffect(() => {
    normalizedProvidedUrlRef.current = normalizedProvidedUrl;
  }, [normalizedProvidedUrl]);

  useEffect(() => {
    // If a siteUrl param was provided, prefer it and skip overwriting initialUrl.
    if (normalizedProvidedUrl) {
      setInitialUrl(normalizedProvidedUrl);
      setCurrentUrl(normalizedProvidedUrl);
      return;
    }

    setInitialUrl(sourceUri);
    setCurrentUrl(sourceUri);
  }, [sourceUri, normalizedProvidedUrl]);

  // Hide splash screen on mount
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  if (showSelector) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: bgColor }]} edges={["top", "bottom"]}>
        <StatusBar style={statusBarStyle} backgroundColor={bgColor} translucent={false} />
        <View style={styles.selectorContainer}>
          <Text style={styles.selectorTitle}>Choose a view</Text>
          <Pressable
            style={styles.optionButton}
            onPress={() => router.push({ pathname: "/webview", params: { mode: "monitoring" } })}
          >
            <Text style={styles.optionText}>Monitoring</Text>
          </Pressable>
          <Pressable
            style={[styles.optionButton, { marginTop: 12 }]}
            onPress={() => router.push({ pathname: "/webview", params: { mode: "maintainance" } })}
          >
            <Text style={styles.optionText}>Maintenance</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  async function restoreSavedUrlFromStorage() {
    if (normalizedProvidedUrlRef.current) return;
    if (currentUrlRef.current && currentUrlRef.current !== sourceUriRef.current) return;
    if (restoreUrlRef.current) return restoreUrlRef.current;

    restoreUrlRef.current = (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const AsyncStorageModule = require("@react-native-async-storage/async-storage");
        const AsyncStorage = AsyncStorageModule?.default || AsyncStorageModule;
        if (!AsyncStorage) {
          console.log("[WebView] AsyncStorage not available - skipping URL restore");
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const SecureStore = require("expo-secure-store");
        const storageKey = `webview_url_${normalizedModeRef.current}`;

        const token = await SecureStore.getItemAsync("jwt");
        if (!token) {
          console.log("[WebView] No token found, clearing saved URL");
          await AsyncStorage.removeItem(storageKey).catch(() => {});
          return;
        }

        const expiry = getTokenExpiry(token);
        const isExpired = expiry && new Date(expiry) < new Date();
        if (isExpired) {
          console.log("[WebView] Token expired, clearing saved URL");
          await AsyncStorage.removeItem(storageKey).catch(() => {});
          return;
        }

        const savedUrl = await AsyncStorage.getItem(storageKey);
        const normalizedSavedUrl = normalizeUrl(savedUrl);
        if (!normalizedSavedUrl) return;

        console.log("[WebView] Token valid, restored URL from storage:", normalizedSavedUrl);
        setInitialUrl(normalizedSavedUrl);
        setCurrentUrl(normalizedSavedUrl);
        void maybeReloadIfWebsiteChanged(normalizedSavedUrl);
      } catch (err) {
        console.log("[WebView] Storage check failed:", err);
      } finally {
        restoreUrlRef.current = null;
      }
    })();

    return restoreUrlRef.current;
  }

  useEffect(() => {
    void restoreSavedUrlFromStorage();
  }, [currentUrl, normalizedMode, normalizedProvidedUrl, sourceUri]);

  async function maybeReloadIfWebsiteChanged(targetUrl: string = currentUrl || sourceUri) {
    if (versionProbeRef.current) {
      return versionProbeRef.current;
    }

    versionProbeRef.current = (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const AsyncStorageModule = require("@react-native-async-storage/async-storage");
        const AsyncStorage = AsyncStorageModule?.default || AsyncStorageModule;

        if (!AsyncStorage) return;

        const versionKey = `webview_remote_version_${normalizedMode}`;
        const response = await fetch(sourceUri, {
          method: "HEAD",
          cache: "no-store",
        });

        const fingerprint = [
          response.headers.get("etag"),
          response.headers.get("last-modified"),
          response.headers.get("content-length"),
        ]
          .filter(Boolean)
          .join("|");

        if (!fingerprint) {
          return;
        }

        const previousFingerprint = await AsyncStorage.getItem(versionKey);
        if (previousFingerprint && previousFingerprint !== fingerprint) {
          const refreshUrl = addCacheBuster(targetUrl, fingerprint);
          console.log("[WebView] Website changed, reloading with cache buster:", refreshUrl);
          setInitialUrl(refreshUrl);
          setCurrentUrl(refreshUrl);
        }

        if (previousFingerprint !== fingerprint) {
          await AsyncStorage.setItem(versionKey, fingerprint);
        }
      } catch (err) {
        console.log("[WebView] Version probe skipped:", err);
      } finally {
        versionProbeRef.current = null;
      }
    })();

    return versionProbeRef.current;
  }

  async function clearSavedLaunchState() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const AsyncStorageModule = require("@react-native-async-storage/async-storage");
      const AsyncStorage = AsyncStorageModule?.default || AsyncStorageModule;
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const SecureStore = require("expo-secure-store");

      if (!AsyncStorage) return;

      await AsyncStorage.removeItem("webview_last_state");
      await AsyncStorage.removeItem(`webview_url_${normalizedMode}`);
      await AsyncStorage.removeItem(`webview_remote_version_${normalizedMode}`);
      await SecureStore.deleteItemAsync("jwt").catch(() => {});
    } catch (err) {
      console.log("[WebView] Failed to clear saved launch state:", err);
    }
  }

  async function exitToHome() {
    setPreventRemove(false);
    await clearSavedLaunchState();
    router.replace("/");
  }

  // Save current URL to storage when it changes
  useEffect(() => {
    if (currentUrl && currentUrl !== sourceUri) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const AsyncStorageModule = require("@react-native-async-storage/async-storage");
        const AsyncStorage = AsyncStorageModule?.default || AsyncStorageModule;
        
        if (!AsyncStorage) {
          console.log("[WebView] AsyncStorage not available - skipping URL save");
          return;
        }
        
        const storageKey = `webview_url_${normalizedMode}`;
        AsyncStorage.setItem(storageKey, normalizeUrl(currentUrl)).catch((err: any) =>
          console.log("[WebView] Failed to save URL:", err)
        );
        AsyncStorage.setItem(
          "webview_last_state",
          JSON.stringify({
            mode: normalizedMode,
            url: normalizeUrl(currentUrl),
            updatedAt: Date.now(),
          })
        ).catch((err: any) => console.log("[WebView] Failed to save last state:", err));
      } catch (err) {
        console.log("[WebView] AsyncStorage not available:", err);
      }
    }
  }, [currentUrl, normalizedMode]);

  usePreventRemove(preventRemove, () => {
    // Keep the WebView pinned in place until an explicit logout or token expiry.
  });

  function handleBackNavigation() {
    // Block system back while the session is still active.
    return true;
  }

  function handleBackPress() {
    void exitToHome();
  }

  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", handleBackNavigation);

    return () => {
      backHandler.remove();
    };
  }, []);

  async function postAuthToken() {
    try {
      let token: string | null = null;
      try {
        // require at runtime to avoid static module resolution errors if package isn't installed yet
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const ss = require("expo-secure-store");
        token = await ss.getItemAsync("jwt");
        if (token) {
          console.log("[WebView] Token found in SecureStore:", token.substring(0, 20) + "...");
        } else {
          console.log("[WebView] No token found in SecureStore");
        }
      } catch (err) {
        console.log("[WebView] Failed to read from SecureStore:", err);
        token = null;
      }
      if (token && webviewRef.current && typeof webviewRef.current.postMessage === "function") {
        console.log("[WebView] Posting token to WebView...");
        webviewRef.current.postMessage(JSON.stringify({ type: "auth", token }));
      } else if (!token) {
        console.log("[WebView] No token to post");
      } else {
        console.log("[WebView] WebView ref not ready");
      }
    } catch (err) {
      console.log("[WebView] Error in postAuthToken:", err);
    }
  }

  async function syncExpoPushTokenToBackend(authToken?: string | null) {
    try {
      // Runtime requires keep the bundle stable even if the package is temporarily missing.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Notifications = require("expo-notifications");
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Device = require("expo-device");
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const AsyncStorageModule = require("@react-native-async-storage/async-storage");
      const AsyncStorage = AsyncStorageModule?.default || AsyncStorageModule;
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const SecureStore = require("expo-secure-store");

      if (!Device?.isDevice) {
        console.log("[Push] Physical device required for Expo push tokens");
        return;
      }

      const storedAuthToken = authToken ?? (await SecureStore.getItemAsync("jwt"));
      if (!storedAuthToken) {
        console.log("[Push] No auth token available yet; skipping push-token sync");
        return;
      }

      // Log limited auth token info for debugging (don't log full token in production)
      try {
        const short = typeof storedAuthToken === 'string' ? storedAuthToken.substring(0, 20) + '...' : String(storedAuthToken);
        console.log("[Push] Using auth token:", short);
        const tokenInfo = decodeJwt(storedAuthToken as string);
        if (tokenInfo) {
          console.log("[Push] Auth token payload:", { sub: tokenInfo.sub, iss: tokenInfo.iss, exp: tokenInfo.exp });
        }
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.log("[Push] Full auth token (dev only):", storedAuthToken);
        }
      } catch (e) {
        console.log("[Push] Failed to decode auth token for debug:", e);
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.log("[Push] Notification permission denied; skipping push-token sync");
        return;
      }

      const projectId =
        Constants.easConfig?.projectId ??
        Constants.expoConfig?.extra?.eas?.projectId;

      const pushTokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
      const expoPushToken = pushTokenResponse?.data;

      if (!expoPushToken) {
        console.log("[Push] Failed to obtain Expo push token");
        return;
      }

      console.log("[Push] Expo push token:", expoPushToken);

      const storageKey = `expo_push_token_sent_${normalizedMode}`;
      const ownerKey = `expo_push_token_owner_${normalizedMode}`;
      const lastSentToken = await AsyncStorage.getItem(storageKey);
      const lastOwner = await AsyncStorage.getItem(ownerKey);

      let currentOwner: string | null = null;
      try {
        const info = decodeJwt(storedAuthToken as string) as any;
        currentOwner = info?.sub ? String(info.sub) : null;
      } catch {}

      // Always send the token to the backend so the server can decide how to handle duplicates
      console.log("[Push] Forcing push-token sync to backend", { lastSentToken, lastOwner, currentOwner });

      const endpoint = getBackendUrl("/api/push-tokens");
      console.log("[Push] Sending push-token to:", endpoint);
      console.log("[Push] Payload preview:", { expoPushToken: expoPushToken ? expoPushToken.substring(0, 16) + '...' : null, platform: Platform.OS, mode: normalizedMode });
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${storedAuthToken}`,
        },
        body: JSON.stringify({
          expoPushToken,
          platform: Platform.OS,
          mode: normalizedMode,
        }),
      });

      if (!response.ok) {
        const responseText = await response.text().catch(() => "");
        console.log("[Push] Backend response:", { status: response.status, body: responseText });
        throw new Error(`Push token sync failed with ${response.status}: ${responseText}`);
      }
      await AsyncStorage.setItem(storageKey, expoPushToken);
      if (currentOwner) {
        await AsyncStorage.setItem(ownerKey, currentOwner).catch(() => {});
      }
      console.log("[Push] Expo push token synced to backend");
    } catch (err) {
      console.log("[Push] Error syncing Expo push token:", err);
    }
  }

  useEffect(() => {
    // Post stored token when screen mounts and when app returns to foreground
    postAuthToken();
    syncExpoPushTokenToBackend();
    void maybeReloadIfWebsiteChanged();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        postAuthToken();
        syncExpoPushTokenToBackend();
        void restoreSavedUrlFromStorage();
        void maybeReloadIfWebsiteChanged();
      }
    });

    return () => {
      try { sub.remove(); } catch { /* ignore older RN */ }
      if (tokenExpiryRef.current) clearTimeout(tokenExpiryRef.current);
    };
  }, []);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bgColor }]} edges={["top", "bottom"]}>
      <StatusBar style={statusBarStyle} backgroundColor={bgColor} translucent={false} />
      {showBackButton ? (
        <Pressable style={styles.floatingBackButton} onPress={handleBackPress}>
          <Text style={styles.floatingBackText}>Back</Text>
        </Pressable>
      ) : null}
      <WebView
        ref={webviewRef}
        source={{ uri: initialUrl }}
        containerStyle={styles.webviewContainer}
        style={styles.webview}
        onNavigationStateChange={(navState) => {
          const nextUrl = normalizeUrl(navState.url);
          setShowBackButton(shouldShowBackButton(nextUrl));
          if (nextUrl && nextUrl !== sourceUri && nextUrl !== currentUrl) {
            setCurrentUrl(nextUrl);
          }
        }}
        cacheEnabled={true}
        incognito={false}
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        domStorageEnabled={true}
        javaScriptEnabled={true}
        originWhitelist={["*"]}
        onShouldStartLoadWithRequest={(request) => {
          const requestedUrl = normalizeUrl(request.url);
          if (!requestedUrl) return false;
          if (requestedUrl.startsWith("http://") || requestedUrl.startsWith("https://")) {
            return true;
          }
          Linking.canOpenURL(requestedUrl).then((supported) => {
            if (supported) Linking.openURL(requestedUrl);
          });
          return false;
        }}
        injectedJavaScriptBeforeContentLoaded={`${getForceDarkScript()}(function(){window.__rn_injected=true; if(window.addEventListener){window.addEventListener('message', function(ev){ try{ var d = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data; console.log('[RN-Auth] Received message:', d); if(d && d.type === 'auth' && d.token){ console.log('[RN-Auth] Token received:', d.token.substring(0, 20) + '...'); try{ localStorage.setItem('jwt', d.token); console.log('[RN-Auth] Token saved to localStorage'); }catch(e){ console.error('[RN-Auth] Failed to save to localStorage:', e); } try{ /* also set cookie for servers that rely on cookies */ document.cookie = 'jwt=' + encodeURIComponent(d.token) + '; path=/; SameSite=None; Secure'; console.log('[RN-Auth] Cookie set'); }catch(e){ console.error('[RN-Auth] Failed to set cookie:', e); } try{ window.dispatchEvent(new CustomEvent('rn-auth',{detail:d.token})); console.log('[RN-Auth] Event dispatched'); }catch(e){ console.error('[RN-Auth] Failed to dispatch event:', e); } } }catch(e){ console.error('[RN-Auth] Error processing message:', e); } }); }
          // Intercept localStorage.setItem to detect when the web app saves a JWT
          try {
            var _origSetItem = localStorage.setItem.bind(localStorage);
            localStorage.setItem = function(key, value) {
              try { _origSetItem(key, value); } catch (e) {}
              try {
                if (typeof key === 'string' && key.toLowerCase() === 'jwt' && value) {
                  try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'auth', token: String(value) })); } catch (e) {}
                }
              } catch (e) {}
            };

            // If a JWT already exists on load, notify React Native
            try {
              var __existing_jwt = localStorage.getItem('jwt') || localStorage.getItem('JWT');
              if (__existing_jwt) {
                try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'auth', token: __existing_jwt })); } catch (e) {}
              }
            } catch (e) {}

            // Also listen to storage events (in case the JWT is written from another context)
            window.addEventListener('storage', function(evt) {
              try {
                if (evt && (evt.key === 'jwt' || evt.key === 'JWT') && evt.newValue) {
                  try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'auth', token: evt.newValue })); } catch (e) {}
                }
              } catch (e) {}
            });
            // Lightweight cookie poller to catch non-HttpOnly jwt cookies set by the site
            try {
              var __cookiePollCount = 0;
              var __cookiePoller = setInterval(function() {
                try {
                  var m = document.cookie.match(/(?:^|;\s*)jwt=([^;]+)/i);
                  var cookieJwt = m ? decodeURIComponent(m[1]) : null;
                  if (cookieJwt) {
                    try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'auth', token: cookieJwt })); } catch (e) {}
                    clearInterval(__cookiePoller);
                    return;
                  }
                } catch (e) {}
                __cookiePollCount++;
                if (__cookiePollCount > 10) {
                  try { clearInterval(__cookiePoller); } catch (e) {}
                }
              }, 1000);
            } catch (e) {}

            // Intercept fetch responses to look for tokens in JSON bodies or text
            try {
              var _origFetch = window.fetch.bind(window);
              window.fetch = function() {
                var args = Array.prototype.slice.call(arguments);
                return _origFetch.apply(this, args).then(function(resp) {
                  try {
                    var cloned = resp.clone();
                    cloned.text().then(function(text) {
                      try {
                        var ct = (cloned.headers && cloned.headers.get ? cloned.headers.get('content-type') : '') || '';
                        var json = null;
                        if (ct.toLowerCase().indexOf('application/json') !== -1) {
                          try { json = JSON.parse(text); } catch (e) { json = null; }
                        }

                        var fieldNames = ['token','access_token','jwt','id_token'];
                        if (json) {
                          for (var i=0;i<fieldNames.length;i++){
                            var k = fieldNames[i];
                            if (json && typeof json[k] === 'string' && json[k].length>10) {
                              try { window.ReactNativeWebView.postMessage(JSON.stringify({type:'auth', token: json[k]})); } catch (e) {}
                              try { localStorage.setItem('jwt', json[k]); } catch (e) {}
                              break;
                            }
                          }
                        } else if (text) {
                          var m = text.match(/[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}/);
                          if (m && m[0]) {
                            try { window.ReactNativeWebView.postMessage(JSON.stringify({type:'auth', token: m[0]})); } catch (e) {}
                            try { localStorage.setItem('jwt', m[0]); } catch (e) {}
                          }
                        }
                      } catch (e) {}
                    }).catch(function(){});
                  } catch (e) {}
                  return resp;
                });
              };
            } catch (e) {}

            // Intercept XHR to inspect JSON/text responses for tokens
            try {
              var _origXOpen = XMLHttpRequest.prototype.open;
              var _origXSend = XMLHttpRequest.prototype.send;
              XMLHttpRequest.prototype.open = function() {
                try { this.__rn_xhr_url = arguments[1]; } catch (e) {}
                return _origXOpen.apply(this, arguments);
              };
              XMLHttpRequest.prototype.send = function() {
                try {
                  this.addEventListener('readystatechange', function() {
                    try {
                      if (this.readyState === 4) {
                        try {
                          var ct = this.getResponseHeader ? (this.getResponseHeader('content-type')||'') : '';
                          var text = this.responseText;
                          var parsed = null;
                          if (ct.toLowerCase().indexOf('application/json') !== -1) {
                            try { parsed = JSON.parse(text); } catch (e) { parsed = null; }
                          }
                          var fieldNames2 = ['token','access_token','jwt','id_token'];
                          if (parsed) {
                            for (var j=0;j<fieldNames2.length;j++){
                              var kk = fieldNames2[j];
                              if (parsed && typeof parsed[kk] === 'string' && parsed[kk].length>10) {
                                try { window.ReactNativeWebView.postMessage(JSON.stringify({type:'auth', token: parsed[kk]})); } catch (e) {}
                                try { localStorage.setItem('jwt', parsed[kk]); } catch (e) {}
                                break;
                              }
                            }
                          } else if (text) {
                            var mm = text.match(/[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}/);
                            if (mm && mm[0]) {
                              try { window.ReactNativeWebView.postMessage(JSON.stringify({type:'auth', token: mm[0]})); } catch (e) {}
                              try { localStorage.setItem('jwt', mm[0]); } catch (e) {}
                            }
                          }
                        } catch (e) {}
                      }
                    } catch (e) {}
                  });
                } catch (e) {}
                return _origXSend.apply(this, arguments);
              };
            } catch (e) {}
          } catch (e) {}
        })();`}
        injectedJavaScript={`(function() {
          function send(url) {
            try {
              window.ReactNativeWebView.postMessage(JSON.stringify({type:'open', url: url}));
            } catch (e) {}
          }

          function sendRoute() {
            try {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'route',
                path: window.location.pathname,
                url: window.location.href
              }));
            } catch (e) {}
          }

          var originalPushState = history.pushState;
          history.pushState = function() {
            var result = originalPushState.apply(history, arguments);
            sendRoute();
            return result;
          };

          var originalReplaceState = history.replaceState;
          history.replaceState = function() {
            var result = originalReplaceState.apply(history, arguments);
            sendRoute();
            return result;
          };

          window.addEventListener('popstate', sendRoute);
          sendRoute();

          window.open = function(url){ send(url); return {closed:false}; };
          document.addEventListener('click', function(e){
            var el = e.target;
            while(el && el.tagName !== 'A') el = el.parentElement;
            if(el && el.tagName === 'A'){
              var target = el.getAttribute('target');
              var href = el.href;
              if(target === '_blank' && href){
                e.preventDefault();
                send(href);
              }
            }
          }, true);
        })();`}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            console.log("[WebView] Message received from page:", JSON.stringify(data).substring(0, 100));

            if ((data.type === "auth" || data.type === "TOKEN") && typeof data.token === "string") {
              console.log("[WebView] 🔐 AUTH TOKEN RECEIVED from page:", data.token.substring(0, 30) + "...");
              
              // Clear any existing expiry timer
              if (tokenExpiryRef.current) {
                clearTimeout(tokenExpiryRef.current);
              }
              
              // Decode JWT and get expiry time
              const expiryMs = getTokenExpiry(data.token);
              const now = Date.now();
              if (expiryMs) {
                const expiresInSeconds = Math.round((expiryMs - now) / 1000);
                const expiryDate = new Date(expiryMs);
                console.log(`[WebView] ⏰ Token expires in ${expiresInSeconds}s at ${expiryDate.toLocaleString()}`);
                
                // Schedule token clearing when it expires
                tokenExpiryRef.current = setTimeout(() => {
                  console.log("[WebView] ⏱️ Token has EXPIRED - clearing storage");
                  try {
                    const ss = require("expo-secure-store");
                    ss.setItemAsync("jwt", "").catch(() => {});
                  } catch {}
                  void exitToHome();
                }, expiryMs - now);
              } else {
                console.log("[WebView] ⚠️ Could not decode token expiry - no automatic clearing");
              }
              
              // Save token coming from the web page into secure storage so RN can reuse it
              try {
                // runtime require to avoid static resolution issues
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const ss = require("expo-secure-store");
                ss.setItemAsync("jwt", data.token).then(() => {
                  console.log("[WebView] ✅ Token SAVED to SecureStore successfully");
                  syncExpoPushTokenToBackend(data.token);
                }).catch((err: any) => {
                  console.log("[WebView] ❌ Failed saving token to SecureStore:", err);
                });
              } catch (err) {
                console.log("[WebView] ❌ SecureStore require failed:", err);
              }
              return;
            }

            if (
              data.type === "logout" ||
              data.type === "LOGOUT" ||
              data.type === "signout" ||
              data.type === "sign_out" ||
              data.type === "user_logout"
            ) {
              console.log("[WebView] Logout requested from page");
              void exitToHome();
              return;
            }

            if (data.type === "theme" && data.scheme) {
              // CMMS safe area is always locked to oklch(0.145 0 0) → #171717
              if (isMaintainance) return;
              setTimeout(() => {
                if (data.scheme === "dark") {
                  setBgColor(HEADER_BG_COLOR);
                  setStatusBarStyle("light");
                } else {
                  setBgColor("#ffffff");
                  setStatusBarStyle("dark");
                }
              }, 120);
              return;
            }

            if (data.type === "route") {
              const path = typeof data.path === "string" ? data.path : "";
              const url = typeof data.url === "string" ? data.url : "";
              const nextUrl = normalizeUrl(url);
              setShowBackButton(shouldShowBackButton(path) || shouldShowBackButton(nextUrl));
              if (nextUrl && nextUrl !== currentUrl) {
                setCurrentUrl(nextUrl);
              }
              return;
            }

            if (data.type === "mode_switch" && data.mode) {
              console.log("[WebView] Mode switch requested:", data.mode);
              const newMode = data.mode;
              
              // Navigate back to home and then to webview with new mode
              router.push("/");
              setTimeout(() => {
                router.push({ pathname: "/webview", params: { mode: newMode } });
              }, 300);
              return;
            }

            const openedUrl = normalizeUrl(data?.url);
            if (openedUrl) {
              Linking.canOpenURL(openedUrl).then((supported) => {
                if (supported) Linking.openURL(openedUrl);
              });
            }
          } catch (err) {
            console.log("[WebView] ❌ Error parsing message from page:", err);
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: HEADER_BG_COLOR, padding: 0, margin: 0 },
  floatingBackButton: {
    position: "absolute",
    top: 50,
    left: 14,
    zIndex: 20,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: "rgba(8, 16, 28, 0.88)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
  },
  floatingBackText: {
    color: "#eaf3ff",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: HEADER_BG_COLOR,
    alignItems: "center",
    justifyContent: "center",
  },
  webviewContainer: {
    flex: 1,
    backgroundColor: HEADER_BG_COLOR,
  },
  webview: {
    flex: 1,
    backgroundColor: HEADER_BG_COLOR,
  },
  selectorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: HEADER_BG_COLOR,
  },
  selectorTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 18,
  },
  optionButton: {
    backgroundColor: "#0f1724",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    minWidth: 220,
    alignItems: "center",
  },
  optionText: {
    color: "#eaf3ff",
    fontSize: 16,
    fontWeight: "600",
  },
});
