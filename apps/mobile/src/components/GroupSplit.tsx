import { formatMoney, money, type Currency, type DbWalletGroup } from '@mangos/core';
import { StyleSheet, Text, View } from 'react-native';
import { type } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { Chip } from './Chip';
import { Segmented } from './Segmented';
import { TextField } from './TextField';

const MODE_OPTIONS = [
  { value: 'equal', label: 'Iguales' },
  { value: 'exact', label: 'Montos' },
] as const;

interface Props {
  group: DbWalletGroup;
  /** Los que pueden pagar o tener parte: los activos y los que el gasto ya tenía (al editar). */
  memberIds: readonly string[];
  payerId: string;
  onPayer: (memberId: string) => void;
  /** D5: el que pagó tiene el gasto en sus finanzas y no sos vos. */
  payerLocked: boolean;
  mode: 'equal' | 'exact';
  onMode: (mode: 'equal' | 'exact') => void;
  included: readonly string[];
  onToggle: (memberId: string) => void;
  exact: Readonly<Record<string, string>>;
  onExact: (memberId: string, text: string) => void;
  /** Lo que falta asignar en montos (positivo) o lo que sobra (negativo), en centavos. */
  remainderMinor: number;
  currency: Currency;
  error?: string;
}

/** Quién pagó y cómo se divide un gasto de grupo (G-5, 02 §7). */
export function GroupSplit(props: Props) {
  const { colors } = useTheme();
  const { group } = props;
  const members = props.memberIds
    .map((id) => group.members.find((m) => m.id === id))
    .filter((m): m is DbWalletGroup['members'][number] => !!m);
  const label = (id: string) => (id === group.my_member_id ? 'Vos' : (group.members.find((m) => m.id === id)?.display_name ?? ''));

  const remainder = props.remainderMinor;
  const remainderText =
    remainder === 0
      ? 'Cierra justo.'
      : remainder > 0
        ? `Falta asignar ${formatMoney(money(remainder, props.currency))}.`
        : `Te pasaste por ${formatMoney(money(-remainder, props.currency))}.`;

  return (
    <View style={styles.block}>
      <View style={styles.block}>
        <Text style={[type.caption, { color: colors.textMuted }]}>Quién pagó</Text>
        {props.payerLocked ? (
          <Text style={[type.body, { color: colors.text }]}>
            {label(props.payerId)} <Text style={[type.caption, { color: colors.textMuted }]}>· Lo puede cambiar quien pagó.</Text>
          </Text>
        ) : (
          <View style={styles.chips}>
            {members.map((m) => (
              <Chip key={m.id} label={label(m.id)} selected={m.id === props.payerId} onPress={() => props.onPayer(m.id)} />
            ))}
          </View>
        )}
      </View>

      <View style={styles.block}>
        <Text style={[type.caption, { color: props.error ? colors.error : colors.textMuted }]}>Cómo se divide</Text>
        <Segmented options={MODE_OPTIONS} value={props.mode} onChange={props.onMode} accessibilityLabel="Cómo se divide" />
        {props.mode === 'equal' ? (
          <View style={styles.chips}>
            {members.map((m) => (
              <Chip
                key={m.id}
                label={label(m.id)}
                selected={props.included.includes(m.id)}
                onPress={() => props.onToggle(m.id)}
                accessibilityLabel={`${label(m.id)}, ${props.included.includes(m.id) ? 'incluido' : 'afuera'}`}
              />
            ))}
          </View>
        ) : (
          <View style={styles.block}>
            {members.map((m) => (
              <TextField
                key={m.id}
                label={`${label(m.id)} (${props.currency === 'ARS' ? '$' : 'US$'})`}
                value={props.exact[m.id] ?? ''}
                onChangeText={(t) => props.onExact(m.id, t)}
                mono
                keyboardType="decimal-pad"
                placeholder="0"
              />
            ))}
            <Text style={[type.caption, { color: remainder === 0 ? colors.textMuted : colors.warning }]}>{remainderText}</Text>
          </View>
        )}
        {props.error ? <Text style={[type.caption, { color: colors.error }]}>{props.error}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
