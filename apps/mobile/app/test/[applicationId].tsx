import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { CandidateQuestion } from '@nab/shared';
import { useTheme } from '@/theme';
import {
  getApplicationTest,
  saveTestAnswers,
  startTest,
  submitTest,
  type CandidateTestView,
} from '@/lib/test-taking';

function useCountdown(startedAt: string | null, timeLimitMinutes: number | null, onExpire: () => void) {
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const expiredRef = useRef(false);

  useEffect(() => {
    if (!startedAt || !timeLimitMinutes) return;
    const deadline = new Date(startedAt).getTime() + timeLimitMinutes * 60_000;
    const tick = () => {
      const secs = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setRemainingSeconds(secs);
      if (secs === 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpire();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAt, timeLimitMinutes]);

  return remainingSeconds;
}

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function QuestionInput({
  question,
  value,
  onChange,
  theme,
}: {
  question: CandidateQuestion;
  value: string;
  onChange: (v: string) => void;
  theme: ReturnType<typeof useTheme>;
}) {
  if (question.type === 'multiple_choice') {
    return (
      <View style={{ gap: 10 }}>
        {question.options.map((opt) => {
          const selected = value === opt.id;
          return (
            <Pressable
              key={opt.id}
              onPress={() => onChange(opt.id)}
              style={{
                borderWidth: 1,
                borderColor: selected ? theme.primary : theme.border,
                backgroundColor: selected ? theme.primarySoft : theme.surface,
                borderRadius: 10,
                padding: 14,
              }}
            >
              <Text style={{ color: theme.fg, fontSize: 15 }}>{opt.text}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      multiline
      placeholder={question.type === 'code' ? 'Escribe tu código aquí…' : 'Escribe tu respuesta…'}
      placeholderTextColor={theme.fgMuted}
      style={{
        minHeight: 160,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 10,
        padding: 12,
        color: theme.fg,
        fontFamily: question.type === 'code' ? 'monospace' : undefined,
        textAlignVertical: 'top',
        fontSize: 15,
      }}
    />
  );
}

/** Runner de prueba técnica — una pregunta por pantalla, autosave, cronómetro server-truth. */
export default function TestRunnerScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { applicationId } = useLocalSearchParams<{ applicationId: string }>();

  const [test, setTest] = useState<CandidateTestView | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const startedOnce = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const view = await getApplicationTest(applicationId);
      setTest(view);
      const fromServer = Object.fromEntries((view.submission?.answersJson ?? []).map((a) => [a.questionId, a.answer]));
      setAnswers(fromServer);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [applicationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    if (startedOnce.current || !test) return;
    startedOnce.current = true;
    void startTest(applicationId);
  }, [applicationId, test]);

  function scheduleSave(next: Record<string, string>) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const payload = Object.entries(next).map(([questionId, answer]) => ({ questionId, answer }));
      void saveTestAnswers(applicationId, payload);
    }, 2500);
  }

  function setAnswer(questionId: string, value: string) {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: value };
      scheduleSave(next);
      return next;
    });
  }

  async function doSubmit() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await submitTest(applicationId);
      router.replace('/(tabs)/applications');
    } catch {
      Alert.alert('No se pudo enviar', 'Intenta de nuevo en unos segundos.');
      setSubmitting(false);
    }
  }

  function confirmSubmit() {
    const unanswered = test?.questions.filter((q) => !(answers[q.id] ?? '').trim().length) ?? [];
    Alert.alert(
      'Enviar prueba',
      unanswered.length > 0
        ? `Tienes ${unanswered.length} pregunta(s) sin responder. ¿Enviar de todas formas?`
        : '¿Confirmas que quieres enviar tu prueba? No podrás editarla después.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Enviar', style: 'destructive', onPress: doSubmit },
      ],
    );
  }

  const remainingSeconds = useCountdown(
    test?.submission?.startedAt ?? null,
    test?.timeLimitMinutes ?? null,
    () => !submitting && doSubmit(),
  );

  if (loadError) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Text style={{ color: theme.fgMuted, textAlign: 'center', paddingHorizontal: 24 }}>
          No pudimos cargar la prueba. El servidor puede estar despertando.
        </Text>
        <Pressable onPress={load}>
          <Text style={{ color: theme.primary, fontWeight: '600' }}>Reintentar</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!test) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.primary} />
      </SafeAreaView>
    );
  }

  if (test.submission && test.submission.status !== 'IN_PROGRESS') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: theme.fg, textAlign: 'center' }}>
          Ya enviaste esta prueba
        </Text>
        <Text style={{ color: theme.fgMuted, textAlign: 'center' }}>
          Puedes ver el estado de tu aplicación en la pestaña Aplicaciones.
        </Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 8 }}>
          <Text style={{ color: theme.primary, fontWeight: '600' }}>Volver</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const question = test.questions[index];
  if (!question) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 4,
        }}
      >
        <Text style={{ color: theme.fgMuted, fontSize: 13 }}>
          Pregunta {index + 1} de {test.questions.length}
        </Text>
        {remainingSeconds != null && (
          <Text style={{ color: remainingSeconds < 60 ? theme.danger : theme.fgMuted, fontWeight: '600', fontSize: 13 }}>
            ⏱ {formatSeconds(remainingSeconds)}
          </Text>
        )}
      </View>

      <View style={{ height: 4, backgroundColor: theme.surface2, marginHorizontal: 20, borderRadius: 2, overflow: 'hidden' }}>
        <View
          style={{
            height: '100%',
            width: `${((index + 1) / test.questions.length) * 100}%`,
            backgroundColor: theme.primary,
          }}
        />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: '600', color: theme.fg, lineHeight: 25 }}>{question.prompt}</Text>
        <QuestionInput question={question} value={answers[question.id] ?? ''} onChange={(v) => setAnswer(question.id, v)} theme={theme} />
      </ScrollView>

      <View style={{ flexDirection: 'row', gap: 10, padding: 20, borderTopWidth: 1, borderTopColor: theme.border }}>
        <Pressable
          disabled={index === 0}
          onPress={() => setIndex((i) => i - 1)}
          style={{
            flex: 1,
            padding: 14,
            borderRadius: 10,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: theme.border,
            opacity: index === 0 ? 0.4 : 1,
          }}
        >
          <Text style={{ color: theme.fg, fontWeight: '600' }}>Atrás</Text>
        </Pressable>
        {index < test.questions.length - 1 ? (
          <Pressable
            onPress={() => setIndex((i) => i + 1)}
            style={{ flex: 1, padding: 14, borderRadius: 10, alignItems: 'center', backgroundColor: theme.primary }}
          >
            <Text style={{ color: theme.primaryFg, fontWeight: '600' }}>Siguiente</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={confirmSubmit}
            disabled={submitting}
            style={{ flex: 1, padding: 14, borderRadius: 10, alignItems: 'center', backgroundColor: theme.primary, opacity: submitting ? 0.6 : 1 }}
          >
            <Text style={{ color: theme.primaryFg, fontWeight: '600' }}>{submitting ? 'Enviando…' : 'Enviar prueba'}</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}
