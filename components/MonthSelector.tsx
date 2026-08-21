import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
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

  // One persistent Text, no key/remount: a real entering+exiting pair keyed
  // on `${year}-${month}` used to leave the OLD label (exiting) and NEW
  // label (entering) both mounted in the same commit, overlapping in the
  // same spot -- that ghosting is what read as a flicker before, not the
  // fade itself. A single shared value dipping to 0 and back on the same
  // element gets the same soft "out then in" feel with nothing to overlap.
  const labelOpacity = useSharedValue(1);
  useEffect(() => {
    labelOpacity.value = withSequence(withTiming(0, { duration: 90 }), withTiming(1, { duration: 90 }));
  }, [year, month, labelOpacity]);
  const labelStyle = useAnimatedStyle(() => ({ opacity: labelOpacity.value }));

  return (
    <View className="items-center py-3">
      {/* Floating white pill (see .claude/skills/ui-ux-design) -- used to be
          three bare touch targets floating directly on the page background.
          Explicit solid backgroundColor (not just the bg-surface class) plus
          elevation: 0 -- Android's elevation shadow renders as a harder,
          darker edge than the soft iOS shadow props below. */}
      <View
        className="flex-row items-center rounded-full border border-border pl-1 pr-2 py-1"
        style={{
          backgroundColor: '#FFFFFF',
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 6,
          elevation: 0,
        }}
      >
        <PressableScale
          onPress={goPrev}
          style={{ minWidth: 40, minHeight: 40 }}
          className="items-center justify-center rounded-full"
          accessibilityRole="button"
          accessibilityLabel="Mes anterior"
        >
          <Ionicons name="chevron-back" size={22} color="#111827" />
        </PressableScale>

        <PressableScale
          onPress={() => setPickerVisible(true)}
          className="flex-row items-center px-2 py-1 rounded-full"
          accessibilityRole="button"
          accessibilityLabel="Elegir mes y año"
        >
          <Animated.Text style={labelStyle} className="text-base font-semibold text-ink mr-1">
            {MONTH_NAMES[month - 1]} {year}
          </Animated.Text>
          <Ionicons name="chevron-down" size={16} color="#64748B" />
        </PressableScale>

        <PressableScale
          onPress={goNext}
          style={{ minWidth: 40, minHeight: 40 }}
          className="items-center justify-center rounded-full"
          accessibilityRole="button"
          accessibilityLabel="Mes siguiente"
        >
          <Ionicons name="chevron-forward" size={22} color="#111827" />
        </PressableScale>
      </View>

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
