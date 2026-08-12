import {
  addPendingNotification,
  confirmPendingNotification,
  discardPendingNotification,
} from '../features/pendingNotifications/inboxStore';
import type { PendingNotification } from '../features/pendingNotifications/types';

function makeNotification(overrides: Partial<PendingNotification> = {}): PendingNotification {
  return {
    id: 'n1',
    rawText: 'Compra por $12.990 en STARBUCKS',
    monto: 12990,
    comercio: 'STARBUCKS',
    tipo: 'gasto',
    suggestedCategoryId: null,
    capturedAt: '2026-08-12T10:00:00.000Z',
    ...overrides,
  };
}

describe('addPendingNotification', () => {
  it('adds a notification to an empty list', () => {
    const notification = makeNotification();
    expect(addPendingNotification([], notification)).toEqual([notification]);
  });

  it('prepends the new notification, most recent first', () => {
    const older = makeNotification({ id: 'n1' });
    const newer = makeNotification({ id: 'n2' });
    expect(addPendingNotification([older], newer)).toEqual([newer, older]);
  });

  it('does not mutate the original list', () => {
    const original: PendingNotification[] = [];
    addPendingNotification(original, makeNotification());
    expect(original).toEqual([]);
  });
});

describe('discardPendingNotification', () => {
  it('removes the notification with the matching id', () => {
    const keep = makeNotification({ id: 'keep' });
    const drop = makeNotification({ id: 'drop' });
    expect(discardPendingNotification([keep, drop], 'drop')).toEqual([keep]);
  });

  it('leaves the list unchanged when the id is not found', () => {
    const list = [makeNotification({ id: 'n1' })];
    expect(discardPendingNotification(list, 'missing')).toEqual(list);
  });

  it('does not mutate the original list', () => {
    const original = [makeNotification({ id: 'n1' })];
    discardPendingNotification(original, 'n1');
    expect(original).toHaveLength(1);
  });
});

describe('confirmPendingNotification', () => {
  it('removes the notification with the matching id, like discard', () => {
    const keep = makeNotification({ id: 'keep' });
    const confirmed = makeNotification({ id: 'confirmed' });
    expect(confirmPendingNotification([keep, confirmed], 'confirmed')).toEqual([keep]);
  });

  it('leaves the list unchanged when the id is not found', () => {
    const list = [makeNotification({ id: 'n1' })];
    expect(confirmPendingNotification(list, 'missing')).toEqual(list);
  });
});
