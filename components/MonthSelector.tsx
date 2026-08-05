import { useState } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from './PressableScale';
import { MonthYearPickerModal } from './MonthYearPickerModal';
import { MONTH_NAMES } from '../features/shared/monthNames';

interface MonthSelectorProps {
  year: number;
  month: number; // 1-12
  onChange: (year: number, month: number) => void;
}

export function MonthSelector({ year, month, onChange }: MonthSelectorProps) {
  const [pickerVisible, setPickerVisible] = useState(false);
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

      <PressableScale
        onPress={() => setPickerVisible(true)}
        className="flex-row items-center px-2 py-1 rounded-full"
        accessibilityRole="button"
        accessibilityLabel="Elegir mes y año"
      >
        <Text className="text-base font-semibold mr-1">
          {MONTH_NAMES[month - 1]} {year}
        </Text>
        <Ionicons name="chevron-down" size={16} color="#6b7280" />
      </PressableScale>

      <PressableScale
        onPress={goNext}
        style={{ minWidth: 48, minHeight: 48 }}
        className="items-center justify-center rounded-full"
        accessibilityRole="button"
        accessibilityLabel="Mes siguiente"
      >
        <Ionicons name="chevron-forward" size={28} color="#111827" />
      </PressableScale>

      <MonthYearPickerModal
        visible={pickerVisible}
        year={year}
        month={month}
        onSelect={(y, m) => {
          onChange(y, m);
          setPickerVisible(false);
        }}
        onClose={() => setPickerVisible(false)}
      />
    </View>
  );
}
