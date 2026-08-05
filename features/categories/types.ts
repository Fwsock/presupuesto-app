export interface Category {
  id: string;
  user_id: string;
  nombre: string;
  /** Fixed/recurring category (Luz, Agua, Arriendo...) -- movements created under it get replicated into each new month, see features/movements/fixedCategories.ts. */
  es_fija: boolean;
  created_at: string;
}

export interface NewCategoryInput {
  nombre: string;
  esFija: boolean;
}

export interface UpdateCategoryInput {
  id: string;
  nombre: string;
  esFija: boolean;
}
