import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { phaseFor, rubberBand, type PullPhase } from '../features/shared/pullToRefresh';
import { theme } from '../lib/theme';

const DEFAULT_THRESHOLD = 56;
const DEFAULT_REFRESH_OFFSET = 64;
const DEFAULT_MAX_PULL = 130;
// How far (in px, measured from the initial touch-down point) the finger
// has to travel before the pull gesture takes over from ordinary scrolling
// -- see the Pan gesture's onTouchesMove below for exactly what gates this.
const ACTIVATE_DISTANCE = 12;

interface PullToRefreshRenderProps {
  onScroll: ReturnType<typeof useAnimatedScrollHandler>;
  scrollEventThrottle: number;
  bounces: false;
  alwaysBounceVertical: false;
  overScrollMode: 'never';
}

interface PullToRefreshProps {
  /** Controlled from outside -- pass the screen's existing `refreshing` state through untouched. */
  refreshing: boolean;
  /** The screen's existing refresh callback (already wrapped in withMinDuration elsewhere). Called once per completed gesture. */
  onRefresh: () => void;
  /** Render-prop: spread the returned props onto the Animated.ScrollView/Animated.SectionList/Animated.FlatList this wraps. */
  children: (props: PullToRefreshRenderProps) => React.ReactNode;
  /** px of (post-resistance) pull needed to commit to a refresh on release. */
  threshold?: number;
  /** px the indicator strip is pinned to while refreshing. */
  refreshOffset?: number;
  /** Asymptotic cap on how far the content can be dragged, however hard the user pulls. */
  maxPull?: number;
  /** Set to false to disable the gesture entirely (e.g. while the screen shows its own loading skeleton). */
  enabled?: boolean;
  tintColor?: string;
  backgroundColor?: string;
  pullLabel?: string;
  releaseLabel?: string;
  refreshingLabel?: string;
  /** Light haptic tick the moment the pull crosses the release threshold. */
  haptics?: boolean;
}

/**
 * Mercado-Pago-style integrated pull-to-refresh: instead of a floating
 * native spinner layered on top of the content (RefreshControl), the whole
 * scrollable content translates down together as the user drags, revealing
 * an indicator strip that was already sitting behind it. Built on
 * `Gesture.Pan()` with `manualActivation(true)` so it never fights ordinary
 * scrolling or a row's own horizontal swipe-to-delete gesture -- see
 * onTouchesMove below for exactly how activation is decided.
 *
 * Purely a wrapper: it doesn't own any data-fetching logic. `refreshing`/
 * `onRefresh` are the same props a screen would hand to a plain
 * `<RefreshControl>` today.
 */
