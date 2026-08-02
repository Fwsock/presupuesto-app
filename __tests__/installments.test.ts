import { generateInstallments } from '../features/movements/installments';

describe('generateInstallments', () => {
  it('generates one row per cuota with sequential months', () => {
    const rows = generateInstallments(
      {
        categoryId: 'cat-1',
        concepto: 'Notebook',
        montoTotal: 21248,
        notas: null,
        totalCuotas: 6,
        fechaInicio: '2026-07-31',
        icono: 'cart-outline',
      },
      'group-1'
    );

    expect(rows).toHaveLength(6);
    expect(rows[0].fecha).toBe('2026-07-31');
    expect(rows[1].fecha).toBe('2026-08-31');
    expect(rows[4].fecha).toBe('2026-11-30'); // Interior row clamped to shorter month
    expect(rows[5].fecha).toBe('2026-12-31');
  });

  it('clamps day-of-month when the target month is shorter', () => {
    const rows = generateInstallments(
      {
        categoryId: 'cat-1',
        concepto: 'Curso',
        montoTotal: 10000,
        notas: null,
        totalCuotas: 3,
        fechaInicio: '2026-01-31',
        icono: 'school-outline',
      },
      'group-2'
    );

    expect(rows[1].fecha).toBe('2026-02-28');
    expect(rows[2].fecha).toBe('2026-03-31');
  });

  it('sets cuota_numero, cuota_total, estado, icono and shared group id on every row', () => {
    const rows = generateInstallments(
      {
        categoryId: 'cat-1',
        concepto: 'TV',
        montoTotal: 5000,
        notas: 'Compra Falabella',
        totalCuotas: 2,
        fechaInicio: '2026-03-15',
        icono: 'card-outline',
      },
      'group-3'
    );

    expect(rows[0]).toMatchObject({
      category_id: 'cat-1',
      concepto: 'TV',
      monto: 2500,
      cuota_numero: 1,
      cuota_total: 2,
      estado: 'pendiente',
      installment_group_id: 'group-3',
      notas: 'Compra Falabella',
      icono: 'card-outline',
    });
    expect(rows[1]).toMatchObject({
      category_id: 'cat-1',
      concepto: 'TV',
      monto: 2500,
      cuota_numero: 2,
      cuota_total: 2,
      estado: 'pendiente',
      installment_group_id: 'group-3',
      icono: 'card-outline',
    });
  });

  it('rolls over to next year when installments cross Dec → Jan boundary', () => {
    const rows = generateInstallments(
      {
        categoryId: 'cat-2',
        concepto: 'Seguro Anual',
        montoTotal: 15000,
        notas: null,
        totalCuotas: 3,
        fechaInicio: '2026-11-30',
        icono: 'receipt-outline',
      },
      'group-4'
    );

    expect(rows).toHaveLength(3);
    expect(rows[0].fecha).toBe('2026-11-30');
    expect(rows[1].fecha).toBe('2026-12-30');
    expect(rows[2].fecha).toBe('2027-01-30'); // Year rolls over correctly
  });

  it('divides the total evenly across cuotas when it divides exactly', () => {
    // The bug report's own example: $21.000 in 6 cuotas -> $3.500 each, not
    // $21.000 each (that was the bug: montoTotal was being stored per row).
    const rows = generateInstallments(
      {
        categoryId: 'cat-1',
        concepto: 'Compra',
        montoTotal: 21000,
        notas: null,
        totalCuotas: 6,
        fechaInicio: '2026-01-15',
        icono: 'receipt-outline',
      },
      'group-5'
    );

    expect(rows.map((r) => r.monto)).toEqual([3500, 3500, 3500, 3500, 3500, 3500]);
    expect(rows.reduce((sum, r) => sum + r.monto, 0)).toBe(21000);
  });

  it('puts the rounding remainder on the last cuota so the total matches exactly', () => {
    // 100000 / 3 = 33333.33... -> 33333, 33333, 33334
    const rows = generateInstallments(
      {
        categoryId: 'cat-1',
        concepto: 'Compra',
        montoTotal: 100000,
        notas: null,
        totalCuotas: 3,
        fechaInicio: '2026-01-15',
        icono: 'receipt-outline',
      },
      'group-6'
    );

    expect(rows.map((r) => r.monto)).toEqual([33333, 33333, 33334]);
    expect(rows.reduce((sum, r) => sum + r.monto, 0)).toBe(100000);
  });
});
