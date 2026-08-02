export interface NewInstallmentInput {
  categoryId: string;
  concepto: string;
  /** Total price of the purchase — split evenly across totalCuotas, not the per-cuota amount. */
  montoTotal: number;
  notas: string | null;
  totalCuotas: number;
  fechaInicio: string; // 'YYYY-MM-DD', date of the first installment
}

export interface InstallmentRow {
  category_id: string;
  concepto: string;
  monto: number;
  notas: string | null;
  estado: 'pendiente';
  fecha: string;
  installment_group_id: string;
  cuota_numero: number;
  cuota_total: number;
}

function addMonths(dateStr: string, months: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const targetMonthIndex = month - 1 + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const targetDay = Math.min(day, daysInTargetMonth);
  const mm = String(targetMonth + 1).padStart(2, '0');
  const dd = String(targetDay).padStart(2, '0');
  return `${targetYear}-${mm}-${dd}`;
}

export function generateInstallments(input: NewInstallmentInput, groupId: string): InstallmentRow[] {
  // Split montoTotal evenly; when it doesn't divide exactly, every cuota
  // except the last gets the floored base amount and the last absorbs the
  // rounding remainder, so the cuotas always sum back to montoTotal exactly.
  const baseAmount = Math.floor(input.montoTotal / input.totalCuotas);
  const remainder = input.montoTotal - baseAmount * input.totalCuotas;

  const rows: InstallmentRow[] = [];
  for (let i = 0; i < input.totalCuotas; i++) {
    const isLastCuota = i === input.totalCuotas - 1;
    rows.push({
      category_id: input.categoryId,
      concepto: input.concepto,
      monto: isLastCuota ? baseAmount + remainder : baseAmount,
      notas: input.notas,
      estado: 'pendiente',
      fecha: addMonths(input.fechaInicio, i),
      installment_group_id: groupId,
      cuota_numero: i + 1,
      cuota_total: input.totalCuotas,
    });
  }
  return rows;
}
