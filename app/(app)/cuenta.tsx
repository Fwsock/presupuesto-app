import { memo, useEffect, useState } from 'react';
import { Image, Platform, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useSession, signOut, updateEmail, updatePassword } from '../../features/auth/hooks';
import { translateAuthError } from '../../features/auth/errors';
import { getPasswordStrength } from '../../features/auth/passwordStrength';
import { useProfile, useUpsertProfile } from '../../features/profile/hooks';
import { useRecurringIncome, useDeleteRecurringIncome } from '../../features/income/hooks';
import { getInitials } from '../../features/profile/initials';
import { parsePhoneNumber, formatPhoneNumber } from '../../features/shared/countries';
import { useExperimentalScanEnabled, useSetExperimentalScanEnabled } from '../../features/shared/experimentalFeatures';
import { RecurringIncomeForm } from '../../components/RecurringIncomeForm';
import { FeedbackForm } from '../../components/FeedbackForm';
import { FullScreenFormModal } from '../../components/FullScreenFormModal';
import { PhoneInput } from '../../components/PhoneInput';
import { AuthTextInput } from '../../components/AuthTextInput';
import { PasswordStrengthMeter } from '../../components/PasswordStrengthMeter';
import { Button } from '../../components/Button';
import { ErrorBanner } from '../../components/ErrorBanner';
import { PressableScale } from '../../components/PressableScale';
import { AnimatedSwitch } from '../../components/AnimatedSwitch';
import { InstallQRCode } from '../../components/InstallQRCode';
import { useConfirmDialog } from '../../components/ConfirmDialog';
import { Accordion } from '../../components/Accordion';
import { INPUT_PLACEHOLDER_COLOR, INPUT_SELECTION_COLOR, INPUT_CURSOR_COLOR, INPUT_TEXT_COLOR } from '../../components/inputTheme';
import { theme } from '../../lib/theme';

type AccountSection =
  | 'personal'
  | 'seguridad'
  | 'ingreso'
  | 'experimental'
  | 'feedback'
  | 'terminos'
  | 'ayuda'
  | 'acerca'
  | 'privacidad'
  | 'soporte'
  | null;

// Keep in sync with app.json's expo.version -- there's no live wiring to it
// (expo-constants would work at runtime, but a static string matches this
// project's existing convention of plain example copy for legal/about
// sections, see the Términos y Condiciones section below).
const APP_VERSION = '1.0.0';

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
  {
    question: '¿Cómo funcionan las notificaciones pendientes?',
    answer:
      'Cada boleta escaneada o notificación bancaria capturada automáticamente llega primero a la bandeja de pendientes (el ícono de sobre arriba a la derecha), no directamente a tus movimientos. Ahí revisas los datos detectados y confirmas o descartas cada una antes de que se registre.',
  },
  {
    question: '¿Qué tipo de boletas o comprobantes puedo escanear o subir desde la galería?',
    answer:
      'Boletas de supermercado y retail, comprobantes o capturas de transferencias, y vales de pago. La app lee el texto automáticamente para sugerir comercio, monto y fecha (ignorando puntos o datos de fidelización), y siempre puedes corregir cualquier campo antes de confirmar.',
  },
  {
    question: '¿Qué diferencia hay entre una categoría fija y una categoría normal?',
    answer:
      'Una categoría "Fija" genera automáticamente su movimiento cada mes (como un arriendo o una suscripción), sin que tengas que crearlo a mano. Una categoría normal no genera nada por sí sola: solo agrupa los movimientos que le asignes manualmente.',
  },
  {
    question: '¿Cómo puedo crear y personalizar mis categorías?',
    answer:
      'Ve a la pestaña Categorías y toca "+ Nueva categoría". Elige un nombre, un ícono de la lista disponible, y si quieres márcala como "Fija" para que se repita cada mes automáticamente. Puedes editar o eliminar cualquier categoría propia después desde esa misma pantalla.',
  },
  {
    question: '¿Cómo funciona la lectura automática de notificaciones bancarias?',
    answer:
      'Si activas el acceso a notificaciones (Cuenta → el aviso en la bandeja de pendientes, o ajustes de Android), la app detecta avisos de tu banco apenas llegan, extrae el monto y el comercio, y los deja listos en la bandeja de pendientes para que los confirmes. Es exclusivo de Android y nunca crea un movimiento sin tu confirmación.',
  },
];

