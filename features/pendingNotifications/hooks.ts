import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';
import { loadPendingNotifications, savePendingNotifications } from './storage';
import { addPendingNotification, confirmPendingNotification, discardPendingNotification } from './inboxStore';
import { parseBankNotification, isRealTransactionNotification } from '../../lib/parsers/bankNotificationParser';
import { suggestCategoryForComercio } from '../movements/categorySuggestion';
import { createMovement } from '../movements/api';
import type { Category } from '../categories/types';
import type { NewMovementInput } from '../movements/types';
import type { PendingNotification } from './types';
import type { ScannedDocumentResult } from './documentCapture';

const QUERY_KEY = ['pending-notifications'];

export function usePendingNotifications() {
  return useQuery({ queryKey: QUERY_KEY, queryFn: loadPendingNotifications });
}

/**
 * Parses raw notification text, suggests a category from the user's own
 * catalog, and adds it to the inbox -- rejecting anything without an
 * extractable amount or that reads as bank marketing copy first (see
 * isRealTransactionNotification). Every entry point (background listener,
 * persisted-queue drain, manual paste, OCR) calls this same mutation, so
 * the filter applies identically to all of them.
 */
export function useAddPendingNotificationFromText() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ rawText, categories }: { rawText: string; categories: Category[] }) => {
      if (!isRealTransactionNotification(rawText)) {
        throw new Error('Este mensaje no parece ser un movimiento con monto — no se agregó a pendientes.');
      }
      const parsed = parseBankNotification(rawText);
      const suggestedCategory = suggestCategoryForComercio(parsed.comercio, categories);
      const notification: PendingNotification = {
        id: uuidv4(),
        rawText,
        monto: parsed.monto,
        comercio: parsed.comercio,
        fecha: null,
        tipo: parsed.tipo,
        suggestedCategoryId: suggestedCategory?.id ?? null,
        capturedAt: new Date().toISOString(),
        source: 'text',
        items: [],
      };
      const current = await loadPendingNotifications();
      const next = addPendingNotification(current, notification);
      await savePendingNotifications(next);
      return next;
    },
    onSuccess: (next) => queryClient.setQueryData(QUERY_KEY, next),
  });
}

/**
 * Adds a scanned document (scanDocumentFromCamera/scanDocumentFromGallery
 * already validated it has a real monto > 0 before this is ever called) to
 * the inbox. Works identically for a boleta/factura, a small-comercio vale,
 * or a transfer confirmation/screenshot -- tipo falls back to 'gasto' when
 * the OCR text had no clear ingreso/gasto language (a photographed document
 * is far more often a purchase than income). Item lines are kept in their
 * own field (not appended into rawText) so the confirm screen can render
 * them as a clean list -- rawText stays the untouched OCR output, shown
 * only behind the debug "ver texto OCR crudo" toggle.
 */
export function useAddPendingNotificationFromScan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ scan, categories }: { scan: ScannedDocumentResult; categories: Category[] }) => {
      const suggestedCategory = suggestCategoryForComercio(scan.comercio, categories);
      const notification: PendingNotification = {
        id: uuidv4(),
        rawText: scan.rawText,
        monto: scan.monto,
        comercio: scan.comercio,
        fecha: scan.fecha,
        tipo: scan.tipo ?? 'gasto',
        suggestedCategoryId: suggestedCategory?.id ?? null,
        capturedAt: new Date().toISOString(),
        source: 'scan',
        items: scan.items,
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
