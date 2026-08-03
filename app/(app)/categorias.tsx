import { useState } from 'react';
import { View, Text, FlatList, Switch, Alert } from 'react-native';
import { useCategories, useDeleteCategory } from '../../features/categories/hooks';
import { useMovements, usePayAllPendingForCategory } from '../../features/movements/hooks';
import { useSelectedMonth } from '../../features/shared/selected-month';
import { MONTH_NAMES } from '../../features/shared/monthNames';
import { CategoryFormModal } from '../../components/CategoryFormModal';
import { ErrorBanner } from '../../components/ErrorBanner';
import { PressableScale } from '../../components/PressableScale';
import type { Category } from '../../features/categories/types';

export default function CategoriasScreen() {
  const { year, month } = useSelectedMonth();
  const { data: categories, isLoading, isError, refetch } = useCategories();
  const { data: movements } = useMovements(year, month);
  const deleteCategory = useDeleteCategory();
  const payAllPending = usePayAllPendingForCategory();

  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [payingCategoryId, setPayingCategoryId] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setModalVisible(true);
  };

  const openEdit = (category: Category) => {
    setEditing(category);
    setModalVisible(true);
  };

  const handleDelete = (id: string) => {
    setActionError(null);
    deleteCategory.mutate(id, {
      onError: (err) => setActionError((err as Error).message),
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
    Alert.alert(
      'Pagar todo',
      `¿Estás seguro que deseas pagar el monto total de $${total.toLocaleString('es-CL')} de la categoría "${category.nombre}" correspondiente a ${MONTH_NAMES[month - 1]} ${year}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Pagar todo',
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
      ]
    );
  };

  return (
    <View className="flex-1 bg-white">
      {isError && <ErrorBanner message="No se pudieron cargar las categorías." onRetry={refetch} />}
      {actionError && (
        <ErrorBanner message={actionError} onRetry={() => setActionError(null)} actionLabel="Descartar" />
      )}

      {isLoading ? (
        <Text className="p-4">Cargando...</Text>
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const { count, total } = pendingForCategory(item.id);
            const isPaying = payingCategoryId === item.id && payAllPending.isPending;
            return (
              <View className="px-4 py-3 border-b border-gray-100">
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="font-medium">{item.nombre}</Text>
                    <Text className="text-gray-500 text-xs">{item.tipo}</Text>
                  </View>
                  <View className="flex-row items-center">
                    <PressableScale
                      onPress={() => openEdit(item)}
                      hitSlop={10}
                      style={{ minWidth: 44, minHeight: 44 }}
                      className="items-center justify-center mr-1"
                      accessibilityRole="button"
                      accessibilityLabel="Editar"
                    >
                      <Text>✏️</Text>
                    </PressableScale>
                    <PressableScale
                      onPress={() => handleDelete(item.id)}
                      hitSlop={10}
                      style={{ minWidth: 44, minHeight: 44 }}
                      className="items-center justify-center"
                      accessibilityRole="button"
                      accessibilityLabel="Eliminar"
                    >
                      <Text>🗑️</Text>
                    </PressableScale>
                  </View>
                </View>

                <View className="flex-row items-center justify-between mt-2">
                  <Text className="text-gray-500 text-xs">
                    {count > 0 ? `Pagar todo (${count} pendiente${count > 1 ? 's' : ''}, $${total.toLocaleString('es-CL')})` : 'Pagar todo'}
                  </Text>
                  <Switch
                    value={count === 0}
                    disabled={count === 0 || isPaying}
                    onValueChange={() => handlePayAll(item)}
                    trackColor={{ false: '#d1d5db', true: '#16a34a' }}
                    thumbColor="#ffffff"
                    ios_backgroundColor="#d1d5db"
                  />
                </View>
              </View>
            );
          }}
        />
      )}

      <View className="absolute bottom-6 right-6">
        <PressableScale
          className="bg-blue-600 w-14 h-14 rounded-full items-center justify-center"
          onPress={openCreate}
        >
          <Text className="text-white text-2xl">+</Text>
        </PressableScale>
      </View>

      <CategoryFormModal
        visible={modalVisible}
        initialValue={editing}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
}
