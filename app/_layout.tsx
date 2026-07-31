import 'react-native-get-random-values';
import '../global.css';
import { Slot, Redirect, usePathname } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../lib/queryClient';
import { useSession } from '../features/auth/hooks';
import { View, Text } from 'react-native';

function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();
  const pathname = usePathname();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>Cargando...</Text>
      </View>
    );
  }

  if (!session && pathname !== '/login') {
    return <Redirect href="/login" />;
  }

  if (session && pathname === '/login') {
    return <Redirect href="/" />;
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate>
        <Slot />
      </AuthGate>
    </QueryClientProvider>
  );
}
