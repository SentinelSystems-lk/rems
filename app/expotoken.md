1. Install Expo Notifications

In your Expo app:

npx expo install expo-notifications expo-device

If you use EAS Build:

npx expo install expo-notifications
2. Get Expo Push Token

Example in React Native / Expo:

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

export async function registerForPushNotificationsAsync() {
  let token;

  if (Device.isDevice) {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();

    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } =
        await Notifications.requestPermissionsAsync();

      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      alert('Failed to get push token');
      return;
    }

    token = (await Notifications.getExpoPushTokenAsync()).data;

    console.log('Expo Push Token:', token);
  } else {
    alert('Must use physical device');
  }

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  return token;
}
3. Save Token to Your Backend

After getting the token:

const token = await registerForPushNotificationsAsync();

await fetch('https://your-api.com/save-token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    userId: user.id,
    expoPushToken: token,
  }),
});

Store it in your DB.