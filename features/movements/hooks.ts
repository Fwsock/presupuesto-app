import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createInstallments,
  createMovement,
  deleteMovement,
  deleteMovementGroup,
  fetchMovementsForMonth,
  fetchMovementsForMonthRange,
  payAllPendingForCategory,
  updateMovement,
} from './api';
import type { InstallmentRow } from './installments';
import type { NewMovementInput, UpdateMovementInput, Movement } from './types';

export function useMovements(year: number, month: number) {
  return useQuery({
    queryKey: ['movements', year, month],
    queryFn: () => fetchMovementsForMonth(year, month),
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
      // Drop the previous version from every month (fecha may have changed).
      mutateMonthCaches((rows) => rows.filter((r) => r.id !== movement.id));
      mutateMonthCaches((rows, year, month) => {
        if (year !== y || month !== m) return rows;
        return [...rows, movement].sort((a, b) => a.fecha.localeCompare(b.fecha));
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
