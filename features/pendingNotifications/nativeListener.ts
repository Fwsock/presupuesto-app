import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addBankNotificationListener,
  drainPersistedBankNotifications,
  isBankNotificationListenerAvailable,
  isNotificationAccessGranted,
  openNotificationAccessSettings,
} from '../../modules/bank-notification-listener';
import { useCategories } from '../categories/hooks';
import { useAddPendingNotificationFromText } from './hooks';

export { openNotificationAccessSettings, isBankNotificationListenerAvailable };

const ACCESS_GRANTED_QUERY_KEY = ['bank-notification-access-granted'];

/**
 * The permission itself is granted from Android's system settings, entirely
 * outside the app, so nothing in-app mutates this query when it changes --
 * without this listener the banner in PendingNotificationsInbox stayed
 * showing "not granted" forever after the user granted it and came back.
 * Re-checking on every app-foreground event (not just while the inbox
 * happens to be open) means it clears the moment they return, regardless of
 * which screen they land back on.
 */
export function useNotificationAccessGranted() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ACCESS_GRANTED_QUERY_KEY,
    queryFn: isNotificationAccessGranted,
    enabled: Platform.OS === 'android' && isBankNotificationListenerAvailable(),
  });

  useEffect(() => {
    if (Platform.OS !== 'android' || !isBankNotificationListenerAvailable()) return;

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        queryClient.invalidateQueries({ queryKey: ACCESS_GRANTED_QUERY_KEY });
      }
    });

    return () => subscription.remove();
  }, [queryClient]);

  return query;
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

  // Once per app launch: catches up on anything BankNotificationListenerService
  // captured while the app's JS context was fully dead (process killed, not
  // just backgrounded) and had nowhere to deliver it live -- see that
  // service's class doc for why this queue exists.
  useEffect(() => {
    if (Platform.OS !== 'android' || !isBankNotificationListenerAvailable()) return;

    drainPersistedBankNotifications()
      .then((events) => {
        events.forEach((event) => {
          addFromText.mutate({ rawText: event.text, categories: categories ?? [] });
        });
      })
      .catch(() => {
        // Best-effort catch-up -- a failure here (e.g. a native-side hiccup
        // reading the persisted queue) shouldn't be fatal, the live listener
        // above still works for anything captured from here on.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
