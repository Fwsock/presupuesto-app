export interface Category {
  id: string;
  user_id: string;
  nombre: string;
  /** Fixed/recurring category (Luz, Agua, Arriendo...) -- movements created under it get replicated into each new month, see features/movements/fixedCategories.ts. */
  es_fija: boolean;
  /** Ionicons name shown in the category's avatar -- see features/categories/visualOptions.ts. */
  icono: string;
  /** Hex color for the category's avatar background and its slice of CategoryDistributionBar. */
  color: string;
  created_at: string;
}

export interface NewCategoryInput {
  nombre: string;
  esFija: boolean;
  icono: string;
  color: string;
}

export interface UpdateCategoryInput {
  id: string;
  nombre: string;
  esFija: boolean;
  icono: string;
  color: string;
}
