import 'react-native-gesture-handler';
import 'react-native-get-random-values';
import '../global.css';
import { useCallback, useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, DefaultTheme, type Theme } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { queryClient } from '../lib/queryClient';
import { useSession } from '../features/auth/hooks';
import { useProfile } from '../features/profile/hooks';
import { View, type LayoutChangeEvent } from 'react-native';
import { ScreenSkeleton } from '../components/Skeleton';
import { theme } from '../lib/theme';

// React Navigation's own default theme has a light-gray `background`/white
// `card` -- neither is one of this app's actual colors, so any native chrome
// it paints ahead of our own screenOptions/content (the very first frame of
// a screen transition, before contentStyle/sceneStyle "wins") used to paint
// that mismatched default first, which is what read as a white flash. Every
// consumer of useTheme() (Stack, Tabs, and their default header/scene
// backgrounds) picks this up automatically as an ancestor context, no
// per-screen wiring needed.
const AppNavigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: theme.brand,
    background: theme.background,
    card: theme.surface,
    text: theme.ink,
    border: theme.border,
  },
};

// Module scope, not inside a component/effect: expo-router's own root
// renderer calls `_internal_maybeHideAsync()` on the very first frame (via
// requestAnimationFrame), so this has to win that race -- a call made from
// inside RootLayout's first effect would already run too late and the
// native splash would flash-hide onto the ScreenSkeleton below before
// onReady (see RootNavigator) ever gets a chance to keep it up.
SplashScreen.preventAutoHideAsync().catch(() => {});
// iOS-only per expo-splash-screen's own types (Android animates the
// transition its own way regardless) -- a soft cross-fade instead of an
// instant cut when hideAsync() runs.
SplashScreen.setOptions({ duration: 250, fade: true });

// Paints the Android root view's own native background -- a layer BELOW
// even the Stack's contentStyle, set before React ever renders a single
// frame. Some OEM Android skins (MIUI/HyperOS included) interpose their own
// window-transition frame during an activity/surface swap that never goes
// through React Navigation's compositing at all, so a screen-level fix alone
// can leave a visible gap on exactly those devices. Module scope, same
// reasoning as preventAutoHideAsync() above: this needs to win the race
// against the very first native frame, not wait for an effect.
SystemUI.setBackgroundColorAsync(theme.background).catch(() => {});

// Stack.Protected registers "(app)", "onboarding", "update-password" and the
// unauthenticated screens up front and just toggles which is reachable via
// `guard` — unlike a <Redirect> fired from a pathname check, there's no
// imperative REPLACE action that can land before the target group's
// navigator has mounted.
function RootNavigator({ onReady }: { onReady: (event: LayoutChangeEvent) => void }) {
  const { session, loading, isPasswordRecovery } = useSession();
  // Skips the profile fetch during a password-recovery session: that
  // session exists only to let update-password.tsx call updateUser(), and
  // fetching a profile for it would be a wasted request that also risks
  // flashing the onboarding/loading skeleton before signOut() kicks in.
  const { data: profile, isLoading: profileLoading } = useProfile(!!session && !isPasswordRecovery);

  const booting = loading || (!!session && !isPasswordRecovery && profileLoading);

  if (booting) {
    // Unlike an in-app screen (where ScreenSkeleton's own top-anchored rows
    // mimic real content sitting under a header), this is a bare transition
    // between Login and the app -- centering it here, not inside
    // ScreenSkeleton itself, keeps every other screen's skeleton position
    // exactly as-is. justify-center only (not items-center): View's default
    // alignItems is 'stretch', so ScreenSkeleton keeps its normal full-width
    // proportions instead of shrink-wrapping to a narrower centered block.
    //
    // In practice this no longer renders on a cold start -- the native
    // splash (see onReady below) covers this whole window and only lifts
    // once `booting` goes false. It still exists for later transitions
    // that hit this same branch again (e.g. right after logout).
    return (
      <View className="flex-1 bg-white justify-center">
        <ScreenSkeleton />
      </View>
    );
  }

  // No profile row yet (never saved anything) counts as "not completed" -
  // the onboarding screen upserts the row itself the first time it's used.
  const needsOnboarding = !!session && !isPasswordRecovery && !profile?.onboarding_completed;

  return (
    // onLayout (not a bare useEffect) so the native splash only lifts once
    // this subtree has actually painted -- an effect can fire a frame
    // before the native layer catches up, which would flash a blank/white
    // frame between the splash and real content.
    <View style={{ flex: 1, backgroundColor: theme.background }} onLayout={onReady}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          // theme.background, not a literal white: the "(app)" group (the
          // whole Tabs navigator) is itself just one Stack.Screen in here,
          // so THIS is the actual native compositing layer sitting directly
          // behind every tab -- during a tab-switch transition, any single
          // frame where the Tabs navigator's own sceneStyle background
          // doesn't fully cover the viewport yet exposes whatever's set
          // here, not the Tabs navigator's own background. Previous fixes
          // (removing FadeTabScreen, sceneStyle on <Tabs>) never touched
          // this layer -- a plain '#FFFFFF' here was fully indistinguishable
          // from a "white flash" bug report even with those in place. Kept
          // as `theme.background` (not pure white) for every screen in this
          // Stack, auth screens included -- the two are close enough in hue
          // that this doesn't reintroduce the original keyboard-dismiss
          // mismatch this value used to guard against.
          contentStyle: { backgroundColor: theme.background },
        }}
      >
        <Stack.Protected guard={!!session && !needsOnboarding && !isPasswordRecovery}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={needsOnboarding}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={!!session && isPasswordRecovery}>
          <Stack.Screen name="update-password" />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
          <Stack.Screen name="verify-otp" />
          <Stack.Screen name="forgot-password" />
          <Stack.Screen name="reset-password" />
        </Stack.Protected>
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  // Guards hideAsync() to fire exactly once -- onLayout can re-fire on a
  // later resize/rotation, and calling hide() again after the splash is
  // already gone is harmless but pointless.
  const hiddenRef = useRef(false);
  const onReady = useCallback(() => {
    if (hiddenRef.current) return;
    hiddenRef.current = true;
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // Safety net: if useSession/useProfile never resolve (a dead network, a
  // Supabase outage), the splash would otherwise stay up forever and the
  // app would look permanently frozen.
  useEffect(() => {
    const timeout = setTimeout(onReady, 6000);
    return () => clearTimeout(timeout);
  }, [onReady]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.brand }}>
      <ThemeProvider value={AppNavigationTheme}>
        <QueryClientProvider client={queryClient}>
          <RootNavigator onReady={onReady} />
        </QueryClientProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
