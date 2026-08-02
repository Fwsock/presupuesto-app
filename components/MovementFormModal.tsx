import { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, Switch, ScrollView } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { Ionicons } from '@expo/vector-icons';
import { useCategories } from '../features/categories/hooks';
import { useCreateMovement, useCreateInstallments, useUpdateMovement } from '../features/movements/hooks';
import { generateInstallments } from '../features/movements/installments';
import { isValidISODate } from '../features/movements/date';
import { suggestMovementIcon, DEFAULT_MOVEMENT_ICON } from '../features/movements/iconSuggestion';
import type { Movement, MovementStatus } from '../features/movements/types';
import { ErrorBanner } from './ErrorBanner';
import { Button } from './Button';
import { DateField } from './DateField';
import { IconPickerModal } from './IconPickerModal';
import { PressableScale } from './PressableScale';

const movementSchema = z
  .object({
    concepto: z.string().min(1, 'El concepto es obligatorio'),
    monto: z
      .string()
      .regex(/^\d+$/, 'Ingresa solo números')
      .refine((v) => Number(v) > 0, 'El monto debe ser mayor a 0'),
    categoryId: z.string().min(1, 'Selecciona una categoría'),
    notas: z.string().optional(),
    fecha: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato YYYY-MM-DD')
      .refine(isValidISODate, 'Fecha inválida'),
    estado: z.enum(['pendiente', 'pagado']),
    esCuota: z.boolean(),
    totalCuotas: z.string().optional(),
    icono: z.string().min(1),
  })
  .superRefine((data, ctx) => {
    if (!data.esCuota) return;
    if (!data.totalCuotas || data.totalCuotas === '') {
      ctx.addIssue({ code: 'custom', path: ['totalCuotas'], message: 'Indica el número de cuotas' });
    } else if (!/^\d+$/.test(data.totalCuotas) || Number(data.totalCuotas) < 2) {
      ctx.addIssue({ code: 'custom', path: ['totalCuotas'], message: 'Debe ser al menos 2 cuotas' });
    }
  });

type MovementForm = z.infer<typeof movementSchema>;

interface MovementFormModalProps {
  visible: boolean;
  mode: 'create' | 'edit';
  movement: Movement | null;
  onClose: () => void;
}

