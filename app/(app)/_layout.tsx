import { Tabs } from 'expo-router';
import { Alert, Pressable, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { signOut } from '../../features/auth/hooks';
import { SelectedMonthProvider } from '../../features/shared/selected-month';

export default function AppLayout() {
  const queryClient = useQueryClient();
  // Bottom tabs pads the bar with the device's safe-area inset (gesture bar /
  // home indicator) on top of whatever height we set — without reserving that
  // space ourselves, the label gets squeezed against that inset instead of
  // sitting above it.
  const insets = useSafeAreaInsets();

  const handleSignOut = async () => {
    try {
      await signOut();
      // Drop every cached row so a later login on this device can't read the
      // previous session's data. The auth gate in app/_layout.tsx redirects to
      // /login on its own once the session clears.
      queryClient.clear();
    } catch (err) {
      Alert.alert('No se pudo cerrar sesión', (err as Error).message);
    }
  };

  return (
    <SelectedMonthProvider>
      <Tabs
        screenOptions={{
          headerShown: true,
          tabBarStyle: { height: 56 + insets.bottom, paddingTop: 6, paddingBottom: insets.bottom + 6 },
          tabBarLabelStyle: { fontSize: 12 },
          headerRight: () => (
            <Pressable onPress={handleSignOut} className="px-4 py-2">
              <Text className="text-blue-600 font-medium">Cerrar sesión</Text>
            </Pressable>
          ),
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Resumen' }} />
        <Tabs.Screen name="movimientos" options={{ title: 'Movimientos' }} />
        <Tabs.Screen name="categorias" options={{ title: 'Categorías' }} />
      </Tabs>
    </SelectedMonthProvider>
  );
}
