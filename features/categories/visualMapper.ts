import { DEFAULT_CATEGORY_COLOR, DEFAULT_CATEGORY_ICON } from './visualOptions';
import type { Category } from './types';

// Same accent-stripping convention as features/movements/categorySuggestion.ts.
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

interface VisualRule {
  keywords: string[];
  icono: string;
  color: string;
}

// Keyword -> {icono, color} table for the common categories a Chilean
// personal-budget user tends to create -- lets a brand-new (or
// migration-backfilled) category start with a coherent look instead of
// every single one showing the same default blue price tag. Order matters:
// first match wins, so more specific product names (e.g. "cmr") are listed
// ahead of their generic bucket ("cuota").
const VISUAL_RULES: VisualRule[] = [
  { keywords: ['ahorro'], icono: 'wallet-outline', color: '#10B981' },
  { keywords: ['ingreso', 'sueldo', 'salario', 'remuneracion'], icono: 'trending-up-outline', color: '#10B981' },
  { keywords: ['cmr', 'falabella', 'ripley', 'paris', 'hites'], icono: 'card-outline', color: '#EF4444' },
  { keywords: ['cuota', 'credito', 'deuda', 'prestamo'], icono: 'card-outline', color: '#F97316' },
  { keywords: ['gastos fijos', 'fijo', 'fijos'], icono: 'home-outline', color: '#2563EB' },
  { keywords: ['gastos extras', 'extra', 'varios'], icono: 'basket-outline', color: '#F59E0B' },
  { keywords: ['arriendo', 'vivienda', 'hipoteca', 'dividendo'], icono: 'home-outline', color: '#6366F1' },
  { keywords: ['luz', 'electricidad', 'energia'], icono: 'flash-outline', color: '#F59E0B' },
  { keywords: ['agua'], icono: 'water-outline', color: '#0EA5E9' },
  { keywords: ['gas'], icono: 'flame-outline', color: '#F97316' },
  { keywords: ['internet', 'wifi', 'cable', 'router'], icono: 'wifi-outline', color: '#06B6D4' },
  { keywords: ['telefono', 'celular', 'movil', 'entel', 'movistar', 'claro', 'wom'], icono: 'phone-portrait-outline', color: '#8B5CF6' },
  { keywords: ['supermercado', 'super', 'alimentacion', 'mercaderia', 'feria'], icono: 'cart-outline', color: '#84CC16' },
  { keywords: ['salud', 'medico', 'farmacia', 'isapre', 'clinica'], icono: 'medkit-outline', color: '#0D9488' },
  { keywords: ['transporte', 'auto', 'bencina', 'combustible', 'uber', 'taxi', 'estacionamiento', 'locomocion'], icono: 'car-outline', color: '#1F2937' },
  { keywords: ['entretenimiento', 'streaming', 'netflix', 'spotify', 'cine'], icono: 'film-outline', color: '#A21CAF' },
  { keywords: ['educacion', 'colegio', 'universidad', 'curso'], icono: 'school-outline', color: '#6D28D9' },
  { keywords: ['mascota', 'perro', 'gato', 'veterinaria'], icono: 'paw-outline', color: '#92400E' },
  { keywords: ['ropa', 'vestuario'], icono: 'shirt-outline', color: '#EC4899' },
  { keywords: ['regalo'], icono: 'gift-outline', color: '#F97316' },
  { keywords: ['viaje', 'vacaciones'], icono: 'airplane-outline', color: '#0EA5E9' },
];

/** Guesses an {icono, color} pair from a category's own name -- used only as a fallback for categories still at the untouched default (see getCategoryVisuals). Falls back to the plain default when nothing matches. */
export function inferCategoryVisuals(nombre: string): { icono: string; color: string } {
  const normalized = normalize(nombre);
  for (const rule of VISUAL_RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(normalize(keyword)))) {
      return { icono: rule.icono, color: rule.color };
    }
  }
  return { icono: DEFAULT_CATEGORY_ICON, color: DEFAULT_CATEGORY_COLOR };
}

/**
 * What to actually render/preload for a category's avatar: its own
 * icono/color as stored, UNLESS both are still exactly the untouched
 * default -- which is true for every pre-existing category right after the
 * 0009_category_visuals.sql backfill (every row got the same
 * 'pricetag-outline'/'#2563EB' pair), not just brand-new ones. In that case,
 * infer something coherent from the name instead of showing the same blue
 * price tag on every single category.
 */
export function getCategoryVisuals(category: Pick<Category, 'nombre' | 'icono' | 'color'>): { icono: string; color: string } {
  const isUntouchedDefault = category.icono === DEFAULT_CATEGORY_ICON && category.color === DEFAULT_CATEGORY_COLOR;
  if (!isUntouchedDefault) return { icono: category.icono, color: category.color };
  return inferCategoryVisuals(category.nombre);
}
