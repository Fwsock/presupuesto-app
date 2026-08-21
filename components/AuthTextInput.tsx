import { useState } from 'react';
import { View, TextInput, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from './PressableScale';
import { INPUT_PLACEHOLDER_COLOR, INPUT_SELECTION_COLOR, INPUT_CURSOR_COLOR, INPUT_TEXT_COLOR } from './inputTheme';

interface AuthTextInputProps extends Omit<TextInputProps, 'style'> {
  icon: keyof typeof Ionicons.glyphMap;
}

/**
 * Login/register text field: leading icon + input, same height and border,
 * shared so both screens look identical. Any field passed `secureTextEntry`
 * (every password field on both screens) automatically gets a trailing
 * eye/eye-off toggle to reveal the typed value -- callers don't opt into
 * this separately, it's implied by `secureTextEntry` itself.
 */
export function AuthTextInput({ icon, secureTextEntry, ...rest }: AuthTextInputProps) {
  const [visible, setVisible] = useState(false);
  const isPasswordField = !!secureTextEntry;

  return (
    <View className="flex-row items-center border border-gray-200 rounded-xl px-3 mb-3" style={{ height: 48 }}>
      <Ionicons name={icon} size={20} color="#6b7280" style={{ marginRight: 8 }} />
      <TextInput
        className="flex-1"
        style={{ color: INPUT_TEXT_COLOR }}
        placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
        selectionColor={INPUT_SELECTION_COLOR}
        cursorColor={INPUT_CURSOR_COLOR}
        secureTextEntry={isPasswordField && !visible}
        {...rest}
      />
      {isPasswordField && (
        <PressableScale
          onPress={() => setVisible((v) => !v)}
          hitSlop={10}
          className="pl-2"
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color="#6b7280" />
        </PressableScale>
      )}
    </View>
  );
}
