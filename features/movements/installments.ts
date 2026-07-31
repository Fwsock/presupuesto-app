export interface NewInstallmentInput {
  categoryId: string;
  concepto: string;
  montoCuota: number;
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
  const rows: InstallmentRow[] = [];
  for (let i = 0; i < input.totalCuotas; i++) {
    rows.push({
      category_id: input.categoryId,
      concepto: input.concepto,
      monto: input.montoCuota,
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
