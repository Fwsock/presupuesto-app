import type { MovementStatus, MovementType } from './types';

export interface NewInstallmentInput {
  categoryId: string;
  tipo: MovementType;
  concepto: string;
  /** Total price of the purchase — split evenly across totalCuotas, not the per-cuota amount. */
  montoTotal: number;
  notas: string | null;
  totalCuotas: number;
  fechaInicio: string; // 'YYYY-MM-DD', date of the first installment
  icono: string;
}

export interface InstallmentRow {
  category_id: string;
  tipo: MovementType;
  concepto: string;
  monto: number;
  notas: string | null;
  estado: MovementStatus;
  fecha: string;
  installment_group_id: string;
  cuota_numero: number;
  cuota_total: number;
  icono: string;
}

export interface RegenerateInstallmentsInput {
  categoryId: string;
  tipo: MovementType;
  concepto: string;
  /** Amount left to pay, split evenly across the REMAINING cuotas only (fromCuotaNumero..newTotalCuotas) — not the grand total of the whole purchase. */
  montoRestante: number;
  notas: string | null;
  /** Position of the first regenerated cuota — the one currently being edited. Earlier cuotas (1..fromCuotaNumero-1) are untouched by this. */
  fromCuotaNumero: number;
  /** New grand total for the whole group, shown on every row (past and regenerated) as `cuota_total`. Must be >= fromCuotaNumero. */
  newTotalCuotas: number;
  fechaInicio: string; // 'YYYY-MM-DD', date of the fromCuotaNumero-th cuota
  icono: string;
  /** estado for the FIRST regenerated row only; every later row is always 'pendiente' (a not-yet-reached future cuota can't already be paid). Defaults to 'pendiente'. */
  firstRowEstado?: MovementStatus;
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
      tipo: input.tipo,
      concepto: input.concepto,
      monto: isLastCuota ? baseAmount + remainder : baseAmount,
      notas: input.notas,
      estado: 'pendiente',
      fecha: addMonths(input.fechaInicio, i),
      installment_group_id: groupId,
      cuota_numero: i + 1,
      cuota_total: input.totalCuotas,
      icono: input.icono,
    });
  }
  return rows;
}

/**
 * Regenerates the TAIL of an installment group, from `fromCuotaNumero`
 * onward, splitting `montoRestante` across just those remaining cuotas --
 * used both when a user edits how many cuotas are left on a purchase
 * already in progress (fromCuotaNumero = the cuota being edited, keeping
 * 1..fromCuotaNumero-1 untouched so already-paid history survives) and when
 * a one-time payment is converted into cuotas for the first time
 * (fromCuotaNumero = 1, nothing precedes it). The caller is responsible for
 * deleting whatever previously occupied fromCuotaNumero..oldTotalCuotas (and
 * updating cuota_total on any earlier untouched rows) before inserting
 * these -- this function only computes the new rows themselves.
 */
export function generateInstallmentsFrom(input: RegenerateInstallmentsInput, groupId: string): InstallmentRow[] {
  const remainingCount = input.newTotalCuotas - input.fromCuotaNumero + 1;
  const baseAmount = Math.floor(input.montoRestante / remainingCount);
  const remainder = input.montoRestante - baseAmount * remainingCount;

  const rows: InstallmentRow[] = [];
  for (let i = 0; i < remainingCount; i++) {
    const isLastCuota = i === remainingCount - 1;
    rows.push({
      category_id: input.categoryId,
      tipo: input.tipo,
      concepto: input.concepto,
      monto: isLastCuota ? baseAmount + remainder : baseAmount,
      notas: input.notas,
      estado: i === 0 ? (input.firstRowEstado ?? 'pendiente') : 'pendiente',
      fecha: addMonths(input.fechaInicio, i),
      installment_group_id: groupId,
      cuota_numero: input.fromCuotaNumero + i,
      cuota_total: input.newTotalCuotas,
      icono: input.icono,
    });
  }
  return rows;
}
