import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useRouter } from 'expo-router';
import { signUp, translateAuthError } from '../features/auth/hooks';
import { AuthHeader } from '../components/AuthHeader';
import { AuthTextInput } from '../components/AuthTextInput';
import { PasswordStrengthMeter } from '../components/PasswordStrengthMeter';
import { Button } from '../components/Button';

const registerSchema = z
  .object({
    email: z.string().email('Ingresa un correo electrónico válido'),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
    confirmPassword: z.string().min(1, 'Confirma tu contraseña'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterScreen() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    // See login.tsx's identical defaultValues for why this matters: without
    // it an untouched field is `undefined`, not `''`, and Zod's base
    // z.string() type check fails with a generic English message before our
    // custom ones ever run.
    defaultValues: { email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = async (values: RegisterForm) => {
    setServerError(null);
    try {
      const { needsEmailConfirmation } = await signUp(values.email, values.password);
      if (needsEmailConfirmation) {
        router.push({ pathname: '/verify-otp', params: { email: values.email } });
      }
      // Otherwise a session now exists already (email confirmations are off
      // for this project) and RootNavigator's Stack.Protected guards
      // (app/_layout.tsx) take over automatically, same as login — no
      // manual navigation here either.
    } catch (err) {
      setServerError(translateAuthError(err));
    }
  };

  const password = watch('password');

  // Only one message at a time, same priority convention as login.tsx.
  const formError =
    errors.email?.message ?? errors.password?.message ?? errors.confirmPassword?.message ?? serverError;

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
        <AuthHeader subtitle="Crea tu cuenta para empezar" />

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
        <PasswordStrengthMeter password={password} />

        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { onChange, value } }) => (
            <AuthTextInput
              icon="lock-closed-outline"
              placeholder="Confirmar contraseña"
              secureTextEntry
              value={value}
              onChangeText={onChange}
            />
          )}
        />

        {formError && <Text className="text-danger mb-2">{formError}</Text>}

        <Button
          title="Crear cuenta"
          loadingLabel="Creando cuenta..."
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
          disabled={isSubmitting}
        />

        <Link href="/login" className="mt-3">
          <Text className="text-brand text-center">¿Ya tienes cuenta? Inicia sesión</Text>
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
