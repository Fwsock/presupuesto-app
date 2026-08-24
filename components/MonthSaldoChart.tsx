import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Line, Rect, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { PressableScale } from './PressableScale';
import { theme } from '../lib/theme';
import { calculateAverageGasto, monthOffset, type MonthlySaldoPoint } from '../features/movements/monthlySeries';

const MONTH_SHORT_NAMES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

const BAR_MAX_HEIGHT = 88;
const BAR_WIDTH = 11;
const BAR_GAP = 4;
const MIN_BAR_HEIGHT = 3;
// Fixed extra space reserved below the bars themselves, so the avg line's
// `bottom` offset (LABEL_AREA_HEIGHT + scaled value) can be computed once
// here instead of re-measured at render time.
const LABEL_AREA_HEIGHT = 26;

const INCOME_GRADIENT = { from: '#34D399', to: '#059669' }; // emerald-400 -> emerald-600
const EXPENSE_GRADIENT = { from: '#FB7185', to: '#DC2626' }; // rose-400 -> red-600

function formatCLP(value: number): string {
  return `$${Math.round(Math.abs(value)).toLocaleString('es-CL')}`;
}

/**
 * Fills its parent with a top-to-bottom color gradient. Deliberately NOT
 * tied to the parent's real pixel height -- viewBox="0 0 1 1" with
 * preserveAspectRatio="none" makes this a 1x1 unit square stretched to
 * whatever size the parent (the animated bar below) happens to be at any
 * given frame, so the gradient just rides along as that height animates
 * instead of needing its own Reanimated-driven SVG props.
 */
function GradientFill({ from, to }: { from: string; to: string }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Defs>
        <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={from} />
          <Stop offset="1" stopColor={to} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="1" height="1" fill="url(#grad)" />
    </Svg>
  );
}

interface GradientBarProps {
  targetHeight: number;
  from: string;
  to: string;
}

/** One bar (income or expense side). Height animates the same way the old single bar did. */
function GradientBar({ targetHeight, from, to }: GradientBarProps) {
  const height = useSharedValue(targetHeight);
  useEffect(() => {
    height.value = withTiming(targetHeight, { duration: 220 });
  }, [targetHeight, height]);
  const heightStyle = useAnimatedStyle(() => ({ height: height.value }));

  return (
    <Animated.View
      className="rounded-t-md overflow-hidden"
      style={[heightStyle, { width: BAR_WIDTH }]}
    >
      <GradientFill from={from} to={to} />
    </Animated.View>
  );
}

interface Comparison {
  direction: 'down' | 'up' | 'flat';
  text: string;
}

// A previous-month gasto below this share of the chart's own scale isn't a
// meaningful baseline to divide by -- going from "almost nothing" to a real
// amount produces a technically-correct but useless percentage (seen in
// practice: "▲ 4298% vs Jul" when July had a few thousand pesos logged and
// August had normal spending). Below this floor, fall back to the average
// the same way a genuinely-missing previous month does.
const MEANINGFUL_BASELINE_RATIO = 0.05;

/**
 * Compares the selected month's gasto against the previous month's, falling
 * back to the visible window's average when there's no previous-month data,
 * it was zero, or it's too small relative to the chart's scale to be a
 * meaningful baseline -- covers the very first month in someone's history,
 * a previous month with nothing logged, or one with only a token amount.
 */
function compareGasto(
  selectedPoint: MonthlySaldoPoint,
  points: MonthlySaldoPoint[],
  avgGasto: number,
  maxAmount: number
): Comparison | null {
  const prevKey = monthOffset(selectedPoint.year, selectedPoint.month, -1);
  const prevPoint = points.find((p) => p.year === prevKey.year && p.month === prevKey.month);
  const meaningfulFloor = maxAmount * MEANINGFUL_BASELINE_RATIO;

  let baseline: number;
  let baselineLabel: string;
  if (prevPoint && prevPoint.totalGastos >= meaningfulFloor) {
    baseline = prevPoint.totalGastos;
    baselineLabel = `vs ${MONTH_SHORT_NAMES[prevPoint.month - 1]}`;
  } else if (avgGasto > 0) {
    baseline = avgGasto;
    baselineLabel = 'vs Promedio';
  } else {
    return null;
  }

  const diffPct = ((selectedPoint.totalGastos - baseline) / baseline) * 100;
  const rounded = Math.round(Math.abs(diffPct));
  if (rounded === 0) return { direction: 'flat', text: `= ${rounded}% ${baselineLabel}` };
  return { direction: diffPct < 0 ? 'down' : 'up', text: `${diffPct < 0 ? '▼' : '▲'} ${rounded}% ${baselineLabel}` };
}

