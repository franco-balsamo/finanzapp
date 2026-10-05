import { formatShortDate, formatTotal, moneyInWords, paymentMethodLabel, type WalletCard } from '@mangos/core';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { cardColors, radius, type } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

function gradient(color: string | null): [string, string] {
  const found = cardColors.credit.find((c) => c.base === color) ?? cardColors.credit[0];
  return [found.base, found.end];
}

/** Lo que viene, en palabras: "ciento ochenta y siete mil pesos y cincuenta dólares". */
function totalInWords(card: WalletCard): string {
  const parts = [card.currentTotal.ARS, card.currentTotal.USD].filter((m) => m.minor !== 0).map(moneyInWords);
  return parts.length ? parts.join(' y ') : 'cero pesos';
}

/** `CardRow` de DESIGN.md (5A): miniatura del plástico, nombre y últimos 4, y lo que viene en el resumen en curso. */
export function CardRow({ card, last, onPress }: { card: WalletCard; last: boolean; onPress?: () => void }) {
  const { colors } = useTheme();
  const label = paymentMethodLabel({ kind: 'card', id: card.id, bank: '', network: card.network, last4: card.last4, isFavorite: card.isFavorite });
  const closes = formatShortDate(card.closeDate);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessible
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`${card.name}${card.isFavorite ? ', favorita' : ''}, ${label}. Te vienen ${totalInWords(card)}. Cierra el ${closes}.`}
      style={({ pressed }) => [
        styles.row,
        !last && { borderBottomWidth: 1, borderBottomColor: colors.line },
        pressed && { backgroundColor: colors.surface2 },
      ]}
    >
      <LinearGradient colors={gradient(card.color)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.thumb} />
      <View style={styles.middle}>
        <Text style={[type.bodyStrong, { color: colors.text }]} numberOfLines={1}>
          {card.name}
          {card.isFavorite ? <Text style={{ color: cardColors.favoriteStar }}> ★</Text> : null}
        </Text>
        <Text style={[type.moneySm, { color: colors.textMuted }]}>·· {card.last4}</Text>
      </View>
      <View style={styles.right}>
        <Text style={[type.money, { color: colors.text }]} maxFontSizeMultiplier={1.3}>
          {formatTotal(card.currentTotal)}
        </Text>
        <Text style={[type.caption, { color: colors.textMuted }]}>cierra {closes}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 4 },
  thumb: { width: 56, height: 36, borderRadius: radius.xs },
  middle: { flex: 1, minWidth: 0 },
  right: { alignItems: 'flex-end' },
});
