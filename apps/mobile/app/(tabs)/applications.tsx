import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { APPLICATION_STATUS_LABELS, KANBAN_COLUMNS } from '@nab/shared';
import { useTheme } from '@/theme';
import { listApplications, updateApplicationStatus, type ApplicationCard } from '@/lib/applications';
import { useRealtime } from '@/lib/socket';

/** Seguimiento de aplicaciones (Fase 7): lista mobile-first del kanban web. */
export default function ApplicationsScreen() {
  const theme = useTheme();
  const [apps, setApps] = useState<ApplicationCard[] | null>(null);

  const load = useCallback(async () => {
    try {
      setApps(await listApplications());
    } catch {
      setApps([]);
    }
  }, []);

  useEffect(() => {
    // Carga inicial de la lista al montar la pantalla — patrón estándar de
    // datos en efecto (react-hooks/set-state-in-effect es demasiado estricto).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // Sincronización en tiempo real (Fase 7): si el estado cambia desde la web
  // (u otro dispositivo), refrescamos la lista al recibir el evento por WS.
  useRealtime('application.status_changed', load);

  function changeStatus(app: ApplicationCard) {
    Alert.alert(
      app.job.title,
      'Cambiar estado a…',
      KANBAN_COLUMNS.map((status) => ({
        text: APPLICATION_STATUS_LABELS[status],
        onPress: async () => {
          setApps((prev) => prev?.map((a) => (a.id === app.id ? { ...a, status } : a)) ?? null);
          try {
            await updateApplicationStatus(app.id, status);
          } catch {
            load();
          }
        },
      })).concat([{ text: 'Cancelar', style: 'cancel' } as never]),
    );
  }

  if (apps === null) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
        <Text style={{ fontSize: 28, fontWeight: '700', color: theme.fg }}>Aplicaciones</Text>
        <Text style={{ fontSize: 14, color: theme.fgMuted, marginTop: 2 }}>
          Toca una tarjeta para cambiar su estado.
        </Text>
      </View>

      <FlatList
        data={apps}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 10, paddingBottom: 20 }}
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', color: theme.fgMuted, marginTop: 40 }}>
            Aún no tienes aplicaciones. Ve al feed y desliza a la derecha.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => changeStatus(item)}
            style={{
              backgroundColor: theme.surface,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: 12,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: theme.fg }}>{item.job.title}</Text>
              <Text style={{ fontSize: 13, color: theme.fgMuted }}>{item.job.company}</Text>
            </View>
            <View
              style={{
                backgroundColor: theme.primarySoft,
                borderRadius: 6,
                paddingHorizontal: 8,
                paddingVertical: 4,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '600', color: theme.primary }}>
                {APPLICATION_STATUS_LABELS[item.status] ?? item.status}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
