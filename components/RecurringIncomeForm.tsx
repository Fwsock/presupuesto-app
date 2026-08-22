import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Ionicons } from '@expo/vector-icons';
import { useUpsertRecurringIncome } from '../features/income/hooks';
import type { RecurringIncome } from '../features/income/types';
import { Button } from './Button';
import { PressableScale } from './PressableScale';
import { ErrorBanner } from './ErrorBanner';
import { useConfirmDialog } from './ConfirmDialog';
import { INPUT_PLACEHOLDER_COLOR, INPUT_SELECTION_COLOR, INPUT_CURSOR_COLOR, INPUT_TEXT_COLOR } from './inputTheme';
import { theme } from '../lib/theme';

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
  const { confirm, element: infoDialog } = useConfirmDialog();

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
            className="font-jakarta border border-gray-200 rounded-xl px-3 py-2 mb-1"
            style={{ color: INPUT_TEXT_COLOR }}
            placeholder="Concepto (ej. Sueldo)"
            placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
            selectionColor={INPUT_SELECTION_COLOR}
            cursorColor={INPUT_CURSOR_COLOR}
            value={value}
            onChangeText={onChange}
          />
        )}
      />
      {errors.concepto && <Text className="font-jakarta text-danger mb-2">{errors.concepto.message}</Text>}

      <View className="mb-1">
        <Text className="font-jakarta text-gray-700 mb-2">Ingreso:</Text>
        {/* flex: 1 set via inline style, not className, so the segmented
            control reliably fills the row regardless of NativeWind's JIT
            picking it up — this is exactly the row that was rendering
            collapsed to its text width, pushing the (i) button far to the
            right with a large empty gap in between. */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Controller
            control={control}
            name="tipo"
            render={({ field: { onChange, value } }) => (
              <View style={{ flexDirection: 'row', flex: 1, marginRight: 12 }}>
                {/* flex: 1 on the plain View, not on PressableScale itself -
                    see PressableScale's own comment for why: its style/
                    className size and center its own touchable surface, but
                    don't determine how it participates in a parent's flex
                    row (that's this wrapper's job). */}
                <View style={{ flex: 1 }}>
                  <PressableScale
                    onPress={() => onChange('fijo')}
                    className={`py-2.5 rounded-l-xl border items-center ${value === 'fijo' ? 'bg-brand border-brand' : 'border-gray-200'}`}
                  >
                    <Text className={`font-jakarta ${value === 'fijo' ? 'text-white' : 'text-black'}`}>Fijo</Text>
                  </PressableScale>
                </View>
                <View style={{ flex: 1 }}>
                  <PressableScale
                    onPress={() => onChange('variable')}
                    className={`py-2.5 rounded-r-xl border items-center ${value === 'variable' ? 'bg-brand border-brand' : 'border-gray-200'}`}
                  >
                    <Text className={`font-jakarta ${value === 'variable' ? 'text-white' : 'text-black'}`}>Variable</Text>
                  </PressableScale>
                </View>
              </View>
            )}
          />
          <PressableScale
            onPress={() =>
              confirm({
                title: 'Fijo vs Variable',
                message: INFO_MESSAGE,
                icon: 'information-circle-outline',
                iconColor: theme.brand,
                actions: [{ label: 'Entendido', variant: 'default' }],
              })
            }
            hitSlop={10}
            style={{ minWidth: 44, minHeight: 44 }}
            className="items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Información"
          >
            <Ionicons name="information-circle-outline" size={24} color="#6b7280" />
          </PressableScale>
        </View>
      </View>

      {tipo === 'fijo' && (
        <>
          <Controller
            control={control}
            name="monto"
            render={({ field: { onChange, value } }) => (
              <TextInput
                className="font-jakarta border border-gray-200 rounded-xl px-3 py-2 mb-1 mt-2"
                style={{ color: INPUT_TEXT_COLOR }}
                placeholder="Monto mensual"
                placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
                selectionColor={INPUT_SELECTION_COLOR}
                cursorColor={INPUT_CURSOR_COLOR}
                keyboardType="number-pad"
                value={value}
                onChangeText={(text) => onChange(text.replace(/[^0-9]/g, ''))}
              />
            )}
          />
          {errors.monto && <Text className="font-jakarta text-danger mb-2">{errors.monto.message}</Text>}
        </>
      )}

      <Button title="Guardar" onPress={handleSubmit(onSubmit)} loading={isSaving} disabled={isSaving} />
      {infoDialog}
    </View>
  );
}
