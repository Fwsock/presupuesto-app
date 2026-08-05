import { sortMovements, filterMovementsByQuery } from '../features/movements/sort';
import type { Movement } from '../features/movements/types';

function movement(overrides: Partial<Movement>): Movement {
  return {
    id: 'm',
    user_id: 'u1',
    category_id: 'cat',
    tipo: 'gasto',
    concepto: 'x',
    monto: 0,
    notas: null,
    estado: 'pagado',
    fecha: '2026-07-01',
    installment_group_id: null,
    cuota_numero: null,
    cuota_total: null,
    icono: 'receipt-outline',
    recurring_income_id: null,
    fixed_series_id: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

describe('sortMovements', () => {
  const movements = [
    movement({ id: 'a', concepto: 'Zapatillas', monto: 7000, fecha: '2026-07-15' }),
    movement({ id: 'b', concepto: 'Arriendo', monto: 300000, fecha: '2026-07-01' }),
    movement({ id: 'c', concepto: 'Café', monto: 3000, fecha: '2026-07-20' }),
  ];

  it('sorts by fecha ascending and descending', () => {
    expect(sortMovements(movements, 'fecha', 'asc').map((m) => m.id)).toEqual(['b', 'a', 'c']);
    expect(sortMovements(movements, 'fecha', 'desc').map((m) => m.id)).toEqual(['c', 'a', 'b']);
  });

  it('sorts by monto ascending and descending', () => {
    expect(sortMovements(movements, 'monto', 'asc').map((m) => m.id)).toEqual(['c', 'a', 'b']);
    expect(sortMovements(movements, 'monto', 'desc').map((m) => m.id)).toEqual(['b', 'a', 'c']);
  });

  it('sorts by nombre (concepto) alphabetically, accent/case-insensitive', () => {
    expect(sortMovements(movements, 'nombre', 'asc').map((m) => m.id)).toEqual(['b', 'c', 'a']);
  });

  it('does not mutate the input array', () => {
    const original = [...movements];
    sortMovements(movements, 'monto', 'asc');
    expect(movements).toEqual(original);
  });
});

describe('filterMovementsByQuery', () => {
  const movements = [
    movement({ id: 'a', concepto: 'Zapatillas Nike' }),
    movement({ id: 'b', concepto: 'Arriendo depto' }),
    movement({ id: 'c', concepto: 'Café' }),
  ];

  it('matches case-insensitively as a substring', () => {
    expect(filterMovementsByQuery(movements, 'nike').map((m) => m.id)).toEqual(['a']);
    expect(filterMovementsByQuery(movements, 'ZAPA').map((m) => m.id)).toEqual(['a']);
  });

  it('returns everything unchanged for an empty or blank query', () => {
    expect(filterMovementsByQuery(movements, '')).toEqual(movements);
    expect(filterMovementsByQuery(movements, '   ')).toEqual(movements);
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterMovementsByQuery(movements, 'xyz123')).toEqual([]);
  });
});
