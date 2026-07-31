import { View, Text, Pressable } from 'react-native';

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
    <View className="flex-row items-center justify-center py-3">
      <Pressable onPress={goPrev} className="px-4">
        <Text className="text-lg">‹</Text>
      </Pressable>
      <Text className="text-base font-semibold">
        {MONTH_NAMES[month - 1]} {year}
      </Text>
      <Pressable onPress={goNext} className="px-4">
        <Text className="text-lg">›</Text>
      </Pressable>
    </View>
  );
}
