import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'experimental-scan-enabled';
const QUERY_KEY = ['experimentalScanEnabled'];

async function loadExperimentalScanEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(STORAGE_KEY)) === 'true';
  } catch {
    return false;
  }
}

/**
 * Android-only opt-in gate for the two "heavy" OCR scan paths (camera
 * receipt scan, gallery screenshot scan) -- see PendingNotificationsInbox's
 * "Agregar movimiento" section (both QuickActionButtons) and this screen's
 * own "Funciones Experimentales" switch. Off by default, persisted so the
 * choice survives an app restart. Deliberately does NOT gate the background
 * bank-notification listener -- that's the app's main, stable capture path
 * (see isBankNotificationListenerAvailable), unrelated to the two OCR flows
 * this toggle covers.
 */
export function useExperimentalScanEnabled(): boolean {
  const { data } = useQuery({ queryKey: QUERY_KEY, queryFn: loadExperimentalScanEnabled, initialData: false });
  return data ?? false;
}

export function useSetExperimentalScanEnabled() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      await AsyncStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
      return enabled;
    },
    onSuccess: (enabled) => {
      queryClient.setQueryData(QUERY_KEY, enabled);
    },
  });
}
