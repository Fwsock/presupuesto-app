import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { PressableScale } from './PressableScale';
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

interface ChartBarProps {
  point: MonthlySaldoPoint;
  isSelected: boolean;
  barHeight: number;
  amountLabel: string;
  onPress: () => void;
}

/**
 * One bar/column. Height is a Reanimated shared value so that tapping a bar
 * directly and pressing the `<`/`>` arrows (which both ultimately just call
 * onSelectMonth and shift `points`) animate identically -- the bar for a
 * given column smoothly grows/shrinks to its new value instead of snapping.
 */
function ChartBar({ point, isSelected, barHeight, amountLabel, onPress }: ChartBarProps) {
  const height = useSharedValue(barHeight);
  useEffect(() => {
    height.value = withTiming(barHeight, { duration: 220 });
  }, [barHeight, height]);
  const heightStyle = useAnimatedStyle(() => ({ height: height.value }));

  return (
    // The equal-width-per-bar distribution needs flex-1 on the actual
    // flex child of this row; that's this plain View, not the
    // PressableScale inside it — PressableScale's own style/className
    // size and center *its own* touchable surface, they don't
    // determine how it participates in a parent's flex layout.
    <View className="flex-1">
      <PressableScale
        onPress={onPress}
        className="items-center"
        accessibilityRole="button"
        accessibilityLabel={`${MONTH_SHORT_NAMES[point.month - 1]}, saldo ${amountLabel}`}
      >
        {/* width: '100%' so the label is bound to this column's width
            instead of auto-sizing to its own text — otherwise a wide
            amount like "$950.004" overflows past the column and
            overlaps the neighboring bar/label. adjustsFontSizeToFit
            only has something to shrink against once this box has an
            actual width. */}
        <View style={{ height: 20, width: '100%' }} className="items-center justify-end mb-1">
          {isSelected && (
            <Text
              className={`text-xs font-bold ${point.saldoDisponible < 0 ? 'text-red-600' : 'text-gray-900'}`}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
              style={{ width: '100%', textAlign: 'center' }}
            >
              {amountLabel}
            </Text>
          )}
        </View>

        <Animated.View
          className={`w-5 rounded-t-md ${isSelected ? 'bg-blue-600' : 'bg-gray-300'}`}
          style={heightStyle}
        />

        <Text className={`text-xs mt-2 ${isSelected ? 'font-bold text-gray-900' : 'text-gray-400'}`}>
          {MONTH_SHORT_NAMES[point.month - 1]}
        </Text>
      </PressableScale>
    </View>
  );
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
    // gap is a fixed pixel value (not derived from column count or content),
    // so the spacing between bars never changes with the selected month or
    // how many points are in range — only each column's own width flexes.
    <View className="flex-row items-end px-2 pt-8" style={{ height: CHART_HEIGHT + 56, gap: 3 }}>
      {points.map((point, index) => {
        const isSelected = point.year === selectedYear && point.month === selectedMonth;
        const barHeight = Math.max(
          MIN_BAR_HEIGHT,
          (Math.abs(point.saldoDisponible) / maxAbsSaldo) * CHART_HEIGHT
        );
        const amountLabel = `${point.saldoDisponible < 0 ? '-' : ''}$${Math.abs(point.saldoDisponible).toLocaleString('es-CL')}`;

        return (
          // Keyed by column index, not `${year}-${month}` -- the window is a
          // fixed set of 7 columns that shifts its *content* as the selected
          // month changes, so keeping each column's component identity
          // stable across a shift is what lets the height animation above
          // actually run instead of unmount/remount-ing a fresh bar at the
          // final height every time.
          <ChartBar
            key={index}
            point={point}
            isSelected={isSelected}
            barHeight={barHeight}
            amountLabel={amountLabel}
            onPress={() => onSelectMonth(point.year, point.month)}
          />
        );
      })}
    </View>
  );
}
