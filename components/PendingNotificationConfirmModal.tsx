import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FullScreenFormModal } from './FullScreenFormModal';
import { PressableScale } from './PressableScale';
import { Button } from './Button';
import { DateField } from './DateField';
import { ErrorBanner } from './ErrorBanner';
import { MovementIconBadge } from './MovementIconBadge';
import { useCategories } from '../features/categories/hooks';
import { useConfirmPendingNotification, useDiscardPendingNotification } from '../features/pendingNotifications/hooks';
import { suggestMovementIcon } from '../features/movements/iconSuggestion';
import { formatISODate, formatDisplayDate, isValidISODate } from '../features/movements/date';
import { INPUT_PLACEHOLDER_COLOR, INPUT_SELECTION_COLOR, INPUT_CURSOR_COLOR, INPUT_TEXT_COLOR } from './inputTheme';
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
 *
 * The raw-OCR-text toggle for scan-sourced entries is deliberately NOT
 * gated behind __DEV__: this project's `eas.json` has no development-client
 * profile, so every build actually installed and tested on a device
 * (including the `preview` profile used throughout this project) runs with
 * __DEV__ false -- gating on it would make the toggle permanently
 * unreachable in the only kind of build anyone ever tests. It's collapsed
 * by default instead, which already satisfies "don't clutter the screen".
 */
