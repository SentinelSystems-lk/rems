import { useEffect } from "react";
import { useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { loadSession } from "./lib/auth";

export default function IndexScreen() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const session = await loadSession();
      if (cancelled) return;
      router.replace(session?.authToken ? "/pages/plantlist" : "/pages/login");
      await SplashScreen.hideAsync().catch(() => {});
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
