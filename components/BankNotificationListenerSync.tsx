import { useBankNotificationListener } from '../features/pendingNotifications/nativeListener';

/**
 * Mounted once at the (app) layout level (like FixedCategoriesSync), so the
 * native Android listener stays subscribed regardless of which tab is
 * focused. Renders nothing -- a no-op on iOS or inside Expo Go.
 */
export function BankNotificationListenerSync() {
  useBankNotificationListener();
  return null;
}
