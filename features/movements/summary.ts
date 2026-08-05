import type { Category } from '../categories/types';
import type { Movement, MovementType } from './types';

export interface CategoryTotal {
  categoryId: string;
  nombre: string;
  /** Dominant movement type in this category this month (by summed amount), for display only — categories are neutral now, a single one can hold both ingreso and gasto movements. */
  tipo: MovementType;
  total: number;
}

export interface MonthSummary {
  totalIngresos: number;
  totalGastos: number;
  saldoDisponible: number;
  totalsByCategory: CategoryTotal[];
}

export function calculateMonthSummary(movements: Movement[], categories: Category[]): MonthSummary {
  const paidMovements = movements.filter((m) => m.estado === 'pagado');

  const totalsByCategory: CategoryTotal[] = categories.map((category) => {
    const categoryMovements = paidMovements.filter((m) => m.category_id === category.id);
    const total = categoryMovements.reduce((sum, m) => sum + m.monto, 0);
    const ingresoTotal = categoryMovements
      .filter((m) => m.tipo === 'ingreso')
      .reduce((sum, m) => sum + m.monto, 0);
    const tipo: MovementType = ingresoTotal > 0 && ingresoTotal >= total - ingresoTotal ? 'ingreso' : 'gasto';
    return { categoryId: category.id, nombre: category.nombre, tipo, total };
  });

  const totalIngresos = paidMovements
    .filter((m) => m.tipo === 'ingreso')
    .reduce((sum, m) => sum + m.monto, 0);
  const totalGastos = paidMovements
    .filter((m) => m.tipo === 'gasto')
    .reduce((sum, m) => sum + m.monto, 0);

  return {
    totalIngresos,
    totalGastos,
    saldoDisponible: totalIngresos - totalGastos,
    totalsByCategory,
  };
}
