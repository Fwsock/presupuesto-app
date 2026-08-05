import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { useEnsureFixedCategoryMovementsForMonth, useMovements, useMovementsForMonthRange } from '../../features/movements/hooks';
import { useEnsureRecurringIncomeForMonth } from '../../features/income/hooks';
import { useCategories } from '../../features/categories/hooks';
import { calculateMonthSummary } from '../../features/movements/summary';
import { buildMonthlySaldoSeries, monthOffset } from '../../features/movements/monthlySeries';
import { MonthSelector } from '../../components/MonthSelector';
import { MonthSaldoChart } from '../../components/MonthSaldoChart';
import { CategoryTotalsList } from '../../components/CategoryTotalsList';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ScreenSkeleton } from '../../components/Skeleton';
import { useSelectedMonth } from '../../features/shared/selected-month';
import { withMinDuration } from '../../features/shared/withMinDuration';
import { FadeTabScreen } from '../../components/FadeTabScreen';

// More months before/after = a denser chart (per UX request), while still
// keeping the selected month roughly centered.
const MONTHS_BEFORE = 3;
const MONTHS_AFTER = 3;

export default function ResumenScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const scrollRef = useRef<ScrollView>(null);
  const { year, month, setMonth } = useSelectedMonth();

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
  // trigger a second fetch, it just lets THIS screen observe their loading
  // state too. Both silently insert a movement (recurring income / a fija
  // category's monthly replica) and only settle once the movements list has
  // caught up -- without waiting on them here, the screen could render its
  // real totals for a moment using the pre-generation (still empty) list,
  // flashing $0 before the actual amount.
  const { isLoading: loadingRecurringIncomeCheck } = useEnsureRecurringIncomeForMonth(year, month);
  const { isLoading: loadingFixedCategoriesCheck } = useEnsureFixedCategoryMovementsForMonth(year, month);

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
  // NOT animated here: an animated scroll takes ~300ms to settle, and on
  // iOS the RefreshControl spinner only renders while the scroll offset is
  // at/above 0 -- starting the refresh before the scroll finishes could
  // leave the spinner invisible for that whole window.
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

  const isLoading =
    loadingMovements || loadingCategories || loadingRecurringIncomeCheck || loadingFixedCategoriesCheck;
  const isError = movementsError || categoriesError;

  return (
    <FadeTabScreen>
    <ScrollView
      ref={scrollRef}
      className="flex-1 bg-white"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <MonthSelector year={year} month={month} onChange={setMonth} />

      {isError && (
        <ErrorBanner
          message="No se pudo cargar el resumen del mes."
          onRetry={() => { refetchMovements(); refetchCategories(); }}
        />
      )}

      {isLoading || !summary ? (
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

          <View className="items-center py-6">
            <Text className="text-gray-500">Saldo disponible</Text>
            <Text className="text-3xl font-bold">${summary.saldoDisponible.toLocaleString('es-CL')}</Text>
          </View>

          <View className="flex-row justify-around mb-4">
            <View className="items-center">
              <Text className="text-gray-500 text-xs">Ingresos</Text>
              <Text className="text-green-600 font-semibold">${summary.totalIngresos.toLocaleString('es-CL')}</Text>
            </View>
            <View className="items-center">
              <Text className="text-gray-500 text-xs">Gastos</Text>
              <Text className={summary.totalGastos > 0 ? 'text-red-600 font-semibold' : 'text-gray-800 font-semibold'}>
                {summary.totalGastos > 0 ? '-' : ''}${summary.totalGastos.toLocaleString('es-CL')}
              </Text>
            </View>
          </View>

          <CategoryTotalsList
            totals={summary.totalsByCategory}
            onPressCategory={(categoryId) =>
              router.push({ pathname: '/movimientos', params: { categoryId } })
            }
          />
        </>
      )}
    </ScrollView>
    </FadeTabScreen>
  );
}
