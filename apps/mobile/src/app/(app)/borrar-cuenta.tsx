import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { SheetFooter } from '../../components/SheetFooter';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/Toast';
import { authErrorMessage } from '../../lib/authErrors';
import { loadGroupList } from '../../lib/groups';
import { useSession } from '../../lib/session';
import { deleteAccount, exportAccount } from '../../lib/settings';
import { supabase } from '../../lib/supabase';
import { type } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

/** Hoja "Borrar mi cuenta" (spec de Ajustes, A-6). El código del mail se pide solo si la base lo exige (D6). */
export default function DeleteAccount() {
  const { colors } = useTheme();
  const { session, settings, signOut } = useSession();
  const toast = useToast();
  const [inGroups, setInGroups] = useState(false);
  const [step, setStep] = useState<'confirm' | 'code'>('confirm');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  const userId = session?.user.id;
  const email = session?.user.email ?? '';

  // Si no se puede leer, el texto va sin la frase de grupos.
  useEffect(() => {
    if (userId) loadGroupList(userId).then((list) => setInGroups(list.groups.length > 0), () => {});
  }, [userId]);

  async function remove() {
    setBusy(true);
    try {
      if ((await deleteAccount()) === 'deleted') {
        toast('Borramos tu cuenta.');
        // Sin sesión, el layout raíz vuelve al login.
        await signOut();
        return;
      }
      const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
      if (error) throw error;
      setStep('code');
    } catch {
      toast('No se pudo borrar la cuenta. Probá de nuevo.');
    }
    setBusy(false);
  }

  async function confirm(token: string) {
    setCodeError(null);
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    if (error) {
      setCodeError(authErrorMessage(error));
      setBusy(false);
      return;
    }
    await remove();
  }

  function onCode(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (digits.length === 6) confirm(digits);
  }

  async function resend() {
    setCodeError(null);
    setCode('');
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    if (error) setCodeError(authErrorMessage(error));
  }

  async function exportData() {
    setExporting(true);
    try {
      if ((await exportAccount()) === 'unavailable') toast('No se puede compartir desde este dispositivo.');
    } catch {
      toast('No se pudo exportar. Probá de nuevo.');
    }
    setExporting(false);
  }

  const body = [type.body, { color: colors.text }];

  return (
    <Sheet
      title="¿Borrar tu cuenta?"
      onClose={() => router.back()}
      footer={
        <SheetFooter
          actionTitle={step === 'confirm' ? 'Borrar mi cuenta' : 'Confirmar y borrar'}
          actionVariant="danger"
          onAction={() => (step === 'confirm' ? remove() : confirm(code))}
          onCancel={() => router.back()}
          loading={busy}
        />
      }
    >
      {step === 'confirm' ? (
        <>
          <Text style={body}>Se borran tus cuentas, tarjetas, movimientos y ajustes. No se puede deshacer.</Text>
          {inGroups ? (
            <Text style={body}>
              En tus grupos vas a seguir apareciendo como "{settings?.name ?? 'vos'}", sin cuenta, para que los saldos de los demás no cambien.
            </Text>
          ) : null}
          {Platform.OS !== 'web' ? (
            <View style={styles.export}>
              <Text style={[type.body, { color: colors.textMuted }]}>Antes, podés exportar tus datos.</Text>
              <Button
                title={exporting ? 'Exportando…' : 'Exportar mis datos'}
                variant="link"
                onPress={exportData}
                disabled={exporting}
                style={styles.start}
              />
            </View>
          ) : null}
        </>
      ) : (
        <>
          <Text style={body}>Te mandamos un código a {email} para confirmar.</Text>
          <TextField
            label="Código"
            value={code}
            onChangeText={onCode}
            error={codeError}
            mono
            autoFocus
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="123456"
            style={[type.moneyCard, { letterSpacing: 6 }]}
          />
          {codeError ? <Button title="Mandar otro código" variant="link" onPress={resend} style={styles.start} /> : null}
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  start: { alignSelf: 'flex-start' },
  export: { gap: 2 },
});
