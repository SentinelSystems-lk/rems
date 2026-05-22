import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View, Animated, Easing } from "react-native";
import { useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";

function getSourceUri(mode: string) {
  return mode === "maintainance" ? "https://cmms.sentinel.lk/cmms" : "https://7s6i6.sentinel.lk/";
}

function getVersionFileUrl(mode: string) {
  const sourceUri = getSourceUri(mode);
  try {
    return new URL("version.json", sourceUri.endsWith("/") ? sourceUri : `${sourceUri}/`).toString();
  } catch {
    return `${sourceUri}version.json`;
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
  const [ready, setReady] = useState(false);

  // Animation refs for splash polish
  const shellOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.98)).current;
  const loaderTranslate = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const mode = "monitoring";
      const versionKey = `webview_site_version_${mode}`;
      const versionUrl = getVersionFileUrl(mode);

      

      try {
        const AsyncStorage = await loadStorage();
        const siteVersion = await readVersionFile(versionUrl);

        if (siteVersion) {
          const previousVersion = await AsyncStorage.getItem(versionKey);
          if (previousVersion !== siteVersion) {
            await AsyncStorage.setItem(versionKey, siteVersion);
          }
        }

        if (!cancelled) {
          router.replace({ pathname: "/webview", params: { mode, ...(siteVersion ? { siteVersion } : {}) } });
          setReady(true);
          await SplashScreen.hideAsync().catch(() => {});
        }
      } catch (err) {
        if (!cancelled) {
          router.replace({ pathname: "/webview", params: { mode } });
          setReady(true);
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

  if (ready) return null;

  return (
    <View style={styles.loading}>
      <StatusBar style="light" backgroundColor="#000000" />
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <Animated.View style={[styles.brandShell, { opacity: shellOpacity, transform: [{ translateY: shellOpacity.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
        <Animated.View style={[styles.logoFrame, { transform: [{ scale: logoScale }] }]}>
          <Image
            source={require("../assets/images/Logo/logo.png")}
            resizeMode="contain"
            style={styles.logo}
          />
        </Animated.View>

        <Text style={styles.title}>InsightsPV</Text>
        <Text style={styles.subtitle}>Renewable Energy Management System</Text>

        <Animated.View style={[styles.loaderRow, { transform: [{ translateY: loaderTranslate }] }]}>
          <ActivityIndicator size="small" color="#4ef27f" />
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
  glowTop: {
    position: "absolute",
    top: -140,
    left: -90,
    width: 300,
    height: 300,
    borderRadius: 300,
    backgroundColor: "rgba(78, 242, 127, 0.12)",
    opacity: 0.85,
  },
  glowBottom: {
    position: "absolute",
    right: -120,
    bottom: -130,
    width: 320,
    height: 320,
    borderRadius: 320,
    backgroundColor: "rgba(82, 77, 220, 0.14)",
    opacity: 0.9,
  },
  brandShell: {
    width: "86%",
    maxWidth: 460,
    alignItems: "center",
    paddingVertical: 34,
    paddingHorizontal: 26,
    borderRadius: 28,
    backgroundColor: "rgba(10, 12, 14, 0.75)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
  },
  logoFrame: {
    width: 156,
    height: 156,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    marginBottom: 22,
  },
  logo: {
    width: 120,
    height: 120,
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
    marginTop: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  loaderText: {
    color: "rgba(244, 247, 251, 0.9)",
    fontSize: 13,
    fontWeight: "500",
  },
});
