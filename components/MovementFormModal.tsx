import { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, Switch, ScrollView } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { useCategories } from '../features/categories/hooks';
import { useCreateMovement, useCreateInstallments, useUpdateMovement } from '../features/movements/hooks';
import { generateInstallments } from '../features/movements/installments';
import { isValidISODate } from '../features/movements/date';
import type { Movement, MovementStatus } from '../features/movements/types';
import { ErrorBanner } from './ErrorBanner';

const movementSchema = z.object({
  concepto: z.string().min(1, 'El concepto es obligatorio'),
  monto: z.coerce.number().positive('El monto debe ser mayor a 0'),
  categoryId: z.string().min(1, 'Selecciona una categoría'),
  notas: z.string().optional(),
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato YYYY-MM-DD')
    .refine(isValidISODate, 'Fecha inválida'),
  estado: z.enum(['pendiente', 'pagado']),
  esCuota: z.boolean(),
  totalCuotas: z.coerce.number().int().min(1, 'Debe ser al menos 1').optional(),
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

  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<z.input<typeof movementSchema>, any, MovementForm>({
    resolver: zodResolver(movementSchema),
    defaultValues: {
      concepto: '',
      monto: 0,
      categoryId: '',
      notas: '',
      fecha: new Date().toISOString().slice(0, 10),
      estado: 'pendiente',
      esCuota: false,
      totalCuotas: 1,
    },
  });

  // Reset explicitly on every open. Relying on useForm's `values` prop is not
  // enough: it deep-compares against the *previous* `values` object, so two
  // consecutive "create" opens (movement === null both times) produce an equal
  // object and no reset fires, leaving the previous entry's input in the form.
  useEffect(() => {
    if (!visible) return;
    setFormError(null);
    reset({
      concepto: movement?.concepto ?? '',
      monto: movement?.monto ?? 0,
      categoryId: movement?.category_id ?? '',
      notas: movement?.notas ?? '',
      fecha: movement?.fecha ?? new Date().toISOString().slice(0, 10),
      estado: (movement?.estado ?? 'pendiente') as MovementStatus,
      esCuota: false,
      totalCuotas: 1,
    });
  }, [visible, movement, reset]);

  const esCuota = watch('esCuota');

  const onSubmit = (values: MovementForm) => {
    setFormError(null);

    if (mode === 'edit' && movement) {
      updateMovement.mutate(
        {
          id: movement.id,
          categoryId: values.categoryId,
          concepto: values.concepto,
          monto: values.monto,
          notas: values.notas || null,
          estado: values.estado,
          fecha: values.fecha,
        },
        {
          onSuccess: () => onClose(),
          onError: (err) => setFormError((err as Error).message),
        }
      );
    } else if (values.esCuota && values.totalCuotas && values.totalCuotas > 1) {
      const rows = generateInstallments(
        {
          categoryId: values.categoryId,
          concepto: values.concepto,
          montoCuota: values.monto,
          notas: values.notas || null,
          totalCuotas: values.totalCuotas,
          fechaInicio: values.fecha,
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
          concepto: values.concepto,
          monto: values.monto,
          notas: values.notas || null,
          estado: values.estado,
          fecha: values.fecha,
        },
        {
          onSuccess: () => onClose(),
          onError: (err) => setFormError((err as Error).message),
        }
      );
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <ScrollView className="bg-white rounded-t-2xl p-6 max-h-[85%]">
          <Text className="text-lg font-bold mb-4">
            {mode === 'edit' ? 'Editar movimiento' : 'Nuevo movimiento'}
          </Text>

          {formError && (
            <ErrorBanner message={formError} onRetry={() => setFormError(null)} actionLabel="Descartar" />
          )}

          <Controller
            control={control}
            name="concepto"
            render={({ field: { onChange, value } }) => (
              <TextInput
                className="border border-gray-300 rounded-md px-3 py-2 mb-1"
                placeholder="Concepto"
                value={value}
                onChangeText={onChange}
              />
            )}
          />
          {errors.concepto && <Text className="text-red-600 mb-2">{errors.concepto.message}</Text>}

          <Controller
            control={control}
            name="monto"
            render={({ field: { onChange, value } }) => (
              <TextInput
                className="border border-gray-300 rounded-md px-3 py-2 mb-1"
                placeholder="Monto"
                keyboardType="numeric"
                value={String(value ?? '')}
                onChangeText={onChange}
              />
            )}
          />
          {errors.monto && <Text className="text-red-600 mb-2">{errors.monto.message}</Text>}

          <Controller
            control={control}
            name="categoryId"
            render={({ field: { onChange, value } }) => (
              <View className="flex-row flex-wrap mb-2">
                {categories?.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => onChange(c.id)}
                    className={`px-3 py-2 mr-2 mb-2 rounded-full border ${value === c.id ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}
                  >
                    <Text className={value === c.id ? 'text-white' : 'text-black'}>{c.nombre}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          />
          {errors.categoryId && <Text className="text-red-600 mb-2">{errors.categoryId.message}</Text>}

          <Controller
            control={control}
            name="fecha"
            render={({ field: { onChange, value } }) => (
              <TextInput
                className="border border-gray-300 rounded-md px-3 py-2 mb-1"
                placeholder="Fecha (YYYY-MM-DD)"
                value={value}
                onChangeText={onChange}
              />
            )}
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
                <Pressable
                  className={`flex-1 py-2 rounded-l-md border ${value === 'pendiente' ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}
                  onPress={() => onChange('pendiente')}
                >
                  <Text className={`text-center ${value === 'pendiente' ? 'text-white' : 'text-black'}`}>Pendiente</Text>
                </Pressable>
                <Pressable
                  className={`flex-1 py-2 rounded-r-md border ${value === 'pagado' ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}
                  onPress={() => onChange('pagado')}
                >
                  <Text className={`text-center ${value === 'pagado' ? 'text-white' : 'text-black'}`}>Pagado</Text>
                </Pressable>
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
                        placeholder="Número de cuotas"
                        keyboardType="numeric"
                        value={String(value ?? '')}
                        onChangeText={onChange}
                      />
                    )}
                  />
                  {errors.totalCuotas && <Text className="text-red-600 mb-2">{errors.totalCuotas.message}</Text>}
                </>
              )}
            </>
          )}

          <Pressable className="bg-blue-600 rounded-md py-3 mb-2 mt-2" onPress={handleSubmit(onSubmit)}>
            <Text className="text-white text-center font-semibold">Guardar</Text>
          </Pressable>
          <Pressable className="py-2 mb-4" onPress={onClose}>
            <Text className="text-center text-gray-500">Cancelar</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}
