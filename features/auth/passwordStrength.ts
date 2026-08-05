export type PasswordStrengthLevel = 'baja' | 'media' | 'alta';

export interface PasswordChecks {
  minLength: boolean;
  hasUppercase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
}

export interface PasswordStrength {
  checks: PasswordChecks;
  /** 0-4, how many checks pass. */
  score: number;
  level: PasswordStrengthLevel;
}

/** Evaluates the four required checks and derives a 0-4 score and a low/medium/high level for the strength bar. */
export function getPasswordStrength(password: string): PasswordStrength {
  const checks: PasswordChecks = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecialChar: /[!@#$%^&*.,]/.test(password),
  };

  const score = Object.values(checks).filter(Boolean).length;
  const level: PasswordStrengthLevel = score <= 1 ? 'baja' : score <= 3 ? 'media' : 'alta';

  return { checks, score, level };
}
