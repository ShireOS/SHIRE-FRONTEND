import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import { registerMobilePushToken } from '@/api/timeClock';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let lastRegisteredKey = '';

function getProjectId() {
  return (
    Constants.easConfig?.projectId ||
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.expoConfig?.extra?.projectId ||
    null
  );
}

export async function registerManagerPushToken(restaurantId?: string | null) {
  if (!Device.isDevice) return null;

  const projectId = getProjectId();
  if (!projectId) return null;

  const existing = await Notifications.getPermissionsAsync();
  const finalStatus = existing.status === 'granted'
    ? existing.status
    : (await Notifications.requestPermissionsAsync()).status;
  if (finalStatus !== 'granted') return null;

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const key = `${restaurantId || 'none'}:${token}`;
  if (key === lastRegisteredKey) return token;

  await registerMobilePushToken({
    token,
    restaurant_id: restaurantId || null,
    device_name: Device.deviceName || Device.modelName || null,
  });
  lastRegisteredKey = key;
  return token;
}
