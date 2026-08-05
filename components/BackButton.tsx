import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from './PressableScale';

interface BackButtonProps {
  onPress: () => void;
}

/**
 * Fixed-position back arrow for the top-left corner of a full-screen
 * auth/onboarding step. Uses a fixed pixel offset rather than
 * react-native-safe-area-context (installed but has no SafeAreaProvider
 * mounted anywhere in this app) -- same fixed-offset convention
 * app/onboarding.tsx already uses via its own `pt-16` content padding.
 */
export function BackButton({ onPress }: BackButtonProps) {
  return (
    <View style={{ position: 'absolute', top: 50, left: 12, zIndex: 10 }}>
      <PressableScale
        onPress={onPress}
        style={{ width: 40, height: 40 }}
        className="items-center justify-center rounded-full"
        accessibilityRole="button"
        accessibilityLabel="Volver"
      >
        <Ionicons name="arrow-back" size={24} color="#111827" />
      </PressableScale>
    </View>
  );
}
