import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PendingNotification } from './types';

const STORAGE_KEY = 'pending-notifications';

/** Never throws: a corrupted/unreadable cache falls back to an empty inbox instead of leaving the whole feature permanently broken. */
export async function loadPendingNotifications(): Promise<PendingNotification[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function savePendingNotifications(list: PendingNotification[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Best-effort persistence -- a write failure here shouldn't crash
    // whatever mutation (confirm/discard/add) triggered it; the in-memory
    // React Query cache still reflects the intended state for this session.
  }
}