function ComparisonBadge({ comparison }: { comparison: Comparison }) {
  const palette =
    comparison.direction === 'down'
      ? { bg: 'bg-green-50', text: 'text-green-700' }
      : comparison.direction === 'up'
        ? { bg: 'bg-red-50', text: 'text-red-700' }
        : { bg: 'bg-gray-100', text: 'text-gray-500' };

  return (
    <View className={`rounded-full px-2 py-1 ${palette.bg}`}>
      <Text className={`text-xs font-jakarta-semibold ${palette.text}`}>{comparison.text}</Text>
    </View>
  );
}

interface ChartColumnProps {
  point: MonthlySaldoPoint;
  isSelected: boolean;
  incomeHeight: number;
  expenseHeight: number;
  onPress: () => void;
}

function ChartColumn({ point, isSelected, incomeHeight, expenseHeight, onPress }: ChartColumnProps) {
  return (
    // flex-1 goes on this wrapping View, not PressableScale's own className
    // -- PressableScale's className/style land on its inner Pressable, one
    // level below the Animated.View that's the actual flex child here (see
    // the identical note on MovementListItem's row / cuenta.tsx's
    // Compartir/Copiar buttons -- same underlying PressableScale quirk).
    <View className="flex-1">
      <PressableScale
        onPress={onPress}
        className={`items-center rounded-xl py-1 ${isSelected ? 'bg-blue-50' : ''}`}
        accessibilityRole="button"
        accessibilityLabel={`${MONTH_SHORT_NAMES[point.month - 1]}, ingresos ${formatCLP(point.totalIngresos)}, gastos ${formatCLP(point.totalGastos)}`}
      >
        <View className="flex-row items-end justify-center" style={{ height: BAR_MAX_HEIGHT, gap: BAR_GAP }}>
          <GradientBar targetHeight={incomeHeight} from={INCOME_GRADIENT.from} to={INCOME_GRADIENT.to} />
          <GradientBar targetHeight={expenseHeight} from={EXPENSE_GRADIENT.from} to={EXPENSE_GRADIENT.to} />
        </View>

        <Text className={`text-xs mt-1.5 ${isSelected ? 'font-jakarta-bold text-ink' : 'font-jakarta-medium text-secondary'}`}>
          {MONTH_SHORT_NAMES[point.month - 1]}
        </Text>
      </PressableScale>
    </View>
  );
}

interface MonthSaldoChartProps {
  points: MonthlySaldoPoint[];
  selectedYear: number;
  selectedMonth: number;
  onSelectMonth: (year: number, month: number) => void;
}

/**
 * Bi-color income/expense bar chart, one column per month (two contiguous
 * gradient bars: emerald for ingresos, rose for gastos), plus a floating
 * tooltip over the selected month and a dashed line marking the average
 * monthly gasto across the visible window. Doubles as month navigation:
 * tapping any column selects that month, same as the arrows in
 * MonthSelector -- selection is lifted to onSelectMonth (backed by
 * useSelectedMonth, shared with Movimientos), so it already refreshes
 * Resumen's totals and category list globally, no local state here.
 * Built with plain Views (no charting library) -- the app has no chart
 * dependency, and react-native-svg (already linked for the QR code and a
 * couple of icons) is enough for the gradient fills.
 */
