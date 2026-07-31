export type CategoryType = 'ingreso' | 'gasto';

export interface Category {
  id: string;
  user_id: string;
  nombre: string;
  tipo: CategoryType;
  created_at: string;
}
