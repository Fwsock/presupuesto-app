import { generateInstallments } from '../features/movements/installments';

describe('generateInstallments', () => {
  it('generates one row per cuota with sequential months', () => {
    const rows = generateInstallments(
      {
        categoryId: 'cat-1',
        concepto: 'Notebook',
        montoCuota: 21248,
        notas: null,
        totalCuotas: 6,
        fechaInicio: '2026-07-31',
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
        montoCuota: 10000,
        notas: null,
        totalCuotas: 3,
        fechaInicio: '2026-01-31',
      },
      'group-2'
    );

    expect(rows[1].fecha).toBe('2026-02-28');
    expect(rows[2].fecha).toBe('2026-03-31');
  });

  it('sets cuota_numero, cuota_total, estado and shared group id on every row', () => {
    const rows = generateInstallments(
      {
        categoryId: 'cat-1',
        concepto: 'TV',
        montoCuota: 5000,
        notas: 'Compra Falabella',
        totalCuotas: 2,
        fechaInicio: '2026-03-15',
      },
      'group-3'
    );

    expect(rows[0]).toMatchObject({
      category_id: 'cat-1',
      concepto: 'TV',
      monto: 5000,
      cuota_numero: 1,
      cuota_total: 2,
      estado: 'pendiente',
      installment_group_id: 'group-3',
      notas: 'Compra Falabella',
    });
    expect(rows[1]).toMatchObject({
      category_id: 'cat-1',
      concepto: 'TV',
      monto: 5000,
      cuota_numero: 2,
      cuota_total: 2,
      estado: 'pendiente',
      installment_group_id: 'group-3',
    });
  });

  it('rolls over to next year when installments cross Dec → Jan boundary', () => {
    const rows = generateInstallments(
      {
        categoryId: 'cat-2',
        concepto: 'Seguro Anual',
        montoCuota: 15000,
        notas: null,
        totalCuotas: 3,
        fechaInicio: '2026-11-30',
      },
      'group-4'
    );

    expect(rows).toHaveLength(3);
    expect(rows[0].fecha).toBe('2026-11-30');
    expect(rows[1].fecha).toBe('2026-12-30');
    expect(rows[2].fecha).toBe('2027-01-30'); // Year rolls over correctly
  });
});
