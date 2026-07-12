import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { streamChat } from '@/lib/chat';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

const GREETING =
  '¡Hola! Soy tu coach de carrera. Puedo revisar tu perfil, tus aplicaciones y buscar vacantes para darte consejos concretos. ¿Por dónde empezamos?';

/** Career Coach (Fase 7): mismo chat con tool-use de la web, en streaming. */
export default function CoachScreen() {
  const theme = useTheme();
  const [messages, setMessages] = useState<Msg[]>([{ role: 'assistant', content: GREETING }]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const sessionId = useRef<string | undefined>(undefined);

  async function send() {
    const content = input.trim();
    if (!content || streaming) return;
    setInput('');
    setStreaming(true);
    setMessages((m) => [...m, { role: 'user', content }, { role: 'assistant', content: '' }]);

    try {
      await streamChat('CAREER_COACH', content, sessionId.current, (evt) => {
        if (evt.delta) {
          setMessages((m) => {
            const next = [...m];
            const last = next[next.length - 1];
            if (last) next[next.length - 1] = { role: 'assistant', content: last.content + evt.delta };
            return next;
          });
        }
        if (evt.done) sessionId.current = evt.sessionId;
        if (evt.error) {
          setMessages((m) => {
            const next = [...m];
            if (next.length) next[next.length - 1] = { role: 'assistant', content: evt.error! };
            return next;
          });
        }
      });
    } catch {
      setMessages((m) => {
        const next = [...m];
        if (next.length) next[next.length - 1] = { role: 'assistant', content: 'No se pudo conectar con el chat.' };
        return next;
      });
    } finally {
      setStreaming(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 }}>
          <Text style={{ fontSize: 28, fontWeight: '700', color: theme.fg }}>Coach IA</Text>
        </View>

        <FlatList
          data={messages}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ padding: 20, gap: 12 }}
          renderItem={({ item, index }) => {
            const isLast = index === messages.length - 1;
            const isEmpty = streaming && isLast && item.role === 'assistant' && item.content === '';
            return (
              <View style={{ alignItems: item.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <View
                  style={{
                    maxWidth: '85%',
                    borderRadius: 14,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    backgroundColor: item.role === 'user' ? theme.primary : theme.surface2,
                  }}
                >
                  {isEmpty ? (
                    <ActivityIndicator size="small" color={theme.fgMuted} />
                  ) : (
                    <Text style={{ color: item.role === 'user' ? theme.primaryFg : theme.fg, fontSize: 14 }}>
                      {item.content}
                    </Text>
                  )}
                </View>
              </View>
            );
          }}
        />

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            padding: 12,
            borderTopWidth: 1,
            borderTopColor: theme.border,
          }}
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Escribe un mensaje…"
            placeholderTextColor={theme.fgMuted}
            style={{
              flex: 1,
              height: 44,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 8,
              paddingHorizontal: 12,
              color: theme.fg,
              backgroundColor: theme.surface,
            }}
          />
          <Pressable
            onPress={send}
            disabled={streaming || !input.trim()}
            style={{
              height: 44,
              paddingHorizontal: 16,
              borderRadius: 8,
              backgroundColor: theme.primary,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: streaming || !input.trim() ? 0.6 : 1,
            }}
          >
            <Text style={{ color: theme.primaryFg, fontWeight: '600' }}>Enviar</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
