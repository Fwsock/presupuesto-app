import { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, Pressable } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Ionicons } from '@expo/vector-icons';
import { useCreateCategory, useUpdateCategory } from '../features/categories/hooks';
import type { Category, CategoryType } from '../features/categories/types';
import { ErrorBanner } from './ErrorBanner';
import { Button } from './Button';

const categorySchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio'),
  tipo: z.enum(['ingreso', 'gasto']),
});

type CategoryForm = z.infer<typeof categorySchema>;

interface CategoryFormModalProps {
  visible: boolean;
  initialValue: Category | null;
  onClose: () => void;
}

export function CategoryFormModal({ visible, initialValue, onClose }: CategoryFormModalProps) {
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();

  const [formError, setFormError] = useState<string | null>(null);

  const { control, handleSubmit, reset, formState: { errors } } = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
    defaultValues: { nombre: '', tipo: 'gasto' },
  });

  const isSaving = createCategory.isPending || updateCategory.isPending;

  // Reset explicitly on every open. useForm's `values` prop deep-compares against
  // the *previous* `values` object, so two consecutive "create" opens
  // (initialValue === null both times) never trigger a reset and the form still
  // holds whatever was typed last time.
  useEffect(() => {
    if (!visible) return;
    setFormError(null);
    reset({
      nombre: initialValue?.nombre ?? '',
      tipo: (initialValue?.tipo ?? 'gasto') as CategoryType,
    });
  }, [visible, initialValue, reset]);

  // The mutations live here rather than in the screen so a failed save renders
  // its error inside the modal. A banner owned by the screen would be painted
  // underneath this transparent Modal and never seen.
  const onSubmit = (values: CategoryForm) => {
    setFormError(null);

    if (initialValue) {
      updateCategory.mutate(
        { id: initialValue.id, ...values },
        {
          onSuccess: () => onClose(),
          onError: (err) => setFormError((err as Error).message),
        }
      );
    } else {
      createCategory.mutate(values, {
        onSuccess: () => onClose(),
        onError: (err) => setFormError((err as Error).message),
      });
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-white">
        <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
          <Pressable
            onPress={onClose}
            disabled={isSaving}
            className="pr-3 py-1"
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          >
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </Pressable>
          <Text className="text-lg font-semibold">
            {initialValue ? 'Editar categoría' : 'Nueva categoría'}
          </Text>
        </View>

        <View className="flex-1 px-4 pt-4">
          {formError && (
            <ErrorBanner message={formError} onRetry={() => setFormError(null)} actionLabel="Descartar" />
          )}

          <Controller
            control={control}
            name="nombre"
            render={({ field: { onChange, value } }) => (
              <TextInput
                className="border border-gray-300 rounded-md px-3 py-2 mb-1"
                placeholder="Nombre"
                value={value}
                onChangeText={onChange}
              />
            )}
          />
          {errors.nombre && <Text className="text-red-600 mb-2">{errors.nombre.message}</Text>}

          <Controller
            control={control}
            name="tipo"
            render={({ field: { onChange, value } }) => (
              <View className="flex-row mb-4">
                <Pressable
                  className={`flex-1 py-2 rounded-l-md border ${value === 'ingreso' ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}
                  onPress={() => onChange('ingreso')}
                >
                  <Text className={`text-center ${value === 'ingreso' ? 'text-white' : 'text-black'}`}>Ingreso</Text>
                </Pressable>
                <Pressable
                  className={`flex-1 py-2 rounded-r-md border ${value === 'gasto' ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}
                  onPress={() => onChange('gasto')}
                >
                  <Text className={`text-center ${value === 'gasto' ? 'text-white' : 'text-black'}`}>Gasto</Text>
                </Pressable>
              </View>
            )}
          />

          <Button title="Guardar" onPress={handleSubmit(onSubmit)} loading={isSaving} disabled={isSaving} />
        </View>
      </View>
    </Modal>
  );
}
