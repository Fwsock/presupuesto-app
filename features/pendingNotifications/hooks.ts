import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';
import { loadPendingNotifications, savePendingNotifications } from './storage';
import { addPendingNotification, confirmPendingNotification, discardPendingNotification } from './inboxStore';
import { parseBankNotification } from '../../lib/parsers/bankNotificationParser';
import { suggestCategoryForComercio } from '../movements/categorySuggestion';
import { createMovement } from '../movements/api';
import type { Category } from '../categories/types';
import type { NewMovementInput } from '../movements/types';
import type { PendingNotification } from './types';

const QUERY_KEY = ['pending-notifications'];

export function usePendingNotifications() {
  return useQuery({ queryKey: QUERY_KEY, queryFn: loadPendingNotifications });
}

/** Parses raw notification text, suggests a category from the user's own catalog, and adds it to the inbox. */
export function useAddPendingNotificationFromText() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ rawText, categories }: { rawText: string; categories: Category[] }) => {
      const parsed = parseBankNotification(rawText);
      const suggestedCategory = suggestCategoryForComercio(parsed.comercio, categories);
      const notification: PendingNotification = {
        id: uuidv4(),
        rawText,
        monto: parsed.monto,
        comercio: parsed.comercio,
        tipo: parsed.tipo,
        suggestedCategoryId: suggestedCategory?.id ?? null,
        capturedAt: new Date().toISOString(),
      };
      const current = await loadPendingNotifications();
      const next = addPendingNotification(current, notification);
      await savePendingNotifications(next);
      return next;
    },
    onSuccess: (next) => queryClient.setQueryData(QUERY_KEY, next),
  });
}

/** Creates the real Movement in Supabase, then removes the source notification from the inbox. */
export function useConfirmPendingNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, movement }: { id: string; movement: NewMovementInput }) => {
      await createMovement(movement);
      const current = await loadPendingNotifications();
      const next = confirmPendingNotification(current, id);
      await savePendingNotifications(next);
      return next;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(QUERY_KEY, next);
      queryClient.invalidateQueries({ queryKey: ['movements'] });
    },
  });
}

export function useDiscardPendingNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const current = await loadPendingNotifications();
      const next = discardPendingNotification(current, id);
      await savePendingNotifications(next);
      return next;
    },
    onSuccess: (next) => queryClient.setQueryData(QUERY_KEY, next),
  });
}
