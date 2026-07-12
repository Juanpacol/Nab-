import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/lib/auth-context';

/** Grupo de autenticación: si ya hay sesión, salta directo al panel. */
export default function AuthLayout() {
  const { user, loading } = useAuth();
  if (!loading && user) return <Redirect href="/(tabs)/feed" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
