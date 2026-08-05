import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from './PressableScale';
import { buildCalendarGrid } from '../features/movements/calendarGrid';
import { formatISODate, isValidISODate, parseISODate } from '../features/movements/date';
import { MONTH_NAMES } from '../features/shared/monthNames';

const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const CELL_SIZE = 36;

interface CalendarPickerModalProps {
  visible: boolean;
  /** 'YYYY-MM-DD', or '' if nothing is selected yet. */
  value: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}

/**
 * Fully custom month-grid date picker, replacing the platform's native
 * DateTimePicker everywhere a date is chosen in this app -- Android's native
 * picker is a system dialog that can't be restyled with the app's own
 * colors, so this renders its own grid instead. Same fade+scale center-card
 * chrome as ConfirmDialog.
 */
export function CalendarPickerModal({ visible, value, onSave, onCancel }: CalendarPickerModalProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const [mounted, setMounted] = useState(visible);
  const [viewYear, setViewYear] = useState(() => (isValidISODate(value) ? parseISODate(value)!.getFullYear() : new Date().getFullYear()));
  const [viewMonth, setViewMonth] = useState(() => (isValidISODate(value) ? parseISODate(value)!.getMonth() + 1 : new Date().getMonth() + 1));
  const [selected, setSelected] = useState(isValidISODate(value) ? value : '');

  useEffect(() => {
    if (visible) {
      const base = isValidISODate(value) ? parseISODate(value)! : new Date();
      setViewYear(base.getFullYear());
      setViewMonth(base.getMonth() + 1);
      setSelected(isValidISODate(value) ? value : '');
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
  }, [visible]);

  if (!mounted) return null;

  const todayISO = formatISODate(new Date());
  const cells = buildCalendarGrid(viewYear, viewMonth);

  const goPrevMonth = () => {
    if (viewMonth === 1) {
      setViewYear(viewYear - 1);
      setViewMonth(12);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };
  const goNextMonth = () => {
    if (viewMonth === 12) {
      setViewYear(viewYear + 1);
      setViewMonth(1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={onCancel}>
      <Animated.View className="flex-1 justify-center items-center bg-black/40 px-8" style={{ opacity }}>
        <Pressable
          onPress={onCancel}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
        />
        <Animated.View className="bg-white rounded-2xl p-5 w-full" style={{ transform: [{ scale }], maxWidth: 360 }}>
          <View className="flex-row items-center justify-between mb-4">
            <PressableScale
              onPress={goPrevMonth}
              style={{ width: 40, height: 40 }}
              className="items-center justify-center rounded-full"
              accessibilityRole="button"
              accessibilityLabel="Mes anterior"
            >
              <Ionicons name="chevron-back" size={22} color="#111827" />
            </PressableScale>
            <Text className="text-base font-semibold">
              {MONTH_NAMES[viewMonth - 1]} {viewYear}
            </Text>
            <PressableScale
              onPress={goNextMonth}
              style={{ width: 40, height: 40 }}
              className="items-center justify-center rounded-full"
              accessibilityRole="button"
              accessibilityLabel="Mes siguiente"
            >
              <Ionicons name="chevron-forward" size={22} color="#111827" />
            </PressableScale>
          </View>

          <View className="flex-row justify-between mb-2">
            {WEEKDAY_LABELS.map((label, i) => (
              <Text key={i} className="text-xs text-gray-400 font-medium" style={{ width: CELL_SIZE, textAlign: 'center' }}>
                {label}
              </Text>
            ))}
          </View>

          {/* Explicit 6 rows of 7, not a single flex-wrap container -- with
              fixed-width cells, flex-wrap's line breaks depend on the
              container's actual pixel width, which could fit an 8th cell
              per row and silently break the 7-column grid. */}
          {[0, 1, 2, 3, 4, 5].map((row) => (
            <View key={row} className="flex-row justify-between mb-1">
              {cells.slice(row * 7, row * 7 + 7).map((cell) => {
                const iso = `${cell.year}-${String(cell.month).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`;
                const isSelected = iso === selected;
                const isToday = iso === todayISO;
                return (
                  <PressableScale
                    key={iso}
                    onPress={() => cell.isCurrentMonth && setSelected(iso)}
                    disabled={!cell.isCurrentMonth}
                    style={{ width: CELL_SIZE, height: CELL_SIZE }}
                    className={`items-center justify-center rounded-full ${
                      isSelected ? 'bg-blue-600' : isToday ? 'border border-blue-600' : ''
                    }`}
                    accessibilityRole="button"
                    accessibilityLabel={`${cell.day} de ${MONTH_NAMES[cell.month - 1]}`}
                  >
                    <Text
                      className={`text-sm ${
                        isSelected ? 'text-white font-semibold' : cell.isCurrentMonth ? 'text-gray-900' : 'text-gray-300'
                      }`}
                    >
                      {cell.day}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>
          ))}

          <View className="flex-row mt-4" style={{ gap: 10 }}>
            <View style={{ flex: 1 }}>
              <PressableScale
                onPress={onCancel}
                className="py-3 rounded-lg items-center border border-gray-300"
                accessibilityRole="button"
                accessibilityLabel="Cancelar"
              >
                <Text className="font-semibold text-gray-700">Cancelar</Text>
              </PressableScale>
            </View>
            <View style={{ flex: 1 }}>
              <PressableScale
                onPress={() => selected && onSave(selected)}
                disabled={!selected}
                className={`py-3 rounded-lg items-center ${selected ? 'bg-blue-600' : 'bg-blue-200'}`}
                accessibilityRole="button"
                accessibilityLabel="Guardar"
              >
                <Text className="font-semibold text-white">Guardar</Text>
              </PressableScale>
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
