import { useEffect } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createInstallments,
  createMovement,
  deleteInstallmentsFrom,
  deleteMovement,
  deleteMovementGroup,
  fetchMovementsForMonth,
  fetchMovementsForMonthRange,
  payAllPendingForCategory,
  updateInstallmentGroupTotal,
  updateMovement,
} from './api';
import { ensureFixedCategoryMovementsForMonth } from './fixedCategories';
import { monthOffset } from './monthlySeries';
import { ensureRecurringIncomeForMonth } from '../income/api';
import { generateInstallmentsFrom, type InstallmentRow, type RegenerateInstallmentsInput } from './installments';
import type { NewMovementInput, UpdateMovementInput, Movement } from './types';

export function useMovements(year: number, month: number) {
  return useQuery({
    queryKey: ['movements', year, month],
    queryFn: () => fetchMovementsForMonth(year, month),
    // Landing on a month that wasn't prefetched (e.g. jumping several months
    // via the picker or tapping a far bar in the chart) would otherwise drop
    // straight to isLoading/undefined for a beat -- keepPreviousData renders
    // the last month's numbers in the meantime instead of a blank/skeleton
    // flash, then swaps in the real data the moment it resolves.
    placeholderData: keepPreviousData,
  });
}

// Key starts with 'movements' (like the per-month query above) so the
// existing invalidateQueries({queryKey: ['movements']}) prefix-matches this
// too — a create/edit/delete anywhere refreshes the chart, not just the list.
export function useMovementsForMonthRange(
  centerYear: number,
  centerMonth: number,
  monthsBefore: number,
  monthsAfter: number
) {
  return useQuery({
    queryKey: ['movements', 'range', centerYear, centerMonth, monthsBefore, monthsAfter],
    queryFn: () => fetchMovementsForMonthRange(centerYear, centerMonth, monthsBefore, monthsAfter),
    // The range shifts its whole window by a month on every navigation, so
    // it's never actually prefetched (usePrefetchAdjacentMonths only warms
    // single-month queries) -- without this, MonthSaldoChart's bars vanish
    // for a beat every time (chartPoints turns [] while rangeMovements is
    // undefined). keepPreviousData keeps the old bars on screen until the
    // new range resolves, instead of the chart blanking out.
    placeholderData: keepPreviousData,
  });
}

// How many months out, in each direction, usePrefetchAdjacentMonths warms.
const PREFETCH_MONTHS_RADIUS = 2;

/**
 * Warms the cache for the 2 months on either side of the one on screen, so
 * Resumen's arrows/chart navigation lands on already-cached data instead of
 * showing the loading skeleton. Mirrors the exact three queries that gate
 * Resumen's own isLoading (raw movements, the recurring-income check, the
 * fixed-categories check) via prefetchQuery -- a plain queryClient call, not
 * a hook, so it can run for months that are never actually mounted/selected.
 * Both ensure-checks are idempotent (guarded by DB unique indexes), so
 * running them a few steps early for a month the user hasn't viewed yet is
 * safe -- worst case it's a no-op check that ran a little sooner than usual.
 */
export function usePrefetchAdjacentMonths(year: number, month: number) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const nearbyMonths = [];
    for (let offset = -PREFETCH_MONTHS_RADIUS; offset <= PREFETCH_MONTHS_RADIUS; offset++) {
      if (offset === 0) continue; // the active month is already fetched by the screen itself
      nearbyMonths.push(monthOffset(year, month, offset));
    }

    for (const { year: y, month: m } of nearbyMonths) {
      queryClient.prefetchQuery({
        queryKey: ['movements', y, m],
        queryFn: () => fetchMovementsForMonth(y, m),
      });
      queryClient.prefetchQuery({
        queryKey: ['recurring-income-check', y, m],
        queryFn: async () => {
          const result = await ensureRecurringIncomeForMonth(y, m);
          await queryClient.invalidateQueries({ queryKey: ['movements'] });
          return result;
        },
      });
      queryClient.prefetchQuery({
        queryKey: ['fixed-categories-check', y, m],
        queryFn: async () => {
          await ensureFixedCategoryMovementsForMonth(y, m);
          await queryClient.invalidateQueries({ queryKey: ['movements'] });
          return true;
        },
      });
    }
  }, [year, month, queryClient]);
}

