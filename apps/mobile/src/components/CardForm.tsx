import { formatAmountInput, normalizeWord } from '@mangos/core';
import { StyleSheet, Text, View } from 'react-native';
import {
  BANK_SUGGESTIONS,
  NETWORK_OPTIONS,
  formatExpiry,
  type CardFormErrors,
  type CardFormValue,
} from '../lib/cardForm';
import { type } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { Chip } from './Chip';
import { Segmented } from './Segmented';
import { TextField } from './TextField';

interface Props {
  value: CardFormValue;
  onChange: (value: CardFormValue) => void;
  errors: CardFormErrors | null;
}

/** Formulario de tarjeta de crédito: el mismo en la bienvenida y en "Sumar tarjeta". */
export function CardForm({ value, onChange, errors }: Props) {
  const { colors } = useTheme();
  const set = <K extends keyof CardFormValue>(key: K, v: CardFormValue[K]) => onChange({ ...value, [key]: v });

  const query = normalizeWord(value.bank.trim());
  const suggestions = query
    ? BANK_SUGGESTIONS.filter((b) => normalizeWord(b).includes(query) && b !== value.bank).slice(0, 4)
    : [];

  return (
    <View style={styles.form}>
      <TextField
        label="Banco o billetera"
        value={value.bank}
        onChangeText={(t) => set('bank', t)}
        error={errors?.bank}
        placeholder="ej. Santander"
        autoCapitalize="words"
      />
      {suggestions.length ? (
        <View style={styles.chips}>
          {suggestions.map((b) => (
            <Chip key={b} label={b} onPress={() => set('bank', b)} />
          ))}
        </View>
      ) : null}
      <TextField
        label="Nombre"
        value={value.name}
        onChangeText={(t) => set('name', t)}
        error={errors?.name}
        placeholder="ej. Visa Santander"
        autoCapitalize="words"
      />
      <View style={styles.field}>
        <Text style={[type.caption, { color: errors?.network ? colors.error : colors.textMuted }]}>Red</Text>
        <Segmented options={NETWORK_OPTIONS} value={value.network} onChange={(n) => set('network', n)} accessibilityLabel="Red" />
        {errors?.network ? <Text style={[type.caption, { color: colors.error }]}>{errors.network}</Text> : null}
      </View>
      <View style={styles.row}>
        <View style={styles.cell}>
          <TextField
            label="Últimos 4 números"
            value={value.last4}
            onChangeText={(t) => set('last4', t.replace(/\D/g, '').slice(0, 4))}
            error={errors?.last4}
            mono
            keyboardType="number-pad"
            maxLength={4}
            placeholder="0763"
          />
        </View>
        <View style={styles.cell}>
          <TextField
            label="Vencimiento (MM/AA)"
            value={value.expiry}
            onChangeText={(t) => set('expiry', formatExpiry(t))}
            error={errors?.expiry}
            mono
            keyboardType="number-pad"
            maxLength={5}
            placeholder="07/30"
          />
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.cell}>
          <TextField
            label="Día de cierre"
            value={value.closeDay}
            onChangeText={(t) => set('closeDay', t.replace(/\D/g, '').slice(0, 2))}
            error={errors?.closeDay}
            mono
            keyboardType="number-pad"
            placeholder="24"
          />
        </View>
        <View style={styles.cell}>
          <TextField
            label="Día de vencimiento"
            value={value.dueDay}
            onChangeText={(t) => set('dueDay', t.replace(/\D/g, '').slice(0, 2))}
            error={errors?.dueDay}
            mono
            keyboardType="number-pad"
            placeholder="6"
          />
        </View>
      </View>
      <Text style={[type.caption, { color: colors.textMuted }]}>
        Los encontrás en tu último resumen. Si el vencimiento es un día menor al de cierre, se toma el mes siguiente.
      </Text>
      <TextField
        label="Límite de compra (pesos, opcional)"
        value={value.limit}
        onChangeText={(t) => set('limit', formatAmountInput(t).text)}
        mono
        keyboardType="decimal-pad"
        placeholder="2.000.000"
      />
      <Text style={[type.caption, { color: colors.textMuted }]}>
        Solo guardamos los últimos 4 números, nunca la tarjeta completa.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  field: { gap: 5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  row: { flexDirection: 'row', gap: 12 },
  cell: { flex: 1 },
});
