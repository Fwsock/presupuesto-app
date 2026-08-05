import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from './PressableScale';
import { MONTH_NAMES } from '../features/shared/monthNames';

const MONTH_ABBR = MONTH_NAMES.map((name) => name.slice(0, 3));

interface MonthYearPickerModalProps {
  visible: boolean;
  year: number;
  month: number; // 1-12
  onSelect: (year: number, month: number) => void;
  onClose: () => void;
}

/**
 * Two-tap month/year picker (pick the year with the arrows, then tap a
 * month) -- opened from MonthSelector so jumping to any month of any year
 * doesn't require stepping through every month in between with the
 * prev/next arrows. Same fade+scale center-card chrome as ConfirmDialog.
 */
export function MonthYearPickerModal({ visible, year, month, onSelect, onClose }: MonthYearPickerModalProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const [mounted, setMounted] = useState(visible);
  const [viewYear, setViewYear] = useState(year);

  useEffect(() => {
    if (visible) {
      setViewYear(year);
      setMounted(true);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 8, tension: 80 }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.9, duration: 120, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, year]);

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Animated.View className="flex-1 justify-center items-center bg-black/40 px-8" style={{ opacity }}>
        <Pressable
          onPress={onClose}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
        />
        <Animated.View className="bg-white rounded-2xl p-5 w-full" style={{ transform: [{ scale }], maxWidth: 340 }}>
          <View className="flex-row items-center justify-between mb-4">
            <PressableScale
              onPress={() => setViewYear(viewYear - 1)}
              style={{ width: 40, height: 40 }}
              className="items-center justify-center rounded-full"
              accessibilityRole="button"
              accessibilityLabel="Año anterior"
            >
              <Ionicons name="chevron-back" size={22} color="#111827" />
            </PressableScale>
            <Text className="text-base font-semibold">{viewYear}</Text>
            <PressableScale
              onPress={() => setViewYear(viewYear + 1)}
              style={{ width: 40, height: 40 }}
              className="items-center justify-center rounded-full"
              accessibilityRole="button"
              accessibilityLabel="Año siguiente"
            >
              <Ionicons name="chevron-forward" size={22} color="#111827" />
            </PressableScale>
          </View>

          {[0, 1, 2, 3].map((row) => (
            <View key={row} className="flex-row justify-between mb-2">
              {MONTH_ABBR.slice(row * 3, row * 3 + 3).map((label, col) => {
                const m = row * 3 + col + 1;
                const isActive = viewYear === year && m === month;
                return (
                  <PressableScale
                    key={m}
                    onPress={() => onSelect(viewYear, m)}
                    style={{ width: 92, height: 44 }}
                    className={`items-center justify-center rounded-lg ${isActive ? 'bg-blue-600' : 'bg-gray-50'}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${MONTH_NAMES[m - 1]} ${viewYear}`}
                  >
                    <Text className={`font-medium ${isActive ? 'text-white' : 'text-gray-700'}`}>{label}</Text>
                  </PressableScale>
                );
              })}
            </View>
          ))}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
