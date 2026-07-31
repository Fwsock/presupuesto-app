import { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, Pressable } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateCategory, useUpdateCategory } from '../features/categories/hooks';
import type { Category, CategoryType } from '../features/categories/types';
import { ErrorBanner } from './ErrorBanner';

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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="bg-white rounded-t-2xl p-6">
          <Text className="text-lg font-bold mb-4">
            {initialValue ? 'Editar categoría' : 'Nueva categoría'}
          </Text>

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

          <Pressable className="bg-blue-600 rounded-md py-3 mb-2" onPress={handleSubmit(onSubmit)}>
            <Text className="text-white text-center font-semibold">Guardar</Text>
          </Pressable>
          <Pressable className="py-2" onPress={onClose}>
            <Text className="text-center text-gray-500">Cancelar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
