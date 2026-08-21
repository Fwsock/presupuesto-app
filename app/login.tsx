import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { signIn, signInWithGoogle, translateAuthError, consumePasswordJustReset } from '../features/auth/hooks';
import { AuthHeader } from '../components/AuthHeader';
import { AuthTextInput } from '../components/AuthTextInput';
import { Button } from '../components/Button';
import { TextLink } from '../components/TextLink';
import { PressableScale } from '../components/PressableScale';
import { GoogleLogo } from '../components/GoogleLogo';

const loginSchema = z.object({
  email: z.string().email('Ingresa un correo electrónico válido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const [showPasswordResetBanner] = useState(consumePasswordJustReset);
  const [serverError, setServerError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    // Without these, an untouched field's value is `undefined` (not `''`)
    // going into Zod, which fails the base z.string() type check before ever
    // reaching .email()/.min() and surfaces Zod's generic English
    // "Invalid input: expected string, received undefined" instead of our
    // Spanish message.
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginForm) => {
    setServerError(null);
    try {
      // No manual navigation here on purpose: RootNavigator's Stack.Protected
      // guards (app/_layout.tsx) react to useSession()'s state automatically
      // once this resolves.
      await signIn(values.email, values.password);
    } catch (err) {
      setServerError(translateAuthError(err));
    }
  };

  const handleGoogleSignIn = async () => {
    setServerError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setServerError(translateAuthError(err));
    } finally {
      setGoogleLoading(false);
    }
  };

  const email = watch('email');

  // Only one message on screen at a time, in priority order: email format,
  // then missing password, then a failed login attempt against the API.
  const formError = errors.email?.message ?? errors.password?.message ?? serverError;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      className="bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        className="px-6"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        keyboardShouldPersistTaps="handled"
      >
        <AuthHeader subtitle="Inicia sesión para continuar" />

        {showPasswordResetBanner && (
          <Text className="text-income mb-4 text-center">
            Contraseña actualizada correctamente. Inicia sesión con tu nueva contraseña.
          </Text>
        )}

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, value } }) => (
            <AuthTextInput
              icon="mail-outline"
              placeholder="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              value={value}
              onChangeText={onChange}
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, value } }) => (
            <AuthTextInput
              icon="lock-closed-outline"
              placeholder="Contraseña"
              secureTextEntry
              value={value}
              onChangeText={onChange}
            />
          )}
        />

        {formError && <Text className="text-danger mb-2">{formError}</Text>}

        <Button title="Ingresar" loadingLabel="Ingresando..." onPress={handleSubmit(onSubmit)} loading={isSubmitting} disabled={isSubmitting} />

        <View className="flex-row items-center my-5">
          <View className="flex-1 h-px bg-border" />
          <Text className="text-secondary text-xs mx-3">o</Text>
          <View className="flex-1 h-px bg-border" />
        </View>

        <PressableScale
          onPress={handleGoogleSignIn}
          disabled={googleLoading || isSubmitting}
          scaleTo={0.965}
          activeOpacity={0.7}
          spring
          haptics
          className="flex-row items-center justify-center border border-border rounded-xl py-3.5"
          style={{ opacity: googleLoading ? 0.6 : 1 }}
          accessibilityRole="button"
          accessibilityLabel="Continuar con Google"
        >
          <GoogleLogo size={20} />
          <Text className="text-ink font-medium ml-3">
            {googleLoading ? 'Conectando...' : 'Continuar con Google'}
          </Text>
        </PressableScale>

        <TextLink href={{ pathname: '/forgot-password', params: email ? { email } : undefined }} className="mt-3">
          ¿Olvidaste tu contraseña?
        </TextLink>

        <TextLink href="/register" className="mt-6">
          ¿No tienes cuenta? Regístrate
        </TextLink>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
