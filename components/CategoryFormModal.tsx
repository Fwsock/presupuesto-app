import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateCategory, useUpdateCategory } from '../features/categories/hooks';
import { CATEGORY_COLORS, DEFAULT_CATEGORY_COLOR, DEFAULT_CATEGORY_ICON } from '../features/categories/visualOptions';
import { getCategoryVisuals } from '../features/categories/visualMapper';
import type { Category } from '../features/categories/types';
import { CategoryIconBadge } from './CategoryIconBadge';
import { CategoryIconPickerModal } from './CategoryIconPickerModal';
import { ErrorBanner } from './ErrorBanner';
import { Button } from './Button';
import { FullScreenFormModal } from './FullScreenFormModal';
import { PressableScale } from './PressableScale';
import { INPUT_PLACEHOLDER_COLOR, INPUT_SELECTION_COLOR, INPUT_CURSOR_COLOR, INPUT_TEXT_COLOR } from './inputTheme';

const categorySchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio'),
  esFija: z.boolean(),
  icono: z.string(),
  color: z.string(),
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
  const [iconPickerVisible, setIconPickerVisible] = useState(false);

  const { control, handleSubmit, reset, watch, formState: { errors } } = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
    defaultValues: { nombre: '', esFija: false, icono: DEFAULT_CATEGORY_ICON, color: DEFAULT_CATEGORY_COLOR },
  });

  const isSaving = createCategory.isPending || updateCategory.isPending;
  const watchedIcono = watch('icono');
  const watchedColor = watch('color');

  // Reset explicitly on every open. useForm's `values` prop deep-compares against
  // the *previous* `values` object, so two consecutive "create" opens
  // (initialValue === null both times) never trigger a reset and the form still
  // holds whatever was typed last time.
  useEffect(() => {
    if (!visible) return;
    setFormError(null);
    // getCategoryVisuals, not the raw fields: a category still at the
    // untouched default (every pre-existing row right after the
    // 0009_category_visuals.sql backfill) opens the edit form pre-filled
    // with a name-appropriate icon/color instead of the same blue price
    // tag -- saving without touching this section then persists that
    // inferred pair instead of leaving the default in place.
    const visuals = initialValue ? getCategoryVisuals(initialValue) : { icono: DEFAULT_CATEGORY_ICON, color: DEFAULT_CATEGORY_COLOR };
    reset({
      nombre: initialValue?.nombre ?? '',
      esFija: initialValue?.es_fija ?? false,
      icono: visuals.icono,
      color: visuals.color,
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
            className="font-jakarta border border-gray-200 rounded-xl px-3 py-2 mb-1"
            style={{ color: INPUT_TEXT_COLOR }}
            placeholder="Nombre"
            placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
            selectionColor={INPUT_SELECTION_COLOR}
            cursorColor={INPUT_CURSOR_COLOR}
            value={value}
            onChangeText={onChange}
            autoFocus
          />
        )}
      />
      {errors.nombre && <Text className="font-jakarta text-danger mb-2">{errors.nombre.message}</Text>}

      <Text className="font-jakarta text-secondary text-xs mb-2 mt-3">Identidad visual</Text>
      <Controller
        control={control}
        name="icono"
        render={({ field: { onChange, value } }) => (
          <>
            <PressableScale
              onPress={() => setIconPickerVisible(true)}
              scaleTo={0.98}
              activeOpacity={0.8}
              className="flex-row items-center border border-gray-200 rounded-xl px-3 py-2.5 mb-3"
              accessibilityRole="button"
              accessibilityLabel="Elegir ícono"
            >
              <CategoryIconBadge icono={value} color={watchedColor} size={36} style={{ marginRight: 10 }} />
              <Text className="flex-1 font-jakarta-medium">Elegir ícono</Text>
              <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
            </PressableScale>
            <CategoryIconPickerModal
              visible={iconPickerVisible}
              selectedIcon={value}
              color={watchedColor}
              onSelect={onChange}
              onClose={() => setIconPickerVisible(false)}
            />
          </>
        )}
      />

      <Controller
        control={control}
        name="color"
        render={({ field: { onChange, value } }) => (
          <View className="flex-row flex-wrap mb-4" style={{ gap: 10 }}>
            {CATEGORY_COLORS.map((c) => {
              const selected = c === value;
              return (
                <PressableScale
                  key={c}
                  onPress={() => onChange(c)}
                  scaleTo={0.85}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: c,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: selected ? 2 : 0,
                    borderColor: '#0F172A',
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Color ${c}`}
                >
                  {selected && <Ionicons name="checkmark" size={16} color="#fff" />}
                </PressableScale>
              );
            })}
          </View>
        )}
      />

      <Text className="font-jakarta text-secondary text-xs mb-2">Tipo de categoría</Text>
      <Controller
        control={control}
        name="esFija"
        render={({ field: { onChange, value } }) => (
          <View className="flex-row mb-1">
            {/* flex: 1 on the plain View, not on PressableScale - see
                PressableScale's own comment for why. */}
            <View style={{ flex: 1 }}>
              <PressableScale
                className={`py-2 rounded-l-xl border ${!value ? 'bg-brand border-brand' : 'border-gray-200'}`}
                onPress={() => onChange(false)}
              >
                <Text className={`font-jakarta text-center ${!value ? 'text-white' : 'text-black'}`}>Variable</Text>
              </PressableScale>
            </View>
            <View style={{ flex: 1 }}>
              <PressableScale
                className={`py-2 rounded-r-xl border ${value ? 'bg-brand border-brand' : 'border-gray-200'}`}
                onPress={() => onChange(true)}
              >
                <Text className={`font-jakarta text-center ${value ? 'text-white' : 'text-black'}`}>Fija / Recurrente</Text>
              </PressableScale>
            </View>
          </View>
        )}
      />
      <Text className="font-jakarta text-secondary text-xs mb-4">
        Las categorías fijas (Insumos básicos, Vivienda, Suscripciones...) replican sus movimientos automáticamente cada mes.
      </Text>

      <Button title="Guardar" onPress={handleSubmit(onSubmit)} loading={isSaving} disabled={isSaving} />
    </FullScreenFormModal>
  );
}
