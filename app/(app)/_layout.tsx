import { useCallback, useMemo, useState } from 'react';
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
import { InboxHeaderButton } from '../../components/InboxHeaderButton';
import { PendingNotificationsInbox } from '../../components/PendingNotificationsInbox';
import { BankNotificationListenerSync } from '../../components/BankNotificationListenerSync';
import { usePendingNotifications } from '../../features/pendingNotifications/hooks';
import { MovementModalContext } from '../../features/shared/movement-modal-context';
import { MovementFilterContext } from '../../features/shared/movement-filter-context';
import { theme, headerTitleFont } from '../../lib/theme';
import type { Movement } from '../../features/movements/types';

type IconName = keyof typeof Ionicons.glyphMap;

/** First given name only ("Bastian Guzman" -> "Bastian") -- same convention AnimatedTabBar already uses for the Cuenta tab's own short label. */
function firstName(nombre: string | null | undefined): string | null {
  const trimmed = nombre?.trim();
  return trimmed ? trimmed.split(' ')[0] : null;
}

// Replaces the plain "Resumen"/"Movimientos"/"Categorías" header titles --
// three screens all just repeating their own tab name read as redundant
// (the tab bar right below already says the same thing). headerTitleStyle
// (set once in screenOptions below) only applies to the DEFAULT string-based
// title, so a custom headerTitle component has to restate that same look
// (white, semibold) itself.
function HeaderTitleText({ text }: { text: string }) {
  return (
    <Text style={{ color: '#ffffff', fontSize: 20, ...headerTitleFont }} numberOfLines={1}>
      {text}
    </Text>
  );
}

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
        className="bg-brand items-center justify-center"
        accessibilityRole="button"
        accessibilityLabel="Nuevo movimiento"
      >
        <Ionicons name="add" size={30} color="#ffffff" />
      </PressableScale>
    </View>
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
  const [inboxVisible, setInboxVisible] = useState(false);
  // Owned here (not derived from route params) so it's guaranteed-clearable:
  // see features/shared/movement-filter-context.tsx for why route params
  // turned out not to be reliable for this. Resumen's "tap a category" sets
  // this before switching tabs; Movimientos' own tabPress listener below is
  // the single, deterministic place that clears it.
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);

  const openCreate = useCallback(() => {
    setEditingMovement(null);
    setModalVisible(true);
    router.navigate('/movimientos');
  }, [router]);

  const openEdit = useCallback((movement: Movement) => {
    setEditingMovement(movement);
    setModalVisible(true);
  }, []);

  const greetingName = firstName(profile?.nombre);
  const resumenGreeting = greetingName ? `¡Hola, ${greetingName}!` : '¡Hola!';
  const pendingCount = pendingNotifications?.length ?? 0;
  const openInbox = useCallback(() => setInboxVisible(true), []);

  // Memoized so this context's consumers (movimientos.tsx, categorias.tsx)
  // only re-render when one of these values actually changed -- without
  // this, a fresh object literal here every render of AppLayout (e.g. every
  // usePendingNotifications poll tick) re-rendered every screen using
  // useMovementModal() regardless of whether pendingCount itself moved.
  const movementModalValue = useMemo(
    () => ({ openCreate, openEdit, openInbox, pendingCount }),
    [openCreate, openEdit, openInbox, pendingCount]
  );

  const movementFilterValue = useMemo(
    () => ({ categoryFilter, setCategoryFilter }),
    [categoryFilter]
  );

  return (
    <MovementModalContext.Provider value={movementModalValue}>
      <MovementFilterContext.Provider value={movementFilterValue}>
        <SelectedMonthProvider>
          <Tabs
            tabBar={(props) => <AnimatedTabBar {...props} />}
            screenOptions={{
              headerShown: true,
              headerStyle: { backgroundColor: theme.brand },
              headerTintColor: '#ffffff',
              headerTitleStyle: { color: '#ffffff', ...headerTitleFont },
              // Explicit, not left to the navigator's own default (white) --
              // without this, the scene container behind each tab briefly
              // paints white before that tab's own content settles, which is
              // what read as a white flash on every tab switch, bleeding
              // visibly right up against the blue header. (`sceneStyle`, not
              // `sceneContainerStyle` -- bottom-tabs v7 renamed it.) Tab
              // switches are otherwise the navigator's own native, un-animated
              // swap now -- an earlier custom opacity fade-in on top of this
              // (FadeTabScreen) was itself the source of a *different* flash:
              // caught on camera, the incoming screen's content was legible at
              // near-zero opacity for a real handful of frames, which read as
              // the screen being blank rather than "fading in".
              sceneStyle: { backgroundColor: theme.background },
              headerRight: () => <InboxHeaderButton count={pendingCount} onPress={openInbox} />,
            }}
          >
            <Tabs.Screen
              name="index"
              options={{
                // `title` still drives the bottom tab bar's own label (see
                // AnimatedTabBar) -- only the native header's title is
                // overridden here, via headerTitle.
                title: 'Resumen',
                headerTitle: () => <HeaderTitleText text={resumenGreeting} />,
                tabBarIcon: TabIcon('stats-chart-outline', 'stats-chart'),
              }}
            />
            <Tabs.Screen
              name="movimientos"
              options={{
                title: 'Movimientos',
                headerTitle: () => <HeaderTitleText text="Tus movimientos" />,
                tabBarIcon: TabIcon('swap-horizontal-outline', 'swap-horizontal'),
              }}
              // A plain tabPress only FOCUSES the already-mounted Movimientos
              // screen -- earlier attempts tried to clear a leftover
              // categoryId by re-navigating the route itself (first via
              // useFocusEffect, then via an explicit router.navigate to the
              // bare path), but the filter kept coming back on a real device
              // regardless. The filter is no longer route-param-derived at
              // all now (see features/shared/movement-filter-context.tsx) --
              // this listener's only job is to guarantee-clear that real
              // React state, which doesn't depend on any router/param-merge
              // behavior to work correctly.
              listeners={{
                tabPress: () => {
                  setCategoryFilter(undefined);
                },
              }}
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
              options={{
                title: 'Categorías',
                headerTitle: () => <HeaderTitleText text="Tus categorías" />,
                tabBarIcon: TabIcon('pricetags-outline', 'pricetags'),
              }}
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
      </MovementFilterContext.Provider>
    </MovementModalContext.Provider>
  );
}
