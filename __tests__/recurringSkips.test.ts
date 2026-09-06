import { buildRecurringSkipKey } from '../features/movements/recurringSkips';

describe('buildRecurringSkipKey', () => {
  it('prefixes an income series id so it can never collide with a fixed series id', () => {
    expect(buildRecurringSkipKey('income', 'abc-123')).toBe('income:abc-123');
  });

  it('prefixes a fixed-category series id', () => {
    expect(buildRecurringSkipKey('fixed', 'serie-luz')).toBe('fixed:serie-luz');
  });

  it('produces distinct keys for the same raw id under each kind', () => {
    const sameId = 'shared-uuid';
    expect(buildRecurringSkipKey('income', sameId)).not.toBe(buildRecurringSkipKey('fixed', sameId));
  });
});
