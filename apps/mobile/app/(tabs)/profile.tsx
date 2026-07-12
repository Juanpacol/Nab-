import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { PLANS, type PlanId } from '@nab/shared';
import { useAuth } from '@/lib/auth-context';
import { registerForPushNotifications } from '@/lib/push';
import { useTheme } from '@/theme';

export default function ProfileScreen() {
  const theme = useTheme();
  const { user, logout } = useAuth();
  const [pushStatus, setPushStatus] = useState<'idle' | 'pending' | 'on' | 'off'>('idle');

  async function onEnablePush() {
    setPushStatus('pending');
    const token = await registerForPushNotifications();
    setPushStatus(token ? 'on' : 'off');
    if (!token) {
      Alert.alert(
        'No se pudo activar',
        'Las notificaciones push requieren un dispositivo físico y permisos concedidos.',
      );
    }
  }

  async function onLogout() {
    await logout();
    router.replace('/(auth)/login');
  }

  const plan = PLANS[(user?.plan as PlanId) ?? 'FREE'];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, gap: 20 }}>
        <Text style={{ fontSize: 28, fontWeight: '700', color: theme.fg }}>Perfil</Text>

        <View
          style={{
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 12,
            padding: 16,
            gap: 4,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '600', color: theme.fg }}>{user?.name}</Text>
          <Text style={{ fontSize: 13, color: theme.fgMuted }}>{user?.email}</Text>
          <Text style={{ fontSize: 13, color: theme.primary, marginTop: 4 }}>
            Plan {plan.name} · {user?.creditsRemaining ?? 0} créditos
          </Text>
        </View>

        <Pressable
          onPress={onEnablePush}
          disabled={pushStatus === 'pending' || pushStatus === 'on'}
          style={{
            height: 48,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: theme.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: theme.fg, fontWeight: '600' }}>
            {pushStatus === 'on'
              ? '🔔 Notificaciones activadas'
              : pushStatus === 'pending'
                ? 'Activando…'
                : 'Activar notificaciones push'}
          </Text>
        </Pressable>

        <Pressable
          onPress={onLogout}
          style={{
            height: 48,
            borderRadius: 8,
            backgroundColor: theme.danger,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>Cerrar sesión</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
