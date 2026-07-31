import { useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from '../../features/categories/hooks';
import { CategoryFormModal } from '../../components/CategoryFormModal';
import { ErrorBanner } from '../../components/ErrorBanner';
import type { Category } from '../../features/categories/types';

export default function CategoriasScreen() {
  const { data: categories, isLoading, isError, refetch } = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    setModalVisible(true);
  };

  const openEdit = (category: Category) => {
    setEditing(category);
    setFormError(null);
    setModalVisible(true);
  };

  const handleSubmit = (values: { nombre: string; tipo: 'ingreso' | 'gasto' }) => {
    setFormError(null);
    if (editing) {
      updateCategory.mutate(
        { id: editing.id, ...values },
        {
          onSuccess: () => setModalVisible(false),
          onError: (err) => setFormError((err as Error).message),
        }
      );
    } else {
      createCategory.mutate(values, {
        onSuccess: () => setModalVisible(false),
        onError: (err) => setFormError((err as Error).message),
      });
    }
  };

  const handleDelete = (id: string) => {
    setDeleteError(null);
    deleteCategory.mutate(id, {
      onError: (err) => setDeleteError((err as Error).message),
    });
  };

  return (
    <View className="flex-1 bg-white">
      {isError && <ErrorBanner message="No se pudieron cargar las categorías." onRetry={refetch} />}
      {deleteError && (
        <ErrorBanner message={deleteError} onRetry={() => setDeleteError(null)} actionLabel="Descartar" />
      )}
      {formError && (
        <ErrorBanner message={formError} onRetry={() => setFormError(null)} actionLabel="Descartar" />
      )}

      {isLoading ? (
        <Text className="p-4">Cargando...</Text>
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
              <View>
                <Text className="font-medium">{item.nombre}</Text>
                <Text className="text-gray-500 text-xs">{item.tipo}</Text>
              </View>
              <View className="flex-row">
                <Pressable onPress={() => openEdit(item)} className="mr-4">
                  <Text>✏️</Text>
                </Pressable>
                <Pressable onPress={() => handleDelete(item.id)}>
                  <Text>🗑️</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}

      <Pressable
        className="absolute bottom-6 right-6 bg-blue-600 w-14 h-14 rounded-full items-center justify-center"
        onPress={openCreate}
      >
        <Text className="text-white text-2xl">+</Text>
      </Pressable>

      <CategoryFormModal
        visible={modalVisible}
        initialValue={editing}
        onClose={() => setModalVisible(false)}
        onSubmit={handleSubmit}
      />
    </View>
  );
}
