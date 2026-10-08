import { formatMoney, formatShortDate, moneyInWords, paymentMethodLabel, type WalletCard } from '@mangos/core';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { cardColors, radius, type } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { Pill } from './Pill';

function gradient(color: string | null): [string, string] {
  const found = cardColors.credit.find((c) => c.base === color) ?? cardColors.credit[0];
  return [found.base, found.end];
}

/** Lo que viene, en palabras: "ciento ochenta y siete mil pesos y cincuenta dólares". */
function totalInWords(card: WalletCard): string {
  const parts = [card.currentTotal.ARS, card.currentTotal.USD].filter((m) => m.minor !== 0).map(moneyInWords);
  return parts.length ? parts.join(' y ') : 'cero pesos';
}

/**
 * `CardRow` de DESIGN.md (5A): miniatura del plástico, nombre y últimos 4, y lo que viene en el resumen en curso.
 * Con un resumen cerrado sin pagar, "Vencido" o "A pagar" van en lugar del cierre (decisión de Fran, 8/10).
 */
export function CardRow({ card, last, onPress }: { card: WalletCard; last: boolean; onPress?: () => void }) {
  const { colors } = useTheme();
  const label = paymentMethodLabel({ kind: 'card', id: card.id, bank: '', network: card.network, last4: card.last4, isFavorite: card.isFavorite });
  const closes = formatShortDate(card.closeDate);
  // Pesos y dólares en dos líneas: en una sola, a 320 de ancho, el monto se come el nombre.
  const { ARS, USD } = card.currentTotal;
  const amounts = [ARS, USD].filter((m) => m.minor !== 0);
  if (!amounts.length) amounts.push(ARS);
  const due = card.dueStatus === 'overdue' ? 'Vencido' : card.dueStatus === 'to_pay' ? 'A pagar' : null;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessible
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`${card.name}${card.isFavorite ? ', favorita' : ''}, ${label}. Te vienen ${totalInWords(card)}. Cierra el ${closes}.${due ? ` Tiene un resumen ${due === 'Vencido' ? 'vencido' : 'a pagar'}.` : ''}`}
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
        <Text style={[type.moneySm, { color: colors.textMuted }]} numberOfLines={1}>
          ·· {card.last4}
        </Text>
      </View>
      <View style={styles.right}>
        {amounts.map((m) => (
          <Text key={m.currency} style={[type.money, { color: colors.text }]} maxFontSizeMultiplier={1.3} numberOfLines={1}>
            {formatMoney(m)}
          </Text>
        ))}
        {due ? (
          <Pill label={due} variant={card.dueStatus === 'overdue' ? 'error' : 'warning'} style={styles.pill} />
        ) : (
          <Text style={[type.caption, { color: colors.textMuted }]}>cierra {closes}</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 4 },
  thumb: { width: 56, height: 36, borderRadius: radius.xs },
  middle: { flex: 1, minWidth: 0 },
  right: { alignItems: 'flex-end', flexShrink: 0 },
  pill: { alignSelf: 'flex-end' },
});
