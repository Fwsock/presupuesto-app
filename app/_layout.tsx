import 'react-native-get-random-values';
import '../global.css';
import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../lib/queryClient';
import { useSession } from '../features/auth/hooks';
import { useProfile } from '../features/profile/hooks';
import { View, Text } from 'react-native';

// Stack.Protected registers "(app)", "onboarding" and "login" up front and
// just toggles which is reachable via `guard` — unlike a <Redirect> fired
// from a pathname check, there's no imperative REPLACE action that can land
// before the target group's navigator has mounted (that raced the
// "(app)" tabs navigator on every login, throwing an unhandled-action
// warning visible to the user right after signing in).
function RootNavigator() {
  const { session, loading } = useSession();
  const { data: profile, isLoading: profileLoading } = useProfile(!!session);

  if (loading || (!!session && profileLoading)) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>Cargando...</Text>
      </View>
    );
  }

  // No profile row yet (never saved anything) counts as "not completed" -
  // the onboarding screen upserts the row itself the first time it's used.
  const needsOnboarding = !!session && !profile?.onboarding_completed;

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Protected guard={!!session && !needsOnboarding}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={needsOnboarding}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="verify-otp" />
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
