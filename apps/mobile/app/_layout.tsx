import 'react-native-reanimated';
import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { AuthProvider } from '@/lib/auth-context';
import { useTheme } from '@/theme';

/**
 * Deep-link de push: al tocar una notificación de mensaje nuevo (enviada por
 * ThreadsService.sendMessageAsCompany con `data: {type: 'thread.message',
 * applicationId}`), navega directo al chat de esa aplicación en vez de solo
 * abrir la app en la pantalla que estuviera visible.
 */
function usePushNotificationRouting() {
  const router = useRouter();
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { type?: string; applicationId?: string };
      if (data.type === 'thread.message' && data.applicationId) {
        router.push(`/chat/${data.applicationId}`);
      }
    });
    return () => sub.remove();
  }, [router]);
}

/** Layout raíz (Fase 7): providers globales + navegación por Stack. */
export default function RootLayout() {
  const theme = useTheme();
  usePushNotificationRouting();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.bg } }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="test/[applicationId]" options={{ headerShown: true, title: 'Prueba técnica' }} />
          <Stack.Screen name="chat/[applicationId]" options={{ headerShown: true, title: 'Chat' }} />
        </Stack>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
