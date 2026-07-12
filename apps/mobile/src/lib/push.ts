import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { apiFetch } from './api';

/**
 * Solicita permiso y registra el token de Expo Notifications del dispositivo
 * en el backend (Fase 7). Devuelve `null` en simuladores/emuladores, donde
 * las notificaciones push no funcionan.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync();
  await apiFetch('/users/me/push-token', { method: 'PUT', body: JSON.stringify({ token }) });
  return token;
}
