import { useCallback, useState } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useProfile } from '../../features/profile/hooks';
import { SelectedMonthProvider } from '../../features/shared/selected-month';
import { PressableScale } from '../../components/PressableScale';
import { MovementFormModal } from '../../components/MovementFormModal';
import { VariableIncomePromptHost } from '../../components/VariableIncomePromptHost';
import { FixedCategoriesSync } from '../../components/FixedCategoriesSync';
import { AnimatedTabBar } from '../../components/AnimatedTabBar';
import { PendingNotificationsInbox } from '../../components/PendingNotificationsInbox';
import { BankNotificationListenerSync } from '../../components/BankNotificationListenerSync';
import { usePendingNotifications } from '../../features/pendingNotifications/hooks';
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
// slot, via the crear Tabs.Screen's `tabBarButton` option below. That option
// fully replaces react-navigation's default tab button — nothing here goes
// through react-navigation's own `tabPress` event, so there's no press to
// intercept; `onPress={openCreate}` on PressableScale is the only thing that
// ever fires. It never reflects focus state on purpose — this isn't a real
// screen, so "selected" would never make sense for it.
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

// Header button shown on every tab, badged with how many captured
// notifications are still waiting to be confirmed or discarded.
function InboxHeaderButton({ count, onPress }: { count: number; onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      className="mr-4"
      accessibilityRole="button"
      accessibilityLabel="Notificaciones pendientes"
    >
      <View>
        <Ionicons name="mail-unread-outline" size={24} color="#ffffff" />
        {count > 0 && (
          <View
            className="absolute -top-1.5 -right-2 bg-red-600 rounded-full items-center justify-center px-1"
            style={{ minWidth: 16, height: 16 }}
          >
            <Text className="text-white text-[10px] font-bold">{count > 9 ? '9+' : count}</Text>
          </View>
        )}
      </View>
    </PressableScale>
  );
}

export default function AppLayout() {
  const { data: profile } = useProfile();
  const router = useRouter();
  const { data: pendingNotifications } = usePendingNotifications();

  // Hosted here (not in movimientos.tsx) so the center tab-bar button can
  // open it from any tab, and Movimientos' row "editar" action can open it
  // too via useMovementModal() — one modal instance, two entry points.
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMovement, setEditingMovement] = useState<Movement | null>(null);
  // Forces MovementFormModal to fully remount on every open (its `key` prop
  // below) so each session starts with fresh internal state - see the
  // component's own comment for why this matters.
  const [formSessionId, setFormSessionId] = useState(0);
  const [inboxVisible, setInboxVisible] = useState(false);

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

  return (
    <MovementModalContext.Provider value={{ openCreate, openEdit }}>
      <SelectedMonthProvider>
        <Tabs
          tabBar={(props) => <AnimatedTabBar {...props} />}
          screenOptions={{
            headerShown: true,
            headerStyle: { backgroundColor: '#2563eb' },
            headerTintColor: '#ffffff',
            headerTitleStyle: { color: '#ffffff', fontWeight: '600' },
            headerRight: () => (
              <InboxHeaderButton count={pendingNotifications?.length ?? 0} onPress={() => setInboxVisible(true)} />
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
              // Custom tabBarButton fully replaces react-navigation's default
              // button, including its onPress — so this never emits a
              // tabPress navigation event to intercept. There must be no
              // `listeners={{ tabPress }}` here: adding one back without also
              // forwarding the real onPress from tabBarButton's props would
              // just be dead code again, and forwarding that real onPress
              // *and* keeping a tabPress listener would double-fire
              // openCreate() on a single tap.
              tabBarButton: () => <CreateTabButton onPress={openCreate} />,
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

        <MovementFormModal
          key={formSessionId}
          visible={modalVisible}
          mode={editingMovement ? 'edit' : 'create'}
          movement={editingMovement}
          onClose={() => setModalVisible(false)}
        />
        <VariableIncomePromptHost />
        <FixedCategoriesSync />
        <BankNotificationListenerSync />
        <PendingNotificationsInbox visible={inboxVisible} onClose={() => setInboxVisible(false)} />
      </SelectedMonthProvider>
    </MovementModalContext.Provider>
  );
}
