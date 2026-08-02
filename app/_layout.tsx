import 'react-native-get-random-values';
import '../global.css';
import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../lib/queryClient';
import { useSession } from '../features/auth/hooks';
import { View, Text } from 'react-native';

// Stack.Protected registers both the "(app)" and "login" screens up front and
// just toggles which is reachable via `guard` — unlike a <Redirect> fired
// from a pathname check, there's no imperative REPLACE action that can land
// before the target group's navigator has mounted (that raced the
// "(app)" tabs navigator on every login, throwing an unhandled-action
// warning visible to the user right after signing in).
function RootNavigator() {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>Cargando...</Text>
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" />
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
