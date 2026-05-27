import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View, Animated, Easing, Pressable } from "react-native";
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

function normalizeUrl(url: string | null | undefined) {
  if (typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";

  const embeddedHttpMatch = trimmed.match(/https?:\/\/{1,2}.*/i);
  const normalized = embeddedHttpMatch ? embeddedHttpMatch[0] : trimmed;

  if (normalized.startsWith("http:/") && !normalized.startsWith("http://")) {
    return normalized.replace(/^http:\//, "http://");
  }

  if (normalized.startsWith("https:/") && !normalized.startsWith("https://")) {
    return normalized.replace(/^https:\//, "https://");
  }

  return normalized;
}

type SavedLaunchState = {
  mode?: string;
  url?: string;
};

async function readSavedLaunchState(AsyncStorage: any) {
  const lastState = parseSavedLaunchState(await AsyncStorage.getItem("webview_last_state"));
  if (lastState?.url) {
    return lastState;
  }

  const monitoringUrl = normalizeUrl(await AsyncStorage.getItem("webview_url_monitoring"));
  if (monitoringUrl) {
    return { mode: "monitoring", url: monitoringUrl };
  }

  const maintenanceUrl = normalizeUrl(await AsyncStorage.getItem("webview_url_maintainance"));
  if (maintenanceUrl) {
    return { mode: "maintainance", url: maintenanceUrl };
  }

  return null;
}

function parseSavedLaunchState(raw: string | null): SavedLaunchState | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    return {
      mode: typeof parsed.mode === "string" ? parsed.mode : undefined,
      url: typeof parsed.url === "string" ? parsed.url : undefined,
    };
  } catch {
    return null;
  }
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
      const defaultMode = "monitoring";
      const versionKey = `webview_site_version_${defaultMode}`;
      const versionUrl = getVersionFileUrl(defaultMode);

      try {
        const AsyncStorage = await loadStorage();
        const siteVersion = await readVersionFile(versionUrl);
        const savedLaunchState = await readSavedLaunchState(AsyncStorage);
        const launchMode = savedLaunchState?.mode === "maintainance" ? "maintainance" : "monitoring";

        if (siteVersion) {
          const previousVersion = await AsyncStorage.getItem(versionKey);
          if (previousVersion !== siteVersion) {
            await AsyncStorage.setItem(versionKey, siteVersion);
          }
        }

        if (savedLaunchState?.url) {
          router.replace({ pathname: "/webview", params: { mode: launchMode, siteUrl: savedLaunchState.url } });
          if (!cancelled) {
            await SplashScreen.hideAsync().catch(() => {});
          }
          return;
        }

        if (!cancelled) {
          setReady(true);
          await SplashScreen.hideAsync().catch(() => {});
        }
      } catch (err) {
        if (!cancelled) {
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

  if (ready) {
    return (
      <View style={styles.selectorContainer}>
        <StatusBar style="light" backgroundColor="#000000" />

        <View style={styles.brandShellSmall}>
          <Image source={require("../assets/images/Logo/logo.png")} resizeMode="contain" style={styles.logoSmall} />
          {/* <Text style={styles.titleSmall}>InsightsPV</Text> */}
          <Text style={styles.subtitleSmall}>Renewable Energy Management</Text>

          <View style={styles.buttonRow}>
            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
              onPress={() => router.replace({ pathname: "/webview", params: { mode: "monitoring" } })}
            >
              <Text style={styles.primaryText}>Monitoring</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
              onPress={() => router.replace({ pathname: "/webview", params: { mode: "maintainance" } })}
            >
              <Text style={styles.secondaryText}>Technician</Text>
            </Pressable>
          </View>

          {/* <Text style={styles.hintText}>Secure session will be prepared after you choose a view.</Text> */}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.loading}>
      <StatusBar style="light" backgroundColor="#000000" />
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <Animated.View style={[styles.brandShell, { opacity: shellOpacity, transform: [{ translateY: shellOpacity.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
        <Animated.Image
          source={require("../assets/images/Logo/logo.png")}
          resizeMode="contain"
          style={[styles.logo, { transform: [{ scale: logoScale }] }]}
        />

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
  logo: {
    width: 160,
    height: 160,
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
  selectorContainer: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
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
  brandShellSmall: {
    width: "86%",
    maxWidth: 520,
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: "rgba(10, 12, 14, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 6,
  },
  logoSmall: {
    width: 200,
    height: 200,
  },
  titleSmall: {
    color: "#f7fbff",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 6,
    textAlign: "center",
  },
  subtitleSmall: {
    color: "rgba(228, 233, 241, 0.7)",
    fontSize: 13,
    marginBottom: 18,
    textAlign: "center",
    maxWidth: 340,
  },
  buttonRow: {
    width: "100%",
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
    marginBottom: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: "#4ef27f",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginHorizontal: 6,
  },
  primaryText: {
    color: "#05220a",
    fontWeight: "700",
    fontSize: 15,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(231, 241, 237, 0.08)",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginHorizontal: 6,
  },
  secondaryText: {
    color: "#eaf3ff",
    fontWeight: "700",
    fontSize: 15,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  hintText: {
    color: "rgba(234,243,255,0.6)",
    fontSize: 12,
    marginTop: 6,
    textAlign: "center",
  },
});
