/**
 * FinanFlow palette — same hex values as tailwind.config.js's `theme.extend.colors`.
 * Use this for anything that can't take a NativeWind className (Ionicons'
 * `color` prop, inline styles, chart colors); use the Tailwind classes
 * (`bg-brand`, `text-income`, `text-danger`, `bg-background`, `bg-surface`,
 * `text-ink`) everywhere else.
 */
export const theme = {
  brand: '#2563EB',
  income: '#10B981',
  danger: '#EF4444',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  ink: '#0F172A',
  // Neobanco-style secondary/muted text (labels, timestamps, helper copy) --
  // deliberately NOT Tailwind's default gray-400/500 (#9CA3AF/#6B7280),
  // which read slightly warm next to this palette's cool slate-leaning
  // brand/background/surface tones.
  secondary: '#64748B',
  // Subtle card border -- a near-invisible hairline, not a real divider.
  border: '#F1F5F9',
} as const;
