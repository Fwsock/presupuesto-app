import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { requestPasswordReset, translateAuthError } from '../features/auth/hooks';
import { AuthTextInput } from '../components/AuthTextInput';
import { Button } from '../components/Button';
import { BackButton } from '../components/BackButton';

const forgotPasswordSchema = z.object({
  email: z.string().email('Ingresa un correo electrónico válido'),
});

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordScreen() {
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: emailParam ?? '' },
  });

  const onSubmit = async (values: ForgotPasswordForm) => {
    setServerError(null);
    try {
      await requestPasswordReset(values.email);
      setSentTo(values.email);
    } catch (err) {
      setServerError(translateAuthError(err));
    }
  };

  const formError = errors.email?.message ?? serverError;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      className="bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <BackButton onPress={() => router.back()} />
      <ScrollView
        className="px-6"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        keyboardShouldPersistTaps="handled"
      >
        {sentTo ? (
          <>
            <Text className="text-2xl font-bold mb-1 text-center">Correo enviado</Text>
            <Text className="text-gray-500 mb-8 text-center">
              Revisa tu bandeja de entrada en {sentTo} y escribe el código de 6 dígitos que te enviamos.
            </Text>
            <Button
              title="Ingresar código"
              onPress={() => router.push({ pathname: '/reset-password', params: { email: sentTo } })}
            />
          </>
        ) : (
          <>
            <Text className="text-2xl font-bold mb-1 text-center">Recuperar contraseña</Text>
            <Text className="text-gray-500 mb-6 text-center">
              Ingresa tu correo para recibir un código de recuperación
            </Text>

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

            {formError && <Text className="text-danger mb-2">{formError}</Text>}

            <Button
              title="Enviar instrucciones"
              loadingLabel="Enviando..."
              onPress={handleSubmit(onSubmit)}
              loading={isSubmitting}
              disabled={isSubmitting}
            />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
