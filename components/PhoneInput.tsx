import { useState } from 'react';
import { Modal, Pressable, View, Text, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from './PressableScale';
import { COUNTRIES } from '../features/shared/countries';

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
        className="flex-row items-center border border-gray-300 rounded-md px-2 mr-2"
        accessibilityRole="button"
        accessibilityLabel="Elegir país"
      >
        <Text style={{ fontSize: 18 }}>{selected.flag}</Text>
        <Text className="ml-1">+{selected.dialCode}</Text>
        <Ionicons name="chevron-down" size={14} color="#6b7280" style={{ marginLeft: 4 }} />
      </PressableScale>

      <TextInput
        className="flex-1 border border-gray-300 rounded-md px-3"
        style={{ height: FIELD_HEIGHT }}
        placeholder="Número"
        keyboardType="number-pad"
        value={digits}
        onChangeText={(text) => onChangeDigits(text.replace(/[^0-9]/g, ''))}
      />

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <Pressable
            onPress={() => setPickerOpen(false)}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          />
          <View className="bg-white rounded-t-2xl" style={{ maxHeight: '70%' }}>
            <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
              <Text className="text-lg font-semibold">Elegir país</Text>
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
                  <Text style={{ fontSize: 20 }}>{country.flag}</Text>
                  <Text className="ml-3 flex-1 text-base">{country.name}</Text>
                  <Text className="text-gray-500">+{country.dialCode}</Text>
                </PressableScale>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
