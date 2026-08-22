import { useEffect, useState } from 'react';
import { View, Text, TextInput, Switch, ScrollView } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { Ionicons } from '@expo/vector-icons';
import { useCategories } from '../features/categories/hooks';
import {
  useCreateMovement,
  useCreateInstallments,
  useUpdateMovement,
  useUpdateInstallmentGroupFrom,
  useConvertMovementToInstallments,
} from '../features/movements/hooks';
import { generateInstallments } from '../features/movements/installments';
import { isValidISODate } from '../features/movements/date';
import { suggestMovementIcon, DEFAULT_MOVEMENT_ICON } from '../features/movements/iconSuggestion';
import type { Movement, MovementStatus, MovementType } from '../features/movements/types';
import { ErrorBanner } from './ErrorBanner';
import { Button } from './Button';
import { DateField } from './DateField';
import { IconPickerModal } from './IconPickerModal';
import { MovementIconBadge } from './MovementIconBadge';
import { PressableScale } from './PressableScale';
import { AnimatedBottomSheet } from './AnimatedBottomSheet';
import { INPUT_PLACEHOLDER_COLOR, INPUT_SELECTION_COLOR, INPUT_CURSOR_COLOR, INPUT_TEXT_COLOR } from './inputTheme';

const movementSchema = z
  .object({
    concepto: z.string().min(1, 'El concepto es obligatorio'),
    monto: z
      .string()
      .regex(/^\d+$/, 'Ingresa solo números')
      .refine((v) => Number(v) > 0, 'El monto debe ser mayor a 0'),
    categoryId: z.string().min(1, 'Selecciona una categoría'),
    tipo: z.enum(['ingreso', 'gasto']),
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
  const updateInstallmentGroupFrom = useUpdateInstallmentGroupFrom();
  const convertToInstallments = useConvertMovementToInstallments();

  // Editing a cuota that's already part of a group: only its remaining
  // count can change (see useUpdateInstallmentGroupFrom's comment for why
  // earlier cuotas stay untouched) -- turning cuotas off entirely isn't
  // supported, so the switch below is locked on whenever this is true.
  const hasExistingGroup = mode === 'edit' && !!movement?.installment_group_id;

  const [formError, setFormError] = useState<string | null>(null);
  const [iconPickerVisible, setIconPickerVisible] = useState(false);
  // Once the user picks an icon manually (or we're editing an existing
  // movement, which already has an intentional icon), stop overwriting it
  // as they keep typing the concepto. This component stays mounted across
  // opens (no remounting `key` -- that used to make every "+" tap pop the
  // sheet open instead of sliding it, since a fresh Modal/native window had
  // to be created each time), so this state is reset explicitly in the
  // effect below rather than relying on a fresh mount to clear it.
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
      tipo: 'gasto',
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
    setIconPickerVisible(false);
    reset({
      concepto: movement?.concepto ?? '',
      monto: String(movement?.monto ?? '').replace(/[^0-9]/g, ''),
      categoryId: movement?.category_id ?? '',
      tipo: (movement?.tipo ?? 'gasto') as MovementType,
      notas: movement?.notas ?? '',
      fecha: movement?.fecha ?? new Date().toISOString().slice(0, 10),
      estado: (movement?.estado ?? 'pendiente') as MovementStatus,
      esCuota: !!movement?.installment_group_id,
      totalCuotas: movement?.cuota_total ? String(movement.cuota_total) : '',
      icono: movement?.icono ?? DEFAULT_MOVEMENT_ICON,
    });
  }, [visible, movement, mode, reset]);

  const esCuota = watch('esCuota');
  const concepto = watch('concepto');
  const icono = watch('icono');
  const totalCuotas = watch('totalCuotas');

  // Only true once the user actually types a different cuota count than
  // this row already had -- editing concepto/monto/fecha/estado on a cuota
  // WITHOUT touching this field must stay a plain single-row update
  // (updateMovement), never regenerate the group. Regenerating on every
  // save regardless would silently reinterpret this row's own amount as a
  // "remaining balance to split", corrupting every later cuota's monto.
  const cuotaCountChanged = hasExistingGroup && totalCuotas !== '' && Number(totalCuotas) !== movement?.cuota_total;

  // Auto-suggest as the user types, until they override it manually.
  useEffect(() => {
    if (iconTouched) return;
    setValue('icono', suggestMovementIcon(concepto));
  }, [concepto, iconTouched, setValue]);

  const isSaving =
    createMovement.isPending ||
    createInstallments.isPending ||
    updateMovement.isPending ||
    updateInstallmentGroupFrom.isPending ||
    convertToInstallments.isPending;

  const onSubmit = (values: MovementForm) => {
    setFormError(null);
    const concepto = values.concepto.trim();

    if (mode === 'edit' && movement && cuotaCountChanged) {
      // Editing an existing cuota's total: the new total can't leave this
      // cuota's own position stranded past the end of the series.
      if (Number(values.totalCuotas) < movement.cuota_numero!) {
        setFormError(`El total debe ser al menos ${movement.cuota_numero} (el número de esta cuota).`);
        return;
      }
      updateInstallmentGroupFrom.mutate(
        {
          groupId: movement.installment_group_id!,
          categoryId: values.categoryId,
          tipo: values.tipo,
          concepto,
          montoRestante: Number(values.monto),
          notas: values.notas || null,
          fromCuotaNumero: movement.cuota_numero!,
          newTotalCuotas: Number(values.totalCuotas),
          fechaInicio: values.fecha,
          icono: values.icono,
        },
        {
          onSuccess: () => onClose(),
          onError: (err) => setFormError((err as Error).message),
        }
      );
    } else if (mode === 'edit' && movement && values.esCuota && !hasExistingGroup) {
      // Converting a one-time payment into cuotas for the first time: cuota
      // 1 inherits this movement's current estado (already-paid lump sums
      // stay paid), every later cuota starts pendiente.
      convertToInstallments.mutate(
        {
          movementId: movement.id,
          groupId: uuidv4(),
          categoryId: values.categoryId,
          tipo: values.tipo,
          concepto,
          montoRestante: Number(values.monto),
          notas: values.notas || null,
          fromCuotaNumero: 1,
          newTotalCuotas: Number(values.totalCuotas),
          fechaInicio: values.fecha,
          icono: values.icono,
          firstRowEstado: values.estado,
        },
        {
          onSuccess: () => onClose(),
          onError: (err) => setFormError((err as Error).message),
        }
      );
    } else if (mode === 'edit' && movement) {
      updateMovement.mutate(
        {
          id: movement.id,
          categoryId: values.categoryId,
          tipo: values.tipo,
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
          tipo: values.tipo,
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
      // A fresh series id, only assigned when the chosen category is "fija"
      // -- this is what lets ensureFixedCategoryMovementsForMonth find and
      // replicate this specific line item into future months. Cuotas skip
      // this entirely: they already repeat via installment_group_id.
      const selectedCategory = categories?.find((c) => c.id === values.categoryId);
      const fixedSeriesId = selectedCategory?.es_fija ? uuidv4() : null;

      createMovement.mutate(
        {
          categoryId: values.categoryId,
          tipo: values.tipo,
          concepto,
          monto: Number(values.monto),
          notas: values.notas || null,
          estado: values.estado,
          fecha: values.fecha,
          icono: values.icono,
          fixedSeriesId,
        },
        {
          onSuccess: () => onClose(),
          onError: (err) => setFormError((err as Error).message),
        }
      );
    }
  };

  return (
    <AnimatedBottomSheet
      visible={visible}
      onClose={onClose}
      onBackdropPress={isSaving ? undefined : onClose}
      maxHeightPercent={90}
    >
        <View className="flex-row items-center px-4 py-3 border-b border-border">
          <PressableScale
            onPress={onClose}
            disabled={isSaving}
            className="pr-3 py-1"
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          >
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </PressableScale>
          <Text className="text-lg font-jakarta-semibold">{mode === 'edit' ? 'Editar movimiento' : 'Nuevo movimiento'}</Text>
        </View>

        <ScrollView className="px-4 pt-4" contentContainerClassName="pb-8" keyboardShouldPersistTaps="handled">
          {formError && (
            <ErrorBanner message={formError} onRetry={() => setFormError(null)} actionLabel="Descartar" />
          )}

          {/* Section 1: Concepto y Monto */}
          <View className="mb-5">
            <Text className="text-gray-400 text-xs font-jakarta-semibold uppercase mb-2">Concepto y monto</Text>

            <View className="flex-row items-start mb-1">
              <PressableScale
                onPress={() => setIconPickerVisible(true)}
                accessibilityRole="button"
                accessibilityLabel="Elegir ícono"
              >
                <MovementIconBadge label={concepto} iconName={icono} size={48} style={{ marginRight: 12 }} />
              </PressableScale>

              <View className="flex-1">
                <Controller
                  control={control}
                  name="concepto"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      className="font-jakarta border border-gray-200 rounded-xl px-3 py-2"
                      style={{ color: INPUT_TEXT_COLOR }}
                      placeholder="Concepto"
                      placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
                      selectionColor={INPUT_SELECTION_COLOR}
                      cursorColor={INPUT_CURSOR_COLOR}
                      value={value}
                      onChangeText={onChange}
                    />
                  )}
                />
                {errors.concepto && <Text className="font-jakarta text-danger mt-1">{errors.concepto.message}</Text>}
              </View>
            </View>
            <Text className="font-jakarta text-gray-400 text-xs mb-3 ml-[60px]">Toca el ícono para elegir uno manualmente.</Text>

            <Controller
              control={control}
              name="monto"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  className="font-jakarta border border-gray-200 rounded-xl px-3 py-2 mb-1"
                  style={{ color: INPUT_TEXT_COLOR }}
                  placeholder={
                    !esCuota
                      ? 'Monto'
                      : cuotaCountChanged
                        ? 'Saldo restante a repartir'
                        : hasExistingGroup
                          ? 'Monto de esta cuota'
                          : 'Monto total de la compra'
                  }
                  placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
                  selectionColor={INPUT_SELECTION_COLOR}
                  cursorColor={INPUT_CURSOR_COLOR}
                  keyboardType="number-pad"
                  value={value}
                  onChangeText={(text) => onChange(text.replace(/[^0-9]/g, ''))}
                />
              )}
            />
            {esCuota && (!hasExistingGroup || cuotaCountChanged) && (
              <Text className="font-jakarta text-gray-500 text-xs mb-1">Se divide entre las cuotas, no es el valor de cada una.</Text>
            )}
            {errors.monto && <Text className="font-jakarta text-danger">{errors.monto.message}</Text>}
          </View>

          {/* Section 2: Tipo y Categoría */}
          <View className="mb-5 pt-5 border-t border-border">
            <Text className="text-gray-400 text-xs font-jakarta-semibold uppercase mb-2">Tipo y categoría</Text>

            <Controller
              control={control}
              name="tipo"
              render={({ field: { onChange, value } }) => (
                <View className="flex-row mb-3">
                  {/* flex: 1 on the plain View, not on PressableScale - see
                      PressableScale's own comment for why. */}
                  <View style={{ flex: 1 }}>
                    <PressableScale
                      className={`py-2 rounded-l-xl border ${value === 'ingreso' ? 'bg-brand border-brand' : 'border-gray-200'}`}
                      onPress={() => onChange('ingreso')}
                    >
                      <Text className={`font-jakarta text-center ${value === 'ingreso' ? 'text-white' : 'text-black'}`}>Ingreso</Text>
                    </PressableScale>
                  </View>
                  <View style={{ flex: 1 }}>
                    <PressableScale
                      className={`py-2 rounded-r-xl border ${value === 'gasto' ? 'bg-brand border-brand' : 'border-gray-200'}`}
                      onPress={() => onChange('gasto')}
                    >
                      <Text className={`font-jakarta text-center ${value === 'gasto' ? 'text-white' : 'text-black'}`}>Gasto</Text>
                    </PressableScale>
                  </View>
                </View>
              )}
            />

            <Controller
              control={control}
              name="categoryId"
              render={({ field: { onChange, value } }) => (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }}>
                  <View className="flex-row" style={{ gap: 8 }}>
                    {categories?.map((c) => {
                      const selected = value === c.id;
                      return (
                        <PressableScale
                          key={c.id}
                          onPress={() => onChange(selected ? '' : c.id)}
                          className={`px-3 py-2 rounded-full border ${selected ? 'bg-brand border-brand' : 'border-gray-200'}`}
                        >
                          <Text className={`font-jakarta ${selected ? 'text-white' : 'text-black'}`}>{c.nombre}</Text>
                        </PressableScale>
                      );
                    })}
                  </View>
                </ScrollView>
              )}
            />
            {errors.categoryId && <Text className="font-jakarta text-danger mt-2">{errors.categoryId.message}</Text>}
          </View>

          {/* Section 3: Detalles */}
          <View className="mb-5 pt-5 border-t border-border">
            <Text className="text-gray-400 text-xs font-jakarta-semibold uppercase mb-2">Detalles</Text>

            <Controller
              control={control}
              name="fecha"
              render={({ field: { onChange, value } }) => <DateField value={value} onChange={onChange} />}
            />
            {errors.fecha && <Text className="font-jakarta text-danger mb-2">{errors.fecha.message}</Text>}

            <Controller
              control={control}
              name="estado"
              render={({ field: { onChange, value } }) => (
                <View className="flex-row mb-3">
                  {/* flex: 1 on the plain View, not on PressableScale - see
                      PressableScale's own comment for why. */}
                  <View style={{ flex: 1 }}>
                    <PressableScale
                      className={`py-2 rounded-l-xl border ${value === 'pendiente' ? 'bg-brand border-brand' : 'border-gray-200'}`}
                      onPress={() => onChange('pendiente')}
                    >
                      <Text className={`font-jakarta text-center ${value === 'pendiente' ? 'text-white' : 'text-black'}`}>Pendiente</Text>
                    </PressableScale>
                  </View>
                  <View style={{ flex: 1 }}>
                    <PressableScale
                      className={`py-2 rounded-r-xl border ${value === 'pagado' ? 'bg-brand border-brand' : 'border-gray-200'}`}
                      onPress={() => onChange('pagado')}
                    >
                      <Text className={`font-jakarta text-center ${value === 'pagado' ? 'text-white' : 'text-black'}`}>Pagado</Text>
                    </PressableScale>
                  </View>
                </View>
              )}
            />

            <Controller
              control={control}
              name="notas"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  className="font-jakarta border border-gray-200 rounded-xl px-3 py-2"
                  style={{ color: INPUT_TEXT_COLOR }}
                  placeholder="Notas (opcional)"
                  placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
                  selectionColor={INPUT_SELECTION_COLOR}
                  cursorColor={INPUT_CURSOR_COLOR}
                  value={value}
                  onChangeText={onChange}
                />
              )}
            />
          </View>

          {/* Section 4: Opciones avanzadas */}
          <View className="mb-5 pt-5 border-t border-border">
            <Text className="text-gray-400 text-xs font-jakarta-semibold uppercase mb-2">Opciones avanzadas</Text>

            <Controller
              control={control}
              name="esCuota"
              render={({ field: { onChange, value } }) => (
                <View className="flex-row items-center justify-between">
                  <Text className="font-jakarta">¿Es en cuotas?</Text>
                  <Switch value={value} onValueChange={onChange} disabled={hasExistingGroup} />
                </View>
              )}
            />
            {hasExistingGroup && (
              <Text className="font-jakarta text-gray-400 text-xs mt-1">
                Ya es parte de una compra en cuotas ({movement!.cuota_numero}/{movement!.cuota_total}) — no se puede
                volver a pago único desde acá.
              </Text>
            )}

            {esCuota && (
              <>
                <Controller
                  control={control}
                  name="totalCuotas"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      className="font-jakarta border border-gray-200 rounded-xl px-3 py-2 mt-3 mb-1"
                      style={{ color: INPUT_TEXT_COLOR }}
                      placeholder="Cuotas"
                      placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
                      selectionColor={INPUT_SELECTION_COLOR}
                      cursorColor={INPUT_CURSOR_COLOR}
                      keyboardType="number-pad"
                      value={value}
                      onChangeText={(text) => onChange(text.replace(/[^0-9]/g, ''))}
                    />
                  )}
                />
                {errors.totalCuotas && <Text className="font-jakarta text-danger">{errors.totalCuotas.message}</Text>}
                {hasExistingGroup && !cuotaCountChanged && (
                  <Text className="font-jakarta text-gray-400 text-xs mt-1">
                    Cambia este número para dividir el saldo restante entre otra cantidad de cuotas — las cuotas
                    anteriores a la {movement!.cuota_numero} no se tocan.
                  </Text>
                )}
                {cuotaCountChanged && (
                  <Text className="font-jakarta text-gray-500 text-xs mt-1">
                    Esto solo cambia la cuota {movement!.cuota_numero} en adelante — las cuotas anteriores no se
                    tocan. El campo "Monto" de arriba pasa a ser el saldo restante a repartir entre las cuotas desde
                    esta en adelante, no el total original de la compra.
                  </Text>
                )}
              </>
            )}
          </View>

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
    </AnimatedBottomSheet>
  );
}
