// Set up environment variables for testing
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

// Set up React Native global for tests
if (typeof __DEV__ === 'undefined') {
  global.__DEV__ = true;
}