export function MovementFormModal({ visible, mode, movement, onClose }: MovementFormModalProps) {
  const { data: categories } = useCategories();
  const createMovement = useCreateMovement();
  const createInstallments = useCreateInstallments();
  const updateMovement = useUpdateMovement();

  const [formError, setFormError] = useState<string | null>(null);
  const [iconPickerVisible, setIconPickerVisible] = useState(false);
  // Once the user picks an icon manually (or we're editing an existing
  // movement, which already has an intentional icon), stop overwriting it
  // as they keep typing the concepto.
  // The parent remounts this component fresh (via a `key` that changes on
  // every open) for each create/edit session, so this initializer alone is
  // enough to scope "has the user manually picked an icon" to that one
  // session — no leftover state to carry into the next movement.
  const [iconTouched, setIconTouched] = useState(mode === 'edit');

  const {
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<z.input<typeof movementSchema>, any, MovementForm>({
    resolver: zodResolver(movementSchema),
    defaultValues: {
      concepto: '',
      monto: '',
      categoryId: '',
      notas: '',
      fecha: new Date().toISOString().slice(0, 10),
      estado: 'pendiente',
      esCuota: false,
      totalCuotas: '',
      icono: DEFAULT_MOVEMENT_ICON,
    },
  });

  // Reset explicitly on every open. Relying on useForm's `values` prop is not
  // enough: it deep-compares against the *previous* `values` object, so two
  // consecutive "create" opens (movement === null both times) produce an equal
  // object and no reset fires, leaving the previous entry's input in the form.
  useEffect(() => {
    if (!visible) return;
    setFormError(null);
    setIconTouched(mode === 'edit');
    reset({
      concepto: movement?.concepto ?? '',
      monto: String(movement?.monto ?? '').replace(/[^0-9]/g, ''),
      categoryId: movement?.category_id ?? '',
      notas: movement?.notas ?? '',
      fecha: movement?.fecha ?? new Date().toISOString().slice(0, 10),
      estado: (movement?.estado ?? 'pendiente') as MovementStatus,
      esCuota: false,
      totalCuotas: '',
      icono: movement?.icono ?? DEFAULT_MOVEMENT_ICON,
    });
  }, [visible, movement, mode, reset]);

  const esCuota = watch('esCuota');
  const concepto = watch('concepto');
  const icono = watch('icono');

  // Auto-suggest as the user types, until they override it manually.
  useEffect(() => {
    if (iconTouched) return;
    setValue('icono', suggestMovementIcon(concepto));
  }, [concepto, iconTouched, setValue]);

  const isSaving = createMovement.isPending || createInstallments.isPending || updateMovement.isPending;

  const onSubmit = (values: MovementForm) => {
    setFormError(null);
    const concepto = values.concepto.trim();

    if (mode === 'edit' && movement) {
      updateMovement.mutate(
        {
          id: movement.id,
          categoryId: values.categoryId,
          concepto,
          monto: Number(values.monto),
          notas: values.notas || null,
          estado: values.estado,
          fecha: values.fecha,
          icono: values.icono,
        },
        {
          onSuccess: () => onClose(),
          onError: (err) => setFormError((err as Error).message),
        }
      );
    } else if (values.esCuota) {
      const rows = generateInstallments(
        {
          categoryId: values.categoryId,
          concepto,
          montoTotal: Number(values.monto),
          notas: values.notas || null,
          totalCuotas: Number(values.totalCuotas),
          fechaInicio: values.fecha,
          icono: values.icono,
        },
        uuidv4()
      );
      createInstallments.mutate(rows, {
        onSuccess: () => onClose(),
        onError: (err) => setFormError((err as Error).message),
      });
    } else {
      createMovement.mutate(
        {
          categoryId: values.categoryId,
          concepto,
          monto: Number(values.monto),
          notas: values.notas || null,
          estado: values.estado,
          fecha: values.fecha,
          icono: values.icono,
        },
        {
          onSuccess: () => onClose(),
          onError: (err) => setFormError((err as Error).message),
        }
      );
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-white">
        <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
          <PressableScale
            onPress={onClose}
            disabled={isSaving}
            className="pr-3 py-1"
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          >
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </PressableScale>
          <Text className="text-lg font-semibold">{mode === 'edit' ? 'Editar movimiento' : 'Nuevo movimiento'}</Text>
        </View>

        <ScrollView className="flex-1 px-4 pt-4" contentContainerClassName="pb-8">
          {formError && (
            <ErrorBanner message={formError} onRetry={() => setFormError(null)} actionLabel="Descartar" />
          )}

          <View className="flex-row items-start mb-1">
            <PressableScale
              onPress={() => setIconPickerVisible(true)}
              className="w-12 h-12 rounded-full bg-gray-100 items-center justify-center mr-3"
              accessibilityRole="button"
              accessibilityLabel="Elegir ícono"
            >
              <Ionicons name={icono as keyof typeof Ionicons.glyphMap} size={22} color="#374151" />
            </PressableScale>

            <View className="flex-1">
              <Controller
                control={control}
                name="concepto"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    className="border border-gray-300 rounded-md px-3 py-2"
                    placeholder="Concepto"
                    value={value}
                    onChangeText={onChange}
                  />
                )}
              />
              {errors.concepto && <Text className="text-red-600 mt-1">{errors.concepto.message}</Text>}
            </View>
          </View>
          <Text className="text-gray-400 text-xs mb-3 ml-[60px]">Toca el ícono para elegir uno manualmente.</Text>

          <Controller
            control={control}
            name="monto"
            render={({ field: { onChange, value } }) => (
              <TextInput
                className="border border-gray-300 rounded-md px-3 py-2 mb-1"
                placeholder={esCuota ? 'Monto total de la compra' : 'Monto'}
                keyboardType="number-pad"
                value={value}
                onChangeText={(text) => onChange(text.replace(/[^0-9]/g, ''))}
              />
            )}
          />
          {esCuota && (
            <Text className="text-gray-500 text-xs mb-1">Se divide entre las cuotas, no es el valor de cada una.</Text>
          )}
          {errors.monto && <Text className="text-red-600 mb-2">{errors.monto.message}</Text>}

          <Controller
            control={control}
            name="categoryId"
            render={({ field: { onChange, value } }) => (
              <View className="flex-row flex-wrap mb-2">
                {categories?.map((c) => {
                  const selected = value === c.id;
                  return (
                    <PressableScale
                      key={c.id}
                      onPress={() => onChange(selected ? '' : c.id)}
                      className={`px-3 py-2 mr-2 mb-2 rounded-full border ${selected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}
                    >
                      <Text className={selected ? 'text-white' : 'text-black'}>{c.nombre}</Text>
                    </PressableScale>
                  );
                })}
              </View>
            )}
          />
          {errors.categoryId && <Text className="text-red-600 mb-2">{errors.categoryId.message}</Text>}

          <Controller
            control={control}
            name="fecha"
            render={({ field: { onChange, value } }) => <DateField value={value} onChange={onChange} />}
          />
          {errors.fecha && <Text className="text-red-600 mb-2">{errors.fecha.message}</Text>}

          <Controller
            control={control}
            name="notas"
            render={({ field: { onChange, value } }) => (
              <TextInput
                className="border border-gray-300 rounded-md px-3 py-2 mb-3"
                placeholder="Notas (opcional)"
                value={value}
                onChangeText={onChange}
              />
            )}
          />

          <Controller
            control={control}
            name="estado"
            render={({ field: { onChange, value } }) => (
              <View className="flex-row mb-4">
                {/* flex: 1 on the plain View, not on PressableScale - see
                    PressableScale's own comment for why. */}
                <View style={{ flex: 1 }}>
                  <PressableScale
                    className={`py-2 rounded-l-md border ${value === 'pendiente' ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}
                    onPress={() => onChange('pendiente')}
                  >
                    <Text className={`text-center ${value === 'pendiente' ? 'text-white' : 'text-black'}`}>Pendiente</Text>
                  </PressableScale>
                </View>
                <View style={{ flex: 1 }}>
                  <PressableScale
                    className={`py-2 rounded-r-md border ${value === 'pagado' ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}
                    onPress={() => onChange('pagado')}
                  >
                    <Text className={`text-center ${value === 'pagado' ? 'text-white' : 'text-black'}`}>Pagado</Text>
                  </PressableScale>
                </View>
              </View>
            )}
          />

          {mode === 'create' && (
            <>
              <Controller
                control={control}
                name="esCuota"
                render={({ field: { onChange, value } }) => (
                  <View className="flex-row items-center justify-between mb-3">
                    <Text>¿Es en cuotas?</Text>
                    <Switch value={value} onValueChange={onChange} />
                  </View>
                )}
              />

              {esCuota && (
                <>
                  <Controller
                    control={control}
                    name="totalCuotas"
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        className="border border-gray-300 rounded-md px-3 py-2 mb-1"
                        placeholder="Cuotas"
                        keyboardType="number-pad"
                        value={value}
                        onChangeText={(text) => onChange(text.replace(/[^0-9]/g, ''))}
                      />
                    )}
                  />
                  {errors.totalCuotas && <Text className="text-red-600 mb-2">{errors.totalCuotas.message}</Text>}
                </>
              )}
            </>
          )}

          <Button title="Guardar" onPress={handleSubmit(onSubmit)} loading={isSaving} disabled={isSaving} />
        </ScrollView>

        <IconPickerModal
          visible={iconPickerVisible}
          selectedIcon={icono}
          onSelect={(selected) => {
            setValue('icono', selected);
            setIconTouched(true);
          }}
          onClose={() => setIconPickerVisible(false)}
        />
      </View>
    </Modal>
  );
}
