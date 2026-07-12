import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { formatSalary, type JobCard } from '@/lib/jobs';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = 120;

export type SwipeDirection = 'left' | 'right' | 'up';

/**
 * Tarjeta de vacante con física de arrastre nativa (Fase 7): derecha aplica,
 * izquierda pasa, arriba guarda — mismo gesto que el feed web, sobre
 * react-native-gesture-handler + reanimated.
 */
export function SwipeCard({
  job,
  isTop,
  onSwipe,
}: {
  job: JobCard;
  isTop: boolean;
  onSwipe: (dir: SwipeDirection) => void;
}) {
  const theme = useTheme();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const salary = formatSalary(job);

  const pan = Gesture.Pan()
    .enabled(isTop)
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      if (e.translationX > SWIPE_THRESHOLD) {
        translateX.value = withSpring(SCREEN_WIDTH);
        runOnJS(onSwipe)('right');
      } else if (e.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withSpring(-SCREEN_WIDTH);
        runOnJS(onSwipe)('left');
      } else if (e.translationY < -SWIPE_THRESHOLD) {
        translateY.value = withSpring(-SCREEN_WIDTH);
        runOnJS(onSwipe)('up');
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${interpolate(translateX.value, [-SCREEN_WIDTH, SCREEN_WIDTH], [-12, 12])}deg` },
    ],
  }));

  const likeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [20, 120], [0, 1]),
  }));
  const nopeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-120, -20], [1, 0]),
  }));
  const saveStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [-120, -20], [1, 0]),
  }));

  const card = (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        cardStyle,
        {
          backgroundColor: theme.surface,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: theme.border,
          padding: 20,
        },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 8,
              backgroundColor: theme.primarySoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 18, color: theme.primary, fontWeight: '700' }}>
              {job.company.charAt(0)}
            </Text>
          </View>
          <View>
            <Text style={{ fontSize: 17, fontWeight: '600', color: theme.fg }}>{job.title}</Text>
            <Text style={{ fontSize: 13, color: theme.fgMuted }}>
              {job.company}
              {job.location ? ` · ${job.location}` : ''}
            </Text>
          </View>
        </View>
        {typeof job.score === 'number' && (
          <Text style={{ fontSize: 12, color: theme.success, fontWeight: '600' }}>
            {Math.round(job.score * 100)}%
          </Text>
        )}
      </View>

      <Text style={{ marginTop: 24, flex: 1, fontSize: 14, lineHeight: 20, color: theme.fgMuted }}>
        {job.company} busca {job.title.toLowerCase()}. Desliza a la derecha para aplicar, arriba
        para guardar, izquierda para pasar.
      </Text>

      {salary && <Text style={{ fontSize: 14, fontWeight: '600', color: theme.fg }}>{salary}</Text>}

      <Animated.View style={[styles.badge, styles.likeBadge, { borderColor: theme.success }, likeStyle]}>
        <Text style={[styles.badgeText, { color: theme.success }]}>APLICAR</Text>
      </Animated.View>
      <Animated.View style={[styles.badge, styles.nopeBadge, { borderColor: theme.danger }, nopeStyle]}>
        <Text style={[styles.badgeText, { color: theme.danger }]}>PASAR</Text>
      </Animated.View>
      <Animated.View style={[styles.badge, styles.saveBadge, { borderColor: theme.primary }, saveStyle]}>
        <Text style={[styles.badgeText, { color: theme.primary }]}>GUARDAR</Text>
      </Animated.View>
    </Animated.View>
  );

  return isTop ? <GestureDetector gesture={pan}>{card}</GestureDetector> : card;
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: 24,
    borderWidth: 2,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  likeBadge: { left: 24 },
  nopeBadge: { right: 24 },
  saveBadge: { left: '50%', transform: [{ translateX: -40 }] },
  badgeText: { fontWeight: '700', fontSize: 14 },
});
