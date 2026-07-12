import { Redirect, Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/theme';

const ICONS: Record<string, string> = {
  feed: '🔥',
  applications: '📋',
  coach: '💬',
  profile: '👤',
};

/** Panel principal (Fase 7): navegación por tabs, igual que el bottom-nav web. */
export default function TabsLayout() {
  const { user, loading } = useAuth();
  const theme = useTheme();

  if (!loading && !user) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.fgMuted,
        tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.border },
        tabBarIcon: () => <Text style={{ fontSize: 20 }}>{ICONS[route.name]}</Text>,
      })}
    >
      <Tabs.Screen name="feed" options={{ title: 'Descubrir' }} />
      <Tabs.Screen name="applications" options={{ title: 'Aplicaciones' }} />
      <Tabs.Screen name="coach" options={{ title: 'Coach IA' }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}
