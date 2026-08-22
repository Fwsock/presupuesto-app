import { memo, useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { View, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useNavigation, useRouter } from 'expo-router';
import {
  useEnsureFixedCategoryMovementsForMonth,
  useMovements,
  useMovementsForMonthRange,
  usePrefetchAdjacentMonths,
} from '../../features/movements/hooks';
import { useEnsureRecurringIncomeForMonth } from '../../features/income/hooks';
import { useCategories } from '../../features/categories/hooks';
import { calculateMonthSummary } from '../../features/movements/summary';
import { buildMonthlySaldoSeries, monthOffset } from '../../features/movements/monthlySeries';
import { MonthSelector } from '../../components/MonthSelector';
import { MonthSaldoChart } from '../../components/MonthSaldoChart';
import { CategoryTotalsList } from '../../components/CategoryTotalsList';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ScreenSkeleton } from '../../components/Skeleton';
import { PullToRefresh } from '../../components/PullToRefresh';
import { useSelectedMonth } from '../../features/shared/selected-month';
import { withMinDuration } from '../../features/shared/withMinDuration';
import { useMovementFilter } from '../../features/shared/movement-filter-context';
import { cardShadow } from '../../lib/theme';

// More months before/after = a denser chart (per UX request), while still
// keeping the selected month roughly centered.
const MONTHS_BEFORE = 3;
const MONTHS_AFTER = 3;

function ResumenScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const scrollRef = useRef<ComponentRef<typeof Animated.ScrollView>>(null);
  const { year, month, setMonth } = useSelectedMonth();
  const { setCategoryFilter } = useMovementFilter();

  // Stable so CategoryTotalsList's own memoized rows can skip re-rendering
  // when this screen re-renders for an unrelated reason. Sets the shared
  // filter state directly (see features/shared/movement-filter-context.tsx)
  // rather than passing categoryId as a route param -- Movimientos reads it
  // from there now, not from useLocalSearchParams().
  const onPressCategory = useCallback(
    (categoryId: string) => {
      setCategoryFilter(categoryId);
      router.navigate('/movimientos');
    },
    [router, setCategoryFilter]
  );

  // Single persistent opacity value (fade out, then back in, on ONE
  // element -- see MonthSelector's identical pattern for why not a keyed
  // remount with real entering/exiting) so the balance card + category list
  // dip and return instead of snapping to the new month's numbers. This is
  // safe to pair with an animation now that `summary` never goes null on a
  // month switch (keepPreviousData on the underlying queries, see the
  // isLoading comment above) -- old numbers stay visible the whole time,
  // this is purely a cosmetic transition on top, not standing in for a
  // loading state.
  const monthContentOpacity = useSharedValue(1);
  useEffect(() => {
    monthContentOpacity.value = withSequence(withTiming(0, { duration: 90 }), withTiming(1, { duration: 90 }));
  }, [year, month, monthContentOpacity]);
  const monthContentStyle = useAnimatedStyle(() => ({ opacity: monthContentOpacity.value }));

  const {
    data: movements,
    isLoading: loadingMovements,
    isError: movementsError,
    refetch: refetchMovements,
  } = useMovements(year, month);
  const {
    data: categories,
    isLoading: loadingCategories,
    isError: categoriesError,
    refetch: refetchCategories,
  } = useCategories();
  const { data: rangeMovements, refetch: refetchRange } = useMovementsForMonthRange(year, month, MONTHS_BEFORE, MONTHS_AFTER);
  // Same queryKeys as FixedCategoriesSync/VariableIncomePromptHost (mounted
  // at the layout level) -- React Query dedupes by key, so this doesn't
  // trigger a second fetch, it just mirrors them here too. Both silently
  // insert a movement (recurring income / a fija category's monthly
  // replica) then invalidate `['movements']` once done, which is what
  // actually refreshes `summary` with the generated entry -- their own
  // `isLoading` is intentionally NOT used to gate this screen's skeleton
  // (see the `!summary` check below): these checks aren't cached with
  // keepPreviousData (their result also drives the variable-income prompt
  // modal, which needs to stay accurate rather than show a stale month's
  // answer), so `isLoading` genuinely flips true again on months outside
  // the prefetch radius -- gating the whole screen on that was dropping it
  // back to the skeleton on every such month change, even though
  // `summary`/`chartPoints` already had valid data to show.
  useEnsureRecurringIncomeForMonth(year, month);
  useEnsureFixedCategoryMovementsForMonth(year, month);
  // Keeps the month right before/after this one warm in cache, so navigating
  // there via the arrows or the chart lands instantly instead of showing the
  // skeleton again -- see the hook's own comment for exactly what it warms.
  usePrefetchAdjacentMonths(year, month);

  // Local, explicit refresh state -- NOT React Query's `isFetching`, which
  // fires for any background refetch (mutations, refocus, etc). Binding
  // RefreshControl to that caused a floating spinner/frame to appear for
  // reasons unrelated to the user's own pull-to-refresh or tap-to-reload.
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // A warm cache can resolve this in a handful of ms, which used to
      // toggle `refreshing` on and off faster than RefreshControl's native
      // spinner could ever actually paint -- tapping the active tab looked
      // like it did nothing. withMinDuration guarantees the spinner stays
      // up long enough to actually be seen, no matter how fast the network is.
      await withMinDuration(
        Promise.all([refetchMovements(), refetchCategories(), refetchRange()]),
        700
      );
    } finally {
      setRefreshing(false);
    }
  }, [refetchMovements, refetchCategories, refetchRange]);

  // Re-tapping the already-active "Resumen" tab reloads and scrolls to top,
  // same contract as Movimientos/Categorías — see AnimatedTabBar. Scroll is
  // NOT animated here: an animated scroll takes ~300ms to settle, and
  // starting the refresh before it finishes could leave PullToRefresh's
  // indicator revealing itself over content that's still mid-scroll.
  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress' as never, () => {
      if (!navigation.isFocused()) return;
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      handleRefresh();
    });
    return unsubscribe;
  }, [navigation, handleRefresh]);

  const summary = useMemo(() => {
    if (!movements || !categories) return null;
    return calculateMonthSummary(movements, categories);
  }, [movements, categories]);

  const chartPoints = useMemo(() => {
    if (!rangeMovements || !categories) return [];
    const candidateMonths = [];
    for (let offset = -MONTHS_BEFORE; offset <= MONTHS_AFTER; offset++) {
      candidateMonths.push(monthOffset(year, month, offset));
    }
    // Always the full fixed window (MONTHS_BEFORE + selected + MONTHS_AFTER),
    // even when future months have no data yet -- dropping empty points here
    // used to push the selected month off-center whenever it was near a
    // year/month boundary. The selected month must always land at index
    // MONTHS_BEFORE (dead center).
    return buildMonthlySaldoSeries(rangeMovements, categories, candidateMonths);
  }, [rangeMovements, categories, year, month]);

  const isError = movementsError || categoriesError;

  return (
      <PullToRefresh refreshing={refreshing} onRefresh={handleRefresh}>
        {(pullProps) => (
          <Animated.ScrollView ref={scrollRef} className="flex-1 bg-background" {...pullProps}>
            <MonthSelector year={year} month={month} onChange={setMonth} />

            {isError && (
              <ErrorBanner
                message="No se pudo cargar el resumen del mes."
                onRetry={() => { refetchMovements(); refetchCategories(); }}
              />
            )}

            {/* Gated on `summary` alone (see the ensure-checks' own comment
                above for why isLoading isn't part of this) -- once
                movements/categories load once, keepPreviousData means
                `summary` stays populated forever after, so this only ever
                shows on the very first load. */}
            {!summary ? (
              <ScreenSkeleton />
            ) : (
              <>
                {/* Chart lives inside this same gate (not rendered unconditionally
                    above it) so it appears together with the totals below, both at
                    once, instead of painting itself early off of a range query
                    that can still be missing a just-auto-generated movement (a
                    recurring income or fija-category replica) -- that used to
                    flash a $0 bar for the newly-viewed month before correcting
                    itself a moment later. */}
                {chartPoints.length > 0 && (
                  <MonthSaldoChart
                    points={chartPoints}
                    selectedYear={year}
                    selectedMonth={month}
                    onSelectMonth={setMonth}
                  />
                )}

                <Animated.View style={monthContentStyle}>
                  {/* Neobanco-style balance card: one white rounded surface for
                      saldo + ingresos/gastos, instead of the amounts floating
                      directly on the screen background -- see
                      .claude/skills/ui-ux-design. Tabular nums on every peso
                      figure so the digits don't visually shift width as they
                      change month to month. */}
                  <View className="mx-4 mt-4 bg-surface rounded-2xl border border-border p-6" style={cardShadow}>
                    <View className="items-center">
                      <Text className="font-jakarta text-secondary text-sm">Saldo disponible</Text>
                      <Text className="text-4xl font-jakarta-bold text-ink mt-1" style={{ fontVariant: ['tabular-nums'] }}>
                        ${summary.saldoDisponible.toLocaleString('es-CL')}
                      </Text>
                    </View>

                    <View className="flex-row justify-around mt-6 pt-6 border-t border-border">
                      <View className="items-center">
                        <Text className="font-jakarta text-secondary text-xs">Ingresos</Text>
                        <Text
                          className="text-income font-jakarta-semibold text-base mt-0.5"
                          style={{ fontVariant: ['tabular-nums'] }}
                        >
                          ${summary.totalIngresos.toLocaleString('es-CL')}
                        </Text>
                      </View>
                      <View className="items-center">
                        <Text className="font-jakarta text-secondary text-xs">Gastos</Text>
                        <Text
                          className={`font-jakarta-semibold text-base mt-0.5 ${summary.totalGastos > 0 ? 'text-danger' : 'text-ink'}`}
                          style={{ fontVariant: ['tabular-nums'] }}
                        >
                          {summary.totalGastos > 0 ? '-' : ''}${summary.totalGastos.toLocaleString('es-CL')}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <CategoryTotalsList totals={summary.totalsByCategory} onPressCategory={onPressCategory} />
                </Animated.View>
              </>
            )}
          </Animated.ScrollView>
        )}
      </PullToRefresh>
  );
}

export default memo(ResumenScreen);
