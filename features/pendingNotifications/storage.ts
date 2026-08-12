import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PendingNotification } from './types';

const STORAGE_KEY = 'pending-notifications';

export async function loadPendingNotifications(): Promise<PendingNotification[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function savePendingNotifications(list: PendingNotification[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}
