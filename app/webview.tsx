import React, { useEffect, useRef, useState } from "react";
import { AppState, Linking, Pressable, StyleSheet, Text, useColorScheme } from "react-native";
import { StatusBar, StatusBarStyle } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import WebView from "react-native-webview";
import { useLocalSearchParams, useRouter } from "expo-router";

type Mode = "monitoring" | "maintainance";

function getSourceUri(mode: string | string[] | undefined) {
  const normalizedMode = Array.isArray(mode) ? mode[0] : mode;
  if (normalizedMode === "maintainance") {
    return "https://cmms.sentinel.lk/cmms";
  }

  return "http://localhost:5173/";
}

function isLoginRoute(url: string | undefined) {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return parsed.pathname === "/login";
  } catch {
    return url.includes("/login");
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

export default function WebviewScreen() {
  const webviewRef = useRef<any>(null);
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: Mode }>();
  const sourceUri = getSourceUri(mode);
  const systemScheme = useColorScheme();

  const normalizedMode = Array.isArray(mode) ? mode[0] : mode;
  const isMaintainance = normalizedMode === "maintainance";
  const isMonitoring = normalizedMode === "monitoring" || !isMaintainance;

  // oklch(0.145 0 0) → #171717 (React Native does not support oklch in StyleSheet)
  const [bgColor, setBgColor] = useState(isMaintainance || isMonitoring ? "#171717" : systemScheme === "dark" ? "#071018" : "#ffffff");
  const [statusBarStyle, setStatusBarStyle] = useState<StatusBarStyle>(isMaintainance || isMonitoring ? "light" : systemScheme === "dark" ? "light" : "dark");
  const [canGoBack, setCanGoBack] = useState(false);
  const [showBackButton, setShowBackButton] = useState(isLoginRoute(sourceUri));
  const tokenExpiryRef = useRef<NodeJS.Timeout | number | null>(null);

  function handleBackPress() {
    if (canGoBack && webviewRef.current && typeof webviewRef.current.goBack === "function") {
      webviewRef.current.goBack();
      return;
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.push("/");
  }

  useEffect(() => {
    try {
      if (webviewRef.current && typeof webviewRef.current.clearCache === "function") {
        webviewRef.current.clearCache(true);
      }
    } catch {
      // Ignore if clearCache is unavailable for this platform/version.
    }
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

  useEffect(() => {
    // Post stored token when screen mounts and when app returns to foreground
    postAuthToken();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") postAuthToken();
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
        source={{ uri: sourceUri }}
        style={styles.webview}
        onNavigationStateChange={(navState) => {
          setCanGoBack(Boolean(navState.canGoBack));
          setShowBackButton(isLoginRoute(navState.url));
        }}
        cacheEnabled={false}
        incognito={true}
        sharedCookiesEnabled={false}
        domStorageEnabled={true}
        startInLoadingState={true}
        javaScriptEnabled={true}
        originWhitelist={["*"]}
        onShouldStartLoadWithRequest={(request) => {
          const requestedUrl: string = request.url || "";
          if (requestedUrl.startsWith("http://") || requestedUrl.startsWith("https://")) {
            return true;
          }
          Linking.canOpenURL(requestedUrl).then((supported) => {
            if (supported) Linking.openURL(requestedUrl);
          });
          return false;
        }}
        injectedJavaScriptBeforeContentLoaded={`${getForceDarkScript()}(function(){window.__rn_injected=true; if(window.addEventListener){window.addEventListener('message', function(ev){ try{ var d = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data; console.log('[RN-Auth] Received message:', d); if(d && d.type === 'auth' && d.token){ console.log('[RN-Auth] Token received:', d.token.substring(0, 20) + '...'); try{ localStorage.setItem('jwt', d.token); console.log('[RN-Auth] Token saved to localStorage'); }catch(e){ console.error('[RN-Auth] Failed to save to localStorage:', e); } try{ window.dispatchEvent(new CustomEvent('rn-auth',{detail:d.token})); console.log('[RN-Auth] Event dispatched'); }catch(e){ console.error('[RN-Auth] Failed to dispatch event:', e); } } }catch(e){ console.error('[RN-Auth] Error processing message:', e); } }); }})();`}
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
                  // Optionally notify the page to redirect to login
                  webviewRef.current?.postMessage(JSON.stringify({ type: "token_expired" }));
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
                }).catch((err: any) => {
                  console.log("[WebView] ❌ Failed saving token to SecureStore:", err);
                });
              } catch (err) {
                console.log("[WebView] ❌ SecureStore require failed:", err);
              }
              return;
            }

            if (data.type === "theme" && data.scheme) {
              // CMMS safe area is always locked to oklch(0.145 0 0) → #171717
              if (isMaintainance) return;
              setTimeout(() => {
                if (data.scheme === "dark") {
                  setBgColor("#000000f5");
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
              setShowBackButton(path === "/login" || isLoginRoute(url));
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

            const openedUrl = data?.url;
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
  safe: { flex: 1, backgroundColor: "#071018", padding: 0, margin: 0 },
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
  webview: { flex: 1 },
});