function AccountRow({
  icon,
  label,
  onPress,
  danger = false,
  isLast = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
  isLast?: boolean;
}) {
  const color = danger ? theme.danger : '#374151';
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.965}
      activeOpacity={0.7}
      spring
      haptics
      className={`flex-row items-center px-4 py-4 ${isLast ? '' : 'border-b border-border'}`}
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

/**
 * Compact navigable row for the "Acerca de" screen -- unlike AccountRow
 * (used by the main account list, which supplies its own px-4), this one
 * assumes it's already inside a FullScreenFormModal body that has its own
 * horizontal padding, so it doesn't add a second layer of it.
 */
function AboutLinkRow({ label, onPress, isLast = false }: { label: string; onPress: () => void; isLast?: boolean }) {
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.965}
      activeOpacity={0.7}
      spring
      haptics
      className={`flex-row items-center justify-between py-3 ${isLast ? '' : 'border-b border-border'}`}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text className="text-base">{label}</Text>
      <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
    </PressableScale>
  );
}

function CuentaScreen() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const upsertProfile = useUpsertProfile();
  const { data: recurringIncome } = useRecurringIncome();
  const deleteRecurringIncome = useDeleteRecurringIncome();
  const { confirm, element: confirmDialog } = useConfirmDialog();
  const experimentalScanEnabled = useExperimentalScanEnabled();
  const setExperimentalScanEnabled = useSetExperimentalScanEnabled();

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

  // Turning it OFF is immediate (hides the two OCR scan entry points right
  // away, nothing risky about that). Turning it ON requires explicit
  // confirmation first -- it's the one direction that exposes a beta path.
  const toggleExperimentalScan = () => {
    if (experimentalScanEnabled) {
      setExperimentalScanEnabled.mutate(false);
      return;
    }
    confirm({
      title: 'Funcionalidad en fase beta',
      message:
        'El escaneo de boletas con cámara y la subida de comprobantes desde la galería son funciones experimentales. Pueden fallar, leer datos incorrectos, o cambiar sin aviso. ¿Quieres activarlas de todas formas?',
      icon: 'warning-outline',
      iconColor: '#F59E0B',
      actions: [
        { label: 'Cancelar', variant: 'cancel' },
        { label: 'Activar', variant: 'default', onPress: () => setExperimentalScanEnabled.mutate(true) },
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
    <View className="flex-1 bg-background">
      {/* No card here on purpose (Option B) -- sits directly on the page
          background, fluid with the top of the screen, so only the options
          list below reads as an actual "card". */}
      <View className="items-center pt-6 pb-8">
        <View className="w-20 h-20 rounded-full bg-brand items-center justify-center mb-3">
          <Text className="text-white text-2xl font-semibold">
            {getInitials(profile?.nombre, session?.user.email ?? null)}
          </Text>
        </View>
        <Text className="text-lg font-semibold text-ink">{displayName}</Text>
        {session?.user.email && <Text className="text-secondary mt-0.5">{session.user.email}</Text>}
      </View>

      <View
        className="mx-4 mt-4 bg-surface rounded-2xl border border-border overflow-hidden"
        style={{ shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 0 }}
      >
        <AccountRow icon="card-outline" label="Información personal" onPress={() => setOpenSection('personal')} />
        <AccountRow icon="lock-closed-outline" label="Seguridad" onPress={() => setOpenSection('seguridad')} />
        <AccountRow icon="repeat-outline" label="Ingreso mensual recurrente" onPress={() => setOpenSection('ingreso')} />
        {Platform.OS === 'android' && (
          <AccountRow icon="flask-outline" label="Funciones Experimentales" onPress={() => setOpenSection('experimental')} />
        )}
        <AccountRow
          icon="chatbox-ellipses-outline"
          label="Reportar un problema o sugerencia"
          onPress={() => setOpenSection('feedback')}
        />
        <AccountRow icon="help-circle-outline" label="Ayuda / Preguntas Frecuentes" onPress={() => setOpenSection('ayuda')} />
        <AccountRow icon="information-circle-outline" label="Acerca de" onPress={() => setOpenSection('acerca')} />
        <AccountRow icon="log-out-outline" label="Cerrar sesión" onPress={confirmSignOut} danger isLast />
      </View>

      <FullScreenFormModal
        visible={openSection === 'personal'}
        title="Información personal"
        onClose={() => setOpenSection(null)}
      >
        <Text className="text-secondary mb-3">
          Ingresa tu apodo y número de contacto para actualizar tu perfil.
        </Text>
        <TextInput
          className="border border-gray-200 rounded-xl px-3 py-2 mb-2"
          style={{ color: INPUT_TEXT_COLOR }}
          placeholder="Nombre"
          placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
          selectionColor={INPUT_SELECTION_COLOR}
          cursorColor={INPUT_CURSOR_COLOR}
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
        {profileSaved && <Text className="text-income mb-2">Guardado.</Text>}
        <Button title="Guardar" onPress={saveProfile} loading={upsertProfile.isPending} disabled={upsertProfile.isPending} />
      </FullScreenFormModal>

      <FullScreenFormModal visible={openSection === 'seguridad'} title="Seguridad" onClose={() => setOpenSection(null)}>
        <Text className="text-base font-semibold mb-2">Correo electrónico</Text>
        <Text className="text-secondary mb-2">Actual: {session?.user.email}</Text>
        <TextInput
          className="border border-gray-200 rounded-xl px-3 py-2 mb-4"
          style={{ color: INPUT_TEXT_COLOR }}
          placeholder="Nuevo correo"
          placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
          selectionColor={INPUT_SELECTION_COLOR}
          cursorColor={INPUT_CURSOR_COLOR}
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
        {securityMessage && <Text className="text-income mb-3">{securityMessage}</Text>}

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

      {Platform.OS === 'android' && (
        <FullScreenFormModal
          visible={openSection === 'experimental'}
          title="Funciones Experimentales"
          onClose={() => setOpenSection(null)}
        >
          <Text className="text-secondary mb-5">
            Activa o desactiva funciones en fase beta. Controla el escaneo de boletas y comprobantes por imagen
            (cámara y galería).
          </Text>

          <View className="flex-row items-center justify-between bg-gray-50 rounded-xl px-4 py-4">
            <View className="flex-1 pr-3">
              <Text className="font-semibold mb-1">Escaneo de boletas por imagen</Text>
              <Text className="text-secondary text-xs">
                Escanear con cámara y subir capturas desde la galería en la bandeja de pendientes.
              </Text>
            </View>
            <AnimatedSwitch value={experimentalScanEnabled} onValueChange={toggleExperimentalScan} />
          </View>
        </FullScreenFormModal>
      )}

      <FullScreenFormModal
        visible={openSection === 'feedback'}
        title="Reportar un problema o sugerencia"
        onClose={() => setOpenSection(null)}
      >
        <FeedbackForm />
      </FullScreenFormModal>

      <FullScreenFormModal
        visible={openSection === 'terminos'}
        title="Términos y Condiciones"
        onClose={() => setOpenSection(null)}
      >
        {/* Placeholder copy — reemplazar con el texto legal real de la app. */}
        <Text className="text-secondary text-xs mb-3">Última actualización: agosto de 2026</Text>
        <Text className="mb-3">
          Bienvenido a FinanFlow. Al usar esta aplicación, aceptas los presentes Términos y Condiciones. Este es un
          texto de ejemplo pensado para ser reemplazado con el contenido legal definitivo de la aplicación.
        </Text>
        <Text className="font-semibold mb-1">1. Uso de la aplicación</Text>
        <Text className="text-gray-700 mb-3">
          FinanFlow está pensada para el registro y seguimiento personal de tus ingresos y gastos. Eres responsable
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
        <Accordion items={FAQ_ITEMS} />
      </FullScreenFormModal>

      <FullScreenFormModal visible={openSection === 'acerca'} title="Acerca de" onClose={() => setOpenSection(null)}>
        <View className="items-center mb-5">
          <Image
            source={require('../../assets/icon.png')}
            className="w-20 h-20 rounded-2xl mb-3"
            accessibilityLabel="Ícono de FinanFlow"
          />
          <Text className="text-lg font-semibold">FinanFlow para Android</Text>
        </View>

        <View className="flex-row items-center justify-between bg-gray-50 rounded-xl px-4 py-3 mb-5">
          <View className="flex-1 pr-3">
            <Text className="text-secondary">Versión {APP_VERSION}</Text>
            <Text className="text-secondary text-xs mt-1">Copyright © 2026 FinanFlow</Text>
            {Platform.OS === 'android' && (
              <Text className="text-secondary text-xs mt-2">Escanea para instalar el APK</Text>
            )}
          </View>
          {Platform.OS === 'android' && <InstallQRCode />}
        </View>

        <AboutLinkRow label="Términos y Condiciones" onPress={() => setOpenSection('terminos')} />
        <AboutLinkRow label="Política de Privacidad" onPress={() => setOpenSection('privacidad')} />
        <AboutLinkRow label="Soporte" onPress={() => setOpenSection('soporte')} isLast />
      </FullScreenFormModal>

      <FullScreenFormModal
        visible={openSection === 'privacidad'}
        title="Política de Privacidad"
        onClose={() => setOpenSection(null)}
      >
        {/* Placeholder copy — reemplazar con el texto legal real de la app. */}
        <Text className="text-secondary text-xs mb-3">Última actualización: agosto de 2026</Text>
        <Text className="mb-3">
          En FinanFlow tu privacidad es prioritaria. Este es un texto de ejemplo pensado para ser reemplazado con la
          política de privacidad definitiva de la aplicación.
        </Text>
        <Text className="font-semibold mb-1">1. Qué datos guardamos</Text>
        <Text className="text-gray-700 mb-3">
          Tu correo, tus movimientos, categorías y la configuración de tu cuenta — nada más, y solo para que la app
          funcione para ti.
        </Text>
        <Text className="font-semibold mb-1">2. Con quién los compartimos</Text>
        <Text className="text-gray-700 mb-3">
          Con nadie. Tus datos nunca se venden ni se comparten con terceros con fines publicitarios.
        </Text>
        <Text className="font-semibold mb-1">3. Tu control sobre tus datos</Text>
        <Text className="text-gray-700 mb-3">
          Puedes editar o eliminar tu información personal y tus movimientos en cualquier momento desde la app.
        </Text>
      </FullScreenFormModal>

      <FullScreenFormModal visible={openSection === 'soporte'} title="Soporte" onClose={() => setOpenSection(null)}>
        <Text className="mb-4">¿Tienes un problema o una sugerencia? Escríbenos, con gusto te ayudamos.</Text>
        <View className="bg-gray-50 rounded-xl p-3 flex-row items-center">
          <Ionicons name="mail-outline" size={20} color="#374151" style={{ marginRight: 10 }} />
          <Text className="text-base">soporte@finanflow.app</Text>
        </View>
      </FullScreenFormModal>

      {confirmDialog}
    </View>
  );
}

export default memo(CuentaScreen);
