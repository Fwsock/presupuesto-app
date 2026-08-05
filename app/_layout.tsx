import 'react-native-get-random-values';
import '../global.css';
import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../lib/queryClient';
import { useSession } from '../features/auth/hooks';
import { useProfile } from '../features/profile/hooks';
import { View } from 'react-native';
import { ScreenSkeleton } from '../components/Skeleton';

// Stack.Protected registers "(app)", "onboarding", "update-password" and the
// unauthenticated screens up front and just toggles which is reachable via
// `guard` — unlike a <Redirect> fired from a pathname check, there's no
// imperative REPLACE action that can land before the target group's
// navigator has mounted.
function RootNavigator() {
  const { session, loading, isPasswordRecovery } = useSession();
  // Skips the profile fetch during a password-recovery session: that
  // session exists only to let update-password.tsx call updateUser(), and
  // fetching a profile for it would be a wasted request that also risks
  // flashing the onboarding/loading skeleton before signOut() kicks in.
  const { data: profile, isLoading: profileLoading } = useProfile(!!session && !isPasswordRecovery);

  if (loading || (!!session && !isPasswordRecovery && profileLoading)) {
    return (
      <View className="flex-1 bg-white">
        <ScreenSkeleton />
      </View>
    );
  }

  // No profile row yet (never saved anything) counts as "not completed" -
  // the onboarding screen upserts the row itself the first time it's used.
  const needsOnboarding = !!session && !isPasswordRecovery && !profile?.onboarding_completed;

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
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
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <RootNavigator />
    </QueryClientProvider>
  );
}
