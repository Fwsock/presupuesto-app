import { calculateMonthSummary } from '../features/movements/summary';
import type { Category } from '../features/categories/types';
import type { Movement } from '../features/movements/types';

const categories: Category[] = [
  { id: 'ing', user_id: 'u1', nombre: 'Ingresos', tipo: 'ingreso', created_at: '' },
  { id: 'fijos', user_id: 'u1', nombre: 'Gastos Fijos', tipo: 'gasto', created_at: '' },
  { id: 'ahorro', user_id: 'u1', nombre: 'Ahorro', tipo: 'gasto', created_at: '' },
];

function movement(overrides: Partial<Movement>): Movement {
  return {
    id: 'm',
    user_id: 'u1',
    category_id: 'fijos',
    concepto: 'x',
    monto: 0,
    notas: null,
    estado: 'pagado',
    fecha: '2026-07-01',
    installment_group_id: null,
    cuota_numero: null,
    cuota_total: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

describe('calculateMonthSummary', () => {
  it('sums ingresos and subtracts gastos for the saldo disponible', () => {
    const movements = [
      movement({ category_id: 'ing', monto: 500000, estado: 'pagado' }),
      movement({ category_id: 'fijos', monto: 100000, estado: 'pagado' }),
      movement({ category_id: 'ahorro', monto: 50000, estado: 'pagado' }),
    ];

    const summary = calculateMonthSummary(movements, categories);

    expect(summary.totalIngresos).toBe(500000);
    expect(summary.totalGastos).toBe(150000);
    expect(summary.saldoDisponible).toBe(350000);
  });

  it('ignores movements that are still pendiente', () => {
    const movements = [
      movement({ category_id: 'ing', monto: 500000, estado: 'pagado' }),
      movement({ category_id: 'fijos', monto: 999999, estado: 'pendiente' }),
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
      movement({ category_id: 'fijos', monto: 100000, estado: 'pagado' }),
      movement({ category_id: 'fijos', monto: 999999, estado: 'pendiente' }),
    ];

    const summary = calculateMonthSummary(movements, categories);
    const fijosTotal = summary.totalsByCategory.find((c) => c.categoryId === 'fijos');

    expect(fijosTotal?.total).toBe(100000);
    expect(summary.totalGastos).toBe(100000);
  });
});
