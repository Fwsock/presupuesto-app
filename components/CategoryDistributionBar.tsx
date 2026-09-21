import { View } from 'react-native';

export interface DistributionSlice {
  id: string;
  /** Not used by the bar itself -- carried through so callers can build a matching legend (see categorias.tsx) from this same slice array instead of a second parallel one. */
  nombre: string;
  color: string;
  /** Absolute amount this category represents -- only the proportion relative to the other slices matters, not the unit. */
  amount: number;
}

interface CategoryDistributionBarProps {
  slices: DistributionSlice[];
  height?: number;
}

/**
 * Compact segmented bar showing each category's share of this month's
 * gastos at a glance -- one colored segment per category, width
 * proportional to its amount. Renders nothing (not even the empty track)
 * when there's nothing to show yet, so a brand-new account's header doesn't
 * show a dead gray sliver.
 */
export function CategoryDistributionBar({ slices, height = 10 }: CategoryDistributionBarProps) {
  const total = slices.reduce((sum, s) => sum + s.amount, 0);
  if (total <= 0) return null;

  return (
    <View
      className="flex-row overflow-hidden"
      style={{ height, borderRadius: height / 2, backgroundColor: 'rgba(255,255,255,0.18)' }}
    >
      {slices
        .filter((s) => s.amount > 0)
        .map((s) => (
          <View key={s.id} style={{ flex: s.amount / total, backgroundColor: s.color }} />
        ))}
    </View>
  );
}
