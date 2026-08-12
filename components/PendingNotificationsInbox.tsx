import { useEffect, useState } from 'react';
import { Platform, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FullScreenFormModal } from './FullScreenFormModal';
import { PressableScale } from './PressableScale';
import { Button } from './Button';
import { ErrorBanner } from './ErrorBanner';
import { PendingNotificationConfirmModal } from './PendingNotificationConfirmModal';
import { useCategories } from '../features/categories/hooks';
import {
  useAddPendingNotificationFromText,
  useDiscardPendingNotification,
  usePendingNotifications,
} from '../features/pendingNotifications/hooks';
import {
  isBankNotificationListenerAvailable,
  openNotificationAccessSettings,
  useNotificationAccessGranted,
} from '../features/pendingNotifications/nativeListener';
import { suggestMovementIcon } from '../features/movements/iconSuggestion';
import { INPUT_PLACEHOLDER_COLOR, INPUT_SELECTION_COLOR, INPUT_TEXT_COLOR } from './inputTheme';
import type { PendingNotification } from '../features/pendingNotifications/types';

interface PendingNotificationsInboxProps {
  visible: boolean;
  onClose: () => void;
}

function PendingNotificationRow({
  notification,
  onPress,
  onDiscard,
}: {
  notification: PendingNotification;
  onPress: () => void;
  onDiscard: () => void;
}) {
  const isGasto = notification.tipo !== 'ingreso';
  const icono = suggestMovementIcon(notification.comercio ?? '');

  return (
    <PressableScale
      onPress={onPress}
      className="flex-row items-center py-3 border-b border-gray-100"
      accessibilityRole="button"
    >
      <View className="w-11 h-11 rounded-full bg-gray-100 items-center justify-center mr-3">
        <Ionicons name={icono as keyof typeof Ionicons.glyphMap} size={20} color="#374151" />
      </View>
      <View className="flex-1">
        <Text className="font-medium" numberOfLines={1}>
          {notification.comercio ?? 'Comercio no detectado'}
        </Text>
        <Text className="text-gray-400 text-xs" numberOfLines={1}>
          {notification.rawText}
        </Text>
      </View>
      <Text className={`font-semibold mr-3 ${isGasto ? 'text-red-600' : 'text-green-600'}`}>
        {notification.monto != null ? `${isGasto ? '-' : '+'}$${notification.monto.toLocaleString('es-CL')}` : '—'}
      </Text>
      <PressableScale onPress={onDiscard} hitSlop={8} accessibilityRole="button" accessibilityLabel="Descartar">
        <Ionicons name="close-circle-outline" size={22} color="#9ca3af" />
      </PressableScale>
    </PressableScale>
  );
}

/**
 * Bandeja de entrada de gastos pendientes: shown once more than one
 * notification has been captured. Also doubles as the manual capture path
 * (paste raw text -> parse) -- there's no OS-level notification listener
 * yet (Android needs a native NotificationListenerService, iOS can't read
 * other apps' notifications at all), so this is how the inbox gets
 * populated and, for now, how this feature is testable end-to-end.
 */
export function PendingNotificationsInbox({ visible, onClose }: PendingNotificationsInboxProps) {
  const { data: pending } = usePendingNotifications();
  const { data: categories } = useCategories();
  const addFromText = useAddPendingNotificationFromText();
  const discardNotification = useDiscardPendingNotification();
  const { data: accessGranted, refetch: refetchAccessGranted } = useNotificationAccessGranted();
  const showAccessBanner = Platform.OS === 'android' && isBankNotificationListenerAvailable() && accessGranted === false;

  const [pasteText, setPasteText] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PendingNotification | null>(null);

  // The permission is granted from Android's system settings, outside the
  // app entirely, so nothing in-app invalidates this query when it changes
  // -- re-check fresh every time the bandeja is opened, so the banner
  // disappears on the next visit once the user has granted it instead of
  // staying stuck showing a stale "not granted" from whenever it first
  // loaded.
  useEffect(() => {
    if (visible) refetchAccessGranted();
  }, [visible, refetchAccessGranted]);

  const handleAdd = () => {
    const text = pasteText.trim();
    if (!text) return;
    setFormError(null);
    addFromText.mutate(
      { rawText: text, categories: categories ?? [] },
      {
        onSuccess: () => setPasteText(''),
        onError: (err) => setFormError((err as Error).message),
      }
    );
  };

  return (
    <>
      <FullScreenFormModal visible={visible} title="Notificaciones pendientes" onClose={onClose}>
        {formError && <ErrorBanner message={formError} onRetry={() => setFormError(null)} actionLabel="Descartar" />}

        {showAccessBanner && (
          <View className="bg-blue-50 border border-blue-200 rounded-md px-4 py-3 mb-5">
            <Text className="text-blue-900 mb-2">
              Activa el acceso a notificaciones para capturar avisos bancarios automáticamente, sin tener que
              pegarlos a mano.
            </Text>
            <PressableScale onPress={openNotificationAccessSettings}>
              <Text className="text-blue-700 font-semibold">Abrir ajustes</Text>
            </PressableScale>
          </View>
        )}

        <View className="mb-5">
          <Text className="text-gray-400 text-xs font-semibold uppercase mb-2">Agregar notificación</Text>
          <View className="flex-row items-center border border-gray-300 rounded-md px-3 py-2 mb-1">
            <Ionicons name="clipboard-outline" size={18} color="#6b7280" style={{ marginRight: 8 }} />
            <TextInput
              className="flex-1"
              style={{ color: INPUT_TEXT_COLOR }}
              placeholder="Pega aquí el SMS o notificación de tu banco..."
              placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
              selectionColor={INPUT_SELECTION_COLOR}
              cursorColor={INPUT_SELECTION_COLOR}
              value={pasteText}
              onChangeText={setPasteText}
              multiline
              numberOfLines={2}
            />
          </View>
          <Text className="text-gray-400 text-xs mb-2">
            Copia el texto completo del SMS o la notificación de tu banco y pégalo arriba — lo analizamos
            automáticamente para completar comercio, monto y categoría.
          </Text>
          <Button
            title="Analizar y agregar"
            onPress={handleAdd}
            loading={addFromText.isPending}
            disabled={!pasteText.trim()}
          />
        </View>

        <View className="pt-4 border-t border-gray-100">
          <Text className="text-gray-400 text-xs font-semibold uppercase mb-2">
            {pending && pending.length > 0 ? `Pendientes (${pending.length})` : 'Pendientes'}
          </Text>
          {!pending || pending.length === 0 ? (
            <Text className="text-gray-400 text-sm py-6 text-center">No hay notificaciones pendientes.</Text>
          ) : (
            pending.map((notification) => (
              <PendingNotificationRow
                key={notification.id}
                notification={notification}
                onPress={() => setSelected(notification)}
                onDiscard={() => discardNotification.mutate(notification.id)}
              />
            ))
          )}
        </View>
      </FullScreenFormModal>

      <PendingNotificationConfirmModal
        visible={!!selected}
        notification={selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
