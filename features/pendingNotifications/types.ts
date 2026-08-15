import type { NotificationMovementType } from '../../lib/parsers/bankNotificationParser';

/**
 * 'text' -- a bank push notification/SMS (background listener, persisted-
 * queue drain, or a gallery pick that ran through the notification-style
 * parser). 'scan' -- a boleta/comprobante photographed or picked through
 * the OCR document scanner. Drives the confirm screen's bottom section: raw
 * notification text for 'text' (already short/readable), a clean extracted-
 * fields summary for 'scan' (raw OCR text can run to dozens of lines).
 */
export type PendingNotificationSource = 'text' | 'scan';

export interface PendingNotification {
  id: string;
  rawText: string;
  monto: number | null;
  comercio: string | null;
  fecha: string | null;
  tipo: NotificationMovementType | null;
  suggestedCategoryId: string | null;
  capturedAt: string;
  source: PendingNotificationSource;
  /** Only ever populated for source: 'scan' -- always [] for 'text'. */
  items: string[];
}