export function PullToRefresh({
  refreshing,
  onRefresh,
  children,
  threshold = DEFAULT_THRESHOLD,
  refreshOffset = DEFAULT_REFRESH_OFFSET,
  maxPull = DEFAULT_MAX_PULL,
  enabled = true,
  tintColor = theme.brand,
  backgroundColor = theme.background,
  pullLabel = 'Desliza para actualizar',
  releaseLabel = 'Suelta para actualizar',
  refreshingLabel = 'Actualizando...',
  haptics = true,
}: PullToRefreshProps) {
  const translateY = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const startY = useSharedValue(0);
  const isRefreshingSV = useSharedValue(refreshing);
  const hapticFiredSV = useSharedValue(false);

  const [phase, setPhase] = useState<PullPhase>('idle');

  // Mirrors the controlled `refreshing` prop into a shared value the
  // worklets below can read -- including the no-gesture path: re-tapping
  // the already-active tab calls the screen's handleRefresh() directly,
  // with no drag at all, and the indicator still has to appear for that.
  useEffect(() => {
    isRefreshingSV.value = refreshing;
  }, [refreshing, isRefreshingSV]);

  const triggerHaptic = () => {
    if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const pan = Gesture.Pan()
    .manualActivation(true)
    .failOffsetX([-15, 15])
    .onTouchesDown((e) => {
      startY.value = e.allTouches[0]?.absoluteY ?? 0;
      hapticFiredSV.value = false;
    })
    .onTouchesMove((e, manager) => {
      if (!enabled || isRefreshingSV.value) {
        manager.fail();
        return;
      }
      const currentY = e.allTouches[0]?.absoluteY ?? startY.value;
      const dy = currentY - startY.value;
      // Dragging up, or not at the very top of the scroll content: this is
      // ordinary scrolling, never our pull -- let it through untouched.
      if (dy < -6 || scrollY.value > 0.5) {
        manager.fail();
        return;
      }
      if (dy > ACTIVATE_DISTANCE) {
        manager.activate();
      }
    })
    .onUpdate((e) => {
      translateY.value = rubberBand(e.translationY, maxPull);
      if (translateY.value >= threshold) {
        if (!hapticFiredSV.value) {
          hapticFiredSV.value = true;
          runOnJS(triggerHaptic)();
        }
      } else {
        hapticFiredSV.value = false;
      }
    })
    .onEnd(() => {
      if (translateY.value >= threshold) {
        translateY.value = withTiming(refreshOffset, { duration: 180 });
        runOnJS(onRefresh)();
      } else {
        translateY.value = withTiming(0, { duration: 220 });
      }
    });

  // Drives the offset directly off the `refreshing` prop, not just the
  // gesture's own onEnd -- covers the tap-to-refresh path (see the effect
  // above) and keeps a manual pull's already-settled offset in sync once
  // the real fetch actually resolves.
  useAnimatedReaction(
    () => isRefreshingSV.value,
    (current, previous) => {
      if (current === previous) return;
      translateY.value = withTiming(current ? refreshOffset : 0, { duration: current ? 200 : 280 });
    }
  );

  useAnimatedReaction(
    () => phaseFor(translateY.value, threshold, isRefreshingSV.value),
    (current, previous) => {
      if (current === previous) return;
      runOnJS(setPhase)(current);
    }
  );

  const contentStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const iconStyle = useAnimatedStyle(() => {
    const progress = threshold > 0 ? Math.min(1, Math.max(0, translateY.value / threshold)) : 0;
    return { transform: [{ scale: 0.6 + 0.4 * progress }, { rotate: `${progress * 180}deg` }] };
  });
  // Drives the WHOLE strip's visibility (icon + label) directly off
  // translateY on the UI thread -- NOT off the `phase` JS state below, which
  // only ever updates via a runOnJS round-trip and used to be the sole
  // gate for showing the label (`{phase !== 'idle' && <Text>}`). That round
  // trip can lag a render or two behind translateY actually reaching 0, and
  // on a real device that lag was enough for "Desliza para actualizar" to
  // sit fully opaque, on top of the settled content, for a couple of
  // seconds after every pull -- fading this from the same value that drives
  // the content's own translateY keeps them perfectly in sync, so the label
  // is gone by the time the content finishes settling back into place, not
  // some renders later.
  const stripStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, translateY.value / 10)),
  }));

  const label = phase === 'refreshing' ? refreshingLabel : phase === 'release' ? releaseLabel : pullLabel;

  return (
    <View style={{ flex: 1, overflow: 'hidden', backgroundColor }}>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: refreshOffset,
            alignItems: 'center',
            justifyContent: 'center',
            // Explicit, below the content's own zIndex: 1 -- belt-and-
            // suspenders on top of the opacity fix above, so this strip can
            // never paint over settled content even for a single frame.
            zIndex: 0,
          },
          stripStyle,
        ]}
      >
        <Animated.View style={iconStyle}>
          {phase === 'refreshing' ? (
            <ActivityIndicator color={tintColor} />
          ) : (
            <Ionicons name="arrow-down" size={20} color={tintColor} />
          )}
        </Animated.View>
        <Text style={{ color: tintColor, fontSize: 12, marginTop: 4 }}>{label}</Text>
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View style={[{ flex: 1, zIndex: 1 }, contentStyle]}>
          {children({
            onScroll,
            scrollEventThrottle: 16,
            bounces: false,
            alwaysBounceVertical: false,
            overScrollMode: 'never',
          })}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
