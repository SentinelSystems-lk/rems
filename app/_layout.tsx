import { useEffect } from "react";
import { Stack } from "expo-router";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";

// Keep native splash visible until app decides navigation (version check)
SplashScreen.preventAutoHideAsync().catch(() => {});

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  useEffect(() => {
    Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    }).catch(() => {});
  }, []);

  return (
    <Stack 
      screenOptions={{ headerShown: false }} 
      initialRouteName="index"
    >
      <Stack.Screen name="index" />
      <Stack.Screen 
        name="webview" 
        initialParams={{ mode: "monitoring" }}
      />
    </Stack>
  );
}
