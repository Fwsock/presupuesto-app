import { Pressable, Text, View } from 'react-native';
import type { MonthlySaldoPoint } from '../features/movements/monthlySeries';

const MONTH_SHORT_NAMES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

const CHART_HEIGHT = 96;
const MIN_BAR_HEIGHT = 4;

interface MonthSaldoChartProps {
  points: MonthlySaldoPoint[];
  selectedYear: number;
  selectedMonth: number;
  onSelectMonth: (year: number, month: number) => void;
}

/**
 * Horizontal row of one bar per month (saldo disponible), the selected month
 * highlighted with its amount floating above it. Doubles as month navigation:
 * tapping any bar selects that month, same as the arrows in MonthSelector.
 * Built with plain Views/Pressable (no charting library) — the app has no
 * chart dependency yet and this is simple enough not to need one.
 */
export function MonthSaldoChart({ points, selectedYear, selectedMonth, onSelectMonth }: MonthSaldoChartProps) {
  const maxAbsSaldo = Math.max(1, ...points.map((p) => Math.abs(p.saldoDisponible)));

  return (
    <View className="flex-row items-end justify-around px-2 pt-8" style={{ height: CHART_HEIGHT + 56 }}>
      {points.map((point) => {
        const isSelected = point.year === selectedYear && point.month === selectedMonth;
        const barHeight = Math.max(
          MIN_BAR_HEIGHT,
          (Math.abs(point.saldoDisponible) / maxAbsSaldo) * CHART_HEIGHT
        );
        const amountLabel = `${point.saldoDisponible < 0 ? '-' : ''}$${Math.abs(point.saldoDisponible).toLocaleString('es-CL')}`;

        return (
          <Pressable
            key={`${point.year}-${point.month}`}
            onPress={() => onSelectMonth(point.year, point.month)}
            className="flex-1 items-center"
            accessibilityRole="button"
            accessibilityLabel={`${MONTH_SHORT_NAMES[point.month - 1]}, saldo ${amountLabel}`}
          >
            <View style={{ height: 20 }} className="items-center justify-end mb-1">
              {isSelected && (
                <Text
                  className={`text-xs font-bold ${point.saldoDisponible < 0 ? 'text-red-600' : 'text-gray-900'}`}
                  numberOfLines={1}
                >
                  {amountLabel}
                </Text>
              )}
            </View>

            <View
              className={`w-7 rounded-t-md ${isSelected ? 'bg-blue-600' : 'bg-gray-300'}`}
              style={{ height: barHeight }}
            />

            <Text
              className={`text-xs mt-2 ${isSelected ? 'font-bold text-gray-900' : 'text-gray-400'}`}
            >
              {MONTH_SHORT_NAMES[point.month - 1]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
