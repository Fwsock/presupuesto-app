import { Tabs } from 'expo-router';
import { Alert, Pressable, Text } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { signOut } from '../../features/auth/hooks';

export default function AppLayout() {
  const queryClient = useQueryClient();

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
    <Tabs
      screenOptions={{
        headerShown: true,
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
  );
}
