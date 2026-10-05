import { formatMoney, moneyInWords, type WalletAccount } from '@mangos/core';
import { StyleSheet, Text, View } from 'react-native';
import { type } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

const TYPE_LABELS: Record<WalletAccount['type'], string> = { bank: 'Banco', wallet: 'Billetera virtual', cash: 'Efectivo' };

/** Fila de cuenta: nombre, tipo y saldo en su moneda. Misma grilla que `MovementRow`, sin ícono. */
export function AccountRow({ account, last }: { account: WalletAccount; last: boolean }) {
  const { colors } = useTheme();
  const negative = account.balance.minor < 0;
  return (
    <View
      accessible
      accessibilityLabel={`${account.name}, ${TYPE_LABELS[account.type]}. Saldo: ${moneyInWords(account.balance)}.`}
      style={[styles.row, !last && { borderBottomWidth: 1, borderBottomColor: colors.line }]}
    >
      <View style={styles.middle}>
        <Text style={[type.bodyStrong, { color: colors.text }]} numberOfLines={1}>
          {account.name}
        </Text>
        <Text style={[type.caption, { color: colors.textMuted }]}>
          {TYPE_LABELS[account.type]} · {account.balance.currency === 'ARS' ? 'pesos' : 'dólares'}
        </Text>
      </View>
      <Text style={[type.money, { color: negative ? colors.error : colors.text }]} maxFontSizeMultiplier={1.3}>
        {formatMoney(account.balance)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 4, minHeight: 58 },
  middle: { flex: 1, minWidth: 0 },
});