/**
 * Runs on the active month, same contract as
 * useEnsureRecurringIncomeForMonth (features/income/hooks.ts): silently
 * replicates every "fija" category's missing recurring movement into the
 * currently viewed month. Mounted once, at the (app) layout level -- see
 * components/FixedCategoriesSync.tsx.
 */
export function useEnsureFixedCategoryMovementsForMonth(year: number, month: number) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['fixed-categories-check', year, month],
    queryFn: async () => {
      await ensureFixedCategoryMovementsForMonth(year, month);
      // Awaited on purpose -- see the identical comment in
      // useEnsureRecurringIncomeForMonth (features/income/hooks.ts).
      await queryClient.invalidateQueries({ queryKey: ['movements'] });
      return true;
    },
  });
}

function useInvalidateMovements() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['movements'] });
}

/**
 * Writes mutation results straight into every cached month, so the list
 * updates the moment a save/delete resolves — invalidation alone was not
 * reliably repainting the active screen.
 */
function useUpdateMovementsCache() {
  const queryClient = useQueryClient();

  const mutateMonthCaches = (mutate: (rows: Movement[], year: number, month: number) => Movement[]) => {
    const queries = queryClient.getQueryCache().findAll({ queryKey: ['movements'] });
    for (const query of queries) {
      const [kind, year, month] = query.queryKey as [string, number, number];
      if (kind !== 'movements' || typeof year !== 'number' || typeof month !== 'number') continue;
      queryClient.setQueryData<Movement[]>(query.queryKey, (old) => (old ? mutate(old, year, month) : old));
    }
  };

  return {
    addMovement: (movement: Movement) => {
      const y = Number(movement.fecha.slice(0, 4));
      const m = Number(movement.fecha.slice(5, 7));
      mutateMonthCaches((rows, year, month) => {
        if (year !== y || month !== m) return rows;
        if (rows.some((r) => r.id === movement.id)) return rows;
        return [...rows, movement].sort((a, b) => a.fecha.localeCompare(b.fecha));
      });
    },
    upsertMovement: (movement: Movement) => {
      const y = Number(movement.fecha.slice(0, 4));
      const m = Number(movement.fecha.slice(5, 7));
      mutateMonthCaches((rows, year, month) => {
        const existingIndex = rows.findIndex((r) => r.id === movement.id);
        if (year !== y || month !== m) {
          // Not this movement's (new) month -- drop it if it used to live here.
          return existingIndex === -1 ? rows : rows.filter((r) => r.id !== movement.id);
        }
        if (existingIndex === -1) {
          // New to this month (fecha changed into it) -- append then resort.
          return [...rows, movement].sort((a, b) => a.fecha.localeCompare(b.fecha));
        }
        // Same month as before (the common case, e.g. toggling estado):
        // replace in place instead of remove+append+resort, so same-date
        // rows keep their exact relative order and the row doesn't jump.
        const next = [...rows];
        next[existingIndex] = movement;
        return next;
      });
    },
    removeMovement: (id: string) => {
      mutateMonthCaches((rows) => rows.filter((r) => r.id !== id));
    },
    removeMovementGroup: (groupId: string) => {
      mutateMonthCaches((rows) => rows.filter((r) => r.installment_group_id !== groupId));
    },
  };
}

export function useCreateMovement() {
  const invalidate = useInvalidateMovements();
  const { addMovement } = useUpdateMovementsCache();
  return useMutation({
    mutationFn: (input: NewMovementInput) => createMovement(input),
    onSuccess: (data) => {
      addMovement(data);
      invalidate();
    },
  });
}

