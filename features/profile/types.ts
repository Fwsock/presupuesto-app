export interface Profile {
  id: string;
  nombre: string | null;
  telefono: string | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface UpsertProfileInput {
  nombre?: string | null;
  telefono?: string | null;
  onboarding_completed?: boolean;
}
