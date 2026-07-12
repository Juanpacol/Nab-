import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Link, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/theme';

const inputStyle = (theme: ReturnType<typeof useTheme>) => ({
  height: 48,
  borderWidth: 1,
  borderColor: theme.border,
  borderRadius: 8,
  paddingHorizontal: 14,
  color: theme.fg,
  backgroundColor: theme.surface,
});

export default function RegisterScreen() {
  const theme = useTheme();
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit() {
    setError(null);
    setPending(true);
    const res = await register(email.trim(), password, name.trim());
    setPending(false);
    if (res.error) setError(res.error);
    else router.replace('/(tabs)/feed');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 16 }}>
        <Text style={{ fontSize: 32, fontWeight: '700', color: theme.fg, marginBottom: 8 }}>
          Crea tu cuenta
        </Text>
        <Text style={{ fontSize: 16, color: theme.fgMuted, marginBottom: 16 }}>
          5 créditos gratis para empezar.
        </Text>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Nombre"
          placeholderTextColor={theme.fgMuted}
          style={inputStyle(theme)}
        />
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Correo electrónico"
          placeholderTextColor={theme.fgMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          style={inputStyle(theme)}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Contraseña"
          placeholderTextColor={theme.fgMuted}
          secureTextEntry
          style={inputStyle(theme)}
        />

        {error && <Text style={{ color: theme.danger, fontSize: 13 }}>{error}</Text>}

        <Pressable
          onPress={onSubmit}
          disabled={pending || !email || !password || !name}
          style={{
            height: 48,
            borderRadius: 8,
            backgroundColor: theme.primary,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pending || !email || !password || !name ? 0.6 : 1,
          }}
        >
          {pending ? (
            <ActivityIndicator color={theme.primaryFg} />
          ) : (
            <Text style={{ color: theme.primaryFg, fontWeight: '600' }}>Crear cuenta</Text>
          )}
        </Pressable>

        <Link href="/(auth)/login" style={{ textAlign: 'center', marginTop: 8 }}>
          <Text style={{ color: theme.primary }}>¿Ya tienes cuenta? Inicia sesión</Text>
        </Link>
      </View>
    </SafeAreaView>
  );
}
