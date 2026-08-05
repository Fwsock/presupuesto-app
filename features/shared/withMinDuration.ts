/**
 * Resolves once `promise` settles AND at least `ms` has elapsed, whichever
 * is longer. Used for manual/programmatic refresh triggers (tap-to-reload
 * on an already-active tab) where the underlying refetch can resolve in a
 * handful of milliseconds against a warm cache -- without a floor, the
 * native RefreshControl spinner toggles on and off too fast to ever
 * actually render, so the "refresh" looks like it did nothing.
 */
export function withMinDuration<T>(promise: Promise<T>, ms: number): Promise<T> {
  const floor = new Promise<void>((resolve) => setTimeout(resolve, ms));
  return Promise.all([promise, floor]).then(([result]) => result);
}
