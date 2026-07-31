import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { router } from 'expo-router';
import { signIn } from '../features/auth/hooks';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginForm) => {
    setServerError(null);
    try {
      await signIn(values.email, values.password);
      router.replace('/');
    } catch (err) {
      setServerError('Email o contraseña incorrectos');
    }
  };

  return (
    <View className="flex-1 justify-center px-6 bg-white">
      <Text className="text-2xl font-bold mb-6">Presupuesto</Text>

      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, value } }) => (
          <TextInput
            className="border border-gray-300 rounded-md px-3 py-2 mb-1"
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={value ?? ''}
            onChangeText={onChange}
          />
        )}
      />
      {errors.email && <Text className="text-red-600 mb-2">{errors.email.message}</Text>}

      <Controller
        control={control}
        name="password"
        render={({ field: { onChange, value } }) => (
          <TextInput
            className="border border-gray-300 rounded-md px-3 py-2 mb-1"
            placeholder="Contraseña"
            secureTextEntry
            value={value ?? ''}
            onChangeText={onChange}
          />
        )}
      />
      {errors.password && <Text className="text-red-600 mb-2">{errors.password.message}</Text>}

      {serverError && <Text className="text-red-600 mb-2">{serverError}</Text>}

      <Pressable
        className="bg-blue-600 rounded-md py-3 mt-4"
        onPress={handleSubmit(onSubmit)}
        disabled={isSubmitting}
      >
        <Text className="text-white text-center font-semibold">
          {isSubmitting ? 'Ingresando...' : 'Ingresar'}
        </Text>
      </Pressable>
    </View>
  );
}
