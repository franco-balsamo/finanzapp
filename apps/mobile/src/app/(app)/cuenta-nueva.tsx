import { formatAmountInput } from '@mangos/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Segmented } from '../../components/Segmented';
import { Sheet } from '../../components/Sheet';
import { SheetFooter } from '../../components/SheetFooter';
import { TextField } from '../../components/TextField';
import {
  ACCOUNT_TYPE_OPTIONS,
  EMPTY_ACCOUNT,
  createAccount,
  validateAccount,
  type AccountFormErrors,
} from '../../lib/accountForm';
import { type } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

const CURRENCY_OPTIONS = [
  { value: 'ARS', label: 'Pesos' },
  { value: 'USD', label: 'Dólares' },
] as const;

export default function NewAccount() {
  const { colors } = useTheme();
  const [value, setValue] = useState(EMPTY_ACCOUNT);
  const [errors, setErrors] = useState<AccountFormErrors | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    const found = validateAccount(value);
    setErrors(found);
    if (found) return;
    setSaving(true);
    setSaveError(null);
    try {
      await createAccount(value);
      router.back();
    } catch {
      setSaveError('No pudimos guardar la cuenta. Probá de nuevo.');
      setSaving(false);
    }
  }

  return (
    <Sheet
      title="Sumar cuenta"
      onClose={() => router.back()}
      footer={<SheetFooter actionTitle="Agregar" onAction={save} onCancel={() => router.back()} loading={saving} />}
    >
      <TextField
        label="Nombre"
        value={value.name}
        onChangeText={(name) => setValue({ ...value, name })}
        error={errors?.name}
        placeholder="ej. Mercado Pago"
        autoCapitalize="words"
      />
      <View style={styles.field}>
        <Text style={[type.caption, { color: errors?.type ? colors.error : colors.textMuted }]}>Tipo</Text>
        <Segmented
          options={ACCOUNT_TYPE_OPTIONS}
          value={value.type}
          onChange={(t) => setValue({ ...value, type: t })}
          accessibilityLabel="Tipo de cuenta"
        />
        {errors?.type ? <Text style={[type.caption, { color: colors.error }]}>{errors.type}</Text> : null}
      </View>
      <View style={styles.field}>
        <Text style={[type.caption, { color: colors.textMuted }]}>Moneda</Text>
        <Segmented
          options={CURRENCY_OPTIONS}
          value={value.currency}
          onChange={(currency) => setValue({ ...value, currency })}
          accessibilityLabel="Moneda"
        />
      </View>
      <TextField
        label={value.currency === 'ARS' ? 'Saldo de hoy ($)' : 'Saldo de hoy (US$)'}
        value={value.balance}
        onChangeText={(t) => setValue({ ...value, balance: formatAmountInput(t).text })}
        mono
        keyboardType="decimal-pad"
        placeholder="0"
      />
      <Text style={[type.caption, { color: colors.textMuted }]}>Si no lo sabés, dejalo en 0 y lo ajustás después.</Text>
      {saveError ? <Text style={[type.caption, { color: colors.error }]}>{saveError}</Text> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  field: { gap: 5 },
});
