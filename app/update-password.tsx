import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { updatePassword, signOut, translateAuthError, markPasswordJustReset } from '../features/auth/hooks';
import { getPasswordStrength } from '../features/auth/passwordStrength';
import { AuthTextInput } from '../components/AuthTextInput';
import { PasswordStrengthMeter } from '../components/PasswordStrengthMeter';
import { Button } from '../components/Button';

const updatePasswordSchema = z
  .object({
    password: z
      .string()
      .min(1, 'La contraseña es obligatoria')
      .refine((value) => getPasswordStrength(value).score === 4, {
        message: 'La contraseña debe cumplir las 4 condiciones de seguridad',
      }),
    confirmPassword: z.string().min(1, 'Confirma tu contraseña'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

type UpdatePasswordForm = z.infer<typeof updatePasswordSchema>;

export default function UpdatePasswordScreen() {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<UpdatePasswordForm>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = async (values: UpdatePasswordForm) => {
    setServerError(null);
    try {
      await updatePassword(values.password);
      // Set before signOut(), not after: RootNavigator's guard swaps back to
      // login as soon as the session clears, and this flag must already be true
      // by then. No router.replace() here on purpose -- see cuenta.tsx's own
      // signOut() for the same convention: the auth gate in app/_layout.tsx
      // handles the navigation on its own once React state settles, avoiding
      // the "action was not handled by any navigator" race that an imperative
      // call right after signOut() can hit.
      markPasswordJustReset();
      // signOut() limpia la sesión de recuperación (y el flag
      // isPasswordRecovery vía el evento SIGNED_OUT) -- sin esto el usuario
      // quedaría "adentro" de la app en vez de volver a login como se pidió.
      await signOut();
    } catch (err) {
      setServerError(translateAuthError(err));
    }
  };

  const password = watch('password');
  const formError = errors.password?.message ?? errors.confirmPassword?.message ?? serverError;

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
        <Text className="text-2xl font-bold mb-1 text-center">Nueva contraseña</Text>
        <Text className="text-gray-500 mb-6 text-center">Elige una contraseña nueva para tu cuenta</Text>

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, value } }) => (
            <AuthTextInput
              icon="lock-closed-outline"
              placeholder="Nueva contraseña"
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
              placeholder="Confirmar nueva contraseña"
              secureTextEntry
              value={value}
              onChangeText={onChange}
            />
          )}
        />

        {formError && <Text className="text-red-600 mb-2">{formError}</Text>}

        <Button
          title="Actualizar contraseña"
          loadingLabel="Actualizando..."
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
          disabled={isSubmitting}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
