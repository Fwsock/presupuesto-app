import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createCategory, deleteCategory, fetchCategories, reassignCategoryMovements, updateCategory } from './api';
import type { NewCategoryInput, UpdateCategoryInput } from './types';

export function useCategories() {
  return useQuery({ queryKey: ['categories'], queryFn: fetchCategories });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewCategoryInput) => createCategory(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateCategoryInput) => updateCategory(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  });
}

/** Reassigns a category's movements onto another category -- see the delete flow's reassignment sheet in app/(app)/categorias.tsx. */
export function useReassignCategoryMovements() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ fromCategoryId, toCategoryId }: { fromCategoryId: string; toCategoryId: string }) =>
      reassignCategoryMovements(fromCategoryId, toCategoryId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['movements'] }),
  });
}
