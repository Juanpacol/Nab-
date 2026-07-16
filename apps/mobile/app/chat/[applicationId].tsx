import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/theme';
import { useAuth } from '@/lib/auth-context';
import { useRealtime } from '@/lib/socket';
import {
  getThreadForApplication,
  listThreadMessages,
  markThreadRead,
  sendThreadMessage,
  type ThreadMessage,
} from '@/lib/threads';

interface ThreadMessagePayload {
  threadId: string;
  applicationId: string;
  message: ThreadMessage;
}

/** Chat candidato↔RH por aplicación — envío por REST, recepción por socket. */
export default function ChatScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const { applicationId } = useLocalSearchParams<{ applicationId: string }>();

  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    (async () => {
      try {
        const thread = await getThreadForApplication(applicationId);
        setThreadId(thread.id);
        const msgs = await listThreadMessages(applicationId);
        setMessages(msgs);
        setLoadError(false);
        if (msgs.some((m) => m.senderUserId !== user?.id && m.readAt === null)) {
          void markThreadRead(applicationId);
        }
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [applicationId, user?.id]);

  useRealtime('thread.message', (payload) => {
    const p = payload as ThreadMessagePayload;
    if (p.applicationId !== applicationId) return;
    setMessages((prev) => (prev.some((m) => m.id === p.message.id) ? prev : [...prev, p.message]));
    void markThreadRead(applicationId);
  });

  async function handleSend() {
    const content = input.trim();
    if (!content || sending || !user) return;
    setInput('');
    setSending(true);

    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: tempId, senderUserId: user.id, fromCompany: false, content, readAt: null, createdAt: new Date().toISOString() },
    ]);

    try {
      const sent = await sendThreadMessage(applicationId, content);
      setMessages((prev) => prev.map((m) => (m.id === tempId ? sent : m)));
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.primary} />
      </SafeAreaView>
    );
  }

  if (loadError || !threadId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: theme.fgMuted, textAlign: 'center' }}>
          No pudimos cargar la conversación. Esta vacante puede no tener chat disponible.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <Text style={{ textAlign: 'center', color: theme.fgMuted, marginTop: 40 }}>
              Aún no hay mensajes. Escribe para empezar la conversación.
            </Text>
          }
          renderItem={({ item }) => {
            const isMine = item.senderUserId === user?.id;
            return (
              <View style={{ alignItems: isMine ? 'flex-end' : 'flex-start' }}>
                <View
                  style={{
                    maxWidth: '80%',
                    backgroundColor: isMine ? theme.primary : theme.surface2,
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ color: isMine ? theme.primaryFg : theme.fg, fontSize: 15 }}>{item.content}</Text>
                  <Text
                    style={{
                      fontSize: 10,
                      marginTop: 4,
                      color: isMine ? theme.primaryFg : theme.fgMuted,
                      opacity: isMine ? 0.7 : 1,
                    }}
                  >
                    {new Date(item.createdAt).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        <View style={{ flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: theme.border }}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Escribe un mensaje…"
            placeholderTextColor={theme.fgMuted}
            multiline
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 20,
              paddingHorizontal: 14,
              paddingVertical: 10,
              color: theme.fg,
              maxHeight: 100,
            }}
          />
          <Pressable
            onPress={handleSend}
            disabled={sending || !input.trim()}
            style={{
              backgroundColor: theme.primary,
              borderRadius: 20,
              paddingHorizontal: 18,
              justifyContent: 'center',
              opacity: sending || !input.trim() ? 0.5 : 1,
            }}
          >
            <Text style={{ color: theme.primaryFg, fontWeight: '600' }}>Enviar</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
