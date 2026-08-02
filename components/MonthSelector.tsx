import { View, Text } from 'react-native';
import { PressableScale } from './PressableScale';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

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
        style={{ minWidth: 44, minHeight: 44 }}
        className="items-center justify-center"
        accessibilityRole="button"
        accessibilityLabel="Mes anterior"
      >
        <Text className="text-2xl">‹</Text>
      </PressableScale>
      <Text className="text-base font-semibold">
        {MONTH_NAMES[month - 1]} {year}
      </Text>
      <PressableScale
        onPress={goNext}
        style={{ minWidth: 44, minHeight: 44 }}
        className="items-center justify-center"
        accessibilityRole="button"
        accessibilityLabel="Mes siguiente"
      >
        <Text className="text-2xl">›</Text>
      </PressableScale>
    </View>
  );
}
