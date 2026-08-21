import { memo, useCallback, useState } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { FullScreenFormModal } from './FullScreenFormModal';
import { PressableScale } from './PressableScale';
import { ErrorBanner } from './ErrorBanner';
import { MovementIconBadge } from './MovementIconBadge';
import { PendingNotificationConfirmModal } from './PendingNotificationConfirmModal';
import { useCategories } from '../features/categories/hooks';
import {
  useAddPendingNotificationFromScan,
  useDiscardPendingNotification,
  usePendingNotifications,
} from '../features/pendingNotifications/hooks';
import {
  isBankNotificationListenerAvailable,
  openNotificationAccessSettings,
  useNotificationAccessGranted,
} from '../features/pendingNotifications/nativeListener';
import {
  isTextRecognitionAvailable,
  scanDocumentFromCamera,
  scanDocumentFromGallery,
} from '../features/pendingNotifications/documentCapture';
import { suggestMovementIcon } from '../features/movements/iconSuggestion';
import { theme } from '../lib/theme';
import type { PendingNotification } from '../features/pendingNotifications/types';

interface PendingNotificationsInboxProps {
  visible: boolean;
  onClose: () => void;
}

// React.memo only pays off when its props are referentially stable across
// re-renders, so onPress/onDiscard take the notification/id as an argument
// instead of being pre-bound per-row closures -- the parent passes the same
// two function references for every row, every render (see
// handleSelectNotification/handleDiscardNotification below).
const PendingNotificationRow = memo(function PendingNotificationRow({
  notification,
  onPress,
  onDiscard,
}: {
  notification: PendingNotification;
  onPress: (notification: PendingNotification) => void;
  onDiscard: (id: string) => void;
}) {
  const isGasto = notification.tipo !== 'ingreso';
  const icono = suggestMovementIcon(notification.comercio ?? '');

  return (
    <PressableScale
      onPress={() => onPress(notification)}
      // Same row feel as MovementListItem/CategoryTotalsList -- every
      // tappable row in the app uses this exact intensity now.
      scaleTo={0.965}
      activeOpacity={0.7}
      spring
      haptics
      className="flex-row items-center py-3 border-b border-border"
      accessibilityRole="button"
    >
      <MovementIconBadge label={notification.comercio} iconName={icono} size={44} style={{ marginRight: 12 }} />
      <View className="flex-1">
        <Text className="font-medium" numberOfLines={1}>
          {notification.comercio ?? 'Comercio no detectado'}
        </Text>
        <Text className="text-secondary text-xs" numberOfLines={1}>
          {notification.rawText}
        </Text>
      </View>
      <Text className={`font-semibold mr-3 ${isGasto ? 'text-danger' : 'text-income'}`}>
        {notification.monto != null ? `${isGasto ? '-' : '+'}$${notification.monto.toLocaleString('es-CL')}` : '—'}
      </Text>
      <PressableScale
        onPress={() => onDiscard(notification.id)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Descartar"
      >
        <Ionicons name="close-circle-outline" size={22} color="#9ca3af" />
      </PressableScale>
    </PressableScale>
  );
});

function QuickActionButton({
  icon,
  label,
  onPress,
  loading = false,
  disabled = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      scaleTo={0.965}
      activeOpacity={0.7}
      spring
      haptics
      className="flex-1 items-center justify-center border border-gray-200 rounded-2xl py-5 px-2"
      style={{ opacity: disabled && !loading ? 0.5 : 1 }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View className="w-12 h-12 rounded-full bg-brand/10 items-center justify-center mb-2">
        {loading ? (
          <ActivityIndicator size="small" color={theme.brand} />
        ) : (
          <Ionicons name={icon} size={22} color={theme.brand} />
        )}
      </View>
      <Text className="text-sm font-medium text-center">{label}</Text>
    </PressableScale>
  );
}

/**
 * Bandeja de entrada de gastos pendientes: shown once more than one
 * notification has been captured. Two capture paths besides the background
 * listener -- "Subir desde galería" and "Escanear con cámara" -- differ only
 * in the image source; both run the exact same flexible OCR scan (see
 * documentCapture.ts), so either one can pick up a boleta/factura, a small
 * vale, or a bank transfer screenshot/confirmation. There used to also be a
 * manual paste box; removed in favor of these two, since OCR covers the
 * same ground with far less friction.
 */
export function PendingNotificationsInbox({ visible, onClose }: PendingNotificationsInboxProps) {
  const { data: pending } = usePendingNotifications();
  const { data: categories } = useCategories();
  const addFromScan = useAddPendingNotificationFromScan();
  const discardNotification = useDiscardPendingNotification();
  // Re-checked automatically on every app-foreground event -- see
  // useNotificationAccessGranted's own comment for why.
  const { data: accessGranted } = useNotificationAccessGranted();
  const showAccessBanner = Platform.OS === 'android' && isBankNotificationListenerAvailable() && accessGranted === false;

  const [formError, setFormError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PendingNotification | null>(null);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);

  const handleSelectNotification = useCallback((notification: PendingNotification) => setSelected(notification), []);
  const handleDiscardNotification = useCallback(
    (id: string) => discardNotification.mutate(id),
    [discardNotification]
  );

  const handlePickFromGallery = async () => {
    setFormError(null);
    setGalleryLoading(true);
    try {
      const scan = await scanDocumentFromGallery();
      if (!scan) return;
      addFromScan.mutate(
        { scan, categories: categories ?? [] },
        { onError: (err) => setFormError((err as Error).message) }
      );
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setGalleryLoading(false);
    }
  };

  const handleScanFromCamera = async () => {
    setFormError(null);
    setCameraLoading(true);
    try {
      const scan = await scanDocumentFromCamera();
      if (!scan) return;
      addFromScan.mutate(
        { scan, categories: categories ?? [] },
        { onError: (err) => setFormError((err as Error).message) }
      );
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setCameraLoading(false);
    }
  };

  return (
    <>
      <FullScreenFormModal visible={visible} title="Notificaciones pendientes" onClose={onClose}>
        {formError && <ErrorBanner message={formError} onRetry={() => setFormError(null)} actionLabel="Descartar" />}

        {showAccessBanner && (
          <View className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-5">
            <Text className="text-blue-900 mb-2">
              Activa el acceso a notificaciones para capturar avisos bancarios automáticamente, sin tener que
              pegarlos a mano.
            </Text>
            <PressableScale onPress={openNotificationAccessSettings}>
              <Text className="text-blue-700 font-semibold">Abrir ajustes</Text>
            </PressableScale>
          </View>
        )}

        {isTextRecognitionAvailable() && (
          <View className="mb-5">
            <Text className="text-secondary text-xs font-semibold uppercase mb-2">Agregar movimiento</Text>
            <View className="flex-row" style={{ gap: 10 }}>
              <QuickActionButton
                icon="image-outline"
                label="Subir desde galería"
                onPress={handlePickFromGallery}
                loading={galleryLoading}
                disabled={cameraLoading}
              />
              <QuickActionButton
                icon="camera-outline"
                label="Escanear con cámara"
                onPress={handleScanFromCamera}
                loading={cameraLoading}
                disabled={galleryLoading}
              />
            </View>
          </View>
        )}

        <View className="pt-4 border-t border-border">
          <Text className="text-secondary text-xs font-semibold uppercase mb-2">
            {pending && pending.length > 0 ? `Pendientes (${pending.length})` : 'Pendientes'}
          </Text>
          {!pending || pending.length === 0 ? (
            <Text className="text-secondary text-sm py-6 text-center">No hay notificaciones pendientes.</Text>
          ) : (
            pending.map((notification) => (
              <Animated.View
                key={notification.id}
                entering={FadeIn.duration(300)}
                exiting={FadeOut.duration(220)}
                layout={LinearTransition.duration(250)}
              >
                <PendingNotificationRow
                  notification={notification}
                  onPress={handleSelectNotification}
                  onDiscard={handleDiscardNotification}
                />
              </Animated.View>
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
