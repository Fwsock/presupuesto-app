import { buildMonthlySaldoSeries, calculateAverageGasto, monthOffset, type MonthlySaldoPoint } from '../features/movements/monthlySeries';
import type { Category } from '../features/categories/types';
import type { Movement } from '../features/movements/types';

const categories: Category[] = [
  { id: 'ing', user_id: 'u1', nombre: 'Ingresos', es_fija: false, created_at: '' },
  { id: 'fijos', user_id: 'u1', nombre: 'Gastos Fijos', es_fija: false, created_at: '' },
];

function movement(overrides: Partial<Movement>): Movement {
  return {
    id: 'm',
    user_id: 'u1',
    category_id: 'fijos',
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

describe('monthOffset', () => {
  it('moves forward within the same year', () => {
    expect(monthOffset(2026, 7, 2)).toEqual({ year: 2026, month: 9 });
  });

  it('moves backward within the same year', () => {
    expect(monthOffset(2026, 7, -2)).toEqual({ year: 2026, month: 5 });
  });

  it('rolls forward into the next year', () => {
    expect(monthOffset(2026, 11, 3)).toEqual({ year: 2027, month: 2 });
  });

  it('rolls backward into the previous year', () => {
    expect(monthOffset(2026, 1, -2)).toEqual({ year: 2025, month: 11 });
  });

  it('returns the same month for a zero offset', () => {
    expect(monthOffset(2026, 7, 0)).toEqual({ year: 2026, month: 7 });
  });
});

describe('buildMonthlySaldoSeries', () => {
  it('computes saldoDisponible per month using only that month\'s movements', () => {
    const movements = [
      movement({ fecha: '2026-06-15', category_id: 'ing', tipo: 'ingreso', monto: 500000, estado: 'pagado' }),
      movement({ fecha: '2026-06-20', category_id: 'fijos', tipo: 'gasto', monto: 100000, estado: 'pagado' }),
      movement({ fecha: '2026-07-05', category_id: 'ing', tipo: 'ingreso', monto: 300000, estado: 'pagado' }),
      movement({ fecha: '2026-07-10', category_id: 'fijos', tipo: 'gasto', monto: 250000, estado: 'pagado' }),
    ];

    const series = buildMonthlySaldoSeries(movements, categories, [
      { year: 2026, month: 6 },
      { year: 2026, month: 7 },
    ]);

    expect(series).toEqual([
      { year: 2026, month: 6, saldoDisponible: 400000, totalIngresos: 500000, totalGastos: 100000, hasMovements: true },
      { year: 2026, month: 7, saldoDisponible: 50000, totalIngresos: 300000, totalGastos: 250000, hasMovements: true },
    ]);
  });

  it('marks a month with no movements as having no data and zero saldo', () => {
    const series = buildMonthlySaldoSeries([], categories, [{ year: 2026, month: 8 }]);

    expect(series).toEqual([
      { year: 2026, month: 8, saldoDisponible: 0, totalIngresos: 0, totalGastos: 0, hasMovements: false },
    ]);
  });

  it('ignores pendiente movements for the saldo but still counts the month as having data', () => {
    const movements = [movement({ fecha: '2026-09-01', estado: 'pendiente', monto: 999999 })];

    const series = buildMonthlySaldoSeries(movements, categories, [{ year: 2026, month: 9 }]);

    expect(series).toEqual([
      { year: 2026, month: 9, saldoDisponible: 0, totalIngresos: 0, totalGastos: 0, hasMovements: true },
    ]);
  });

  it('can produce a negative saldoDisponible', () => {
    const movements = [
      movement({ fecha: '2026-05-01', category_id: 'ing', tipo: 'ingreso', monto: 100000, estado: 'pagado' }),
      movement({ fecha: '2026-05-02', category_id: 'fijos', tipo: 'gasto', monto: 150000, estado: 'pagado' }),
    ];

    const series = buildMonthlySaldoSeries(movements, categories, [{ year: 2026, month: 5 }]);

    expect(series[0].saldoDisponible).toBe(-50000);
  });
});

function point(overrides: Partial<MonthlySaldoPoint>): MonthlySaldoPoint {
  return { year: 2026, month: 1, saldoDisponible: 0, totalIngresos: 0, totalGastos: 0, hasMovements: false, ...overrides };
}

describe('calculateAverageGasto', () => {
  const TODAY = new Date('2026-08-23');

  it('excludes future months (always $0) from the divisor instead of dragging the average down', () => {
    const points = [
      point({ month: 7, totalGastos: 200000, hasMovements: true }), // past
      point({ month: 8, totalGastos: 300000, hasMovements: true }), // present
      point({ month: 9, totalGastos: 0, hasMovements: false }), // future, no data yet
    ];

    // Old (buggy) behavior would have divided by 3 -> 166,666.
    expect(calculateAverageGasto(points, TODAY)).toBe(250000);
  });

  it('excludes a past/present month with genuinely nothing logged, not just future ones', () => {
    const points = [
      point({ month: 6, totalGastos: 0, hasMovements: false }), // past, nothing logged
      point({ month: 7, totalGastos: 400000, hasMovements: true }),
      point({ month: 8, totalGastos: 200000, hasMovements: true }),
    ];

    expect(calculateAverageGasto(points, TODAY)).toBe(300000);
  });

  it('treats the current month as eligible (present, not future)', () => {
    const points = [point({ year: 2026, month: 8, totalGastos: 100000, hasMovements: true })];

    expect(calculateAverageGasto(points, TODAY)).toBe(100000);
  });

  it('excludes a future month that rolls into next year', () => {
    const points = [
      point({ year: 2026, month: 8, totalGastos: 200000, hasMovements: true }),
      point({ year: 2027, month: 1, totalGastos: 999999, hasMovements: true }),
    ];

    expect(calculateAverageGasto(points, TODAY)).toBe(200000);
  });

  it('returns 0 when there is no qualifying month', () => {
    const points = [
      point({ month: 9, totalGastos: 0, hasMovements: false }),
      point({ month: 10, totalGastos: 0, hasMovements: false }),
    ];

    expect(calculateAverageGasto(points, TODAY)).toBe(0);
  });
});
