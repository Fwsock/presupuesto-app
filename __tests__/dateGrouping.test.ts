import { groupMovementsByDate } from '../features/movements/dateGrouping';
import type { Movement } from '../features/movements/types';

function movement(overrides: Partial<Movement>): Movement {
  return {
    id: 'm',
    user_id: 'u1',
    category_id: 'c1',
    tipo: 'gasto',
    concepto: 'Item',
    monto: 1000,
    notas: null,
    estado: 'pagado',
    fecha: '2026-08-04',
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

describe('groupMovementsByDate', () => {
  it('returns an empty array for no movements', () => {
    expect(groupMovementsByDate([])).toEqual([]);
  });

  it('groups movements sharing a fecha into one section', () => {
    const movements = [
      movement({ id: 'a', fecha: '2026-08-04', tipo: 'gasto', monto: 5000 }),
      movement({ id: 'b', fecha: '2026-08-04', tipo: 'gasto', monto: 3000 }),
    ];

    const result = groupMovementsByDate(movements);

    expect(result).toHaveLength(1);
    expect(result[0].fecha).toBe('2026-08-04');
    expect(result[0].data.map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('sums the day total with sign: ingreso positive, gasto negative', () => {
    const movements = [
      movement({ id: 'a', fecha: '2026-08-04', tipo: 'ingreso', monto: 10000 }),
      movement({ id: 'b', fecha: '2026-08-04', tipo: 'gasto', monto: 3000 }),
    ];

    const result = groupMovementsByDate(movements);

    expect(result[0].totalDelDia).toBe(7000);
  });

  it('orders sections by fecha descending regardless of input order', () => {
    const movements = [
      movement({ id: 'a', fecha: '2026-08-01' }),
      movement({ id: 'b', fecha: '2026-08-05' }),
      movement({ id: 'c', fecha: '2026-08-03' }),
    ];

    const result = groupMovementsByDate(movements);

    expect(result.map((g) => g.fecha)).toEqual(['2026-08-05', '2026-08-03', '2026-08-01']);
  });
});
