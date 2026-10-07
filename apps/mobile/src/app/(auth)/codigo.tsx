import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { authErrorMessage } from '../../lib/authErrors';
import { supabase } from '../../lib/supabase';
import { type } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

const RESEND_AFTER_S = 60;

export default function Code() {
  const { colors } = useTheme();
  const { email = '' } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [wait, setWait] = useState(RESEND_AFTER_S);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  async function verify(token: string) {
    setError(null);
    setVerifying(true);
    // Al entrar, la sesión cambia y el layout raíz lleva a la bienvenida o a la app.
    const { error: verifyError } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    setVerifying(false);
    if (verifyError) setError(authErrorMessage(verifyError));
  }

  function onChange(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (digits.length === 6) verify(digits);
  }

  async function resend() {
    setError(null);
    setWait(RESEND_AFTER_S);
    const { error: otpError } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (otpError) setError(authErrorMessage(otpError));
  }

  return (
    <Screen>
      <Text style={[type.displayOnb, { color: colors.text, marginTop: 48 }]} accessibilityRole="header">
        Revisá tu mail
      </Text>
      <Text style={[type.body, { color: colors.textMuted }]}>Escribí el código que te mandamos a {email}.</Text>
      <TextField
        label="Código"
        value={code}
        onChangeText={onChange}
        error={error}
        mono
        autoFocus
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="123456"
        style={[type.moneyCard, { letterSpacing: 6 }]}
      />
      <Button
        title="Entrar"
        variant="primary"
        onPress={() => verify(code)}
        disabled={code.length !== 6}
        loading={verifying}
      />
      <Button
        title={wait > 0 ? `Reenviar código en ${wait} s` : 'Reenviar código'}
        variant="link"
        onPress={resend}
        disabled={wait > 0}
      />
    </Screen>
  );
}
