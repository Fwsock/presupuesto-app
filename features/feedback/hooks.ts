import { useMutation } from '@tanstack/react-query';
import { submitFeedback } from './api';
import type { NewFeedbackInput } from './types';

/** No query invalidation on success -- nothing else in the app reads the feedback table (it has no in-app list/history screen), unlike categories/movements. */
export function useSubmitFeedback() {
  return useMutation({
    mutationFn: (input: NewFeedbackInput) => submitFeedback(input),
  });
}
