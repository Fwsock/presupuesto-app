import { ScrollView, Text } from 'react-native';
import { useUpsertProfile } from '../features/profile/hooks';
import { RecurringIncomeForm } from '../components/RecurringIncomeForm';
import { Button } from '../components/Button';

export default function OnboardingScreen() {
  const upsertProfile = useUpsertProfile();

  // No explicit navigation on finish: app/_layout.tsx's guard watches the
  // profile query and swaps from "onboarding" to "(app)" on its own once
  // onboarding_completed flips true, the same way the auth guard reacts to
  // session changes without an imperative router call.
  const finish = () => {
    upsertProfile.mutate({ onboarding_completed: true });
  };

  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="p-6 pt-16">
      <Text className="text-2xl font-bold mb-2">¿Cuál es tu ingreso mensual?</Text>
      <Text className="text-gray-500 mb-6">
        Configura tu sueldo u otro ingreso recurrente para que se registre automáticamente cada mes. Puedes
        cambiarlo después desde la pestaña Cuenta.
      </Text>

      <RecurringIncomeForm initialValue={null} onSaved={finish} />

      <Button title="Ahora no" variant="ghost" onPress={finish} disabled={upsertProfile.isPending} />
    </ScrollView>
  );
}
