import { useSelectedMonth } from '../features/shared/selected-month';
import { useEnsureFixedCategoryMovementsForMonth } from '../features/movements/hooks';

/**
 * Mounted once at the (app) layout level (like VariableIncomePromptHost),
 * so fixed-category movements get replicated into the active month exactly
 * once regardless of which tab is focused. Renders nothing -- it's a pure
 * side-effecting query.
 */
export function FixedCategoriesSync() {
  const { year, month } = useSelectedMonth();
  useEnsureFixedCategoryMovementsForMonth(year, month);
  return null;
}
