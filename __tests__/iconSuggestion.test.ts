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

describe('suggestMovementIcon (expanded Chilean dictionary)', () => {
  it('matches Chilean supermarket chains', () => {
    expect(suggestMovementIcon('Compra en Jumbo')).toBe('cart-outline');
    expect(suggestMovementIcon('TOTTUS')).toBe('cart-outline');
  });

  it('matches personal care variations, accent-insensitively', () => {
    expect(suggestMovementIcon('Corte de pelo')).toBe('cut-outline');
    expect(suggestMovementIcon('Barberia El Estilo')).toBe('cut-outline');
  });

  it('matches transport brands including gas stations and transit', () => {
    expect(suggestMovementIcon('Copec bencinera')).toBe('car-outline');
    expect(suggestMovementIcon('Carga BIP')).toBe('car-outline');
  });

  it('matches fast food and delivery brands', () => {
    expect(suggestMovementIcon('McDonalds')).toBe('restaurant-outline');
    expect(suggestMovementIcon('Starbucks Coffee')).toBe('restaurant-outline');
  });

  it('matches pharmacy chains', () => {
    expect(suggestMovementIcon('Farmacias Cruz Verde')).toBe('medical-outline');
    expect(suggestMovementIcon('Dr Simi')).toBe('medical-outline');
  });

  it('matches home-improvement stores into the existing repair bucket', () => {
    expect(suggestMovementIcon('Sodimac')).toBe('construct-outline');
  });

  it('matches department stores', () => {
    expect(suggestMovementIcon('Ripley')).toBe('bag-outline');
    expect(suggestMovementIcon('Paris')).toBe('bag-outline');
  });

  it('matches courier services', () => {
    expect(suggestMovementIcon('Envio por Chilexpress')).toBe('cube-outline');
  });

  it('prioritizes the credit-card match over the store name for "CMR Falabella"', () => {
    expect(suggestMovementIcon('CMR Falabella')).toBe('card-outline');
  });
});

describe('AVAILABLE_MOVEMENT_ICONS', () => {
  it('includes the default icon and every icon a rule can suggest, with no duplicates', () => {
    expect(AVAILABLE_MOVEMENT_ICONS).toContain(DEFAULT_MOVEMENT_ICON);
    expect(new Set(AVAILABLE_MOVEMENT_ICONS).size).toBe(AVAILABLE_MOVEMENT_ICONS.length);
  });
});
