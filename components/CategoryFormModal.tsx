import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateCategory, useUpdateCategory } from '../features/categories/hooks';
import type { Category } from '../features/categories/types';
import { ErrorBanner } from './ErrorBanner';
import { Button } from './Button';
import { FullScreenFormModal } from './FullScreenFormModal';
import { PressableScale } from './PressableScale';

const categorySchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio'),
  esFija: z.boolean(),
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
    defaultValues: { nombre: '', esFija: false },
  });

  const isSaving = createCategory.isPending || updateCategory.isPending;

  // Reset explicitly on every open. useForm's `values` prop deep-compares against
  // the *previous* `values` object, so two consecutive "create" opens
  // (initialValue === null both times) never trigger a reset and the form still
  // holds whatever was typed last time.
  useEffect(() => {
    if (!visible) return;
    setFormError(null);
    reset({ nombre: initialValue?.nombre ?? '', esFija: initialValue?.es_fija ?? false });
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
    <FullScreenFormModal
      visible={visible}
      title={initialValue ? 'Editar categoría' : 'Nueva categoría'}
      onClose={onClose}
    >
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
            autoFocus
          />
        )}
      />
      {errors.nombre && <Text className="text-red-600 mb-2">{errors.nombre.message}</Text>}

      <Text className="text-gray-500 text-xs mb-2">Tipo de categoría</Text>
      <Controller
        control={control}
        name="esFija"
        render={({ field: { onChange, value } }) => (
          <View className="flex-row mb-1">
            {/* flex: 1 on the plain View, not on PressableScale - see
                PressableScale's own comment for why. */}
            <View style={{ flex: 1 }}>
              <PressableScale
                className={`py-2 rounded-l-md border ${!value ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}
                onPress={() => onChange(false)}
              >
                <Text className={`text-center ${!value ? 'text-white' : 'text-black'}`}>Variable</Text>
              </PressableScale>
            </View>
            <View style={{ flex: 1 }}>
              <PressableScale
                className={`py-2 rounded-r-md border ${value ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}
                onPress={() => onChange(true)}
              >
                <Text className={`text-center ${value ? 'text-white' : 'text-black'}`}>Fija / Recurrente</Text>
              </PressableScale>
            </View>
          </View>
        )}
      />
      <Text className="text-gray-400 text-xs mb-4">
        Las categorías fijas (Insumos básicos, Vivienda, Suscripciones...) replican sus movimientos automáticamente cada mes.
      </Text>

      <Button title="Guardar" onPress={handleSubmit(onSubmit)} loading={isSaving} disabled={isSaving} />
    </FullScreenFormModal>
  );
}
