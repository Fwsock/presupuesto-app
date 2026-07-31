import { useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { useMovements, useUpdateMovement, useDeleteMovement } from '../../features/movements/hooks';
import { useCategories } from '../../features/categories/hooks';
import { MonthSelector } from '../../components/MonthSelector';
import { MovementListItem } from '../../components/MovementListItem';
import { MovementFormModal } from '../../components/MovementFormModal';
import { ErrorBanner } from '../../components/ErrorBanner';
import type { Movement } from '../../features/movements/types';

export default function MovimientosScreen() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data: movements, isLoading, isError, refetch } = useMovements(year, month);
  const { data: categories } = useCategories();
  const updateMovement = useUpdateMovement();
  const deleteMovement = useDeleteMovement();

  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Movement | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setModalVisible(true);
  };

  const openEdit = (movement: Movement) => {
    setEditing(movement);
    setModalVisible(true);
  };

  const toggleEstado = (movement: Movement) => {
    setActionError(null);
    updateMovement.mutate(
      {
        id: movement.id,
        categoryId: movement.category_id,
        concepto: movement.concepto,
        monto: movement.monto,
        notas: movement.notas,
        fecha: movement.fecha,
        estado: movement.estado === 'pagado' ? 'pendiente' : 'pagado',
      },
      {
        onError: (err) => setActionError((err as Error).message),
      }
    );
  };

  const handleDelete = (id: string) => {
    setActionError(null);
    deleteMovement.mutate(id, {
      onError: (err) => setActionError((err as Error).message),
    });
  };

  return (
    <View className="flex-1 bg-white">
      <MonthSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />

      {isError && <ErrorBanner message="No se pudieron cargar los movimientos." onRetry={refetch} />}
      {actionError && (
        <ErrorBanner message={actionError} onRetry={() => setActionError(null)} actionLabel="Descartar" />
      )}

      {isLoading ? (
        <Text className="p-4">Cargando...</Text>
      ) : (
        <FlatList
          data={movements}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MovementListItem
              movement={item}
              category={categories?.find((c) => c.id === item.category_id)}
              onToggleEstado={() => toggleEstado(item)}
              onEdit={() => openEdit(item)}
              onDelete={() => handleDelete(item.id)}
            />
          )}
        />
      )}

      <Pressable
        className="absolute bottom-6 right-6 bg-blue-600 w-14 h-14 rounded-full items-center justify-center"
        onPress={openCreate}
      >
        <Text className="text-white text-2xl">+</Text>
      </Pressable>

      <MovementFormModal
        visible={modalVisible}
        mode={editing ? 'edit' : 'create'}
        movement={editing}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
}
