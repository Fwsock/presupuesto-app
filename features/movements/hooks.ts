import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createInstallments,
  createMovement,
  deleteMovement,
  fetchMovementsForMonth,
  updateMovement,
} from './api';
import type { InstallmentRow } from './installments';
import type { NewMovementInput, UpdateMovementInput } from './types';

export function useMovements(year: number, month: number) {
  return useQuery({
    queryKey: ['movements', year, month],
    queryFn: () => fetchMovementsForMonth(year, month),
  });
}

function useInvalidateMovements() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['movements'] });
}

export function useCreateMovement() {
  const invalidate = useInvalidateMovements();
  return useMutation({
    mutationFn: (input: NewMovementInput) => createMovement(input),
    onSuccess: invalidate,
  });
}

export function useCreateInstallments() {
  const invalidate = useInvalidateMovements();
  return useMutation({
    mutationFn: (rows: InstallmentRow[]) => createInstallments(rows),
    onSuccess: invalidate,
  });
}

export function useUpdateMovement() {
  const invalidate = useInvalidateMovements();
  return useMutation({
    mutationFn: (input: UpdateMovementInput) => updateMovement(input),
    onSuccess: invalidate,
  });
}

export function useDeleteMovement() {
  const invalidate = useInvalidateMovements();
  return useMutation({
    mutationFn: (id: string) => deleteMovement(id),
    onSuccess: invalidate,
  });
}
