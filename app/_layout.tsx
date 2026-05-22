import { useEffect } from "react";
import { Stack } from "expo-router";
import * as Notifications from "expo-notifications";

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
      initialRouteName="webview"
    >
      <Stack.Screen 
        name="webview" 
        initialParams={{ mode: "monitoring" }}
      />
    </Stack>
  );
}
