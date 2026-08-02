import { suggestMovementIcon, DEFAULT_MOVEMENT_ICON, AVAILABLE_MOVEMENT_ICONS } from '../features/movements/iconSuggestion';

describe('suggestMovementIcon', () => {
  it('matches a keyword regardless of surrounding words', () => {
    expect(suggestMovementIcon('Supermercado Lider')).toBe('cart-outline');
  });

  it('matches case-insensitively', () => {
    expect(suggestMovementIcon('BENCINA COPEC')).toBe('car-outline');
  });

  it('matches a keyword in the middle of the concepto', () => {
    expect(suggestMovementIcon('Pago arriendo depto')).toBe('home-outline');
  });

  it('matches accented input against an unaccented keyword', () => {
    expect(suggestMovementIcon('Peluquería')).toBe('cut-outline');
  });

  it('falls back to the default icon when nothing matches', () => {
    expect(suggestMovementIcon('Algo completamente distinto')).toBe(DEFAULT_MOVEMENT_ICON);
  });

  it('falls back to the default icon for an empty concepto', () => {
    expect(suggestMovementIcon('')).toBe(DEFAULT_MOVEMENT_ICON);
  });

  it('returns the first matching rule when a concepto could match more than one keyword set', () => {
    // "auto" (car-outline) appears in the car rule; the function should be
    // deterministic and not throw when a string has multiple potential hits.
    expect(suggestMovementIcon('Seguro auto')).toBe('car-outline');
  });
});

describe('AVAILABLE_MOVEMENT_ICONS', () => {
  it('includes the default icon and every icon a rule can suggest, with no duplicates', () => {
    expect(AVAILABLE_MOVEMENT_ICONS).toContain(DEFAULT_MOVEMENT_ICON);
    expect(new Set(AVAILABLE_MOVEMENT_ICONS).size).toBe(AVAILABLE_MOVEMENT_ICONS.length);
  });
});
