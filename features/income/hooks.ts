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
      queryClient.invalidateQueries({ queryKey: ['movements'] });
      return result;
    },
  });
}

/**
 * Wraps the check + submit flow into what VariableIncomePromptModal needs.
 * Each screen that renders the modal (Resumen, Movimientos) calls this
 * independently, so "Ahora no" only dismisses it for that screen/session -
 * navigating to the other tab (or back to this one later) asks again,
 * which matches "cada vez que el usuario navega... se le debe preguntar."
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
