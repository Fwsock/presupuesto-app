import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteRecurringIncome,
  ensureRecurringIncomeForMonth,
  fetchRecurringIncome,
  submitIncomeForMonth,
  upsertRecurringIncome,
} from './api';
import type { RecurringIncome, UpsertRecurringIncomeInput } from './types';

export function useRecurringIncome() {
  return useQuery({ queryKey: ['recurring-income'], queryFn: fetchRecurringIncome });
}

export function useUpsertRecurringIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertRecurringIncomeInput) => upsertRecurringIncome(input),
    onSuccess: (data) => {
      queryClient.setQueryData(['recurring-income'], data);
      queryClient.invalidateQueries({ queryKey: ['recurring-income-check'] });
    },
  });
}

export function useDeleteRecurringIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRecurringIncome(id),
    onSuccess: () => {
      queryClient.setQueryData(['recurring-income'], null);
      queryClient.invalidateQueries({ queryKey: ['recurring-income-check'] });
    },
  });
}

/**
 * Runs on every Resumen/Movimientos view for the active month. For 'fijo' it
 * silently creates that month's movement if missing (idempotent - guarded by
 * a DB unique index, see the migration). For 'variable' it never creates
 * anything, only reports whether the amount prompt should be shown.
 */
export function useEnsureRecurringIncomeForMonth(year: number, month: number) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['recurring-income-check', year, month],
    queryFn: async () => {
      const result = await ensureRecurringIncomeForMonth(year, month);
      // Awaited on purpose: callers (e.g. Resumen's loading gate) rely on
      // this query's own `isLoading` only flipping false once the movements
      // list has actually caught up with whatever got auto-generated here --
      // otherwise the screen could render its real content for a moment
      // with the pre-generation (still empty) movements list before the
      // invalidated refetch resolves, flashing $0 before the real total.
      await queryClient.invalidateQueries({ queryKey: ['movements'] });
      return result;
    },
  });
}

/**
 * Wraps the check + submit flow into what VariableIncomePromptModal needs.
 * Called exactly once, by VariableIncomePromptHost (mounted at the (app)
 * layout level, alongside the tab navigator, never by an individual
 * screen) — so `skippedKey` lives in a component instance that survives
 * switching tabs. "Ahora no" (skip()) therefore stays dismissed for the
 * rest of the session regardless of navigation, and only re-arms itself
 * when `monthKey` actually changes (the user moves to a different month).
 */
export function useVariableIncomePromptState(year: number, month: number) {
  const ensureCheck = useEnsureRecurringIncomeForMonth(year, month);
  const submitVariableIncome = useSubmitVariableIncome();
  const [skippedKey, setSkippedKey] = useState<string | null>(null);

  const monthKey = `${year}-${month}`;
  const recurringIncome = ensureCheck.data?.recurringIncome ?? null;
  const visible = !!ensureCheck.data?.needsVariablePrompt && skippedKey !== monthKey;

  return {
    visible,
    concepto: recurringIncome?.concepto ?? '',
    previousAmount: ensureCheck.data?.previousAmount ?? null,
    loading: submitVariableIncome.isPending,
    error: submitVariableIncome.isError ? (submitVariableIncome.error as Error).message : null,
    submit: (monto: number) => {
      if (!recurringIncome) return;
      submitVariableIncome.mutate({ recurringIncome, year, month, monto });
    },
    skip: () => setSkippedKey(monthKey),
    dismissError: () => submitVariableIncome.reset(),
  };
}

export function useSubmitVariableIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      recurringIncome,
      year,
      month,
      monto,
    }: {
      recurringIncome: RecurringIncome;
      year: number;
      month: number;
      monto: number;
    }) => submitIncomeForMonth(recurringIncome, year, month, monto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movements'] });
      queryClient.invalidateQueries({ queryKey: ['recurring-income-check'] });
    },
  });
}
