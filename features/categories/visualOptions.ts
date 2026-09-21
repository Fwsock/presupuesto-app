// Ionicons names offered in the category avatar picker (CategoryIconPickerModal).
// Deliberately a separate, more generic-purpose list than
// features/movements/iconSuggestion's AVAILABLE_MOVEMENT_ICONS -- a category is a
// broad bucket ("Vivienda", "Ahorro"), not a single merchant/transaction, so this
// favors category-level concepts over specific storefront icons.
export const DEFAULT_CATEGORY_ICON = 'pricetag-outline';

export const CATEGORY_ICONS: string[] = [
  DEFAULT_CATEGORY_ICON,
  'home-outline',
  'flash-outline',
  'water-outline',
  'wifi-outline',
  'cart-outline',
  'restaurant-outline',
  'car-outline',
  'bus-outline',
  'airplane-outline',
  'medkit-outline',
  'fitness-outline',
  'school-outline',
  'briefcase-outline',
  'card-outline',
  'cash-outline',
  'wallet-outline',
  'trending-up-outline',
  'trending-down-outline',
  'gift-outline',
  'shirt-outline',
  'paw-outline',
  'game-controller-outline',
  'film-outline',
  'phone-portrait-outline',
  'construct-outline',
  'basket-outline',
  'book-outline',
];

// Curated neobanco-consistent palette -- spans the full hue wheel plus two
// neutrals, with lightness/saturation deliberately varied between
// neighboring hues (e.g. turquoise vs teal, violet vs dark violet, pink vs
// magenta) so no two swatches read as "basically the same color" even with
// 15-20 categories on screen at once in CategoryDistributionBar.
export const DEFAULT_CATEGORY_COLOR = '#2563EB';

export const CATEGORY_COLORS: string[] = [
  '#2563EB', // blue (brand)
  '#0EA5E9', // sky blue
  '#06B6D4', // cyan
  '#2DD4BF', // turquoise
  '#0D9488', // teal
  '#10B981', // emerald
  '#6B8E23', // olive
  '#84CC16', // lime
  '#F59E0B', // amber / gold
  '#F97316', // orange
  '#92400E', // brown / coffee
  '#EF4444', // red
  '#9F1239', // maroon / wine
  '#EC4899', // pink
  '#A21CAF', // magenta / fuchsia
  '#8B5CF6', // violet
  '#6D28D9', // dark violet
  '#6366F1', // indigo
  '#1F2937', // charcoal / black
  '#64748B', // slate / gray
];
