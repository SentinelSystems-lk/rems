import { Stack } from "expo-router";

export default function RootLayout() {
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
