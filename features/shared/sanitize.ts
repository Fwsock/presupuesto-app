// Matches C0 control characters (0x00-0x1F) except \t/\n/\r, plus DEL
// (0x7F) -- these have no legitimate place in a category name, movement
// concepto/notas, or profile nombre, and stripping them defends against
// malformed payloads reaching the database or a future export (CSV, email)
// where a raw control character could do something unexpected.
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/**
 * Normalizes free-text input before it reaches the database: trims
 * surrounding whitespace, strips non-printable control characters, and
 * truncates to `maxLength`. Does NOT do HTML/script sanitization -- React
 * Native's Text/TextInput never render raw HTML, so there is no injection
 * surface for that here.
 */
export function sanitizeText(value: string, maxLength: number): string {
  return value.replace(CONTROL_CHARS, '').trim().slice(0, maxLength);
}

/** Same as sanitizeText, but passes `null` through unchanged (for optional fields like `notas`). */
export function sanitizeNullableText(value: string | null, maxLength: number): string | null {
  return value === null ? null : sanitizeText(value, maxLength);
}
