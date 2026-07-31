import type { Category, CategoryType } from '../categories/types';
import type { Movement } from './types';

export interface CategoryTotal {
  categoryId: string;
  nombre: string;
  tipo: CategoryType;
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
    const total = paidMovements
      .filter((m) => m.category_id === category.id)
      .reduce((sum, m) => sum + m.monto, 0);
    return { categoryId: category.id, nombre: category.nombre, tipo: category.tipo, total };
  });

  const totalIngresos = totalsByCategory
    .filter((c) => c.tipo === 'ingreso')
    .reduce((sum, c) => sum + c.total, 0);
  const totalGastos = totalsByCategory
    .filter((c) => c.tipo === 'gasto')
    .reduce((sum, c) => sum + c.total, 0);

  return {
    totalIngresos,
    totalGastos,
    saldoDisponible: totalIngresos - totalGastos,
    totalsByCategory,
  };
}
