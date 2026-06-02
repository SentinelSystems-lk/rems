import React, { useEffect, useRef, useState } from "react";
import { AppState, BackHandler, Linking, Platform, StyleSheet, useColorScheme } from "react-native";
import { StatusBar, StatusBarStyle } from "expo-status-bar";
import Constants from "expo-constants";
import { SafeAreaView } from "react-native-safe-area-context";
import WebView from "react-native-webview";
import { useLocalSearchParams, useRouter } from "expo-router";
import { usePreventRemove } from "@react-navigation/native";
import * as SplashScreen from "expo-splash-screen";
import { getBackendUrl } from "./config";

const HEADER_BG_COLOR = "#0b0b0b";
// const APP_URL = "http://localhost:5173/";
const APP_URL = "https://7s6i6.sentinel.lk/";
const STORAGE_SCOPE = "monitoring";
const CMMS_AUTH_STORAGE_KEY = "cmms_auth_token";
const LEGACY_AUTH_STORAGE_KEY = "jwt";
const MAX_JS_TIMEOUT_MS = 2147483647;

function getSourceUri() {
  return APP_URL;
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

function buildCmmsTokenInjectionScript(token: string) {
  const safeToken = JSON.stringify(token);

  return `(function() {
    try {
      var token = ${safeToken};
      if (!token) return;

      try {
        localStorage.setItem('${CMMS_AUTH_STORAGE_KEY}', token);
      } catch (e) {}

      try {
        window.dispatchEvent(new Event('cmms-auth-token-change'));
      } catch (e) {}

      try {
        window.postMessage(JSON.stringify({ type: 'CMMS_TOKEN_READY' }), '*');
      } catch (e) {}
    } catch (e) {}
  })(); true;`;
}

function buildClearCmmsAuthInjectionScript() {
  return `(function() {
    try {
      try {
        localStorage.removeItem('${CMMS_AUTH_STORAGE_KEY}');
        localStorage.removeItem('${LEGACY_AUTH_STORAGE_KEY}');
      } catch (e) {}

      try {
        sessionStorage.removeItem('${CMMS_AUTH_STORAGE_KEY}');
        sessionStorage.removeItem('${LEGACY_AUTH_STORAGE_KEY}');
      } catch (e) {}

      try {
        document.cookie = '${CMMS_AUTH_STORAGE_KEY}=; Max-Age=0; path=/; SameSite=None; Secure';
        document.cookie = '${LEGACY_AUTH_STORAGE_KEY}=; Max-Age=0; path=/; SameSite=None; Secure';
      } catch (e) {}
    } catch (e) {}
  })(); true;`;
}

function buildAuthDiscoveryScript() {
  return `(function() {
    try {
      var lastPostedToken = null;

      function looksLikeJwt(value) {
        return typeof value === 'string' && /^[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}$/.test(value.trim());
      }

      function looksLikeAuthValue(value) {
        if (typeof value !== 'string') return false;
        var trimmed = value.trim();
        if (!trimmed) return false;
        return looksLikeJwt(trimmed) || (trimmed.length > 40 && trimmed.indexOf('.') !== -1);
      }

      function postToken(token, source) {
        try {
          if (!looksLikeAuthValue(token)) return;
          if (lastPostedToken === token) return;
          lastPostedToken = token;
          console.log('[RN-CMMS] Auth token discovered from ' + source + ':', String(token).substring(0, 20) + '...');
          try { localStorage.setItem('${CMMS_AUTH_STORAGE_KEY}', token); } catch (e) {}
          try { sessionStorage.setItem('${CMMS_AUTH_STORAGE_KEY}', token); } catch (e) {}
          try { localStorage.setItem('${LEGACY_AUTH_STORAGE_KEY}', token); } catch (e) {}
          try { sessionStorage.setItem('${LEGACY_AUTH_STORAGE_KEY}', token); } catch (e) {}
          try { window.dispatchEvent(new Event('cmms-auth-token-change')); } catch (e) {}
          try {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'auth', token: token, source: source }));
          } catch (e) {}
        } catch (e) {}
      }

      function scanStorage(storage, label) {
        try {
          if (!storage) return;

          var directKeys = ['${LEGACY_AUTH_STORAGE_KEY}', '${CMMS_AUTH_STORAGE_KEY}'];
          for (var i = 0; i < directKeys.length; i++) {
            var directValue = storage.getItem(directKeys[i]);
            if (looksLikeAuthValue(directValue)) {
              postToken(directValue, label + ':' + directKeys[i]);
              return;
            }
          }

          for (var index = 0; index < storage.length; index++) {
            var key = storage.key(index);
            if (!key) continue;
            var value = storage.getItem(key);
            if (looksLikeAuthValue(value)) {
              postToken(value, label + ':' + key);
              return;
            }
          }
        } catch (e) {}
      }

      function scanCookies() {
        try {
          var cookieParts = document.cookie ? document.cookie.split(/;\\s*/) : [];
          for (var i = 0; i < cookieParts.length; i++) {
            var part = cookieParts[i];
            var eqIndex = part.indexOf('=');
            if (eqIndex === -1) continue;
            var key = part.substring(0, eqIndex);
            var value = decodeURIComponent(part.substring(eqIndex + 1));
            if (key === '${LEGACY_AUTH_STORAGE_KEY}' && looksLikeAuthValue(value)) {
              postToken(value, 'cookie:' + key);
              return;
            }
          }

          for (var j = 0; j < cookieParts.length; j++) {
            var cmmsPart = cookieParts[j];
            var cmmsEq = cmmsPart.indexOf('=');
            if (cmmsEq === -1) continue;
            var cmmsKey = cmmsPart.substring(0, cmmsEq);
            var cmmsValue = decodeURIComponent(cmmsPart.substring(cmmsEq + 1));
            if (cmmsKey === '${CMMS_AUTH_STORAGE_KEY}' && looksLikeAuthValue(cmmsValue)) {
              postToken(cmmsValue, 'cookie:' + cmmsKey);
              return;
            }
          }
        } catch (e) {}
      }

      function scanAll() {
        scanStorage(window.localStorage, 'localStorage');
        scanStorage(window.sessionStorage, 'sessionStorage');
        scanCookies();
      }

      scanAll();
      window.addEventListener('storage', scanAll);
      window.addEventListener('focus', scanAll);
      document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible') scanAll();
      });
      window.addEventListener('message', function(ev) {
        try {
          var d = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
          if (!d || typeof d !== 'object') return;
          var candidates = [d.token, d.jwt, d.access_token, d.authToken, d.auth_token, d.legacy_jwt, d.cmms_auth_token];
          for (var i = 0; i < candidates.length; i++) {
            if (looksLikeAuthValue(candidates[i])) {
              postToken(candidates[i], 'window.message:' + (d.type || 'unknown'));
              return;
            }
          }
        } catch (e) {}
      });
      setInterval(scanAll, 1000);
    } catch (e) {}
  })(); true;`;
}

function extractTokenFromPayload(value: unknown): string {
  const seen = new Set<unknown>();

  function walk(input: unknown): string {
    if (!input || typeof input !== "object") {
      return "";
    }

    if (seen.has(input)) {
      return "";
    }
    seen.add(input);

    if (Array.isArray(input)) {
      for (const item of input) {
        const token = walk(item);
        if (token) return token;
      }
      return "";
    }

    const record = input as Record<string, unknown>;
    const directKeys = [
      "token",
      "jwt",
      "access_token",
      "authToken",
      "auth_token",
      "legacy_jwt",
      "cmms_auth_token",
    ];

    for (const key of directKeys) {
      const candidate = record[key];
      if (typeof candidate === "string" && candidate.length > 20 && candidate.includes(".")) {
        return candidate;
      }
    }

    for (const nested of Object.values(record)) {
      const token = walk(nested);
      if (token) return token;
    }

    return "";
  }

  if (typeof value === "string" && value.length > 20 && value.includes(".")) {
    return value;
  }

  return walk(value);
}

function buildBeforeContentJavaScript(token: string | null) {
  const bootstrapScript = token ? buildCmmsTokenInjectionScript(token) : "true;";
  const hasBootstrapToken = Boolean(token);

  return `${getForceDarkScript()}(function(){window.__rn_injected=true;console.log('[RN-CMMS] injectedJavaScriptBeforeContentLoaded running');console.log('[RN-CMMS] Bootstrap token available before load:', ${hasBootstrapToken});${buildAuthDiscoveryScript()}${bootstrapScript}if(window.addEventListener){window.addEventListener('message',function(ev){try{var d=typeof ev.data==='string'?JSON.parse(ev.data):ev.data;console.log('[RN-CMMS] Received message:',d);if(d&&d.type==='CMMS_TOKEN_READY'&&d.token){console.log('[RN-CMMS] Token received:',String(d.token).substring(0,20)+'...');try{localStorage.setItem('${CMMS_AUTH_STORAGE_KEY}',d.token);console.log('[RN-CMMS] Token saved to localStorage');window.dispatchEvent(new Event('cmms-auth-token-change'));}catch(e){console.error('[RN-CMMS] Failed to save to localStorage:',e);}}}catch(e){console.error('[RN-CMMS] Error processing message:',e);}});}return true;})(); true;`;
}

export default function WebviewScreen() {
  const webviewRef = useRef<any>(null);
  const router = useRouter();
  const { siteUrl } = useLocalSearchParams<{ siteUrl?: string }>();
  const sourceUri = normalizeUrl(getSourceUri());
  const providedSiteUrl = Array.isArray(siteUrl) ? siteUrl[0] : siteUrl;
  const normalizedProvidedUrl = normalizeUrl(providedSiteUrl);
  const systemScheme = useColorScheme();

  const [initialUrl, setInitialUrl] = useState(normalizedProvidedUrl || sourceUri);

  // oklch(0.145 0 0) → #171717 (React Native does not support oklch in StyleSheet)
  // Default safe area color: use pure black
  const [bgColor, setBgColor] = useState(HEADER_BG_COLOR);
  const [statusBarStyle, setStatusBarStyle] = useState<StatusBarStyle>(systemScheme === "dark" ? "light" : "dark");
  const [preventRemove, setPreventRemove] = useState(true);
  const [currentUrl, setCurrentUrl] = useState(sourceUri);
  const [isSessionHydrated, setIsSessionHydrated] = useState(false);
  const [bootstrapAuthToken, setBootstrapAuthToken] = useState<string | null>(null);
  const tokenExpiryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pushSyncRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pushJwtWaitRef = useRef<Promise<string | null> | null>(null);
  const pushJwtResolveRef = useRef<((token: string | null) => void) | null>(null);
  const isMountedRef = useRef(true);
  const versionProbeRef = useRef<Promise<void> | null>(null);
  const restoreUrlRef = useRef<Promise<void> | null>(null);
  const currentUrlRef = useRef(currentUrl);
  const sourceUriRef = useRef(sourceUri);
  const normalizedProvidedUrlRef = useRef(normalizedProvidedUrl);

  useEffect(() => {
    currentUrlRef.current = currentUrl;
  }, [currentUrl]);

  useEffect(() => {
    sourceUriRef.current = sourceUri;
  }, [sourceUri]);

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

  function deliverTokenToWebView(token: string) {
    const webview = webviewRef.current;
    if (!webview) {
      console.log("[WebView] WebView ref not ready for token delivery");
      return;
    }

    try {
      if (typeof webview.injectJavaScript === "function") {
        console.log("[WebView] Injecting CMMS token into WebView:", `${token.substring(0, 24)}...`);
        webview.injectJavaScript(buildCmmsTokenInjectionScript(token));
      }
    } catch (err) {
      console.log("[WebView] Failed JS token injection:", err);
    }
  }

  function clearWebViewAuthState() {
    const webview = webviewRef.current;
    if (!webview) {
      return;
    }

    try {
      if (typeof webview.injectJavaScript === "function") {
        webview.injectJavaScript(buildClearCmmsAuthInjectionScript());
      }
    } catch (err) {
      console.log("[WebView] Failed to clear WebView auth state:", err);
    }
  }

  function clearPushSyncRetry() {
    if (pushSyncRetryRef.current) {
      clearTimeout(pushSyncRetryRef.current);
      pushSyncRetryRef.current = null;
    }
  }

  async function waitForLegacyJwtToken(SecureStore: any) {
    if (pushJwtWaitRef.current) {
      return pushJwtWaitRef.current;
    }

    const tokenRaw = await SecureStore.getItemAsync(LEGACY_AUTH_STORAGE_KEY);
    const token = typeof tokenRaw === "string" ? tokenRaw.trim() : "";
    if (token) {
      console.log("[Push] Legacy JWT became available:", `${token.substring(0, 24)}...`);
      return token;
    }

    pushJwtWaitRef.current = new Promise<string | null>((resolve) => {
      pushJwtResolveRef.current = resolve;
    }).finally(() => {
      pushJwtWaitRef.current = null;
      pushJwtResolveRef.current = null;
    });

    console.log("[Push] Waiting for legacy JWT before push sync...");
    return pushJwtWaitRef.current;
  }

  function resolveLegacyJwtWait(token: string | null) {
    if (!pushJwtResolveRef.current) return;
    pushJwtResolveRef.current(token);
  }

  function scheduleTokenExpiry(token: string) {
    if (tokenExpiryRef.current) {
      clearTimeout(tokenExpiryRef.current);
      tokenExpiryRef.current = null;
    }

    const expiryMs = getTokenExpiry(token);
    if (!expiryMs) {
      console.log("[WebView] ⚠️ Could not decode token expiry - no automatic clearing");
      return;
    }

    const scheduleNextCheck = () => {
      const remainingMs = expiryMs - Date.now();
      if (remainingMs <= 0) {
        console.log("[WebView] ⏱️ Token has EXPIRED - clearing storage");
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const ss = require("expo-secure-store");
          ss.deleteItemAsync(CMMS_AUTH_STORAGE_KEY).catch(() => {});
          ss.deleteItemAsync(LEGACY_AUTH_STORAGE_KEY).catch(() => {});
        } catch {}
        void exitToHome();
        return;
      }

      const delay = Math.min(remainingMs, MAX_JS_TIMEOUT_MS);
      tokenExpiryRef.current = setTimeout(scheduleNextCheck, delay);
    };

    const expiryDate = new Date(expiryMs);
    const expiresInSeconds = Math.round((expiryMs - Date.now()) / 1000);
    console.log(`[WebView] ⏰ Token expires in ${expiresInSeconds}s at ${expiryDate.toLocaleString()}`);
    scheduleNextCheck();
  }

  async function readValidStoredToken() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const ss = require("expo-secure-store");
      const cmmsRaw = await ss.getItemAsync(CMMS_AUTH_STORAGE_KEY);
      const legacyRaw = await ss.getItemAsync(LEGACY_AUTH_STORAGE_KEY);
      const tokenRaw = cmmsRaw ?? legacyRaw;
      const token = typeof tokenRaw === "string" ? tokenRaw.trim() : "";

      console.log(
        "[WebView] Read stored token:",
        token ? `${token.substring(0, 24)}...` : "none",
        "from secure storage"
      );
      console.log("[WebView] SecureStore lookup order:", CMMS_AUTH_STORAGE_KEY, "then", LEGACY_AUTH_STORAGE_KEY);

      if (!token) return null;

      const expiry = getTokenExpiry(token);
      if (expiry && expiry <= Date.now()) {
        console.log("[WebView] Stored token already expired, clearing");
        await ss.deleteItemAsync(CMMS_AUTH_STORAGE_KEY).catch(() => {});
        await ss.deleteItemAsync(LEGACY_AUTH_STORAGE_KEY).catch(() => {});
        return null;
      }

      if (cmmsRaw) {
        await ss.setItemAsync(CMMS_AUTH_STORAGE_KEY, token).catch(() => {});
      } else if (legacyRaw) {
        await ss.setItemAsync(LEGACY_AUTH_STORAGE_KEY, token).catch(() => {});
      }

      return token;
    } catch (err) {
      console.log("[WebView] Failed to read token from SecureStore:", err);
      return null;
    }
  }

  async function restoreSavedUrlFromStorage() {
    console.log("[WebView] restoreSavedUrlFromStorage() called");
    if (normalizedProvidedUrlRef.current) {
      console.log("[WebView] Restore skipped because siteUrl param was provided:", normalizedProvidedUrlRef.current);
      return;
    }
    if (currentUrlRef.current && currentUrlRef.current !== sourceUriRef.current) {
      console.log("[WebView] Restore skipped because currentUrl already differs from source:", currentUrlRef.current);
      return;
    }
    if (restoreUrlRef.current) {
      console.log("[WebView] Restore already in progress");
      return restoreUrlRef.current;
    }

    restoreUrlRef.current = (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const AsyncStorageModule = require("@react-native-async-storage/async-storage");
        const AsyncStorage = AsyncStorageModule?.default || AsyncStorageModule;
        if (!AsyncStorage) {
          console.log("[WebView] AsyncStorage not available - skipping URL restore");
          return;
        }

        const storageKey = `webview_url_${STORAGE_SCOPE}`;
        console.log("[WebView] Looking for last visit URL in storage key:", storageKey);
        const token = await readValidStoredToken();
        if (!token) {
          console.log("[WebView] No token found yet, deferring URL restore");
          return;
        }

        const savedUrl = await AsyncStorage.getItem(storageKey);
        console.log("[WebView] Raw saved URL from storage:", savedUrl || "none");
        const normalizedSavedUrl = normalizeUrl(savedUrl);
        console.log("[WebView] Normalized saved URL:", normalizedSavedUrl || "none");
        if (!normalizedSavedUrl) {
          console.log("[WebView] No saved URL to restore");
          return;
        }

        console.log("[WebView] Token valid, restored URL from storage:", normalizedSavedUrl);
        console.log("[WebView] Setting initialUrl/currentUrl to restored URL");
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
    let mounted = true;

    (async () => {
      console.log("[WebView] Session bootstrap started");
      const storedToken = await readValidStoredToken();
      console.log(
        "[WebView] Bootstrap token loaded from SecureStore:",
        storedToken ? `${storedToken.substring(0, 24)}...` : "none"
      );
      if (mounted) {
        setBootstrapAuthToken(storedToken);
      }

      await restoreSavedUrlFromStorage();
      await postAuthToken();
      console.log("[WebView] Session bootstrap complete");
      if (mounted) setIsSessionHydrated(true);
    })().catch(() => {
      console.log("[WebView] Session bootstrap failed");
      if (mounted) setIsSessionHydrated(true);
    });

    return () => {
      mounted = false;
    };
  }, [normalizedProvidedUrl, sourceUri]);

  async function maybeReloadIfWebsiteChanged(targetUrl: string = currentUrl || sourceUri) {
    if (versionProbeRef.current) {
      console.log("[WebView] Version probe already running");
      return versionProbeRef.current;
    }

    versionProbeRef.current = (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const AsyncStorageModule = require("@react-native-async-storage/async-storage");
        const AsyncStorage = AsyncStorageModule?.default || AsyncStorageModule;

        if (!AsyncStorage) return;

        const versionKey = `webview_remote_version_${STORAGE_SCOPE}`;
        console.log("[WebView] Checking remote version using source URI:", sourceUri);
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
          console.log("[WebView] No remote fingerprint found; skipping reload check");
          return;
        }

        const previousFingerprint = await AsyncStorage.getItem(versionKey);
        console.log("[WebView] Remote fingerprint:", fingerprint);
        console.log("[WebView] Previous remote fingerprint:", previousFingerprint || "none");
        if (previousFingerprint && previousFingerprint !== fingerprint) {
          const refreshUrl = addCacheBuster(targetUrl, fingerprint);
          console.log("[WebView] Website changed, reloading with cache buster:", refreshUrl);
          setInitialUrl(refreshUrl);
          setCurrentUrl(refreshUrl);
        } else {
          console.log("[WebView] Website fingerprint unchanged; keeping current URL");
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
      clearWebViewAuthState();

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const AsyncStorageModule = require("@react-native-async-storage/async-storage");
      const AsyncStorage = AsyncStorageModule?.default || AsyncStorageModule;
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const SecureStore = require("expo-secure-store");

      if (!AsyncStorage) return;

      await AsyncStorage.removeItem("webview_last_state");
      await AsyncStorage.removeItem(`webview_url_${STORAGE_SCOPE}`);
      await AsyncStorage.removeItem(`webview_remote_version_${STORAGE_SCOPE}`);
      await SecureStore.deleteItemAsync(CMMS_AUTH_STORAGE_KEY).catch(() => {});
      await SecureStore.deleteItemAsync(LEGACY_AUTH_STORAGE_KEY).catch(() => {});
    } catch (err) {
      console.log("[WebView] Failed to clear saved launch state:", err);
    }
  }

  async function exitToHome() {
    setPreventRemove(false);
    clearPushSyncRetry();
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
        
        const storageKey = `webview_url_${STORAGE_SCOPE}`;
        console.log("[WebView] Saving current URL to storage:", normalizeUrl(currentUrl));
        AsyncStorage.setItem(storageKey, normalizeUrl(currentUrl)).catch((err: any) =>
          console.log("[WebView] Failed to save URL:", err)
        );
        AsyncStorage.setItem(
          "webview_last_state",
          JSON.stringify({
            mode: STORAGE_SCOPE,
            url: normalizeUrl(currentUrl),
            updatedAt: Date.now(),
          })
        ).catch((err: any) => console.log("[WebView] Failed to save last state:", err));
      } catch (err) {
        console.log("[WebView] AsyncStorage not available:", err);
      }
    }
  }, [currentUrl]);

  usePreventRemove(preventRemove, () => {
    // Keep the WebView pinned in place until an explicit logout or token expiry.
  });

  function handleBackNavigation() {
    // Block system back while the session is still active.
    return true;
  }

  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", handleBackNavigation);

    return () => {
      backHandler.remove();
    };
  }, []);

  async function postAuthToken() {
    try {
      console.log("[WebView] postAuthToken() called");
      const token = await readValidStoredToken();

      if (!token) {
        console.log("[WebView] No token to post");
        return;
      }

      console.log("[WebView] Posting token into WebView");
      clearPushSyncRetry();
      scheduleTokenExpiry(token);
      deliverTokenToWebView(token);
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

      let storedAuthToken = authToken ?? (await SecureStore.getItemAsync(LEGACY_AUTH_STORAGE_KEY));
      console.log(
        "[Push] Legacy JWT selected for push sync:",
        storedAuthToken ? `${String(storedAuthToken).substring(0, 24)}...` : "none",
        authToken ? "from argument" : "from SecureStore"
      );
      if (!storedAuthToken) {
        storedAuthToken = await waitForLegacyJwtToken(SecureStore);
        console.log(
          "[Push] Legacy JWT selected for push sync after wait:",
          storedAuthToken ? `${String(storedAuthToken).substring(0, 24)}...` : "none"
        );
        if (!storedAuthToken) {
          console.log("[Push] Legacy JWT wait ended without a token; push sync paused");
          return;
        }
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

      const storageKey = `expo_push_token_sent_${STORAGE_SCOPE}`;
      const ownerKey = `expo_push_token_owner_${STORAGE_SCOPE}`;
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
      console.log("[Push] Payload preview:", { expoPushToken: expoPushToken ? expoPushToken.substring(0, 16) + '...' : null, platform: Platform.OS, mode: STORAGE_SCOPE });
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${storedAuthToken}`,
        },
        body: JSON.stringify({
          expoPushToken,
          platform: Platform.OS,
          mode: STORAGE_SCOPE,
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
      clearPushSyncRetry();
      console.log("[Push] Expo push token synced to backend");
    } catch (err) {
      console.log("[Push] Error syncing Expo push token:", err);
    }
  }

  useEffect(() => {
    // Post stored token when screen mounts and when app returns to foreground
    console.log("[WebView] Initial auth/push bootstrap running");
    postAuthToken();
    void syncExpoPushTokenToBackend();
    void maybeReloadIfWebsiteChanged();
    const sub = AppState.addEventListener("change", (state) => {
      console.log("[WebView] AppState changed:", state);
      if (state === "active") {
        console.log("[WebView] App became active - refreshing token, push sync, and last URL");
        postAuthToken();
        void syncExpoPushTokenToBackend();
        void restoreSavedUrlFromStorage();
        void maybeReloadIfWebsiteChanged();
      }
    });

    return () => {
      isMountedRef.current = false;
      resolveLegacyJwtWait(null);
      try { sub.remove(); } catch { /* ignore older RN */ }
      if (tokenExpiryRef.current) clearTimeout(tokenExpiryRef.current);
      clearPushSyncRetry();
    };
  }, []);

  if (!isSessionHydrated) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: bgColor }]} edges={["top", "bottom"]}>
        <StatusBar style={statusBarStyle} backgroundColor={bgColor} translucent={false} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bgColor }]} edges={["top", "bottom"]}>
      <StatusBar style={statusBarStyle} backgroundColor={bgColor} translucent={false} />
      <WebView
        ref={webviewRef}
        source={{ uri: initialUrl }}
        containerStyle={styles.webviewContainer}
        style={styles.webview}
        onNavigationStateChange={(navState) => {
          const nextUrl = normalizeUrl(navState.url);
          if (nextUrl && nextUrl !== sourceUri && nextUrl !== currentUrl) {
            console.log("[WebView] Navigation state changed to:", nextUrl);
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
        injectedJavaScriptBeforeContentLoaded={buildBeforeContentJavaScript(bootstrapAuthToken)}
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

            const candidateToken =
              extractTokenFromPayload(data) ||
              (typeof data.token === "string" && data.token) ||
              (typeof data.jwt === "string" && data.jwt) ||
              (typeof data.access_token === "string" && data.access_token) ||
              (typeof data.authToken === "string" && data.authToken) ||
              (typeof data.auth_token === "string" && data.auth_token) ||
              (typeof data.legacy_jwt === "string" && data.legacy_jwt) ||
              (typeof data.cmms_auth_token === "string" && data.cmms_auth_token) ||
              "";

            const tokenType = typeof data.type === "string" ? data.type.toLowerCase() : "";
            const tokenLooksValid = typeof candidateToken === "string" && candidateToken.length > 20 && candidateToken.includes(".");

            if (
              tokenLooksValid &&
              (
                tokenType === "auth" ||
                tokenType === "token" ||
                tokenType === "token_ready" ||
                tokenType === "jwt" ||
                tokenType === "legacy_jwt" ||
                tokenType === "access_token" ||
                tokenType === "auth_token" ||
                tokenType === "cmms_token" ||
                tokenType === "cmms_auth_token" ||
                tokenType === "tokenreceived" ||
                tokenType === "token_received" ||
                tokenType === ""
              )
            ) {
              console.log("[WebView] 🔐 AUTH TOKEN RECEIVED from page:", candidateToken.substring(0, 30) + "...");
              console.log("[WebView] Page token length:", candidateToken.length);
              console.log("[WebView] Auth token source:", data.source || data.type || "unknown");

              const expiryMs = getTokenExpiry(candidateToken);
              if (expiryMs && expiryMs <= Date.now()) {
                console.log("[WebView] ⛔ Ignoring expired auth token from page");
                clearWebViewAuthState();
                void exitToHome();
                return;
              }

              scheduleTokenExpiry(candidateToken);
              
              // Save the token into the matching secure storage key so CMMS auth and legacy push auth stay separate.
              try {
                // runtime require to avoid static resolution issues
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const ss = require("expo-secure-store");
                const source = typeof data.source === "string" ? data.source.toLowerCase() : "";
                const looksLegacy = source.includes("jwt") || source.includes("legacy") || data.type === "TOKEN";
                const looksCmms = source.includes("cmms_auth_token") || source.includes("cmms");
                const saveLegacy = looksLegacy || !looksCmms;
                const saveCmms = looksCmms || !looksLegacy;
                console.log("[WebView] Saving auth token to SecureStore keys:", { saveLegacy, saveCmms });
                Promise.all([
                  saveLegacy ? ss.setItemAsync(LEGACY_AUTH_STORAGE_KEY, candidateToken) : Promise.resolve(),
                  saveCmms ? ss.setItemAsync(CMMS_AUTH_STORAGE_KEY, candidateToken) : Promise.resolve(),
                ]).then(() => {
                  if (saveCmms) {
                    setBootstrapAuthToken(candidateToken);
                  }
                  clearPushSyncRetry();
                  if (saveLegacy) {
                    resolveLegacyJwtWait(candidateToken);
                  }
                  console.log("[WebView] ✅ Token SAVED to SecureStore successfully");
                  void restoreSavedUrlFromStorage();
                  if (saveLegacy) {
                    void syncExpoPushTokenToBackend(candidateToken);
                  } else {
                    void syncExpoPushTokenToBackend();
                  }
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
              const url = typeof data.url === "string" ? data.url : "";
              const nextUrl = normalizeUrl(url);
              console.log("[WebView] Route message received:", nextUrl || "none");
              if (nextUrl && nextUrl !== currentUrl) {
                setCurrentUrl(nextUrl);
              }
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
});
