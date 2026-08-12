import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FullScreenFormModal } from './FullScreenFormModal';
import { PressableScale } from './PressableScale';
import { Button } from './Button';
import { ErrorBanner } from './ErrorBanner';
import { useCategories } from '../features/categories/hooks';
import { useConfirmPendingNotification, useDiscardPendingNotification } from '../features/pendingNotifications/hooks';
import { suggestMovementIcon } from '../features/movements/iconSuggestion';
import { formatISODate } from '../features/movements/date';
import { INPUT_PLACEHOLDER_COLOR, INPUT_SELECTION_COLOR, INPUT_TEXT_COLOR } from './inputTheme';
import type { PendingNotification } from '../features/pendingNotifications/types';
import type { NotificationMovementType } from '../lib/parsers/bankNotificationParser';

interface PendingNotificationConfirmModalProps {
  visible: boolean;
  notification: PendingNotification | null;
  onClose: () => void;
}

/**
 * Quick one-tap confirm screen for a single captured notification: every
 * field arrives pre-filled from the parser (features/movements categoría
 * suggestion included), the user only has to glance and tap Guardar --
 * or correct a field first if the parser got something wrong.
 */
export function PendingNotificationConfirmModal({ visible, notification, onClose }: PendingNotificationConfirmModalProps) {
  const { data: categories } = useCategories();
  const confirmNotification = useConfirmPendingNotification();
  const discardNotification = useDiscardPendingNotification();

  const [concepto, setConcepto] = useState('');
  const [monto, setMonto] = useState('');
  const [tipo, setTipo] = useState<NotificationMovementType>('gasto');
  const [categoryId, setCategoryId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !notification) return;
    setConcepto(notification.comercio ?? '');
    setMonto(notification.monto ? String(notification.monto) : '');
    setTipo(notification.tipo ?? 'gasto');
    setCategoryId(notification.suggestedCategoryId ?? '');
    setFormError(null);
  }, [visible, notification]);

  if (!notification) return null;

  const isSaving = confirmNotification.isPending || discardNotification.isPending;
  const icono = suggestMovementIcon(concepto);
  const canSave = concepto.trim().length > 0 && Number(monto) > 0 && categoryId.length > 0;

  const handleConfirm = () => {
    if (!canSave) {
      setFormError('Completa comercio, monto y categoría antes de guardar.');
      return;
    }
    setFormError(null);
    confirmNotification.mutate(
      {
        id: notification.id,
        movement: {
          categoryId,
          tipo,
          concepto: concepto.trim(),
          monto: Number(monto),
          notas: null,
          estado: 'pendiente',
          fecha: formatISODate(new Date()),
          icono,
        },
      },
      {
        onSuccess: () => onClose(),
        onError: (err) => setFormError((err as Error).message),
      }
    );
  };

  const handleDiscard = () => {
    setFormError(null);
    discardNotification.mutate(notification.id, {
      onSuccess: () => onClose(),
      onError: (err) => setFormError((err as Error).message),
    });
  };

  return (
    <FullScreenFormModal visible={visible} title="Confirmar movimiento" onClose={onClose}>
      {formError && <ErrorBanner message={formError} onRetry={() => setFormError(null)} actionLabel="Descartar" />}

      <View className="items-center mb-5">
        <View className="w-14 h-14 rounded-full bg-gray-100 items-center justify-center mb-2">
          <Ionicons name={icono as keyof typeof Ionicons.glyphMap} size={26} color="#374151" />
        </View>
        <Text className="text-gray-400 text-xs">Detectado automáticamente</Text>
      </View>

      <View className="mb-4">
        <Text className="text-gray-400 text-xs font-semibold uppercase mb-2">Comercio</Text>
        <TextInput
          className="border border-gray-300 rounded-md px-3 py-2"
          style={{ color: INPUT_TEXT_COLOR }}
          placeholder="Ej: Lider, Uber, Jumbo"
          placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
          selectionColor={INPUT_SELECTION_COLOR}
          cursorColor={INPUT_SELECTION_COLOR}
          value={concepto}
          onChangeText={setConcepto}
        />
      </View>

      <View className="mb-4">
        <Text className="text-gray-400 text-xs font-semibold uppercase mb-2">Monto</Text>
        <TextInput
          className="border border-gray-300 rounded-md px-3 py-2"
          style={{ color: INPUT_TEXT_COLOR }}
          placeholder="Monto"
          placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
          selectionColor={INPUT_SELECTION_COLOR}
          cursorColor={INPUT_SELECTION_COLOR}
          keyboardType="number-pad"
          value={monto}
          onChangeText={(text) => setMonto(text.replace(/[^0-9]/g, ''))}
        />
      </View>

      <View className="mb-4">
        <Text className="text-gray-400 text-xs font-semibold uppercase mb-2">Tipo</Text>
        <View className="flex-row" style={{ gap: 0 }}>
          <View style={{ flex: 1 }}>
            <PressableScale
              className={`py-2 rounded-l-md border ${tipo === 'ingreso' ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}
              onPress={() => setTipo('ingreso')}
            >
              <Text className={`text-center ${tipo === 'ingreso' ? 'text-white' : 'text-black'}`}>Ingreso</Text>
            </PressableScale>
          </View>
          <View style={{ flex: 1 }}>
            <PressableScale
              className={`py-2 rounded-r-md border ${tipo === 'gasto' ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}
              onPress={() => setTipo('gasto')}
            >
              <Text className={`text-center ${tipo === 'gasto' ? 'text-white' : 'text-black'}`}>Gasto</Text>
            </PressableScale>
          </View>
        </View>
      </View>

      <View className="mb-5">
        <Text className="text-gray-400 text-xs font-semibold uppercase mb-2">Categoría</Text>
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          {categories?.map((c) => {
            const selected = categoryId === c.id;
            return (
              <PressableScale
                key={c.id}
                onPress={() => setCategoryId(selected ? '' : c.id)}
                className={`px-3 py-2 rounded-full border ${selected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}
              >
                <Text className={selected ? 'text-white' : 'text-black'}>{c.nombre}</Text>
              </PressableScale>
            );
          })}
        </View>
      </View>

      <View className="mb-5 pt-4 border-t border-gray-100">
        <Text className="text-gray-400 text-xs font-semibold uppercase mb-2">Notificación original</Text>
        <Text className="text-gray-500 text-xs italic">{notification.rawText}</Text>
      </View>

      <Button title="Guardar" onPress={handleConfirm} loading={confirmNotification.isPending} disabled={isSaving} />
      <PressableScale onPress={handleDiscard} disabled={isSaving} className="py-2 items-center">
        <Text className="text-red-600 font-semibold">Descartar</Text>
      </PressableScale>
    </FullScreenFormModal>
  );
}
