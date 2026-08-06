import { generateInstallments, generateInstallmentsFrom } from '../features/movements/installments';

describe('generateInstallments', () => {
  it('generates one row per cuota with sequential months', () => {
    const rows = generateInstallments(
      {
        categoryId: 'cat-1',
        tipo: 'gasto',
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
        tipo: 'gasto',
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
        tipo: 'gasto',
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
        tipo: 'gasto',
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
        tipo: 'gasto',
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
        tipo: 'gasto',
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

describe('generateInstallmentsFrom', () => {
  it('generates only the remaining cuotas, numbered from fromCuotaNumero to newTotalCuotas', () => {
    // Editing cuota 3 of an original 6, bumping the total to 8: rows 3..8 (6 rows).
    const rows = generateInstallmentsFrom(
      {
        categoryId: 'cat-1',
        tipo: 'gasto',
        concepto: 'Notebook',
        montoRestante: 60000,
        notas: null,
        fromCuotaNumero: 3,
        newTotalCuotas: 8,
        fechaInicio: '2026-03-15',
        icono: 'card-outline',
      },
      'group-1'
    );

    expect(rows).toHaveLength(6);
    expect(rows.map((r) => r.cuota_numero)).toEqual([3, 4, 5, 6, 7, 8]);
    expect(rows.every((r) => r.cuota_total === 8)).toBe(true);
    expect(rows.map((r) => r.monto)).toEqual([10000, 10000, 10000, 10000, 10000, 10000]);
    expect(rows[0].fecha).toBe('2026-03-15');
    expect(rows[5].fecha).toBe('2026-08-15');
  });

  it('only the first regenerated row gets firstRowEstado, every later row is pendiente', () => {
    const rows = generateInstallmentsFrom(
      {
        categoryId: 'cat-1',
        tipo: 'gasto',
        concepto: 'TV',
        montoRestante: 4000,
        notas: null,
        fromCuotaNumero: 1,
        newTotalCuotas: 2,
        fechaInicio: '2026-03-15',
        icono: 'card-outline',
        firstRowEstado: 'pagado',
      },
      'group-2'
    );

    expect(rows[0].estado).toBe('pagado');
    expect(rows[1].estado).toBe('pendiente');
  });

  it('defaults firstRowEstado to pendiente when not given', () => {
    const rows = generateInstallmentsFrom(
      {
        categoryId: 'cat-1',
        tipo: 'gasto',
        concepto: 'TV',
        montoRestante: 4000,
        notas: null,
        fromCuotaNumero: 4,
        newTotalCuotas: 6,
        fechaInicio: '2026-03-15',
        icono: 'card-outline',
      },
      'group-3'
    );

    expect(rows.every((r) => r.estado === 'pendiente')).toBe(true);
  });

  it('puts the rounding remainder on the last regenerated cuota', () => {
    const rows = generateInstallmentsFrom(
      {
        categoryId: 'cat-1',
        tipo: 'gasto',
        concepto: 'Compra',
        montoRestante: 10000,
        notas: null,
        fromCuotaNumero: 5,
        newTotalCuotas: 7,
        fechaInicio: '2026-01-15',
        icono: 'receipt-outline',
      },
      'group-4'
    );

    // 10000 / 3 = 3333.33... -> 3333, 3333, 3334
    expect(rows.map((r) => r.monto)).toEqual([3333, 3333, 3334]);
    expect(rows.reduce((sum, r) => sum + r.monto, 0)).toBe(10000);
  });

  it('handles the single-remaining-cuota case (editing the very last cuota)', () => {
    const rows = generateInstallmentsFrom(
      {
        categoryId: 'cat-1',
        tipo: 'gasto',
        concepto: 'Compra',
        montoRestante: 5000,
        notas: null,
        fromCuotaNumero: 6,
        newTotalCuotas: 6,
        fechaInicio: '2026-06-15',
        icono: 'receipt-outline',
      },
      'group-5'
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ cuota_numero: 6, cuota_total: 6, monto: 5000 });
  });
});
