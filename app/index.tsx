import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Linking, useColorScheme } from "react-native";
import { StatusBar, StatusBarStyle } from "expo-status-bar";
import { WebView } from "react-native-webview";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Home() {
  const webviewRef = useRef<any>(null);
  const baseUrl = "http://localhost:5173/";
  const [url, setUrl] = useState(`${baseUrl}?_=${Date.now()}`);
  const systemScheme = useColorScheme();

  // Theme state - synced from web app
  const [bgColor, setBgColor] = useState(systemScheme === "dark" ? "#071018" : "#ffffff");
  const [statusBarStyle, setStatusBarStyle] = useState<StatusBarStyle>(systemScheme === "dark" ? "light" : "dark");

  useEffect(() => {
    // Try to clear native WebView cache if available, then force a fresh URL
    try {
      if (webviewRef.current && typeof webviewRef.current.clearCache === "function") {
        webviewRef.current.clearCache(true);
      }
    } catch (e) {
      // ignore if not supported on platform
    }
    // Update URL with a timestamp to bypass service-worker and HTTP caches
    setUrl(`${baseUrl}?_=${Date.now()}`);
  }, []);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bgColor }]} edges={["top", "bottom"]}>
      <StatusBar style={statusBarStyle} backgroundColor={bgColor} translucent={false} />
      <WebView
        ref={webviewRef}
        // source={{ uri: "https://7s6i6.sentinel.lk/" }}
        source={{ uri: "http://localhost:5173/" }}
        style={styles.webview}
        cacheEnabled={false}
        incognito={true}
        sharedCookiesEnabled={false}
        startInLoadingState={true}
        javaScriptEnabled={true}
        originWhitelist={["*"]}
        onShouldStartLoadWithRequest={(request) => {
          const url: string = request.url || "";
          if (url.startsWith("http://") || url.startsWith("https://")) {
            return true;
          }
          Linking.canOpenURL(url).then((supported) => {
            if (supported) Linking.openURL(url);
          });
          return false;
        }}
        injectedJavaScriptBeforeContentLoaded={"(function(){window.__rn_injected=true;})();"}
        injectedJavaScript={`(function() {
          function send(url) { try{ window.ReactNativeWebView.postMessage(JSON.stringify({type:'open', url: url})); } catch(e){}
          }
          var _open = window.open;
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
            console.log('[RN] Received message:', data);

            // Handle theme messages from web app
            if (data.type === 'theme' && data.scheme) {
              console.log('[RN] Theme changed to:', data.scheme);
              const scheme = data.scheme;
              
              // Delay color change by  seconds to allow web app transition to complete
              setTimeout(() => {
                if (scheme === 'dark') {
                  console.log('[RN] Setting dark mode - bg: #000000, status bar: light');
                  setBgColor('#000000f5');
                  setStatusBarStyle('light');
                } else {
                  console.log('[RN] Setting light mode - bg: #ffffff, status bar: dark');
                  setBgColor('#ffffff');
                  setStatusBarStyle('dark');
                }
              }, 120); // 184.5ms delay to ensure smooth transition
              return;
            }

            // Handle link opens
            const url = data?.url;
            if (url) {
              Linking.canOpenURL(url).then((supported) => {
                if (supported) Linking.openURL(url);
              });
            }
          } catch (e) {
            console.log('[RN] Message error:', e);
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
