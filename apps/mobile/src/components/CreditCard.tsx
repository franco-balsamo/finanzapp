import { formatMoney, moneyInWords, type ByCurrency, type CardNetwork } from '@mangos/core';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import { cardColors, fonts, radius, shadow, type } from '../theme/tokens';

const NETWORK_LABELS: Record<CardNetwork, string> = { VISA: 'VISA', MC: 'mastercard', AMEX: 'AMEX', CABAL: 'CABAL' };

function initials(bank: string): string {
  const words = bank.replace(/^banco\s+/i, '').split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0]![0]! + words[1]![0]! : (words[0] ?? '?').slice(0, 2)).toUpperCase();
}

interface Props {
  bank: string;
  network: CardNetwork;
  last4: string;
  expiry: string | null;
  color: string | null;
  isFavorite: boolean;
  /** El total del resumen elegido. */
  total: ByCurrency;
  /** "Vence 6/11". */
  dueLabel: string;
  /** Mientras carga: los montos van en esqueleto. */
  loading?: boolean;
}

/**
 * `CreditCard` de DESIGN.md: el plástico como encabezado del detalle. Degradado a 140° de `base` a
 * `end`; las capas de brillo y anillos quedan para cuando esté `react-native-svg`.
 */
export function CreditCard({ bank, network, last4, expiry, color, isFavorite, total, dueLabel, loading }: Props) {
  const plastic = cardColors.credit.find((c) => c.base === color) ?? cardColors.credit[0];
  const words = [total.ARS, total.USD].filter((m) => m.minor !== 0).map(moneyInWords).join(' y ') || 'cero pesos';

  return (
    <View
      accessible
      accessibilityLabel={`Tarjeta ${bank}${isFavorite ? ', favorita' : ''}, terminada en ${last4.split('').join(' ')}. Total del resumen: ${words}. ${dueLabel}.`}
      style={[styles.shadow, shadow.card]}
    >
      <LinearGradient colors={[plastic.base, plastic.end]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={styles.card}>
        <View style={styles.row}>
          <View style={styles.bank}>
            <View style={styles.monogram}>
              <Text style={[styles.monogramText, { color: plastic.base }]}>{initials(bank)}</Text>
            </View>
            <Text style={styles.bankName} numberOfLines={1}>
              {bank}
            </Text>
          </View>
          {isFavorite ? <Text style={[styles.star, { color: cardColors.favoriteStar }]}>★</Text> : null}
        </View>

        <View>
          {loading ? (
            <View style={styles.skeleton} />
          ) : (
            <>
              <Text style={[type.moneyCard, styles.onCard]} maxFontSizeMultiplier={1.3}>
                {formatMoney(total.ARS)}
              </Text>
              {total.USD.minor !== 0 ? (
                <Text style={[type.moneySm, styles.onCard]} maxFontSizeMultiplier={1.3}>
                  + {formatMoney(total.USD)}
                </Text>
              ) : null}
            </>
          )}
          <Text style={[styles.due, styles.onCard]}>{dueLabel}</Text>
        </View>

        <View style={[styles.row, styles.bottom]}>
          <View>
            <Text style={[type.label, styles.onCard, { opacity: 0.85 }]}>Crédito</Text>
            <Text style={[styles.number, styles.onCard]}>•••• {last4}</Text>
          </View>
          <View style={styles.right}>
            <Text style={[styles.network, styles.onCard]}>{NETWORK_LABELS[network]}</Text>
            {expiry ? (
              <Text style={[styles.onCard, styles.expiry]}>
                <Text style={styles.expiryLabel}>VENCE </Text>
                {expiry}
              </Text>
            ) : null}
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { borderRadius: radius.card },
  card: { aspectRatio: 1.586, borderRadius: radius.card, paddingVertical: 18, paddingHorizontal: 20, justifyContent: 'space-between' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bank: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  monogram: { width: 26, height: 26, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  monogramText: { fontFamily: fonts.bold, fontSize: 11 },
  bankName: { fontFamily: fonts.regular, fontSize: 14, color: cardColors.onCard, flexShrink: 1 },
  star: { fontSize: 18 },
  onCard: { color: cardColors.onCard },
  due: { fontFamily: fonts.regular, fontSize: 12, opacity: 0.82, marginTop: 2 },
  skeleton: { height: 28, width: 160, borderRadius: radius.sm, backgroundColor: 'rgba(255,255,255,0.16)' },
  bottom: { alignItems: 'flex-end' },
  number: { fontFamily: fonts.mono, fontSize: 16, letterSpacing: 0.64 },
  right: { alignItems: 'flex-end' },
  network: { fontFamily: fonts.bold, fontSize: 17, letterSpacing: 1 },
  expiry: { fontFamily: fonts.mono, fontSize: 14 },
  expiryLabel: { fontFamily: fonts.medium, fontSize: 9.5 },
});
