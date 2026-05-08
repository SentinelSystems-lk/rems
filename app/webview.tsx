import React, { useEffect, useRef, useState } from "react";
import { Linking, StyleSheet, useColorScheme } from "react-native";
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

export default function WebviewScreen() {
  const webviewRef = useRef<any>(null);
  const { mode } = useLocalSearchParams<{ mode?: Mode }>();
  const sourceUri = getSourceUri(mode);
  const systemScheme = useColorScheme();

  const normalizedMode = Array.isArray(mode) ? mode[0] : mode;
  const isMaintainance = normalizedMode === "maintainance";

  // oklch(0.145 0 0) → #171717 (React Native does not support oklch in StyleSheet)
  const [bgColor, setBgColor] = useState(isMaintainance ? "#171717" : systemScheme === "dark" ? "#071018" : "#ffffff");
  const [statusBarStyle, setStatusBarStyle] = useState<StatusBarStyle>(isMaintainance ? "light" : systemScheme === "dark" ? "light" : "dark");

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
        injectedJavaScript={`(function() {
          function send(url) {
            try {
              window.ReactNativeWebView.postMessage(JSON.stringify({type:'open', url: url}));
            } catch (e) {}
          }
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
  safe: { flex: 1, backgroundColor: "#071018", padding: 0, margin: 0 },
  webview: { flex: 1 },
});
