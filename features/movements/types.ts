export type MovementStatus = 'pendiente' | 'pagado';

export interface Movement {
  id: string;
  user_id: string;
  category_id: string;
  concepto: string;
  monto: number;
  notas: string | null;
  estado: MovementStatus;
  fecha: string;
  installment_group_id: string | null;
  cuota_numero: number | null;
  cuota_total: number | null;
  created_at: string;
  updated_at: string;
}
