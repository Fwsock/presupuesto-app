/** "Bastian Guzmán" -> "BG". Falls back to the first letter of the email when there's no name yet (new account, onboarding not finished), and to "?" when neither is available. */
export function getInitials(nombre: string | null | undefined, email: string | null | undefined): string {
  const trimmed = nombre?.trim();
  if (trimmed) {
    const words = trimmed.split(/\s+/).filter(Boolean);
    return words
      .slice(0, 2)
      .map((word) => word[0]!.toUpperCase())
      .join('');
  }
  if (email) return email[0]!.toUpperCase();
  return '?';
}
