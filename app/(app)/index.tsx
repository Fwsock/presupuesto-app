import { useMemo, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useMovements } from '../../features/movements/hooks';
import { useCategories } from '../../features/categories/hooks';
import { calculateMonthSummary } from '../../features/movements/summary';
import { MonthSelector } from '../../components/MonthSelector';
import { CategoryTotalsList } from '../../components/CategoryTotalsList';
import { ErrorBanner } from '../../components/ErrorBanner';

export default function ResumenScreen() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data: movements, isLoading: loadingMovements, isError: movementsError, refetch: refetchMovements } = useMovements(year, month);
  const { data: categories, isLoading: loadingCategories, isError: categoriesError, refetch: refetchCategories } = useCategories();

  const summary = useMemo(() => {
    if (!movements || !categories) return null;
    return calculateMonthSummary(movements, categories);
  }, [movements, categories]);

  const isLoading = loadingMovements || loadingCategories;
  const isError = movementsError || categoriesError;

  return (
    <ScrollView className="flex-1 bg-white">
      <MonthSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />

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

          <CategoryTotalsList totals={summary.totalsByCategory} />
        </>
      )}
    </ScrollView>
  );
}
