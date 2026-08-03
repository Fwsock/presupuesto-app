import { useCallback, useState } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Alert, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { signOut } from '../../features/auth/hooks';
import { useProfile } from '../../features/profile/hooks';
import { SelectedMonthProvider } from '../../features/shared/selected-month';
import { PressableScale } from '../../components/PressableScale';
import { MovementFormModal } from '../../components/MovementFormModal';
import { MovementModalContext } from '../../features/shared/movement-modal-context';
import type { Movement } from '../../features/movements/types';

type IconName = keyof typeof Ionicons.glyphMap;

// react-navigation/bottom-tabs already wraps each tab's icon + label in a
// single touchable — tabBarIcon and the tab's title aren't two separate
// pressables, they're rendered inside the same tab button.
function TabIcon(outline: IconName, filled: IconName) {
  return ({ focused, color, size }: { focused: boolean; color: string; size: number }) => (
    <Ionicons name={focused ? filled : outline} size={size} color={color} />
  );
}

// Renders in place of the normal icon+label tab button for the "crear" tab
// slot. It never reflects focus state on purpose — this isn't a real screen,
// tabPress is always intercepted below (see the crear Tabs.Screen's
// `listeners`), so "selected" would never make sense for it.
function CreateTabButton({ onPress }: { onPress: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <PressableScale
        onPress={onPress}
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          marginTop: -26,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.3,
          shadowRadius: 5,
          elevation: 6,
        }}
        className="bg-blue-600 items-center justify-center"
        accessibilityRole="button"
        accessibilityLabel="Nuevo movimiento"
      >
        <Ionicons name="add" size={30} color="#ffffff" />
      </PressableScale>
    </View>
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
  const router = useRouter();

  // Hosted here (not in movimientos.tsx) so the center tab-bar button can
  // open it from any tab, and Movimientos' row "editar" action can open it
  // too via useMovementModal() — one modal instance, two entry points.
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMovement, setEditingMovement] = useState<Movement | null>(null);
  // Forces MovementFormModal to fully remount on every open (its `key` prop
  // below) so each session starts with fresh internal state - see the
  // component's own comment for why this matters.
  const [formSessionId, setFormSessionId] = useState(0);

  const openCreate = useCallback(() => {
    setEditingMovement(null);
    setFormSessionId((id) => id + 1);
    setModalVisible(true);
    router.navigate('/movimientos');
  }, [router]);

  const openEdit = useCallback((movement: Movement) => {
    setEditingMovement(movement);
    setFormSessionId((id) => id + 1);
    setModalVisible(true);
  }, []);

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
    <MovementModalContext.Provider value={{ openCreate, openEdit }}>
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
              <PressableScale onPress={handleSignOut} className="px-4 py-2">
                <Text className="text-blue-600 font-medium">Cerrar sesión</Text>
              </PressableScale>
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
            name="crear"
            options={{
              title: '',
              tabBarButton: () => <CreateTabButton onPress={openCreate} />,
            }}
            listeners={{
              tabPress: (e) => {
                e.preventDefault();
                openCreate();
              },
            }}
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

      <MovementFormModal
        key={formSessionId}
        visible={modalVisible}
        mode={editingMovement ? 'edit' : 'create'}
        movement={editingMovement}
        onClose={() => setModalVisible(false)}
      />
    </MovementModalContext.Provider>
  );
}
