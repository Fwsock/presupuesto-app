import { Tabs } from 'expo-router';
import { Alert, Pressable, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { signOut } from '../../features/auth/hooks';
import { useProfile } from '../../features/profile/hooks';
import { SelectedMonthProvider } from '../../features/shared/selected-month';

type IconName = keyof typeof Ionicons.glyphMap;

// react-navigation/bottom-tabs already wraps each tab's icon + label in a
// single touchable — tabBarIcon and the tab's title aren't two separate
// pressables, they're rendered inside the same tab button.
function TabIcon(outline: IconName, filled: IconName) {
  return ({ focused, color, size }: { focused: boolean; color: string; size: number }) => (
    <Ionicons name={focused ? filled : outline} size={size} color={color} />
  );
}

export default function AppLayout() {
  const queryClient = useQueryClient();
  // Bottom tabs pads the bar with the device's safe-area inset (gesture bar /
  // home indicator) on top of whatever height we set — without reserving that
  // space ourselves, the label gets squeezed against that inset instead of
  // sitting above it.
  const insets = useSafeAreaInsets();
  const { data: profile } = useProfile();

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
          tabBarActiveTintColor: '#2563eb',
          tabBarInactiveTintColor: '#6b7280',
          tabBarStyle: {
            height: 60 + insets.bottom,
            paddingTop: 8,
            paddingBottom: 8 + insets.bottom,
          },
          tabBarLabelStyle: { fontSize: 11 },
          tabBarIconStyle: { marginBottom: 2 },
          headerRight: () => (
            <Pressable onPress={handleSignOut} className="px-4 py-2">
              <Text className="text-blue-600 font-medium">Cerrar sesión</Text>
            </Pressable>
          ),
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: 'Resumen', tabBarIcon: TabIcon('stats-chart-outline', 'stats-chart') }}
        />
        <Tabs.Screen
          name="movimientos"
          options={{ title: 'Movimientos', tabBarIcon: TabIcon('swap-horizontal-outline', 'swap-horizontal') }}
        />
        <Tabs.Screen
          name="categorias"
          options={{ title: 'Categorías', tabBarIcon: TabIcon('pricetags-outline', 'pricetags') }}
        />
        <Tabs.Screen
          name="cuenta"
          options={{
            title: profile?.nombre?.trim() || 'Cuenta',
            tabBarIcon: TabIcon('person-outline', 'person'),
          }}
        />
      </Tabs>
    </SelectedMonthProvider>
  );
}
