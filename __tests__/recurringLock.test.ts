import { isRecurringGeneratedMovement } from '../features/movements/recurringLock';

describe('isRecurringGeneratedMovement', () => {
  it('is true when recurring_income_id is set', () => {
    expect(isRecurringGeneratedMovement({ recurring_income_id: 'abc' })).toBe(true);
  });

  it('is false when recurring_income_id is null', () => {
    expect(isRecurringGeneratedMovement({ recurring_income_id: null })).toBe(false);
  });
});