export function PendingNotificationConfirmModal({ visible, notification, onClose }: PendingNotificationConfirmModalProps) {
  const { data: categories } = useCategories();
  const confirmNotification = useConfirmPendingNotification();
  const discardNotification = useDiscardPendingNotification();

  const [concepto, setConcepto] = useState('');
  const [monto, setMonto] = useState('');
  const [tipo, setTipo] = useState<NotificationMovementType>('gasto');
  const [categoryId, setCategoryId] = useState('');
  const [fecha, setFecha] = useState(formatISODate(new Date()));
  const [notas, setNotas] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  // Only ever surfaced when __DEV__ is true (see the bottom section below) --
  // an escape hatch for auditing the exact OCR output while iterating on the
  // parser, without dumping raw text in front of real users.
  const [showRawText, setShowRawText] = useState(false);

  useEffect(() => {
    if (!visible || !notification) return;
    setConcepto(notification.comercio ?? '');
    setMonto(notification.monto ? String(notification.monto) : '');
    setTipo(notification.tipo ?? 'gasto');
    setCategoryId(notification.suggestedCategoryId ?? '');
    // Falls back to today whenever the scan didn't confidently read a date
    // (e.g. plain pasted/notification-listener text, which never had one).
    setFecha(notification.fecha && isValidISODate(notification.fecha) ? notification.fecha : formatISODate(new Date()));
    // Pre-fills Notas with the detected item list (blank when the scan
    // found none, or for a text-sourced notification) -- purely a starting
    // point, the user can freely edit or clear it before saving.
    setNotas(notification.items.length > 0 ? notification.items.map((item) => item.replace(/\s+/g, ' ').trim()).join('\n') : '');
    setFormError(null);
    setShowRawText(false);
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
          notas: notas.trim() || null,
          estado: 'pendiente',
          fecha,
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
        <MovementIconBadge label={concepto} iconName={icono} size={56} style={{ marginBottom: 8 }} />
        <Text className="text-secondary text-xs">Detectado automáticamente</Text>
      </View>

      <View className="mb-4">
        <Text className="text-secondary text-xs font-semibold uppercase mb-2">Comercio</Text>
        <TextInput
          className="border border-gray-200 rounded-xl px-3 py-2"
          style={{ color: INPUT_TEXT_COLOR }}
          placeholder="Ej: Lider, Uber, Jumbo"
          placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
          selectionColor={INPUT_SELECTION_COLOR}
          cursorColor={INPUT_CURSOR_COLOR}
          value={concepto}
          onChangeText={setConcepto}
        />
      </View>

      <View className="mb-4">
        <Text className="text-secondary text-xs font-semibold uppercase mb-2">Monto</Text>
        <TextInput
          className="border border-gray-200 rounded-xl px-3 py-2"
          style={{ color: INPUT_TEXT_COLOR }}
          placeholder="Monto"
          placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
          selectionColor={INPUT_SELECTION_COLOR}
          cursorColor={INPUT_CURSOR_COLOR}
          keyboardType="number-pad"
          value={monto}
          onChangeText={(text) => setMonto(text.replace(/[^0-9]/g, ''))}
        />
      </View>

      <View className="mb-4">
        <Text className="text-secondary text-xs font-semibold uppercase mb-2">Fecha</Text>
        <DateField value={fecha} onChange={setFecha} />
      </View>

      <View className="mb-4">
        <Text className="text-secondary text-xs font-semibold uppercase mb-2">Tipo</Text>
        <View className="flex-row" style={{ gap: 0 }}>
          <View style={{ flex: 1 }}>
            <PressableScale
              className={`py-2 rounded-l-xl border ${tipo === 'ingreso' ? 'bg-brand border-brand' : 'border-gray-200'}`}
              onPress={() => setTipo('ingreso')}
            >
              <Text className={`text-center ${tipo === 'ingreso' ? 'text-white' : 'text-black'}`}>Ingreso</Text>
            </PressableScale>
          </View>
          <View style={{ flex: 1 }}>
            <PressableScale
              className={`py-2 rounded-r-xl border ${tipo === 'gasto' ? 'bg-brand border-brand' : 'border-gray-200'}`}
              onPress={() => setTipo('gasto')}
            >
              <Text className={`text-center ${tipo === 'gasto' ? 'text-white' : 'text-black'}`}>Gasto</Text>
            </PressableScale>
          </View>
        </View>
      </View>

      <View className="mb-4">
        <Text className="text-secondary text-xs font-semibold uppercase mb-2">Notas</Text>
        <TextInput
          className="border border-gray-200 rounded-xl px-3 py-2"
          style={{ color: INPUT_TEXT_COLOR }}
          placeholder="Notas (opcional)"
          placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
          selectionColor={INPUT_SELECTION_COLOR}
          cursorColor={INPUT_CURSOR_COLOR}
          value={notas}
          onChangeText={setNotas}
          multiline
        />
      </View>

      <View className="mb-5">
        <Text className="text-secondary text-xs font-semibold uppercase mb-2">Categoría</Text>
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          {categories?.map((c) => {
            const selected = categoryId === c.id;
            return (
              <PressableScale
                key={c.id}
                onPress={() => setCategoryId(selected ? '' : c.id)}
                className={`px-3 py-2 rounded-full border ${selected ? 'bg-brand border-brand' : 'border-gray-200'}`}
              >
                <Text className={selected ? 'text-white' : 'text-black'}>{c.nombre}</Text>
              </PressableScale>
            );
          })}
        </View>
      </View>

      <View className="mb-5 pt-4 border-t border-border">
        {notification.source === 'scan' ? (
          <>
            <Text className="text-secondary text-xs font-semibold uppercase mb-2">Información extraída</Text>
            <View className="bg-gray-50 rounded-xl p-3" style={{ gap: 6 }}>
              <View className="flex-row justify-between">
                <Text className="text-secondary text-xs">Comercio</Text>
                <Text className="text-gray-800 text-xs font-medium">{notification.comercio ?? 'No detectado'}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-secondary text-xs">Monto total</Text>
                <Text className="text-gray-800 text-xs font-medium">
                  {notification.monto != null ? `$${notification.monto.toLocaleString('es-CL')}` : 'No detectado'}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-secondary text-xs">Fecha</Text>
                <Text className="text-gray-800 text-xs font-medium">
                  {notification.fecha ? formatDisplayDate(notification.fecha) : 'No detectada'}
                </Text>
              </View>
            </View>

            {notification.items.length > 0 && (
              <View className="mt-3">
                <Text className="text-secondary text-xs font-semibold uppercase mb-2">Items detectados</Text>
                {notification.items.map((item, index) => (
                  <Text key={index} className="text-gray-600 text-xs mb-1">
                    {item.replace(/\s+/g, ' ').trim()}
                  </Text>
                ))}
              </View>
            )}

            {/* Collapsed by default so the raw OCR dump never clutters the
                screen -- see the module-level comment for why this isn't
                gated behind __DEV__ in this project specifically. */}
            <PressableScale onPress={() => setShowRawText((v) => !v)} className="mt-3 py-1">
              <Text className="text-brand text-xs font-medium">
                {showRawText ? 'Ocultar texto OCR crudo' : 'Ver texto OCR crudo'}
              </Text>
            </PressableScale>
            {showRawText && <Text className="text-secondary text-xs italic mt-2">{notification.rawText}</Text>}
          </>
        ) : (
          <>
            <Text className="text-secondary text-xs font-semibold uppercase mb-2">Notificación original</Text>
            <Text className="text-secondary text-xs italic">{notification.rawText}</Text>
          </>
        )}
      </View>

      <Button title="Guardar" onPress={handleConfirm} loading={confirmNotification.isPending} disabled={isSaving} />
      <PressableScale onPress={handleDiscard} disabled={isSaving} className="py-2 items-center">
        <Text className="text-danger font-semibold">Descartar</Text>
      </PressableScale>
    </FullScreenFormModal>
  );
}
