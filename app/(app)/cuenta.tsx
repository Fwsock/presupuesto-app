import { useEffect, useState } from 'react';
import { Text, TextInput, View, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSession, updateEmail, updatePassword } from '../../features/auth/hooks';
import { useProfile, useUpsertProfile } from '../../features/profile/hooks';
import { useRecurringIncome, useDeleteRecurringIncome } from '../../features/income/hooks';
import { getInitials } from '../../features/profile/initials';
import { RecurringIncomeForm } from '../../components/RecurringIncomeForm';
import { FullScreenFormModal } from '../../components/FullScreenFormModal';
import { Button } from '../../components/Button';
import { ErrorBanner } from '../../components/ErrorBanner';
import { PressableScale } from '../../components/PressableScale';

type AccountSection = 'personal' | 'seguridad' | 'ingreso' | null;

function AccountRow({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} className="flex-row items-center px-4 py-4 border-b border-gray-100">
      <Ionicons name={icon} size={20} color="#374151" style={{ marginRight: 12 }} />
      <Text className="flex-1 text-base">{label}</Text>
      <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
    </PressableScale>
  );
}

export default function CuentaScreen() {
  const { session } = useSession();
  const { data: profile } = useProfile();
  const upsertProfile = useUpsertProfile();
  const { data: recurringIncome } = useRecurringIncome();
  const deleteRecurringIncome = useDeleteRecurringIncome();

  const [openSection, setOpenSection] = useState<AccountSection>(null);

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

  const displayName = profile?.nombre?.trim() || session?.user.email || 'Usuario';

  return (
    <View className="flex-1 bg-white">
      <View className="items-center py-8 border-b border-gray-100">
        <View className="w-20 h-20 rounded-full bg-blue-600 items-center justify-center mb-3">
          <Text className="text-white text-2xl font-semibold">
            {getInitials(profile?.nombre, session?.user.email ?? null)}
          </Text>
        </View>
        <Text className="text-lg font-semibold">{displayName}</Text>
        {session?.user.email && <Text className="text-gray-500 mt-0.5">{session.user.email}</Text>}
      </View>

      <View className="mt-4">
        <AccountRow icon="card-outline" label="Información personal" onPress={() => setOpenSection('personal')} />
        <AccountRow icon="lock-closed-outline" label="Seguridad" onPress={() => setOpenSection('seguridad')} />
        <AccountRow icon="repeat-outline" label="Ingreso mensual recurrente" onPress={() => setOpenSection('ingreso')} />
      </View>

      <FullScreenFormModal
        visible={openSection === 'personal'}
        title="Información personal"
        onClose={() => setOpenSection(null)}
      >
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
      </FullScreenFormModal>

      <FullScreenFormModal visible={openSection === 'seguridad'} title="Seguridad" onClose={() => setOpenSection(null)}>
        <Text className="text-base font-semibold mb-2">Correo electrónico</Text>
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

        <Text className="text-base font-semibold mb-2 mt-6">Contraseña</Text>
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
      </FullScreenFormModal>

      <FullScreenFormModal
        visible={openSection === 'ingreso'}
        title="Ingreso mensual recurrente"
        onClose={() => setOpenSection(null)}
      >
        <RecurringIncomeForm initialValue={recurringIncome ?? null} />
        {recurringIncome && (
          <Button
            title="Eliminar ingreso recurrente"
            variant="ghost"
            onPress={confirmDeleteIncome}
            disabled={deleteRecurringIncome.isPending}
          />
        )}
      </FullScreenFormModal>
    </View>
  );
}
