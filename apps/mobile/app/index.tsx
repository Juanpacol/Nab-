import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/theme';

/** Punto de entrada: redirige según el estado de la sesión. */
export default function Index() {
  const { user, loading } = useAuth();
  const theme = useTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg }}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  return <Redirect href={user ? '/(tabs)/feed' : '/(auth)/login'} />;
}
