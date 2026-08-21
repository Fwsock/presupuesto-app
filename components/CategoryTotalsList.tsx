import { memo } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from './PressableScale';
import type { CategoryTotal } from '../features/movements/summary';

interface CategoryTotalsListProps {
  totals: CategoryTotal[];
  onPressCategory?: (categoryId: string) => void;
}

interface CategoryTotalRowProps {
  total: CategoryTotal;
  isLast: boolean;
  onPress: ((categoryId: string) => void) | undefined;
}

// React.memo'd + item-aware onPress (one stable function shared by every
// row, rather than a fresh `() => onPressCategory?.(t.categoryId)` closure
// per row per render) so re-rendering the parent (e.g. a month switch)
// doesn't force every category row to re-render too when its own data
// didn't change.
const CategoryTotalRow = memo(function CategoryTotalRow({ total: t, isLast, onPress }: CategoryTotalRowProps) {
  return (
    <PressableScale
      onPress={() => onPress?.(t.categoryId)}
      // Ultra-soft press feedback for a full-width card row -- the
      // default scaleTo/activeOpacity (0.85/0.6) is tuned for small
      // icon-only buttons and read as an abrupt flash here.
      scaleTo={0.965}
      activeOpacity={0.7}
      spring
      haptics
      className={`flex-row items-center justify-between px-4 py-4 ${isLast ? '' : 'border-b border-border'}`}
    >
      <Text className="flex-1 text-ink font-medium">{t.nombre}</Text>
      <Text
        className={t.total === 0 ? 'text-ink font-semibold' : t.tipo === 'ingreso' ? 'text-income font-semibold' : 'text-danger font-semibold'}
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {t.total > 0 && t.tipo === 'gasto' ? '-' : ''}${t.total.toLocaleString('es-CL')}
      </Text>
      <Ionicons name="chevron-forward" size={18} color="#CBD5E1" style={{ marginLeft: 6 }} />
    </PressableScale>
  );
});

export function CategoryTotalsList({ totals, onPressCategory }: CategoryTotalsListProps) {
  return (
    // Same white-card treatment as the balance card above it (see
    // .claude/skills/ui-ux-design) -- one elevated surface for the whole
    // list, rows separated by a hairline divider, instead of each category
    // floating as plain text directly on the screen background.
    <View
      className="mx-4 mt-4 bg-surface rounded-2xl border border-border"
      style={{ shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 0 }}
    >
      {totals.map((t, index) => (
        <CategoryTotalRow key={t.categoryId} total={t} isLast={index === totals.length - 1} onPress={onPressCategory} />
      ))}
    </View>
  );
}
