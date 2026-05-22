import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";

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

  if (ready) return null;

  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color="#ffffff" />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: "#0b0b0b",
    alignItems: "center",
    justifyContent: "center",
  },
});
