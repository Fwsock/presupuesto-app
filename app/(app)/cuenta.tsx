import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useSession, signOut, updateEmail, updatePassword } from '../../features/auth/hooks';
import { translateAuthError } from '../../features/auth/errors';
import { getPasswordStrength } from '../../features/auth/passwordStrength';
import { useProfile, useUpsertProfile } from '../../features/profile/hooks';
import { useRecurringIncome, useDeleteRecurringIncome } from '../../features/income/hooks';
import { getInitials } from '../../features/profile/initials';
import { parsePhoneNumber, formatPhoneNumber } from '../../features/shared/countries';
import { RecurringIncomeForm } from '../../components/RecurringIncomeForm';
import { FullScreenFormModal } from '../../components/FullScreenFormModal';
import { PhoneInput } from '../../components/PhoneInput';
import { AuthTextInput } from '../../components/AuthTextInput';
import { PasswordStrengthMeter } from '../../components/PasswordStrengthMeter';
import { Button } from '../../components/Button';
import { ErrorBanner } from '../../components/ErrorBanner';
import { PressableScale } from '../../components/PressableScale';
import { useConfirmDialog } from '../../components/ConfirmDialog';
import { FadeTabScreen } from '../../components/FadeTabScreen';

type AccountSection = 'personal' | 'seguridad' | 'ingreso' | 'terminos' | 'ayuda' | null;

const FAQ_ITEMS: { question: string; answer: string }[] = [
  {
    question: '¿Cómo registro un movimiento nuevo?',
    answer:
      'Toca el botón "+" central de la barra inferior desde cualquier pantalla, o el "+" dentro de Movimientos. Completa el concepto, monto, tipo (ingreso o gasto) y categoría.',
  },
  {
    question: '¿Qué diferencia hay entre ingreso fijo y variable?',
    answer:
      'Un ingreso "Fijo" se pregunta una sola vez y se repite automáticamente cada mes con el mismo monto. Un ingreso "Variable" te pregunta el monto cada vez que entras a un mes nuevo, ya que puede cambiar.',
  },
  {
    question: '¿Puedo eliminar una categoría que ya tiene movimientos?',
    answer:
      'No directamente: primero debes reasignar o eliminar sus movimientos. Si intentas eliminar una categoría con movimientos asociados, la app te avisa en vez de borrarla.',
  },
  {
    question: '¿Cómo cambio mi correo o contraseña?',
    answer: 'Ve a Cuenta → Seguridad. Ahí puedes actualizar tu correo (se confirma por email) y tu contraseña.',
  },
  {
    question: '¿Mis datos están seguros?',
    answer:
      'Tus datos se almacenan de forma aislada por usuario: nadie más puede ver tus movimientos, categorías ni tu información personal.',
  },
];

