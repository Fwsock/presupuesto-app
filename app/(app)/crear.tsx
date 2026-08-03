import { Redirect } from 'expo-router';

// This route only exists because expo-router's file-based Tabs.Screen needs
// a real file per tab name to register the tab. The center "+" tab uses a
// custom tabBarButton (see app/(app)/_layout.tsx) that fully replaces
// react-navigation's default tab button and calls openCreate() directly via
// its own onPress, bypassing react-navigation's tabPress event entirely —
// there's no real onPress for tabPress to ever fire from in the first place.
// So this component should never actually mount in normal use — the
// redirect is just a safety net for the extremely unlikely case something
// navigates here directly (e.g. a stale deep link).
export default function CrearScreen() {
  return <Redirect href="/movimientos" />;
}
