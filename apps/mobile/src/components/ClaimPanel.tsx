import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { authErrorMessage } from '../lib/authErrors';
import { claimPlace, type ClaimError } from '../lib/guest';
import { useSession } from '../lib/session';
import { supabase } from '../lib/supabase';
import { radius, type } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { Button } from './Button';
import { TextField } from './TextField';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_AFTER_S = 30;

const CLAIM_ERROR: Record<ClaimError, string> = {
  already_member: 'Ya sos parte de este grupo con esta cuenta.',
  taken: 'Ese lugar ya lo tomó otra persona.',
  invalid: 'Este link ya no funciona. Pedile uno nuevo a alguien del grupo.',
  failed: 'No pudimos tomar el lugar. Probá de nuevo.',
};

interface Props {
  token: string;
  memberId: string;
  memberName: string;
  groupName: string;
  onClose: () => void;
  /** Después de reclamar (o si el lugar ya no está libre): la página vuelve a traer el grupo. */
  onChanged: () => void;
}

/**
 * Reclamar un lugar en la web de invitados (W-5, D3): el mismo login por código que la app y,
 * con sesión, `claim_member`. Después, invita a instalar la app y entrar con el mismo mail.
 */
export function ClaimPanel({ token, memberId, memberName, groupName, onClose, onChanged }: Props) {
  const { colors } = useTheme();
  const { session } = useSession();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const [doneWith, setDoneWith] = useState<string | null>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  async function sendCode() {
    const address = email.trim().toLowerCase();
    if (!EMAIL.test(address)) return setError('Revisá el mail.');
    setError(null);
    setBusy(true);
    const { error: otpError } = await supabase.auth.signInWithOtp({ email: address, options: { shouldCreateUser: true } });
    setBusy(false);
    if (otpError) return setError(authErrorMessage(otpError));
    setEmail(address);
    setStep('code');
    setWait(RESEND_AFTER_S);
  }

  async function verify(token6: string) {
    setError(null);
    setBusy(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({ email, token: token6, type: 'email' });
    setBusy(false);
    if (verifyError) setError(authErrorMessage(verifyError));
    // Con la sesión iniciada, el panel pasa a "Tomar el lugar".
  }

  async function claim() {
    setError(null);
    setBusy(true);
    const failure = await claimPlace(token, memberId);
    setBusy(false);
    if (failure) {
      setError(CLAIM_ERROR[failure]);
      if (failure === 'taken') onChanged();
      return;
    }
    setDoneWith(session?.user.email ?? email);
    onChanged();
  }

  return (
    <View style={[styles.panel, { borderColor: colors.primary, backgroundColor: colors.primarySoft }]} accessibilityLiveRegion="polite">
      {doneWith ? (
        <>
          <Text style={[type.bodyStrong, { color: colors.text }]}>Ya sos {memberName} en {groupName}.</Text>
          <Text style={[type.body, { color: colors.text }]}>
            Instalá Mangos y entrá con {doneWith} para ver el grupo y cargar gastos. Los gastos que pagaste por el grupo ya
            están en tus finanzas, para que les pongas con qué los pagaste.
          </Text>
          <Button title="Listo" onPress={onClose} style={styles.start} />
        </>
      ) : session ? (
        <>
          <Text style={[type.bodyStrong, { color: colors.text }]}>¿Sos {memberName}?</Text>
          <Text style={[type.body, { color: colors.text }]}>
            Vas a tomar su lugar en {groupName} con tu cuenta {session.user.email}. Los gastos y saldos del grupo no cambian.
          </Text>
          {error ? <Text style={[type.caption, { color: colors.error }]}>{error}</Text> : null}
          <View style={styles.buttons}>
            <Button title="Cancelar" onPress={onClose} disabled={busy} />
            <Button title={`Soy ${memberName}`} variant="primary" onPress={claim} loading={busy} />
          </View>
          <Button title="Usar otro mail" variant="link" onPress={() => supabase.auth.signOut()} style={styles.start} />
        </>
      ) : step === 'email' ? (
        <>
          <Text style={[type.bodyStrong, { color: colors.text }]}>¿Sos {memberName}? Entrá con tu mail para tomar su lugar.</Text>
          <TextField
            label="Mail"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              setError(null);
            }}
            error={error}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            onSubmitEditing={sendCode}
            placeholder="vos@mail.com"
          />
          <View style={styles.buttons}>
            <Button title="Cancelar" onPress={onClose} disabled={busy} />
            <Button title="Mandame el código" variant="primary" onPress={sendCode} loading={busy} />
          </View>
        </>
      ) : (
        <>
          <Text style={[type.bodyStrong, { color: colors.text }]}>Escribí el código que te mandamos a {email}.</Text>
          <TextField
            label="Código"
            value={code}
            onChangeText={(t) => {
              const digits = t.replace(/\D/g, '').slice(0, 6);
              setCode(digits);
              if (digits.length === 6) verify(digits);
            }}
            error={error}
            mono
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="123456"
            style={{ fontSize: 24, letterSpacing: 6 }}
          />
          <View style={styles.buttons}>
            <Button title="Cambiar el mail" variant="ghost" onPress={() => setStep('email')} disabled={busy} />
            <Button
              title={wait > 0 ? `Reenviar en ${wait} s` : 'Reenviar el código'}
              onPress={sendCode}
              disabled={wait > 0 || busy}
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: radius.md, padding: 14, gap: 10, marginTop: 6 },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' },
  start: { alignSelf: 'flex-start' },
});