export function useCreateInstallments() {
  const invalidate = useInvalidateMovements();
  const { addMovement } = useUpdateMovementsCache();
  return useMutation({
    mutationFn: (rows: InstallmentRow[]) => createInstallments(rows),
    onSuccess: (data) => {
      data.forEach(addMovement);
      invalidate();
    },
  });
}

/**
 * Changes how many cuotas remain on a purchase already split into an
 * installment group, starting from one specific cuota in that group
 * (fromCuotaNumero) — earlier cuotas are left completely alone (see
 * updateInstallmentGroupTotal), so any of them already marked "pagado"
 * keeps its date/monto/estado exactly as it was. Only the tail from
 * fromCuotaNumero onward gets deleted and regenerated with the new count.
 * No fine-grained cache patch here (unlike the other mutations in this
 * file): a variable number of rows across a variable number of months is
 * added, removed and re-dated all at once, so a full invalidate + refetch
 * is simpler and safer than trying to hand-reconcile the cache.
 */
export function useUpdateInstallmentGroupFrom() {
  const invalidate = useInvalidateMovements();
  return useMutation({
    mutationFn: async (input: { groupId: string } & RegenerateInstallmentsInput) => {
      await updateInstallmentGroupTotal(input.groupId, input.newTotalCuotas, input.fromCuotaNumero);
      await deleteInstallmentsFrom(input.groupId, input.fromCuotaNumero);
      const rows = generateInstallmentsFrom(input, input.groupId);
      return createInstallments(rows);
    },
    onSuccess: () => invalidate(),
  });
}

/**
 * Converts a standalone (non-cuota) movement into the first cuota of a
 * brand-new installment group: deletes the original single row and inserts
 * the freshly generated cuotas in its place. The original movement's own
 * `estado` carries over onto the new cuota 1 (a lump sum already marked
 * "pagado" stays paid once split), every later cuota starts "pendiente".
 */
export function useConvertMovementToInstallments() {
  const invalidate = useInvalidateMovements();
  return useMutation({
    mutationFn: async (input: { movementId: string; groupId: string } & RegenerateInstallmentsInput) => {
      await deleteMovement(input.movementId);
      const rows = generateInstallmentsFrom(input, input.groupId);
      return createInstallments(rows);
    },
    onSuccess: () => invalidate(),
  });
}

export function useUpdateMovement() {
  const invalidate = useInvalidateMovements();
  const { upsertMovement } = useUpdateMovementsCache();
  return useMutation({
    mutationFn: (input: UpdateMovementInput) => updateMovement(input),
    onSuccess: (data) => {
      upsertMovement(data);
      invalidate();
    },
  });
}

export function useDeleteMovement() {
  const invalidate = useInvalidateMovements();
  const { removeMovement } = useUpdateMovementsCache();
  return useMutation({
    mutationFn: (id: string) => deleteMovement(id),
    onSuccess: (_data, id) => {
      removeMovement(id);
      invalidate();
    },
  });
}

export function useDeleteMovementGroup() {
  const invalidate = useInvalidateMovements();
  const { removeMovementGroup } = useUpdateMovementsCache();
  return useMutation({
    mutationFn: (groupId: string) => deleteMovementGroup(groupId),
    onSuccess: (_data, groupId) => {
      removeMovementGroup(groupId);
      invalidate();
    },
  });
}

export function usePayAllPendingForCategory() {
  const invalidate = useInvalidateMovements();
  const { upsertMovement } = useUpdateMovementsCache();
  return useMutation({
    mutationFn: ({ categoryId, year, month }: { categoryId: string; year: number; month: number }) =>
      payAllPendingForCategory(categoryId, year, month),
    onSuccess: (data) => {
      data.forEach(upsertMovement);
      invalidate();
    },
  });
}
