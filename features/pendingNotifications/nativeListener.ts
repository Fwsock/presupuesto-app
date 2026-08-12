import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import {
  addBankNotificationListener,
  isBankNotificationListenerAvailable,
  isNotificationAccessGranted,
  openNotificationAccessSettings,
} from '../../modules/bank-notification-listener';
import { useCategories } from '../categories/hooks';
import { useAddPendingNotificationFromText } from './hooks';

export { openNotificationAccessSettings, isBankNotificationListenerAvailable };

export function useNotificationAccessGranted() {
  return useQuery({
    queryKey: ['bank-notification-access-granted'],
    queryFn: isNotificationAccessGranted,
    enabled: Platform.OS === 'android' && isBankNotificationListenerAvailable(),
  });
}

/**
 * Subscribes to the native Android listener (modules/bank-notification-listener)
 * for the app's whole lifetime and feeds every captured notification into the
 * same parse+suggest+add pipeline the manual "paste text" entry in
 * PendingNotificationsInbox uses (useAddPendingNotificationFromText) -- one
 * pipeline, two ways in. A no-op on iOS or inside Expo Go, where the native
 * module doesn't exist (see modules/bank-notification-listener/index.ts).
 */
export function useBankNotificationListener() {
  const { data: categories } = useCategories();
  const addFromText = useAddPendingNotificationFromText();

  useEffect(() => {
    if (Platform.OS !== 'android' || !isBankNotificationListenerAvailable()) return;

    const subscription = addBankNotificationListener((event) => {
      addFromText.mutate({ rawText: event.text, categories: categories ?? [] });
    });

    return () => subscription?.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);
}
