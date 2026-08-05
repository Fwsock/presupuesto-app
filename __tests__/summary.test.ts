import { calculateMonthSummary } from '../features/movements/summary';
import type { Category } from '../features/categories/types';
import type { Movement } from '../features/movements/types';

const categories: Category[] = [
  { id: 'ing', user_id: 'u1', nombre: 'Ingresos', es_fija: false, created_at: '' },
  { id: 'fijos', user_id: 'u1', nombre: 'Gastos Fijos', es_fija: false, created_at: '' },
  { id: 'ahorro', user_id: 'u1', nombre: 'Ahorro', es_fija: false, created_at: '' },
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

describe('calculateMonthSummary', () => {
  it('sums ingresos and subtracts gastos for the saldo disponible', () => {
    const movements = [
      movement({ category_id: 'ing', tipo: 'ingreso', monto: 500000, estado: 'pagado' }),
      movement({ category_id: 'fijos', tipo: 'gasto', monto: 100000, estado: 'pagado' }),
      movement({ category_id: 'ahorro', tipo: 'gasto', monto: 50000, estado: 'pagado' }),
    ];

    const summary = calculateMonthSummary(movements, categories);

    expect(summary.totalIngresos).toBe(500000);
    expect(summary.totalGastos).toBe(150000);
    expect(summary.saldoDisponible).toBe(350000);
  });

  it('ignores movements that are still pendiente', () => {
    const movements = [
      movement({ category_id: 'ing', tipo: 'ingreso', monto: 500000, estado: 'pagado' }),
      movement({ category_id: 'fijos', tipo: 'gasto', monto: 999999, estado: 'pendiente' }),
    ];

    const summary = calculateMonthSummary(movements, categories);

    expect(summary.totalGastos).toBe(0);
    expect(summary.saldoDisponible).toBe(500000);
  });

  it('includes every category in totalsByCategory even with zero movements', () => {
    const summary = calculateMonthSummary([], categories);

    expect(summary.totalsByCategory).toHaveLength(3);
    expect(summary.totalsByCategory.every((c) => c.total === 0)).toBe(true);
  });

  it('excludes pendiente movements from a category total even when the same category also has pagado movements', () => {
    const movements = [
      movement({ category_id: 'fijos', tipo: 'gasto', monto: 100000, estado: 'pagado' }),
      movement({ category_id: 'fijos', tipo: 'gasto', monto: 999999, estado: 'pendiente' }),
    ];

    const summary = calculateMonthSummary(movements, categories);
    const fijosTotal = summary.totalsByCategory.find((c) => c.categoryId === 'fijos');

    expect(fijosTotal?.total).toBe(100000);
    expect(summary.totalGastos).toBe(100000);
  });

  it('splits totalIngresos/totalGastos by movement.tipo even when a category holds both kinds', () => {
    const movements = [
      movement({ category_id: 'fijos', tipo: 'ingreso', monto: 20000, estado: 'pagado' }),
      movement({ category_id: 'fijos', tipo: 'gasto', monto: 5000, estado: 'pagado' }),
    ];

    const summary = calculateMonthSummary(movements, categories);
    const fijosTotal = summary.totalsByCategory.find((c) => c.categoryId === 'fijos');

    expect(summary.totalIngresos).toBe(20000);
    expect(summary.totalGastos).toBe(5000);
    // Category total is the combined sum regardless of type...
    expect(fijosTotal?.total).toBe(25000);
    // ...and its display tipo follows whichever side has the larger amount.
    expect(fijosTotal?.tipo).toBe('ingreso');
  });
});
