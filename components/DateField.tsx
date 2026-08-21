import { useState } from 'react';
import { Text } from 'react-native';
import { formatDisplayDate } from '../features/movements/date';
import { PressableScale } from './PressableScale';
import { CalendarPickerModal } from './CalendarPickerModal';

interface DateFieldProps {
  /** Stored value, always 'YYYY-MM-DD'. */
  value: string;
  onChange: (value: string) => void;
}

/**
 * Date input that displays DD-MM-AAAA and opens the app's own custom
 * calendar (CalendarPickerModal) on tap -- same modal on both platforms, no
 * Platform.OS branching, since it replaces the native DateTimePicker
 * entirely instead of wrapping it.
 */
export function DateField({ value, onChange }: DateFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <PressableScale
        onPress={() => setVisible(true)}
        className="border border-gray-200 rounded-xl px-3 py-3 mb-1"
        accessibilityRole="button"
        accessibilityLabel="Seleccionar fecha"
      >
        <Text className={value ? 'text-black' : 'text-gray-400'}>{value ? formatDisplayDate(value) : 'Selecciona la fecha'}</Text>
      </PressableScale>

      <CalendarPickerModal
        visible={visible}
        value={value}
        onSave={(v) => {
          onChange(v);
          setVisible(false);
        }}
        onCancel={() => setVisible(false)}
      />
    </>
  );
}
