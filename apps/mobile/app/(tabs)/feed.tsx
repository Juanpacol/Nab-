import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { fetchForYou, fetchRecentJobs, saveJob, type JobCard } from '@/lib/jobs';
import { applyToJob } from '@/lib/applications';
import { SwipeCard, type SwipeDirection } from '@/components/swipe-card';

/** Feed swipe (Fase 7): mismo gesto y flujo que la web, sobre datos reales. */
export default function FeedScreen() {
  const theme = useTheme();
  const [jobs, setJobs] = useState<JobCard[] | null>(null);
  const [index, setIndex] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  // Distingue "no hay vacantes" (lista vacía real) de "no pudimos conectar"
  // (timeout de cold start, red caída) — antes ambos casos se veían igual.
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setIndex(0);
    setLoadError(false);
    try {
      const forYou = await fetchForYou();
      setJobs(forYou.length > 0 ? forYou : await fetchRecentJobs());
    } catch {
      setJobs([]);
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    // Carga inicial del feed al montar la pantalla — patrón estándar de datos
    // en efecto (react-hooks/set-state-in-effect es demasiado estricto aquí).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleSwipe(job: JobCard, dir: SwipeDirection) {
    setIndex((i) => i + 1);
    if (dir === 'right') {
      try {
        const res = await applyToJob(job.id);
        setToast(res.alreadyApplied ? 'Ya habías aplicado' : `Aplicaste a ${job.company}`);
        if (res.applyUrl) Linking.openURL(res.applyUrl);
      } catch {
        setToast('No se pudo aplicar. Revisa tus créditos.');
      }
    } else if (dir === 'up') {
      try {
        await saveJob(job.id);
        setToast(`Guardada: ${job.title}`);
      } catch {
        setToast('No se pudo guardar.');
      }
    }
  }

  if (jobs === null) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.primary} />
      </SafeAreaView>
    );
  }

  const remaining = jobs.slice(index);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
        <Text style={{ fontSize: 28, fontWeight: '700', color: theme.fg }}>Descubrir</Text>
        <Text style={{ fontSize: 14, color: theme.fgMuted, marginTop: 2 }}>
          Derecha aplica · Arriba guarda · Izquierda pasa
        </Text>
      </View>

      <View style={{ flex: 1, margin: 20, marginTop: 24 }}>
        {remaining.length === 0 ? (
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: theme.border,
              gap: 8,
            }}
          >
            <Text style={{ fontSize: 40 }}>{loadError ? '⚠️' : '🎉'}</Text>
            <Text style={{ fontSize: 18, fontWeight: '600', color: theme.fg }}>
              {loadError ? 'No pudimos conectar' : '¡Por hoy es todo!'}
            </Text>
            <Text style={{ fontSize: 13, color: theme.fgMuted }}>
              {loadError
                ? 'El servidor puede estar despertando. Intenta de nuevo.'
                : 'Vuelve pronto por más vacantes.'}
            </Text>
            <Pressable onPress={load} style={{ marginTop: 12 }}>
              <Text style={{ color: theme.primary, fontWeight: '600' }}>Recargar</Text>
            </Pressable>
          </View>
        ) : (
          remaining
            .slice(0, 3)
            .reverse()
            .map((job, i, arr) => (
              <SwipeCard
                key={job.id}
                job={job}
                isTop={i === arr.length - 1}
                onSwipe={(dir) => handleSwipe(job, dir)}
              />
            ))
        )}
      </View>

      {toast && (
        <Text style={{ textAlign: 'center', color: theme.primary, marginBottom: 12, fontSize: 13 }}>
          {toast}
        </Text>
      )}
    </SafeAreaView>
  );
}
