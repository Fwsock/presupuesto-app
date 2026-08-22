module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    // Replaces (not extends) Tailwind's default `font-sans` stack -- Plus
    // Jakarta Sans Regular becomes the app's base typeface everywhere a
    // Text doesn't set its own fontFamily. Loaded via useFonts in
    // app/_layout.tsx, which holds the splash screen until it's ready, so
    // there's no fallback-font flash to guard against here.
    fontFamily: {
      sans: ['PlusJakartaSans_400Regular'],
    },
    extend: {
      // FinanFlow palette (see lib/theme.ts for the same values used outside
      // className strings — Ionicons `color` props, inline styles, etc).
      colors: {
        brand: '#2563EB',
        income: '#10B981',
        danger: '#EF4444',
        background: '#F8FAFC',
        surface: '#FFFFFF',
        ink: '#0F172A',
        secondary: '#64748B',
        border: '#F1F5F9',
      },
      // Named on purpose, NOT layered onto font-medium/font-semibold/
      // font-bold: those are Tailwind's numeric fontWeight utilities, which
      // just synthesize bold on top of whatever fontFamily is active in
      // React Native (there's no @font-face weight-matching like on the
      // web). Static per-weight Google Font files need their own distinct
      // family name to actually render as that cut instead of a fake-bold
      // Regular. Use these explicitly (font-jakarta-medium/-semibold/-bold)
      // wherever a heavier weight matters visually (currently just
      // headerTitleFont, see lib/theme.ts) -- everywhere still on
      // font-semibold/font-bold keeps synthesizing bold on Plus Jakarta
      // Regular for now.
      fontFamily: {
        // Same family as the top-level `sans` override above -- exists as
        // its own explicit token (`font-jakarta`) so call sites that want
        // to state "this is Plus Jakarta Regular" outright (TextInputs,
        // mainly) can, instead of relying silently on the base/inherited
        // default. Functionally identical to font-sans; purely for
        // explicitness/auditability at the call site.
        jakarta: ['PlusJakartaSans_400Regular'],
        'jakarta-medium': ['PlusJakartaSans_500Medium'],
        'jakarta-semibold': ['PlusJakartaSans_600SemiBold'],
        'jakarta-bold': ['PlusJakartaSans_700Bold'],
      },
    },
  },
  plugins: [],
};