export function MonthSaldoChart({ points, selectedYear, selectedMonth, onSelectMonth }: MonthSaldoChartProps) {
  const maxAmount = Math.max(1, ...points.map((p) => Math.max(p.totalIngresos, p.totalGastos)));

  const avgGasto = calculateAverageGasto(points);
  const avgLineOffset = avgGasto > 0 ? Math.min(BAR_MAX_HEIGHT, (avgGasto / maxAmount) * BAR_MAX_HEIGHT) : null;

  const selectedPoint = points.find((p) => p.year === selectedYear && p.month === selectedMonth);
  const comparison = selectedPoint ? compareGasto(selectedPoint, points, avgGasto, maxAmount) : null;

  const handleSelect = (year: number, month: number) => {
    Haptics.selectionAsync().catch(() => {});
    onSelectMonth(year, month);
  };

  return (
    // Same white-card treatment as the balance/category cards below it (see
    // .claude/skills/ui-ux-design) -- the chart used to float directly on
    // the screen background with no surface of its own.
    <View
      className="mx-4 mt-4 bg-surface rounded-2xl border border-border pb-2"
      style={{ shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 0 }}
    >
      {/* Right-aligned row instead of an absolute overlay -- reads as "top
          right corner of the chart" without needing z-index/overlap math
          against the tallest bar. Reserves its own row height always (not
          just when `comparison` resolves) so the bars below never shift. */}
      <View className="flex-row justify-end px-3 pt-3 pb-1" style={{ minHeight: 26 }}>
        {comparison && <ComparisonBadge comparison={comparison} />}
      </View>

      {/* gap is a fixed pixel value (not derived from column count or content),
          so the spacing between columns never changes with the selected month
          or how many points are in range -- only each column's own width flexes. */}
      <View className="flex-row items-end px-3" style={{ height: BAR_MAX_HEIGHT + LABEL_AREA_HEIGHT, gap: 6 }}>
        {avgLineOffset !== null && (
          // RN's own `borderStyle: 'dashed'` is silently unsupported on this
          // Fabric/New Architecture setup (confirmed via a runtime "WARN
          // Unsupported dashed / dotted border style" -- the border simply
          // never painted, at any width/opacity/color). SVG's
          // stroke-dasharray has no such gap, so the line is drawn with
          // react-native-svg instead -- same library already used for the
          // bar gradients. Rendered BEFORE the columns below (so bars paint
          // over it, same as any reference line crossing behind data marks)
          // -- only the amount label needs to sit above them, see below.
          <View
            pointerEvents="none"
            style={{ position: 'absolute', left: 12, right: 12, bottom: LABEL_AREA_HEIGHT + avgLineOffset - 1 }}
          >
            <Svg width="100%" height={2}>
              <Line x1="0" y1="1" x2="100%" y2="1" stroke={theme.secondary} strokeWidth={1.5} strokeDasharray="4,4" strokeOpacity={0.45} />
            </Svg>
          </View>
        )}

        {points.map((point, index) => {
          const isSelected = point.year === selectedYear && point.month === selectedMonth;
          const incomeHeight = Math.max(MIN_BAR_HEIGHT, (point.totalIngresos / maxAmount) * BAR_MAX_HEIGHT);
          const expenseHeight = Math.max(MIN_BAR_HEIGHT, (point.totalGastos / maxAmount) * BAR_MAX_HEIGHT);

          return (
            // Keyed by column index, not `${year}-${month}` -- the window is a
            // fixed set of 7 columns that shifts its *content* as the selected
            // month changes, so keeping each column's component identity
            // stable across a shift is what lets the height animation above
            // actually run instead of unmount/remount-ing a fresh bar at the
            // final height every time.
            <ChartColumn
              key={index}
              point={point}
              isSelected={isSelected}
              incomeHeight={incomeHeight}
              expenseHeight={expenseHeight}
              onPress={() => handleSelect(point.year, point.month)}
            />
          );
        })}

        {avgLineOffset !== null && (
          // Declared AFTER the columns above (not alongside the line itself)
          // so it paints on top of whichever bar happens to reach through
          // this height -- a bare transparent Text here used to render
          // UNDER the columns (same document-order stacking) and get lost
          // behind/inside tall bars near the chart's right edge. The small
          // bg-surface backing is a second safety net for the same problem:
          // legible even if a future tweak reorders this again.
          <View
            pointerEvents="none"
            className="bg-surface rounded px-1"
            style={{ position: 'absolute', right: 12, bottom: LABEL_AREA_HEIGHT + avgLineOffset + 3 }}
          >
            <Text className="text-slate-400 font-jakarta-medium text-[10px]">{formatCLP(avgGasto)} Prom.</Text>
          </View>
        )}
      </View>
    </View>
  );
}
