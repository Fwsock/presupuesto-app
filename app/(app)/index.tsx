import { useMemo } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useMovements, useMovementsForMonthRange } from '../../features/movements/hooks';
import { useCategories } from '../../features/categories/hooks';
import { calculateMonthSummary } from '../../features/movements/summary';
import { buildMonthlySaldoSeries, monthOffset } from '../../features/movements/monthlySeries';
import { MonthSelector } from '../../components/MonthSelector';
import { MonthSaldoChart } from '../../components/MonthSaldoChart';
import { CategoryTotalsList } from '../../components/CategoryTotalsList';
import { ErrorBanner } from '../../components/ErrorBanner';
import { VariableIncomePromptModal } from '../../components/VariableIncomePromptModal';
import { useSelectedMonth } from '../../features/shared/selected-month';
import { useVariableIncomePromptState } from '../../features/income/hooks';

const MONTHS_BEFORE = 2;
const MONTHS_AFTER = 2;

export default function ResumenScreen() {
  const router = useRouter();
  const { year, month, setMonth } = useSelectedMonth();

  const { data: movements, isLoading: loadingMovements, isError: movementsError, refetch: refetchMovements } = useMovements(year, month);
  const { data: categories, isLoading: loadingCategories, isError: categoriesError, refetch: refetchCategories } = useCategories();
  const { data: rangeMovements } = useMovementsForMonthRange(year, month, MONTHS_BEFORE, MONTHS_AFTER);

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
    const series = buildMonthlySaldoSeries(rangeMovements, categories, candidateMonths);
    // Past months (offset <= 0) always show, even with $0/no data, so the
    // chart keeps a consistent shape. Future months only show once a cuota
    // or other movement has actually been created for them.
    return series.filter((point, index) => index <= MONTHS_BEFORE || point.hasMovements);
  }, [rangeMovements, categories, year, month]);

  const isLoading = loadingMovements || loadingCategories;
  const isError = movementsError || categoriesError;

  const variableIncomePrompt = useVariableIncomePromptState(year, month);

  return (
    <ScrollView className="flex-1 bg-white">
      {chartPoints.length > 0 && (
        <MonthSaldoChart
          points={chartPoints}
          selectedYear={year}
          selectedMonth={month}
          onSelectMonth={setMonth}
        />
      )}

      <MonthSelector year={year} month={month} onChange={setMonth} />

      {isError && (
        <ErrorBanner
          message="No se pudo cargar el resumen del mes."
          onRetry={() => { refetchMovements(); refetchCategories(); }}
        />
      )}

      {isLoading || !summary ? (
        <Text className="p-4">Cargando...</Text>
      ) : (
        <>
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
              <Text className="text-red-600 font-semibold">${summary.totalGastos.toLocaleString('es-CL')}</Text>
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

      <VariableIncomePromptModal
        visible={variableIncomePrompt.visible}
        concepto={variableIncomePrompt.concepto}
        year={year}
        month={month}
        loading={variableIncomePrompt.loading}
        error={variableIncomePrompt.error}
        onSubmit={variableIncomePrompt.submit}
        onSkip={variableIncomePrompt.skip}
        onDismissError={variableIncomePrompt.dismissError}
      />
    </ScrollView>
  );
}
