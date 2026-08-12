import type { NotificationMovementType } from '../../lib/parsers/bankNotificationParser';

export interface PendingNotification {
  id: string;
  rawText: string;
  monto: number | null;
  comercio: string | null;
  tipo: NotificationMovementType | null;
  suggestedCategoryId: string | null;
  capturedAt: string;
}
