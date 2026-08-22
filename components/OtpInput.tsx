import { useRef } from 'react';
import { Pressable, TextInput, View, Text } from 'react-native';

interface OtpInputProps {
  length: number;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
}

const BOX_SIZE = 46;

/**
 * `length` individual-looking digit boxes backed by a SINGLE real
 * `TextInput`, kept invisible and stretched over the whole row. That real
 * input is what actually receives focus/typing/backspace/paste -- the boxes
 * below it are purely a rendering of its current value. This sidesteps all
 * the fiddly manual per-box focus-chaining/backspace/paste logic a "real"
 * multi-input implementation needs, and gets platform OTP autofill
 * (`textContentType="oneTimeCode"` / `autoComplete="sms-otp"`) for free
 * since it's a normal text field under the hood.
 */
export function OtpInput({ length, value, onChange, autoFocus = false, disabled = false }: OtpInputProps) {
  const inputRef = useRef<TextInput>(null);

  return (
    <Pressable
      onPress={() => inputRef.current?.focus()}
      className="flex-row justify-center"
      style={{ gap: 10 }}
      accessibilityRole="none"
    >
      {Array.from({ length }).map((_, index) => {
        const digit = value[index] ?? '';
        const isCursor = index === value.length;
        return (
          <View
            key={index}
            className={`items-center justify-center rounded-lg border-2 ${
              isCursor ? 'border-brand' : 'border-gray-200'
            }`}
            style={{ width: BOX_SIZE, height: BOX_SIZE + 6 }}
          >
            <Text className="text-xl font-jakarta-semibold">{digit}</Text>
          </View>
        );
      })}

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(text) => onChange(text.replace(/[^0-9]/g, '').slice(0, length))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={length}
        autoFocus={autoFocus}
        editable={!disabled}
        caretHidden
        accessibilityLabel="Código de verificación"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0 }}
      />
    </Pressable>
  );
}
