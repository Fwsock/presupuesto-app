import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchProfile, upsertProfile } from './api';
import type { UpsertProfileInput } from './types';

export function useProfile(enabled: boolean = true) {
  return useQuery({ queryKey: ['profile'], queryFn: fetchProfile, enabled });
}

export function useUpsertProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertProfileInput) => upsertProfile(input),
    onSuccess: (data) => {
      queryClient.setQueryData(['profile'], data);
    },
  });
}
