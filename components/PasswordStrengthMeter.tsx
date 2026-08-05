import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPasswordStrength, type PasswordStrengthLevel } from '../features/auth/passwordStrength';

const LEVEL_COLOR: Record<PasswordStrengthLevel, string> = {
  baja: '#dc2626',
  media: '#f59e0b',
  alta: '#16a34a',
};

const LEVEL_LABEL: Record<PasswordStrengthLevel, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
};

function ChecklistItem({ met, label }: { met: boolean; label: string }) {
  return (
    <View className="flex-row items-center mb-1">
      <Ionicons
        name={met ? 'checkmark-circle' : 'ellipse-outline'}
        size={16}
        color={met ? '#16a34a' : '#9ca3af'}
        style={{ marginRight: 6 }}
      />
      <Text className={met ? 'text-green-600' : 'text-gray-500'}>{label}</Text>
    </View>
  );
}

/** Dynamic strength bar (red/yellow/green) + real-time checklist, shown under the password field on Registro. */
export function PasswordStrengthMeter({ password }: { password: string }) {
  const { checks, score, level } = getPasswordStrength(password);
  const color = LEVEL_COLOR[level];
  // 4 checks -> 4 segments, so the bar visibly fills left to right as each one passes.
  const filledSegments = score;

  return (
    <View className="mb-3">
      <View className="flex-row mb-1" style={{ height: 6, gap: 4 }}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              borderRadius: 3,
              backgroundColor: i < filledSegments ? color : '#e5e7eb',
            }}
          />
        ))}
      </View>
      {password.length > 0 && (
        <Text className="text-xs mb-2" style={{ color }}>
          Fortaleza: {LEVEL_LABEL[level]}
        </Text>
      )}

      <ChecklistItem met={checks.minLength} label="Al menos 8 caracteres" />
      <ChecklistItem met={checks.hasUppercase} label="Al menos una letra mayúscula" />
      <ChecklistItem met={checks.hasNumber} label="Al menos un número" />
      <ChecklistItem met={checks.hasSpecialChar} label="Al menos un carácter especial (!@#$%^&*.,)" />
    </View>
  );
}
