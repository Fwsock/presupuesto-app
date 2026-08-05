import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from './PressableScale';
import { MONTH_NAMES } from '../features/shared/monthNames';

interface MonthSelectorProps {
  year: number;
  month: number; // 1-12
  onChange: (year: number, month: number) => void;
}

export function MonthSelector({ year, month, onChange }: MonthSelectorProps) {
  const goPrev = () => (month === 1 ? onChange(year - 1, 12) : onChange(year, month - 1));
  const goNext = () => (month === 12 ? onChange(year + 1, 1) : onChange(year, month + 1));

  return (
    <View className="flex-row items-center justify-center py-2">
      <PressableScale
        onPress={goPrev}
        style={{ minWidth: 48, minHeight: 48 }}
        className="items-center justify-center rounded-full"
        accessibilityRole="button"
        accessibilityLabel="Mes anterior"
      >
        <Ionicons name="chevron-back" size={28} color="#111827" />
      </PressableScale>
      <Text className="text-base font-semibold">
        {MONTH_NAMES[month - 1]} {year}
      </Text>
      <PressableScale
        onPress={goNext}
        style={{ minWidth: 48, minHeight: 48 }}
        className="items-center justify-center rounded-full"
        accessibilityRole="button"
        accessibilityLabel="Mes siguiente"
      >
        <Ionicons name="chevron-forward" size={28} color="#111827" />
      </PressableScale>
    </View>
  );
}
