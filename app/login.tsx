import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { signIn, translateAuthError, consumePasswordJustReset } from '../features/auth/hooks';
import { AuthTextInput } from '../components/AuthTextInput';
import { Button } from '../components/Button';
import { TextLink } from '../components/TextLink';

const loginSchema = z.object({
  email: z.string().email('Ingresa un correo electrónico válido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const [showPasswordResetBanner] = useState(consumePasswordJustReset);
  const [serverError, setServerError] = useState<string | null>(null);
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

  const email = watch('email');

  // Only one message on screen at a time, in priority order: email format,
  // then missing password, then a failed login attempt against the API.
  const formError = errors.email?.message ?? errors.password?.message ?? serverError;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      className="bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        className="px-6"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-2xl font-bold mb-1 text-center">Presupuesto</Text>
        <Text className="text-gray-500 mb-6 text-center">Inicia sesión para continuar</Text>

        {showPasswordResetBanner && (
          <Text className="text-green-600 mb-4 text-center">
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

        {formError && <Text className="text-red-600 mb-2">{formError}</Text>}

        <Button title="Ingresar" loadingLabel="Ingresando..." onPress={handleSubmit(onSubmit)} loading={isSubmitting} disabled={isSubmitting} />

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
