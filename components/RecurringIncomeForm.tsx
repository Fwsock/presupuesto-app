import { useEffect, useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Ionicons } from '@expo/vector-icons';
import { useUpsertRecurringIncome } from '../features/income/hooks';
import type { RecurringIncome } from '../features/income/types';
import { Button } from './Button';
import { PressableScale } from './PressableScale';
import { ErrorBanner } from './ErrorBanner';

const schema = z
  .object({
    concepto: z.string().min(1, 'El concepto es obligatorio'),
    tipo: z.enum(['fijo', 'variable']),
    monto: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.tipo !== 'fijo') return;
    if (!data.monto || !/^\d+$/.test(data.monto) || Number(data.monto) <= 0) {
      ctx.addIssue({ code: 'custom', path: ['monto'], message: 'Ingresa un monto válido' });
    }
  });

type FormValues = z.infer<typeof schema>;

interface RecurringIncomeFormProps {
  initialValue: RecurringIncome | null;
  onSaved?: () => void;
}

const INFO_MESSAGE =
  'Fijo: se te preguntará una sola vez. Este monto se repetirá automáticamente cada mes hasta que lo modifiques desde Cuenta.\n\n' +
  'Variable: se te preguntará el monto correspondiente cada vez que entres a un mes nuevo, ya que puede cambiar mes a mes.';

/** Shared by the onboarding screen and Cuenta — same fields, same save logic. */
export function RecurringIncomeForm({ initialValue, onSaved }: RecurringIncomeFormProps) {
  const upsertRecurringIncome = useUpsertRecurringIncome();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { concepto: '', tipo: 'fijo', monto: '' },
  });

  useEffect(() => {
    reset({
      concepto: initialValue?.concepto ?? '',
      tipo: initialValue?.tipo ?? 'fijo',
      monto: initialValue?.monto ? String(initialValue.monto) : '',
    });
  }, [initialValue, reset]);

  const tipo = watch('tipo');
  const isSaving = upsertRecurringIncome.isPending;

  const onSubmit = (values: FormValues) => {
    setFormError(null);
    upsertRecurringIncome.mutate(
      {
        concepto: values.concepto.trim(),
        tipo: values.tipo,
        monto: values.tipo === 'fijo' ? Number(values.monto) : null,
        activo: true,
      },
      {
        onSuccess: () => onSaved?.(),
        onError: (err) => setFormError((err as Error).message),
      }
    );
  };

  return (
    <View>
      {formError && <ErrorBanner message={formError} onRetry={() => setFormError(null)} actionLabel="Descartar" />}

      <Controller
        control={control}
        name="concepto"
        render={({ field: { onChange, value } }) => (
          <TextInput
            className="border border-gray-300 rounded-md px-3 py-2 mb-1"
            placeholder="Concepto (ej. Sueldo)"
            value={value}
            onChangeText={onChange}
          />
        )}
      />
      {errors.concepto && <Text className="text-red-600 mb-2">{errors.concepto.message}</Text>}

      <View className="flex-row items-center mb-1">
        <Text className="mr-2 text-gray-700">Ingreso:</Text>
        <Controller
          control={control}
          name="tipo"
          render={({ field: { onChange, value } }) => (
            <View className="flex-row flex-1">
              <PressableScale
                onPress={() => onChange('fijo')}
                className={`flex-1 py-2 rounded-l-md border items-center ${value === 'fijo' ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}
              >
                <Text className={value === 'fijo' ? 'text-white' : 'text-black'}>Fijo</Text>
              </PressableScale>
              <PressableScale
                onPress={() => onChange('variable')}
                className={`flex-1 py-2 rounded-r-md border items-center ${value === 'variable' ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}
              >
                <Text className={value === 'variable' ? 'text-white' : 'text-black'}>Variable</Text>
              </PressableScale>
            </View>
          )}
        />
        <PressableScale
          onPress={() => Alert.alert('Fijo vs Variable', INFO_MESSAGE)}
          hitSlop={10}
          style={{ minWidth: 44, minHeight: 44 }}
          className="items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Información"
        >
          <Ionicons name="information-circle-outline" size={22} color="#6b7280" />
        </PressableScale>
      </View>

      {tipo === 'fijo' && (
        <>
          <Controller
            control={control}
            name="monto"
            render={({ field: { onChange, value } }) => (
              <TextInput
                className="border border-gray-300 rounded-md px-3 py-2 mb-1 mt-2"
                placeholder="Monto mensual"
                keyboardType="number-pad"
                value={value}
                onChangeText={(text) => onChange(text.replace(/[^0-9]/g, ''))}
              />
            )}
          />
          {errors.monto && <Text className="text-red-600 mb-2">{errors.monto.message}</Text>}
        </>
      )}

      <Button title="Guardar" onPress={handleSubmit(onSubmit)} loading={isSaving} disabled={isSaving} />
    </View>
  );
}
