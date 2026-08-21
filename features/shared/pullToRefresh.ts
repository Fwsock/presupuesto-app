/**
 * Pure logic behind components/PullToRefresh.tsx, split out so it's
 * unit-testable without rendering the Reanimated/gesture-handler tree (same
 * idea as features/movements/swipeDelete.ts).
 *
 * Both functions below carry an explicit 'worklet' directive: they're
 * called from inside PullToRefresh's gesture callbacks and
 * useAnimatedReaction, which run on the UI thread. Reanimated's Babel
 * plugin only auto-workletizes an arrow function passed directly to a hook
 * like useAnimatedReaction -- a plain function imported from ANOTHER module
 * and called from within that worklet stays a regular JS function object
 * unless it's marked 'worklet' at its own definition site. Without this,
 * calling it from the UI thread crashes immediately with
 * "TypeError: Object is not a function" (the imported reference gets
 * serialized to the UI runtime as an inert object, not a callable worklet)
 * -- reproduced on real-device launch, since useAnimatedReaction runs its
 * "prepare" function once immediately on mount, before any gesture at all.
 * Harmless outside Reanimated (plain Jest/Node execution, e.g. this file's
 * own tests): 'worklet' is just a no-op string-literal statement there,
 * only the Reanimated Babel plugin (which only runs for the app bundle, not
 * ts-jest) does anything with it.
 */

// How quickly the pull resists further dragging as it grows -- lower means
// softer/more resistance. 0.55 gives a feel close to iOS's own rubber-band
// scroll overscroll: roughly linear for a small pull, flattening out well
// before `maxPull`.
const RUBBER_BAND_COEFFICIENT = 0.55;

/**
 * Maps a raw drag distance to the actual on-screen pull distance, softening
 * the further past 0 the user drags so it visually approaches `maxPull`
 * instead of following the finger 1:1 forever. A non-positive `distance` or
 * `maxPull` always returns 0 -- there's nothing to resist yet, and a
 * degenerate `maxPull` must never divide-by-zero into `NaN`/`Infinity`.
 */
export function rubberBand(distance: number, maxPull: number): number {
  'worklet';
  if (distance <= 0 || maxPull <= 0) return 0;
  return (distance * maxPull * RUBBER_BAND_COEFFICIENT) / (maxPull + distance * RUBBER_BAND_COEFFICIENT);
}

export type PullPhase = 'idle' | 'pull' | 'release' | 'refreshing';

/**
 * The indicator's current phase, driving which label/icon it shows --
 * `refreshing` always wins regardless of the current pull distance (the
 * indicator stays pinned at `refreshOffset` while a refresh is in flight,
 * including the no-gesture case: a tap on the already-active tab).
 */
export function phaseFor(translateY: number, threshold: number, refreshing: boolean): PullPhase {
  'worklet';
  if (refreshing) return 'refreshing';
  if (translateY <= 0) return 'idle';
  if (translateY >= threshold) return 'release';
  return 'pull';
}
