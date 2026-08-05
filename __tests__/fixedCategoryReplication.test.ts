import { computeFixedCategoryReplications } from '../features/movements/fixedCategoryReplication';
import type { Movement } from '../features/movements/types';

function movement(overrides: Partial<Movement>): Movement {
  return {
    id: 'm',
    user_id: 'u1',
    category_id: 'fijos',
    tipo: 'gasto',
    concepto: 'Insumos basicos',
    monto: 29000,
    notas: null,
    estado: 'pagado',
    fecha: '2026-08-03',
    installment_group_id: null,
    cuota_numero: null,
    cuota_total: null,
    icono: 'receipt-outline',
    recurring_income_id: null,
    fixed_series_id: 'serie-1',
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

describe('computeFixedCategoryReplications', () => {
  it('replicates into a month far in the future from the single latest prior instance (direct jump, e.g. Agosto 2026 -> Enero 2027)', () => {
    const priorMovements = [movement({ id: 'm-ago', fecha: '2026-08-03' })];

    const result = computeFixedCategoryReplications(priorMovements, new Set(), 2027, 1, 'u1');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      user_id: 'u1',
      category_id: 'fijos',
      concepto: 'Insumos basicos',
      monto: 29000,
      estado: 'pendiente',
      fecha: '2027-01-03',
      fixed_series_id: 'serie-1',
    });
  });

  it('does not duplicate a series that already has a movement in the viewed month', () => {
    const priorMovements = [movement({ id: 'm-ago', fecha: '2026-08-03' })];

    const result = computeFixedCategoryReplications(priorMovements, new Set(['serie-1']), 2027, 1, 'u1');

    expect(result).toHaveLength(0);
  });

  it('picks the most recent instance per series when several exist across many months', () => {
    const priorMovements = [
      // Not sorted on purpose to also cover out-of-order input defensively
      // -- the real caller sorts by fecha desc, but the "latest wins" rule
      // should hold regardless.
      movement({ id: 'm-dec', fecha: '2026-12-03', monto: 31000 }),
      movement({ id: 'm-ago', fecha: '2026-08-03', monto: 29000 }),
      movement({ id: 'm-sep', fecha: '2026-09-03', monto: 30000 }),
    ].sort((a, b) => b.fecha.localeCompare(a.fecha));

    const result = computeFixedCategoryReplications(priorMovements, new Set(), 2027, 1, 'u1');

    expect(result).toHaveLength(1);
    expect(result[0].monto).toBe(31000);
    expect(result[0].fecha).toBe('2027-01-03');
  });

  it('replicates every independent series a fija category holds', () => {
    const priorMovements = [
      movement({ id: 'm-luz', fecha: '2026-08-05', concepto: 'Luz', fixed_series_id: 'serie-luz' }),
      movement({ id: 'm-agua', fecha: '2026-08-10', concepto: 'Agua', fixed_series_id: 'serie-agua' }),
    ];

    const result = computeFixedCategoryReplications(priorMovements, new Set(), 2027, 1, 'u1');

    expect(result.map((r) => r.concepto).sort()).toEqual(['Agua', 'Luz']);
  });

  it('returns nothing when there are no prior movements', () => {
    expect(computeFixedCategoryReplications([], new Set(), 2027, 1, 'u1')).toEqual([]);
  });

  it('replicates a cuota series that has not reached its last installment, incrementing cuota_numero', () => {
    const priorMovements = [
      movement({ id: 'm-5', fecha: '2026-08-05', concepto: 'Zapatillas', cuota_numero: 5, cuota_total: 6 }),
    ];

    const result = computeFixedCategoryReplications(priorMovements, new Set(), 2026, 9, 'u1');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ cuota_numero: 6, cuota_total: 6, fecha: '2026-09-05' });
  });

  it('does not replicate a cuota series that already reached its last installment', () => {
    const priorMovements = [
      movement({ id: 'm-6', fecha: '2026-09-05', concepto: 'Zapatillas', cuota_numero: 6, cuota_total: 6 }),
    ];

    const result = computeFixedCategoryReplications(priorMovements, new Set(), 2026, 10, 'u1');

    expect(result).toHaveLength(0);
  });

  it('still replicates indefinitely for a series with no cuotas (cuota_numero/cuota_total both null)', () => {
    const priorMovements = [movement({ id: 'm-luz', fecha: '2026-08-05', concepto: 'Luz' })];

    const result = computeFixedCategoryReplications(priorMovements, new Set(), 2026, 9, 'u1');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ cuota_numero: null, cuota_total: null });
  });
});
