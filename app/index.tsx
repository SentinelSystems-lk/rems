import { useEffect, useRef } from "react";
import { ActivityIndicator, StyleSheet, Text, View, Animated, Easing } from "react-native";
import { useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";

const APP_URL = "http://localhost:5173/";
// const APP_URL = "https://7s6i6.sentinel.lk/";

function getVersionFileUrl() {
  try {
    return new URL("version.json", APP_URL.endsWith("/") ? APP_URL : `${APP_URL}/`).toString();
  } catch {
    return `${APP_URL}version.json`;
  }
}

async function readVersionFile(versionUrl: string) {
  try {
    const response = await fetch(versionUrl, { cache: "no-store" });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await response.json().catch(() => null);
      if (data && typeof data.version === "string") return data.version.trim();
    }
    const text = (await response.text()).trim();
    if (!text) return null;
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed.version === "string") return parsed.version.trim();
    } catch {}
    return text;
  } catch {
    return null;
  }
}

async function loadStorage() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const AsyncStorageModule = require("@react-native-async-storage/async-storage");
  return AsyncStorageModule?.default || AsyncStorageModule;
}

export default function Home() {
  const router = useRouter();

  // Animation refs for splash polish
  const shellOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.98)).current;
  const loaderTranslate = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const versionKey = "webview_site_version";
      const versionUrl = getVersionFileUrl();

      try {
        const AsyncStorage = await loadStorage();
        const siteVersion = await readVersionFile(versionUrl);

        if (siteVersion) {
          const previousVersion = await AsyncStorage.getItem(versionKey);
          if (previousVersion !== siteVersion) {
            await AsyncStorage.setItem(versionKey, siteVersion);
          }
        }

        router.replace("/webview");
        if (!cancelled) {
          await SplashScreen.hideAsync().catch(() => {});
        }
      } catch {
        router.replace("/webview");
        if (!cancelled) {
          await SplashScreen.hideAsync().catch(() => {});
        }
      }
    }

    void bootstrap();

    return () => { cancelled = true; };
  }, [router]);

  useEffect(() => {
    // run splash animations once
    Animated.sequence([
      Animated.timing(shellOpacity, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, friction: 7, tension: 120, useNativeDriver: true }),
        Animated.timing(loaderTranslate, { toValue: 0, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
    ]).start();

    // gentle pulsing loop for logo
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(logoScale, { toValue: 1.03, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(logoScale, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    pulse.start();

    return () => pulse.stop();
  }, [shellOpacity, logoScale, loaderTranslate]);

  return (
    <View style={styles.loading}>
      <StatusBar style="light" backgroundColor="#000000" />

      <Animated.View style={[styles.brandShell, { opacity: shellOpacity, transform: [{ translateY: shellOpacity.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
        <Animated.Image
          source={require("../assets/images/Logo/logo.png")}
          resizeMode="contain"
          style={[styles.logo, { transform: [{ scale: logoScale }] }]}
        />

        <Animated.View style={[styles.loaderRow, { transform: [{ translateY: loaderTranslate }] }]}>
          <ActivityIndicator size="small" color="#344DB9" />
          <Text style={styles.loaderText}>Preparing secure session</Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  brandShell: {
    width: "96%",
    maxWidth: 1200,
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  logo: {
    width: "100%",
    maxWidth: 1150,
    height: 210,
  },
  title: {
    color: "#f7fbff",
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "700",
    letterSpacing: 0.4,
    textAlign: "center",
  },
  subtitle: {
    marginTop: 6,
    color: "rgba(228, 233, 241, 0.7)",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    maxWidth: 300,
  },
  loaderRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
  },
  loaderText: {
    color: "rgba(255, 255, 255, 0.86)",
    fontSize: 13,
    fontWeight: "500",
  },
});
