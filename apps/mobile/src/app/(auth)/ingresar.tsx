import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { authErrorMessage } from '../../lib/authErrors';
import { supabase } from '../../lib/supabase';
import { type } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignIn() {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function send() {
    const address = email.trim().toLowerCase();
    if (!EMAIL.test(address)) {
      setError('Revisá el mail.');
      return;
    }
    setError(null);
    setSending(true);
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: address,
      options: { shouldCreateUser: true },
    });
    setSending(false);
    if (otpError) {
      setError(authErrorMessage(otpError));
      return;
    }
    router.push({ pathname: '/codigo', params: { email: address } });
  }

  return (
    <Screen>
      <Text style={[type.displayOnb, { color: colors.text, marginTop: 48 }]} accessibilityRole="header">
        Entrá con tu mail
      </Text>
      <Text style={[type.body, { color: colors.textMuted }]}>Te mandamos un código de 6 números.</Text>
      <TextField
        label="Mail"
        value={email}
        onChangeText={setEmail}
        error={error}
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={send}
        placeholder="vos@mail.com"
      />
      <Button title="Mandame el código" variant="primary" onPress={send} loading={sending} />
    </Screen>
  );
}
