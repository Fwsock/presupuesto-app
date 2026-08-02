import { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, View, Alert } from 'react-native';
import { useSession, updateEmail, updatePassword } from '../../features/auth/hooks';
import { useProfile, useUpsertProfile } from '../../features/profile/hooks';
import { useRecurringIncome, useDeleteRecurringIncome } from '../../features/income/hooks';
import { RecurringIncomeForm } from '../../components/RecurringIncomeForm';
import { Button } from '../../components/Button';
import { ErrorBanner } from '../../components/ErrorBanner';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-6">
      <Text className="text-base font-semibold mb-2">{title}</Text>
      {children}
    </View>
  );
}

export default function CuentaScreen() {
  const { session } = useSession();
  const { data: profile } = useProfile();
  const upsertProfile = useUpsertProfile();
  const { data: recurringIncome } = useRecurringIncome();
  const deleteRecurringIncome = useDeleteRecurringIncome();

  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);

  useEffect(() => {
    setNombre(profile?.nombre ?? '');
    setTelefono(profile?.telefono ?? '');
  }, [profile]);

  const saveProfile = () => {
    setProfileError(null);
    setProfileSaved(false);
    upsertProfile.mutate(
      { nombre: nombre.trim() || null, telefono: telefono.trim() || null },
      {
        onSuccess: () => setProfileSaved(true),
        onError: (err) => setProfileError((err as Error).message),
      }
    );
  };

  const [newEmail, setNewEmail] = useState('');
  const [emailPending, setEmailPending] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);

  const changeEmail = async () => {
    if (!newEmail) return;
    setEmailError(null);
    setEmailMessage(null);
    setEmailPending(true);
    try {
      await updateEmail(newEmail.trim());
      setEmailMessage('Revisa tu correo para confirmar el cambio.');
      setNewEmail('');
    } catch (err) {
      setEmailError((err as Error).message);
    } finally {
      setEmailPending(false);
    }
  };

  const [newPassword, setNewPassword] = useState('');
  const [passwordPending, setPasswordPending] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  const changePassword = async () => {
    if (newPassword.length < 6) {
      setPasswordError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setPasswordError(null);
    setPasswordMessage(null);
    setPasswordPending(true);
    try {
      await updatePassword(newPassword);
      setPasswordMessage('Contraseña actualizada.');
      setNewPassword('');
    } catch (err) {
      setPasswordError((err as Error).message);
    } finally {
      setPasswordPending(false);
    }
  };

  const confirmDeleteIncome = () => {
    if (!recurringIncome) return;
    Alert.alert(
      'Eliminar ingreso recurrente',
      `¿Eliminar "${recurringIncome.concepto}"? Ya no se generará automáticamente.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => deleteRecurringIncome.mutate(recurringIncome.id) },
      ]
    );
  };

  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="p-4">
      <Section title="Perfil">
        <TextInput
          className="border border-gray-300 rounded-md px-3 py-2 mb-2"
          placeholder="Nombre"
          value={nombre}
          onChangeText={setNombre}
        />
        <TextInput
          className="border border-gray-300 rounded-md px-3 py-2 mb-2"
          placeholder="Teléfono"
          keyboardType="phone-pad"
          value={telefono}
          onChangeText={setTelefono}
        />
        {profileError && (
          <ErrorBanner message={profileError} onRetry={() => setProfileError(null)} actionLabel="Descartar" />
        )}
        {profileSaved && <Text className="text-green-600 mb-2">Guardado.</Text>}
        <Button title="Guardar" onPress={saveProfile} loading={upsertProfile.isPending} disabled={upsertProfile.isPending} />
      </Section>

      <Section title="Correo electrónico">
        <Text className="text-gray-500 mb-2">Actual: {session?.user.email}</Text>
        <TextInput
          className="border border-gray-300 rounded-md px-3 py-2 mb-2"
          placeholder="Nuevo correo"
          autoCapitalize="none"
          keyboardType="email-address"
          value={newEmail}
          onChangeText={setNewEmail}
        />
        {emailError && <ErrorBanner message={emailError} onRetry={() => setEmailError(null)} actionLabel="Descartar" />}
        {emailMessage && <Text className="text-green-600 mb-2">{emailMessage}</Text>}
        <Button title="Cambiar correo" onPress={changeEmail} loading={emailPending} disabled={emailPending || !newEmail} />
      </Section>

      <Section title="Contraseña">
        <TextInput
          className="border border-gray-300 rounded-md px-3 py-2 mb-2"
          placeholder="Nueva contraseña"
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
        />
        {passwordError && (
          <ErrorBanner message={passwordError} onRetry={() => setPasswordError(null)} actionLabel="Descartar" />
        )}
        {passwordMessage && <Text className="text-green-600 mb-2">{passwordMessage}</Text>}
        <Button
          title="Cambiar contraseña"
          onPress={changePassword}
          loading={passwordPending}
          disabled={passwordPending || !newPassword}
        />
      </Section>

      <Section title="Ingreso mensual recurrente">
        <RecurringIncomeForm initialValue={recurringIncome ?? null} />
        {recurringIncome && (
          <Button
            title="Eliminar ingreso recurrente"
            variant="ghost"
            onPress={confirmDeleteIncome}
            disabled={deleteRecurringIncome.isPending}
          />
        )}
      </Section>
    </ScrollView>
  );
}