function AccountRow({
  icon,
  label,
  onPress,
  danger = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const color = danger ? '#dc2626' : '#374151';
  return (
    <PressableScale
      onPress={onPress}
      className="flex-row items-center px-4 py-4 border-b border-gray-100"
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={20} color={color} style={{ marginRight: 12 }} />
      <Text className="flex-1 text-base" style={danger ? { color } : undefined}>
        {label}
      </Text>
      {!danger && <Ionicons name="chevron-forward" size={18} color="#9ca3af" />}
    </PressableScale>
  );
}

export default function CuentaScreen() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const upsertProfile = useUpsertProfile();
  const { data: recurringIncome } = useRecurringIncome();
  const deleteRecurringIncome = useDeleteRecurringIncome();
  const { confirm, element: confirmDialog } = useConfirmDialog();

  const [openSection, setOpenSection] = useState<AccountSection>(null);

  const [nombre, setNombre] = useState('');
  const [phoneCountryCode, setPhoneCountryCode] = useState('CL');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);

  useEffect(() => {
    setNombre(profile?.nombre ?? '');
    const parsed = parsePhoneNumber(profile?.telefono);
    setPhoneCountryCode(parsed.countryCode);
    setPhoneDigits(parsed.digits);
  }, [profile]);

  // Each time a section is opened, clear out whatever success/error feedback
  // was left over from a previous session with that (or another) section, and
  // re-sync the profile fields from the last saved value — otherwise a closed
  // and reopened section still shows the previous "Guardado."/error message,
  // or unsaved/abandoned edits to nombre/teléfono.
  useEffect(() => {
    if (openSection === null) return;
    setProfileError(null);
    setProfileSaved(false);
    setSecurityError(null);
    setSecurityMessage(null);
    setNombre(profile?.nombre ?? '');
    const parsed = parsePhoneNumber(profile?.telefono);
    setPhoneCountryCode(parsed.countryCode);
    setPhoneDigits(parsed.digits);
  }, [openSection]);

  const saveProfile = () => {
    setProfileError(null);
    setProfileSaved(false);
    upsertProfile.mutate(
      {
        nombre: nombre.trim() || null,
        telefono: phoneDigits ? formatPhoneNumber(phoneCountryCode, phoneDigits) : null,
      },
      {
        onSuccess: () => setProfileSaved(true),
        onError: (err) => setProfileError((err as Error).message),
      }
    );
  };

  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [securityPending, setSecurityPending] = useState(false);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [securityMessage, setSecurityMessage] = useState<string | null>(null);

  const guardarCambiosSeguridad = async () => {
    const emailTrimmed = newEmail.trim();
    const wantsEmailChange = emailTrimmed.length > 0;
    const wantsPasswordChange = newPassword.length > 0;
    if (!wantsEmailChange && !wantsPasswordChange) return;

    if (wantsPasswordChange && getPasswordStrength(newPassword).score !== 4) {
      setSecurityError('La contraseña debe tener al menos 8 caracteres, una mayúscula, un número y un símbolo');
      setSecurityMessage(null);
      return;
    }
    if (wantsPasswordChange && newPassword !== newPasswordConfirm) {
      setSecurityError('Las contraseñas no coinciden');
      setSecurityMessage(null);
      return;
    }

    setSecurityError(null);
    setSecurityMessage(null);
    setSecurityPending(true);
    try {
      const results = await Promise.allSettled([
        wantsEmailChange ? updateEmail(emailTrimmed) : Promise.resolve(undefined),
        wantsPasswordChange ? updatePassword(newPassword) : Promise.resolve(undefined),
      ]);
      const [emailResult, passwordResult] = results;

      const messages: string[] = [];
      const errors: string[] = [];

      if (wantsEmailChange) {
        if (emailResult.status === 'fulfilled') {
          messages.push('Revisa tu correo para confirmar el cambio.');
          setNewEmail('');
        } else {
          errors.push(translateAuthError(emailResult.reason));
        }
      }
      if (wantsPasswordChange) {
        if (passwordResult.status === 'fulfilled') {
          messages.push('Contraseña actualizada.');
          setNewPassword('');
          setNewPasswordConfirm('');
        } else {
          errors.push(translateAuthError(passwordResult.reason));
        }
      }

      if (messages.length > 0) setSecurityMessage(messages.join(' '));
      if (errors.length > 0) setSecurityError(errors.join(' '));
    } finally {
      setSecurityPending(false);
    }
  };

  const confirmDeleteIncome = () => {
    if (!recurringIncome) return;
    confirm({
      title: 'Eliminar ingreso recurrente',
      message: `¿Eliminar "${recurringIncome.concepto}"? Ya no se generará automáticamente.`,
      actions: [
        { label: 'Cancelar', variant: 'cancel' },
        { label: 'Eliminar', variant: 'destructive', onPress: () => deleteRecurringIncome.mutate(recurringIncome.id) },
      ],
    });
  };

  const confirmSignOut = () => {
    confirm({
      title: 'Cerrar sesión',
      message: '¿Estás seguro de que deseas cerrar sesión?',
      icon: 'log-out-outline',
      actions: [
        { label: 'Cancelar', variant: 'cancel' },
        {
          label: 'Cerrar sesión',
          variant: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              // Drop every cached row so a later login on this device can't
              // read the previous session's data. The auth gate in
              // app/_layout.tsx redirects to /login on its own once the
              // session clears.
              queryClient.clear();
            } catch (err) {
              confirm({
                title: 'No se pudo cerrar sesión',
                message: translateAuthError(err),
                icon: 'alert-circle-outline',
                actions: [{ label: 'Entendido', variant: 'default' }],
              });
            }
          },
        },
      ],
    });
  };

  const displayName = profile?.nombre?.trim() || session?.user.email || 'Usuario';

  return (
    <FadeTabScreen>
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
        <AccountRow icon="document-text-outline" label="Términos y Condiciones" onPress={() => setOpenSection('terminos')} />
        <AccountRow icon="help-circle-outline" label="Ayuda / Preguntas Frecuentes" onPress={() => setOpenSection('ayuda')} />
        <AccountRow icon="log-out-outline" label="Cerrar sesión" onPress={confirmSignOut} danger />
      </View>

      <FullScreenFormModal
        visible={openSection === 'personal'}
        title="Información personal"
        onClose={() => setOpenSection(null)}
      >
        <Text className="text-gray-500 mb-3">
          Ingresa tu apodo y número de contacto para actualizar tu perfil.
        </Text>
        <TextInput
          className="border border-gray-300 rounded-md px-3 py-2 mb-2"
          placeholder="Nombre"
          value={nombre}
          onChangeText={setNombre}
        />
        <PhoneInput
          countryCode={phoneCountryCode}
          digits={phoneDigits}
          onChangeCountryCode={setPhoneCountryCode}
          onChangeDigits={setPhoneDigits}
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
          className="border border-gray-300 rounded-md px-3 py-2 mb-4"
          placeholder="Nuevo correo"
          autoCapitalize="none"
          keyboardType="email-address"
          value={newEmail}
          onChangeText={setNewEmail}
        />

        <Text className="text-base font-semibold mb-2">Contraseña</Text>
        <AuthTextInput
          icon="lock-closed-outline"
          placeholder="Nueva contraseña"
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
        />
        <PasswordStrengthMeter password={newPassword} />
        <AuthTextInput
          icon="lock-closed-outline"
          placeholder="Confirmar nueva contraseña"
          secureTextEntry
          value={newPasswordConfirm}
          onChangeText={setNewPasswordConfirm}
        />

        {securityError && (
          <ErrorBanner message={securityError} onRetry={() => setSecurityError(null)} actionLabel="Descartar" />
        )}
        {securityMessage && <Text className="text-green-600 mb-3">{securityMessage}</Text>}

        <Button
          title="Guardar cambios"
          onPress={guardarCambiosSeguridad}
          loading={securityPending}
          disabled={securityPending || (!newEmail.trim() && !newPassword)}
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

      <FullScreenFormModal
        visible={openSection === 'terminos'}
        title="Términos y Condiciones"
        onClose={() => setOpenSection(null)}
      >
        {/* Placeholder copy — reemplazar con el texto legal real de la app. */}
        <Text className="text-gray-500 text-xs mb-3">Última actualización: agosto de 2026</Text>
        <Text className="mb-3">
          Bienvenido a Presupuesto. Al usar esta aplicación, aceptas los presentes Términos y Condiciones. Este es un
          texto de ejemplo pensado para ser reemplazado con el contenido legal definitivo de la aplicación.
        </Text>
        <Text className="font-semibold mb-1">1. Uso de la aplicación</Text>
        <Text className="text-gray-700 mb-3">
          Presupuesto está pensada para el registro y seguimiento personal de tus ingresos y gastos. Eres responsable
          de la exactitud de la información que ingresas.
        </Text>
        <Text className="font-semibold mb-1">2. Tus datos</Text>
        <Text className="text-gray-700 mb-3">
          Tus movimientos, categorías y datos de perfil son privados y están aislados de los de otros usuarios.
        </Text>
        <Text className="font-semibold mb-1">3. Cambios en estos términos</Text>
        <Text className="text-gray-700 mb-3">
          Estos términos pueden actualizarse en el futuro. Te recomendamos revisarlos periódicamente.
        </Text>
      </FullScreenFormModal>

      <FullScreenFormModal
        visible={openSection === 'ayuda'}
        title="Ayuda / Preguntas Frecuentes"
        onClose={() => setOpenSection(null)}
      >
        {FAQ_ITEMS.map((item, index) => (
          <View key={item.question} className={index < FAQ_ITEMS.length - 1 ? 'mb-4' : ''}>
            <Text className="font-semibold mb-1">{item.question}</Text>
            <Text className="text-gray-700">{item.answer}</Text>
          </View>
        ))}
      </FullScreenFormModal>

      {confirmDialog}
    </View>
    </FadeTabScreen>
  );
}
