import React, { useEffect, useRef, useState } from "react";
import { Linking, StyleSheet } from "react-native";
import { StatusBar, StatusBarStyle } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import WebView from "react-native-webview";
import { useLocalSearchParams } from "expo-router";

type Mode = "monitoring" | "maintainance";

function getSourceUri(mode: string | string[] | undefined) {
  const normalizedMode = Array.isArray(mode) ? mode[0] : mode;
  if (normalizedMode === "maintainance") {
    return "https://cmms.sentinel.lk/cmms";
  }

  return "https://7s6i6.sentinel.lk/";
}

function getInjectedJavaScript(mode: string | string[] | undefined) {
  const normalizedMode = Array.isArray(mode) ? mode[0] : mode;
  const forceDarkForCmms = normalizedMode === "maintainance";

  return `(function() {
    function send(url) {
      try {
        window.ReactNativeWebView.postMessage(JSON.stringify({type:'open', url: url}));
      } catch (e) {}
    }

    ${forceDarkForCmms ? `
    try {
      var style = document.createElement('style');
      style.setAttribute('id', 'rn-force-dark-theme');
      style.textContent = \
        "*{transition:background-color 0.12s ease,color 0.12s ease,border-color 0.12s ease;}" +
        ":root{--background:#FFFFFF;--foreground:#0F1117;--card:#ffffff;--card-foreground:#0F1117;--popover:#F8F9FA;--popover-foreground:#0F1117;--primary:#3B82F6;--primary-foreground:#FFFFFF;--secondary:#E5E7EB;--secondary-foreground:#0F1117;--muted:#F3F4F6;--muted-foreground:#64748B;--accent:#E5E7EB;--accent-foreground:#0F1117;--destructive:#EF4444;--destructive-foreground:#FFFFFF;--border:#E5E7EB;--input:#FFFFFF;--input-background:#FFFFFF;--switch-background:#E5E7EB;--ring:#3B82F6;}" +
        ".dark{--background:oklch(0.145 0 0);--foreground:oklch(0.985 0 0);--card:oklch(0.145 0 0);--card-foreground:oklch(0.985 0 0);--popover:oklch(0.145 0 0);--popover-foreground:oklch(0.985 0 0);--primary:oklch(0.985 0 0);--primary-foreground:oklch(0.205 0 0);--secondary:oklch(0.269 0 0);--secondary-foreground:oklch(0.985 0 0);--muted:oklch(0.269 0 0);--muted-foreground:oklch(0.708 0 0);--accent:oklch(0.269 0 0);--accent-foreground:oklch(0.985 0 0);--destructive:oklch(0.396 0.141 25.723);--destructive-foreground:oklch(0.637 0.237 25.331);--border:oklch(0.269 0 0);--input:oklch(0.269 0 0);--input-background:var(--card);--ring:oklch(0.439 0 0);--sidebar-destructive:#F87171;}" +
        "html,body{background:var(--background)!important;color:var(--foreground)!important;color-scheme:dark;}";
      var root = document.documentElement;
      if (!document.getElementById('rn-force-dark-theme')) {
        document.head.appendChild(style);
      }
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
      document.body && (document.body.style.backgroundColor = 'var(--background)');
    } catch (e) {}
    ` : ""}

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
  })();`;
}

export default function WebviewScreen() {
  const webviewRef = useRef<any>(null);
  const { mode } = useLocalSearchParams<{ mode?: Mode }>();
  const sourceUri = getSourceUri(mode);
  const normalizedMode = Array.isArray(mode) ? mode[0] : mode;
  const isMaintainance = normalizedMode === "maintainance";

  const [bgColor, setBgColor] = useState("#0f1117");
  const [statusBarStyle, setStatusBarStyle] = useState<StatusBarStyle>("light");

  useEffect(() => {
    try {
      if (webviewRef.current && typeof webviewRef.current.clearCache === "function") {
        webviewRef.current.clearCache(true);
      }
    } catch {
      // Ignore if clearCache is unavailable for this platform/version.
    }
  }, []);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bgColor }]} edges={["top", "bottom"]}>
      <StatusBar style={statusBarStyle} backgroundColor={bgColor} translucent={false} />
      <WebView
        ref={webviewRef}
        source={{ uri: sourceUri }}
        style={styles.webview}
        cacheEnabled={false}
        incognito={true}
        sharedCookiesEnabled={false}
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
        injectedJavaScriptBeforeContentLoaded={"(function(){window.__rn_injected=true;})();"}
        injectedJavaScript={getInjectedJavaScript(mode)}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);

            if (data.type === "theme" && data.scheme) {
              if (isMaintainance) {
                setBgColor("#0f1117");
                setStatusBarStyle("light");
                return;
              }

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

            const openedUrl = data?.url;
            if (openedUrl) {
              Linking.canOpenURL(openedUrl).then((supported) => {
                if (supported) Linking.openURL(openedUrl);
              });
            }
          } catch {
            // Ignore invalid messages from webview content.
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0f1117", padding: 0, margin: 0 },
  webview: { flex: 1 },
});
