import { useState } from 'react';
import { Modal, Text, TextInput, View } from 'react-native';
import { MONTH_NAMES } from '../features/shared/monthNames';
import { Button } from './Button';
import { ErrorBanner } from './ErrorBanner';

interface VariableIncomePromptModalProps {
  visible: boolean;
  concepto: string;
  year: number;
  month: number;
  loading: boolean;
  error: string | null;
  onSubmit: (monto: number) => void;
  onSkip: () => void;
  onDismissError: () => void;
}

/** Asks for this month's amount of a 'variable' recurring income the first time the user views a month it hasn't been entered for. */
export function VariableIncomePromptModal({
  visible,
  concepto,
  year,
  month,
  loading,
  error,
  onSubmit,
  onSkip,
  onDismissError,
}: VariableIncomePromptModalProps) {
  const [monto, setMonto] = useState('');

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onSkip}>
      <View className="flex-1 justify-center items-center bg-black/40 px-6">
        <View className="bg-white rounded-2xl p-6 w-full">
          <Text className="text-lg font-bold mb-1">
            {concepto} — {MONTH_NAMES[month - 1]} {year}
          </Text>
          <Text className="text-gray-500 mb-4">¿Cuánto recibiste este mes por este ingreso?</Text>

          {error && <ErrorBanner message={error} onRetry={onDismissError} actionLabel="Descartar" />}

          <TextInput
            className="border border-gray-300 rounded-md px-3 py-2 mb-4"
            placeholder="Monto"
            keyboardType="number-pad"
            value={monto}
            onChangeText={(text) => setMonto(text.replace(/[^0-9]/g, ''))}
            autoFocus
          />

          <Button
            title="Guardar"
            onPress={() => monto && onSubmit(Number(monto))}
            loading={loading}
            disabled={loading || !monto}
          />
          <Button title="Ahora no" variant="ghost" onPress={onSkip} disabled={loading} />
        </View>
      </View>
    </Modal>
  );
}
