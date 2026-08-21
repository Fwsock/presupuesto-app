import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { useUpsertProfile } from '../features/profile/hooks';
import { DEFAULT_COUNTRY_CODE, formatPhoneNumber, isValidPhoneNumber } from '../features/shared/countries';
import { RecurringIncomeForm } from '../components/RecurringIncomeForm';
import { PhoneInput } from '../components/PhoneInput';
import { Button } from '../components/Button';
import { BackButton } from '../components/BackButton';
import { INPUT_PLACEHOLDER_COLOR, INPUT_SELECTION_COLOR, INPUT_CURSOR_COLOR, INPUT_TEXT_COLOR } from '../components/inputTheme';

type Step = 'perfil' | 'ingreso';

export default function OnboardingScreen() {
  const [step, setStep] = useState<Step>('perfil');
  const upsertProfile = useUpsertProfile();

  const [nombre, setNombre] = useState('');
  const [phoneCountryCode, setPhoneCountryCode] = useState(DEFAULT_COUNTRY_CODE);
  const [phoneDigits, setPhoneDigits] = useState('');
  const [profileError, setProfileError] = useState<string | null>(null);

  const nombreTrimmed = nombre.trim();
  const phoneValid = phoneDigits.length === 0 || isValidPhoneNumber(phoneCountryCode, phoneDigits);

  const handleNext = () => {
    setProfileError(null);
    if (!nombreTrimmed) {
      setProfileError('Ingresa tu nombre completo');
      return;
    }
    if (!phoneValid) {
      setProfileError('Ingresa un número de teléfono válido');
      return;
    }
    upsertProfile.mutate(
      {
        nombre: nombreTrimmed,
        telefono: phoneDigits ? formatPhoneNumber(phoneCountryCode, phoneDigits) : null,
      },
      {
        onSuccess: () => setStep('ingreso'),
        onError: (err) => setProfileError((err as Error).message),
      }
    );
  };

  // No explicit navigation on finish: app/_layout.tsx's guard watches the
  // profile query and swaps from "onboarding" to "(app)" on its own once
  // onboarding_completed flips true, the same way the auth guard reacts to
  // session changes without an imperative router call.
  const finish = () => {
    upsertProfile.mutate({ onboarding_completed: true });
  };

  if (step === 'perfil') {
    return (
      <ScrollView className="flex-1 bg-white" contentContainerClassName="p-6 pt-16">
        <Text className="text-2xl font-bold mb-2">Cuéntanos sobre ti</Text>
        <Text className="text-gray-500 mb-6">
          Estos datos nos ayudan a personalizar tu cuenta. Puedes cambiarlos después desde la pestaña Cuenta.
        </Text>

        <TextInput
          className="border border-gray-200 rounded-xl px-3 py-2 mb-3"
          style={{ color: INPUT_TEXT_COLOR }}
          placeholder="Nombre completo"
          placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
          selectionColor={INPUT_SELECTION_COLOR}
          cursorColor={INPUT_CURSOR_COLOR}
          value={nombre}
          onChangeText={setNombre}
          autoFocus
        />

        <PhoneInput
          countryCode={phoneCountryCode}
          digits={phoneDigits}
          onChangeCountryCode={setPhoneCountryCode}
          onChangeDigits={setPhoneDigits}
        />

        {profileError && <Text className="text-danger mb-2 mt-1">{profileError}</Text>}

        <Button
          title="Siguiente"
          onPress={handleNext}
          loading={upsertProfile.isPending}
          disabled={upsertProfile.isPending || !nombreTrimmed}
        />
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1 }} className="bg-white">
      <BackButton onPress={() => setStep('perfil')} />
      <ScrollView contentContainerClassName="p-6 pt-24">
        <Text className="text-2xl font-bold mb-2">¿Cuál es tu ingreso mensual?</Text>
        <Text className="text-gray-500 mb-6">
          Configura tu sueldo u otro ingreso recurrente para que se registre automáticamente cada mes. Puedes
          cambiarlo después desde la pestaña Cuenta.
        </Text>

        <RecurringIncomeForm initialValue={null} onSaved={finish} />

        <Button title="Ahora no" variant="ghost" onPress={finish} disabled={upsertProfile.isPending} />
      </ScrollView>
    </View>
  );
}
