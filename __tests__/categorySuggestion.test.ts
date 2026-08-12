import { suggestCategoryForComercio } from '../features/movements/categorySuggestion';
import type { Category } from '../features/categories/types';

function makeCategory(id: string, nombre: string): Category {
  return { id, user_id: 'u1', nombre, es_fija: false, created_at: '2026-01-01T00:00:00.000Z' };
}

describe('suggestCategoryForComercio', () => {
  it('matches a category whose name is a direct substring of the comercio', () => {
    const categories = [makeCategory('c1', 'Supermercado'), makeCategory('c2', 'Salud')];
    expect(suggestCategoryForComercio('SUPERMERCADO LIDER', categories)).toEqual(categories[0]);
  });

  it('matches case- and accent-insensitively', () => {
    const categories = [makeCategory('c1', 'Peluquería')];
    expect(suggestCategoryForComercio('PELUQUERIA BELLA', categories)).toEqual(categories[0]);
  });

  it('falls back to the icon-bucket match when no category name is a direct substring', () => {
    // "Comida" and "PEDIDOSYA DELIVERY" share no substring, but both land on
    // restaurant-outline via iconSuggestion's keyword rules.
    const categories = [makeCategory('c1', 'Comida'), makeCategory('c2', 'Transporte')];
    expect(suggestCategoryForComercio('PEDIDOSYA DELIVERY', categories)).toEqual(categories[0]);
  });

  it('returns null when the comercio matches no keyword bucket at all', () => {
    const categories = [makeCategory('c1', 'Ahorro'), makeCategory('c2', 'Salud')];
    expect(suggestCategoryForComercio('XYZ CORP RANDOM', categories)).toBeNull();
  });

  it('returns null for a null comercio', () => {
    expect(suggestCategoryForComercio(null, [makeCategory('c1', 'Comida')])).toBeNull();
  });

  it('returns null for an empty category list', () => {
    expect(suggestCategoryForComercio('STARBUCKS', [])).toBeNull();
  });
});
