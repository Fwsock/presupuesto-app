import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { View, Text, FlatList, RefreshControl } from 'react-native';
import { useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useCategories, useDeleteCategory } from '../../features/categories/hooks';
import { categoryHasMovements } from '../../features/categories/api';
import { useMovements, usePayAllPendingForCategory } from '../../features/movements/hooks';
import { useSelectedMonth } from '../../features/shared/selected-month';
import { withMinDuration } from '../../features/shared/withMinDuration';
import { MONTH_NAMES } from '../../features/shared/monthNames';
import { CategoryFormModal } from '../../components/CategoryFormModal';
import { ErrorBanner } from '../../components/ErrorBanner';
import { PressableScale } from '../../components/PressableScale';
import { useConfirmDialog } from '../../components/ConfirmDialog';
import { ScreenSkeleton } from '../../components/Skeleton';
import { FadeTabScreen } from '../../components/FadeTabScreen';
import type { Category } from '../../features/categories/types';

export default function CategoriasScreen() {
  const navigation = useNavigation();
  const listRef = useRef<FlatList<Category>>(null);
  const { year, month } = useSelectedMonth();
  const { data: categories, isLoading, isError, refetch } = useCategories();
  const { data: movements, refetch: refetchMovements } = useMovements(year, month);
  const deleteCategory = useDeleteCategory();
  const payAllPending = usePayAllPendingForCategory();
  const { confirm, element: confirmDialog } = useConfirmDialog();

  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [payingCategoryId, setPayingCategoryId] = useState<string | null>(null);
  // Local, explicit refresh state -- NOT React Query's `isFetching`, which
  // fires for any background refetch, not just the user's own
  // pull-to-refresh or tap-to-reload.
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // See withMinDuration -- a warm cache resolves fast enough that the
      // native spinner never got a chance to actually paint before this
      // flipped back to false, so tapping the active tab looked like a no-op.
      await withMinDuration(Promise.all([refetch(), refetchMovements()]), 700);
    } finally {
      setRefreshing(false);
    }
  }, [refetch, refetchMovements]);

  const openCreate = () => {
    setEditing(null);
    setModalVisible(true);
  };

  // Categorías owns the header's right-side action (the FAB it replaces was
  // removed — the center tab-bar "+" only creates movements, not categories).
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <PressableScale
          onPress={openCreate}
          className="mr-3 px-3 py-1.5 rounded-full border border-white/70"
          accessibilityRole="button"
          accessibilityLabel="Nueva categoría"
        >
          <Text className="text-white font-medium text-sm">+ Nueva categoría</Text>
        </PressableScale>
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation]);

  // Re-tapping the already-active "Categorías" tab reloads and scrolls to
  // top, same contract as Movimientos/Resumen — see AnimatedTabBar. Scroll
  // is NOT animated: an animated scroll takes ~300ms to settle, and on iOS
  // the RefreshControl spinner only renders while the scroll offset is
  // at/above 0 -- starting the refresh before the scroll finishes could
  // leave the spinner invisible for that whole window.
  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress' as never, () => {
      if (!navigation.isFocused()) return;
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
      handleRefresh();
    });
    return unsubscribe;
  }, [navigation, handleRefresh]);

  const openEdit = (category: Category) => {
    setEditing(category);
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    setActionError(null);
    const onDeleteError = (err: unknown) => setActionError((err as Error).message);

    try {
      // A category with movements is going to fail the delete with a
      // foreign-key violation regardless of what's shown for the currently
      // selected month, so this checks all-time, not just `movements` above
      // (which is scoped to the month in view) — otherwise a category with
      // movements only in other months would wrongly skip straight to the
      // plain confirm dialog instead of the FK-violation banner.
      const hasMovements = await categoryHasMovements(id);
      if (hasMovements) {
        deleteCategory.mutate(id, { onError: onDeleteError });
        return;
      }
    } catch (err) {
      onDeleteError(err);
      return;
    }

    confirm({
      title: '¿Eliminar categoría?',
      message: '¿Estás seguro de que deseas eliminar esta categoría? Esta acción no se puede deshacer.',
      actions: [
        { label: 'Cancelar', variant: 'cancel' },
        { label: 'Eliminar', variant: 'destructive', onPress: () => deleteCategory.mutate(id, { onError: onDeleteError }) },
      ],
    });
  };

  const pendingForCategory = (categoryId: string) => {
    const pending = (movements ?? []).filter((m) => m.category_id === categoryId && m.estado === 'pendiente');
    return { count: pending.length, total: pending.reduce((sum, m) => sum + m.monto, 0) };
  };

  const handlePayAll = (category: Category) => {
    const { count, total } = pendingForCategory(category.id);
    if (count === 0) return;

    setActionError(null);
    confirm({
      title: 'Pagar todo',
      message: `¿Estás seguro que deseas pagar el monto total de $${total.toLocaleString('es-CL')} de la categoría "${category.nombre}" correspondiente a ${MONTH_NAMES[month - 1]} ${year}?`,
      icon: 'checkmark-circle-outline',
      iconColor: '#2563eb',
      actions: [
        { label: 'Cancelar', variant: 'cancel' },
        {
          label: 'Pagar todo',
          variant: 'default',
          onPress: () => {
            setPayingCategoryId(category.id);
            payAllPending.mutate(
              { categoryId: category.id, year, month },
              {
                onSettled: () => setPayingCategoryId(null),
                onError: (err) => setActionError((err as Error).message),
              }
            );
          },
        },
      ],
    });
  };

  return (
    <FadeTabScreen>
    <View className="flex-1 bg-white">
      {isError && <ErrorBanner message="No se pudieron cargar las categorías." onRetry={refetch} />}
      {actionError && (
        <ErrorBanner message={actionError} onRetry={() => setActionError(null)} actionLabel="Descartar" />
      )}

      {isLoading ? (
        <ScreenSkeleton />
      ) : (
        <FlatList
          ref={listRef}
          data={categories}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          renderItem={({ item }) => {
            const { count, total } = pendingForCategory(item.id);
            const isPaying = payingCategoryId === item.id && payAllPending.isPending;
            return (
              <Animated.View
                entering={FadeIn.duration(350)}
                exiting={FadeOut.duration(300)}
                layout={LinearTransition.duration(300)}
              >
                <View className="px-4 py-3 border-b border-gray-100">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1 pr-2" style={{ gap: 6 }}>
                      <Text className="font-medium">{item.nombre}</Text>
                      {item.es_fija && (
                        <View className="px-2 py-0.5 rounded-full bg-blue-50">
                          <Text className="text-blue-600 text-xs font-medium">Fija</Text>
                        </View>
                      )}
                    </View>
                    <View className="flex-row items-center" style={{ gap: 4 }}>
                      <PressableScale
                        onPress={() => openEdit(item)}
                        hitSlop={12}
                        style={{ width: 36, height: 36 }}
                        className="items-center justify-center"
                        accessibilityRole="button"
                        accessibilityLabel="Editar"
                      >
                        <Ionicons name="pencil-outline" size={20} color="#374151" />
                      </PressableScale>
                      <PressableScale
                        onPress={() => handleDelete(item.id)}
                        hitSlop={12}
                        style={{ width: 36, height: 36 }}
                        className="items-center justify-center"
                        accessibilityRole="button"
                        accessibilityLabel="Eliminar"
                      >
                        <Ionicons name="trash-outline" size={20} color="#374151" />
                      </PressableScale>
                    </View>
                  </View>

                  <View className="flex-row items-center justify-between mt-2">
                    <Text className="text-gray-500 text-xs">
                      {count > 0 ? `${count} pendiente${count > 1 ? 's' : ''}` : 'Sin pendientes'}
                    </Text>
                    {count > 0 ? (
                      <PressableScale
                        onPress={() => handlePayAll(item)}
                        disabled={isPaying}
                        className={`px-3 py-1.5 rounded-full bg-blue-600 ${isPaying ? 'opacity-60' : ''}`}
                        accessibilityRole="button"
                        accessibilityLabel="Pagar todo"
                      >
                        <Text className="text-white text-xs font-medium">
                          {isPaying ? 'Pagando...' : `Pagar todo ($${total.toLocaleString('es-CL')})`}
                        </Text>
                      </PressableScale>
                    ) : (
                      <View className="flex-row items-center px-3 py-1.5 rounded-full bg-gray-100">
                        <Ionicons name="checkmark-circle" size={14} color="#16a34a" style={{ marginRight: 4 }} />
                        <Text className="text-gray-500 text-xs font-medium">Todo pagado</Text>
                      </View>
                    )}
                  </View>
                </View>
              </Animated.View>
            );
          }}
        />
      )}

      <CategoryFormModal
        visible={modalVisible}
        initialValue={editing}
        onClose={() => setModalVisible(false)}
      />

      {confirmDialog}
    </View>
    </FadeTabScreen>
  );
}
