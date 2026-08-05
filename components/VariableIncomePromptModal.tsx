import { useEffect, useState } from 'react';
import { Modal, Text, TextInput, View } from 'react-native';
import { MONTH_NAMES } from '../features/shared/monthNames';
import { Button } from './Button';
import { ErrorBanner } from './ErrorBanner';

interface VariableIncomePromptModalProps {
  visible: boolean;
  concepto: string;
  year: number;
  month: number;
  /** Amount submitted last month for this income, pre-filled as the starting value since it usually doesn't change much month to month. */
  previousAmount: number | null;
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
  previousAmount,
  loading,
  error,
  onSubmit,
  onSkip,
  onDismissError,
}: VariableIncomePromptModalProps) {
  const [monto, setMonto] = useState('');
  // Locks the button the instant Guardar is pressed, independent of
  // `loading`. `loading` (the mutation's own isPending) flips back to false
  // as soon as the save resolves, but the modal only actually closes once
  // the follow-up "does this month still need the prompt" query has
  // re-fetched and come back false — a real gap where the button would
  // otherwise flash back to its normal, re-pressable blue state for a few
  // frames before the modal disappears.
  const [justSubmitted, setJustSubmitted] = useState(false);

  // Pre-fill with last month's amount every time the prompt opens for a new
  // month — this component stays mounted with `visible` toggling, so a plain
  // useState initializer only runs once and would miss later openings.
  useEffect(() => {
    if (visible) {
      setMonto(previousAmount ? String(previousAmount) : '');
      setJustSubmitted(false);
    }
  }, [visible, previousAmount]);

  const isLocked = loading || justSubmitted;

  const handleSubmit = () => {
    if (!monto) return;
    setJustSubmitted(true);
    onSubmit(Number(monto));
  };

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
            onPress={handleSubmit}
            loading={isLocked}
            disabled={isLocked || !monto}
          />
          <Button title="Ahora no" variant="ghost" onPress={onSkip} disabled={isLocked} />
        </View>
      </View>
    </Modal>
  );
}
