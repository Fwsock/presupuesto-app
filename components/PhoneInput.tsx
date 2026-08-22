import { useState } from 'react';
import { View, Text, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from './PressableScale';
import { AnimatedBottomSheet } from './AnimatedBottomSheet';
import { COUNTRIES } from '../features/shared/countries';
import { INPUT_PLACEHOLDER_COLOR, INPUT_SELECTION_COLOR, INPUT_CURSOR_COLOR, INPUT_TEXT_COLOR } from './inputTheme';

const FIELD_HEIGHT = 44;

interface PhoneInputProps {
  countryCode: string;
  digits: string;
  onChangeCountryCode: (code: string) => void;
  onChangeDigits: (digits: string) => void;
}

/** Country selector (flag + dial code, opens a country-list modal) + local number field, side by side and the same height. */
export function PhoneInput({ countryCode, digits, onChangeCountryCode, onChangeDigits }: PhoneInputProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const selected = COUNTRIES.find((c) => c.code === countryCode) ?? COUNTRIES[0];

  return (
    <View className="flex-row mb-1">
      <PressableScale
        onPress={() => setPickerOpen(true)}
        style={{ minWidth: 92, height: FIELD_HEIGHT }}
        className="flex-row items-center border border-gray-200 rounded-xl px-2 mr-2"
        accessibilityRole="button"
        accessibilityLabel="Elegir país"
      >
        <Text className="font-jakarta" style={{ fontSize: 18 }}>{selected.flag}</Text>
        <Text className="font-jakarta ml-1">+{selected.dialCode}</Text>
        <Ionicons name="chevron-down" size={14} color="#6b7280" style={{ marginLeft: 4 }} />
      </PressableScale>

      <TextInput
        className="flex-1 font-jakarta border border-gray-200 rounded-xl px-3"
        style={{ height: FIELD_HEIGHT, color: INPUT_TEXT_COLOR }}
        placeholder="Número"
        placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
        selectionColor={INPUT_SELECTION_COLOR}
        cursorColor={INPUT_CURSOR_COLOR}
        keyboardType="number-pad"
        value={digits}
        onChangeText={(text) => onChangeDigits(text.replace(/[^0-9]/g, ''))}
      />

      <AnimatedBottomSheet visible={pickerOpen} onClose={() => setPickerOpen(false)} maxHeightPercent={70}>
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
          <Text className="text-lg font-jakarta-semibold">Elegir país</Text>
          <PressableScale
            onPress={() => setPickerOpen(false)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          >
            <Ionicons name="close" size={22} color="#111827" />
          </PressableScale>
        </View>
        <ScrollView contentContainerClassName="pb-6">
          {COUNTRIES.map((country) => (
            <PressableScale
              key={country.code}
              onPress={() => {
                onChangeCountryCode(country.code);
                setPickerOpen(false);
              }}
              className="flex-row items-center px-4 py-3"
            >
              <Text className="font-jakarta" style={{ fontSize: 20 }}>{country.flag}</Text>
              <Text className="font-jakarta ml-3 flex-1 text-base">{country.name}</Text>
              <Text className="font-jakarta text-gray-500">+{country.dialCode}</Text>
            </PressableScale>
          ))}
        </ScrollView>
      </AnimatedBottomSheet>
    </View>
  );
}
