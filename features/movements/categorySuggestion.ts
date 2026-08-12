import { suggestMovementIcon, DEFAULT_MOVEMENT_ICON } from './iconSuggestion';
import type { Category } from '../categories/types';

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Guesses which of the user's own categories a parsed notification's
 * comercio belongs to. Category names are arbitrary per user, so there's no
 * fixed keyword-to-category table -- two strategies instead:
 *  1. Direct match: the comercio text and a category's nombre share a
 *     substring (covers a user who named a category "Starbucks" or "Uber").
 *  2. Icon-bucket match: reuse suggestMovementIcon's existing keyword rules
 *     -- if the comercio and a category's nombre map to the same icon
 *     (e.g. both land on 'car-outline' via "uber"/"bencina"), that's a
 *     reasonable semantic match without duplicating the keyword list here.
 * Returns null rather than guessing when neither strategy finds anything.
 */
export function suggestCategoryForComercio(comercio: string | null, categories: Category[]): Category | null {
  if (!comercio || categories.length === 0) return null;

  const normalizedComercio = normalize(comercio);
  const directMatch = categories.find((c) => {
    const normalizedName = normalize(c.nombre);
    return normalizedName.length > 0 && normalizedComercio.includes(normalizedName);
  });
  if (directMatch) return directMatch;

  const icon = suggestMovementIcon(comercio);
  if (icon === DEFAULT_MOVEMENT_ICON) return null;

  return categories.find((c) => suggestMovementIcon(c.nombre) === icon) ?? null;
}
