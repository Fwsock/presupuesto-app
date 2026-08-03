import { Redirect } from 'expo-router';

// This route only exists because expo-router's file-based Tabs.Screen needs
// a real file per tab name to register the tab. The center "+" tab's
// tabPress is always intercepted in app/(app)/_layout.tsx (e.detail
// preventDefault + openCreate()), so this component should never actually
// mount in normal use — the redirect is just a safety net for any edge case
// that reaches it directly (e.g. a stale deep link).
export default function CrearScreen() {
  return <Redirect href="/movimientos" />;
}
