import type { PendingNotification } from './types';

export function addPendingNotification(
  list: PendingNotification[],
  notification: PendingNotification
): PendingNotification[] {
  return [notification, ...list];
}

export function discardPendingNotification(list: PendingNotification[], id: string): PendingNotification[] {
  return list.filter((n) => n.id !== id);
}

// Confirming removes the item from the inbox the same way discarding does —
// turning it into a real Movement first is the caller's job (see
// useConfirmPendingNotification in features/pendingNotifications/hooks.ts).
export function confirmPendingNotification(list: PendingNotification[], id: string): PendingNotification[] {
  return discardPendingNotification(list, id);
}
