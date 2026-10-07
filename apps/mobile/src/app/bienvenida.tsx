import { convert, formatMoney, money } from '@mangos/core';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Option } from '../components/Option';
import { latestRates, type FxKind, type LatestRate } from '../lib/fx';
import { useSession, type UserSettings } from '../lib/session';
import { layout, type } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

const FX_OPTIONS = [
  { value: 'mep', title: 'Dólar MEP', subtitle: 'El que conseguís en el banco o el broker de forma legal. Recomendado.' },
  { value: 'oficial', title: 'Dólar oficial', subtitle: 'El del Banco Nación.' },
  { value: 'blue', title: 'Dólar blue', subtitle: 'El del mercado informal.' },
] as const;

/** Bienvenida de un paso (01 §1): el dólar de referencia. La moneda del patrimonio se cambia en la Billetera y las tarjetas se suman ahí. */
export default function Welcome() {
  const { colors } = useTheme();
  const { updateSettings } = useSession();
  const [fx, setFx] = useState<UserSettings['fx_reference']>('mep');
  const [rates, setRates] = useState<Partial<Record<FxKind, LatestRate>>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Sin cotizaciones, las opciones se muestran igual, sin el valor.
    latestRates().then(setRates, () => {});
  }, []);

  async function finish() {
    setSaving(true);
    setError(null);
    try {
      await updateSettings({ fx_reference: fx, onboarded_at: new Date().toISOString() });
    } catch {
      setError('No pudimos guardar. Probá de nuevo.');
      setSaving(false);
    }
  }

  const fxValue = (kind: FxKind) => {
    const r = rates[kind];
    return r ? formatMoney(convert(money(100, 'USD'), r.sell, 'ARS')) : null;
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[type.displayOnb, { color: colors.text }]} accessibilityRole="header">
          ¿Con qué dólar querés ver tus números?
        </Text>
        <Text style={[type.body, { color: colors.textMuted }]}>
          Lo usamos para convertir todo a una sola cifra. Lo podés cambiar cuando quieras.
        </Text>
        <View style={styles.options} accessibilityRole="radiogroup">
          {FX_OPTIONS.map((o) => {
            const value = fxValue(o.value);
            return (
              <Option
                key={o.value}
                title={o.title}
                subtitle={o.subtitle}
                selected={fx === o.value}
                onPress={() => setFx(o.value)}
                aside={value ? <Text style={[type.money, { color: colors.textMuted }]}>{value}</Text> : null}
              />
            );
          })}
        </View>
        {error ? (
          <Text style={[type.caption, { color: colors.error }]} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.line }]}>
        <Button title="Listo" variant="primary" onPress={finish} loading={saving} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: layout.gutter, gap: layout.sectionGap },
  options: { gap: 8 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: layout.gutter,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
});
