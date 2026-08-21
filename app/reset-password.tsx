import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { requestPasswordReset, translateAuthError, verifyPasswordRecoveryOtp } from '../features/auth/hooks';
import { OtpInput } from '../components/OtpInput';
import { Button } from '../components/Button';
import { PressableScale } from '../components/PressableScale';
import { BackButton } from '../components/BackButton';
import { theme } from '../lib/theme';

const RESEND_SECONDS = 60;
const OTP_LENGTH = 6;

export default function ResetPasswordScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const router = useRouter();

  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [resendSeconds, setResendSeconds] = useState(RESEND_SECONDS);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setResendSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleVerify = async () => {
    if (otp.length !== OTP_LENGTH || verifying) return;
    setVerifying(true);
    setError(null);
    try {
      await verifyPasswordRecoveryOtp(email, otp);
      // No manual navigation on success: RootNavigator's Stack.Protected
      // guard reacts to isPasswordRecovery automatically (app/_layout.tsx).
    } catch (err) {
      setError(translateAuthError(err));
      setOtp('');
    } finally {
      setVerifying(false);
    }
  };

  // Auto-submit the moment the 6th digit lands, same convention as verify-otp.tsx.
  useEffect(() => {
    if (otp.length === OTP_LENGTH) handleVerify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  const handleResend = async () => {
    if (resendSeconds > 0 || resending) return;
    setResending(true);
    setError(null);
    setResendMessage(null);
    try {
      // supabase.auth.resend() no soporta type: 'recovery' (solo signup /
      // email_change / sms / phone_change) -- reenviar un código de
      // recuperación es simplemente pedir uno nuevo.
      await requestPasswordReset(email);
      setResendSeconds(RESEND_SECONDS);
      setResendMessage('Código reenviado. Revisa tu correo.');
    } catch (err) {
      setError(translateAuthError(err));
    } finally {
      setResending(false);
    }
  };

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
        <Text className="text-2xl font-bold mb-1 text-center">Ingresa el código de 6 dígitos</Text>
        <Text className="text-gray-500 mb-8 text-center">
          Enviamos un código de recuperación a tu correo {email}
        </Text>

        <OtpInput length={OTP_LENGTH} value={otp} onChange={setOtp} autoFocus disabled={verifying} />

        {verifying && (
          <View className="flex-row items-center justify-center mt-4">
            <ActivityIndicator size="small" color={theme.brand} />
            <Text className="text-gray-500 ml-2">Validando código...</Text>
          </View>
        )}

        {error && <Text className="text-danger text-center mt-4">{error}</Text>}
        {resendMessage && !error && <Text className="text-income text-center mt-4">{resendMessage}</Text>}

        <View className="mt-6">
          <Button
            title="Continuar"
            onPress={handleVerify}
            loading={verifying}
            disabled={verifying || otp.length !== OTP_LENGTH}
          />
        </View>

        <PressableScale
          onPress={handleResend}
          disabled={resendSeconds > 0 || resending}
          className="mt-2 py-2"
          accessibilityRole="button"
          accessibilityLabel="Reenviar código"
        >
          <Text className={`text-center ${resendSeconds > 0 ? 'text-gray-400' : 'text-brand'}`}>
            {resendSeconds > 0
              ? `Reenviar código (${resendSeconds}s)`
              : resending
                ? 'Reenviando...'
                : 'Reenviar código'}
          </Text>
        </PressableScale>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
