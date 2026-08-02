import { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { formatDisplayDate, formatISODate, parseISODate } from '../features/movements/date';
import { PressableScale } from './PressableScale';

interface DateFieldProps {
  /** Stored value, always 'YYYY-MM-DD'. */
  value: string;
  onChange: (value: string) => void;
}

/**
 * Date input that displays DD-MM-AAAA and opens the platform's native date
 * picker on tap. The stored value stays ISO (YYYY-MM-DD) for the API.
 */
export function DateField({ value, onChange }: DateFieldProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [pickerDate, setPickerDate] = useState<Date | null>(null);

  const openPicker = () => {
    setPickerDate(parseISODate(value) ?? new Date());
    setShowPicker(true);
  };

  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
      if (event.type === 'set' && selected) onChange(formatISODate(selected));
    } else {
      // iOS spinner updates the value live; it is dismissed with "Listo".
      if (selected) {
        setPickerDate(selected);
        onChange(formatISODate(selected));
      }
    }
  };

  return (
    <>
      <PressableScale onPress={openPicker} className="border border-gray-300 rounded-md px-3 py-3 mb-1">
        <Text className={value ? 'text-black' : 'text-gray-400'}>
          {value ? formatDisplayDate(value) : 'Selecciona la fecha'}
        </Text>
      </PressableScale>

      {showPicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={pickerDate ?? new Date()}
          mode="date"
          display="default"
          onChange={handleChange}
        />
      )}

      {showPicker && Platform.OS === 'ios' && (
        <View className="border border-gray-200 rounded-md p-3 mb-1">
          <DateTimePicker
            value={pickerDate ?? new Date()}
            mode="date"
            display="spinner"
            onChange={handleChange}
          />
          <PressableScale onPress={() => setShowPicker(false)} className="py-2 items-end">
            <Text className="text-blue-600 font-semibold">Listo</Text>
          </PressableScale>
        </View>
      )}
    </>
  );
}
