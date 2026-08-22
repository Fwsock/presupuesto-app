import { Platform, type TextStyle, type ViewStyle } from 'react-native';

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

/**
 * Semibold weight for screen/section headers (native nav header title,
 * FullScreenFormModal's title bar). Used to be a platform-conditional hack
 * (`fontWeight: '600'` on iOS, `fontFamily: 'sans-serif-medium'` on Android)
 * because plain `fontWeight: '600'` quietly falls back to regular on stock
 * Android "Roboto", which only reliably maps to 400/700 -- and even the
 * Android-only alias still read thinner than iOS on a real device, since it
 * depends on whatever medium-weight font the OS skin happens to ship.
 *
 * A real embedded font file sidesteps all of that: PlusJakartaSans_600SemiBold
 * (loaded via useFonts in app/_layout.tsx) is the exact same bytes on both
 * platforms, so there's no OS/skin-dependent weight-mapping left to get
 * wrong -- this is now identical on iOS and Android by construction, not by
 * two separate platform-specific approximations.
 */
export const headerTitleFont: TextStyle = { fontFamily: 'PlusJakartaSans_600SemiBold' };

/**
 * Shared "elevated card" shadow -- used to live copy-pasted identically in
 * index.tsx, CategoryTotalsList.tsx, categorias.tsx, and cuenta.tsx.
 * Centralized here to kill that duplication.
 *
 * Android-only `elevation: 0` on purpose, confirmed on a real device: giving
 * Android any `elevation` > 0 (tried 2) renders a visible gray ring/halo
 * around every card, not just the soft native Material shadow it's supposed
 * to be -- worse, that ring stayed clearly visible even on a fully-settled
 * card, not only mid-animation (e.g. Resumen's month-switch opacity fade),
 * so this isn't a transition-timing bug to chase, it's `elevation` itself
 * rendering wrong for this combination of light background + rounded card +
 * low elevation value on this device. iOS never had this problem --
 * shadowColor/shadowOpacity/shadowRadius/shadowOffset are iOS-only
 * properties (Android ignores them entirely), so it keeps its own soft,
 * diffused shadow (blurred via a large shadowRadius, subtle at 0.06
 * opacity) untouched. Net effect: iOS cards are visibly elevated; Android
 * cards fall back to definition from their `border border-border` hairline
 * alone, same as before this shadow was ever touched -- flatter, but
 * guaranteed free of the artifact.
 */
export const cardShadow: ViewStyle = {
  shadowColor: '#0F172A',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.06,
  shadowRadius: 16,
  elevation: Platform.OS === 'android' ? 0 : 2,
};
