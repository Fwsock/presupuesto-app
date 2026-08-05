import { VariableIncomePromptModal } from './VariableIncomePromptModal';
import { useSelectedMonth } from '../features/shared/selected-month';
import { useVariableIncomePromptState } from '../features/income/hooks';

/**
 * Renders the single, shared instance of VariableIncomePromptModal for the
 * whole (app) tab tree. It used to be rendered separately by both Resumen
 * and Movimientos, each running its own useVariableIncomePromptState — since
 * bottom-tabs keeps every tab's screen mounted, that meant two independent
 * prompts (one per screen) could both be visible at once, stacked on top of
 * each other. Mounted once here (in app/(app)/_layout.tsx) instead.
 */
export function VariableIncomePromptHost() {
  const { year, month } = useSelectedMonth();
  const prompt = useVariableIncomePromptState(year, month);

  return (
    <VariableIncomePromptModal
      visible={prompt.visible}
      concepto={prompt.concepto}
      year={year}
      month={month}
      previousAmount={prompt.previousAmount}
      loading={prompt.loading}
      error={prompt.error}
      onSubmit={prompt.submit}
      onSkip={prompt.skip}
      onDismissError={prompt.dismissError}
    />
  );
}
