import { convert, formatMoney, money } from '@mangos/core';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { CardForm } from '../components/CardForm';
import { Option } from '../components/Option';
import { Segmented } from '../components/Segmented';
import { EMPTY_CARD, validateCard, type CardFormErrors, type CardFormValue } from '../lib/cardForm';
import { createCard } from '../lib/cards';
import { latestRates, type FxKind, type LatestRate } from '../lib/fx';
import { useSession, type UserSettings } from '../lib/session';
import { layout, type } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

const STEPS = 3;

const GOALS = [
  { value: 'control', title: 'Ordenar mis gastos', subtitle: 'Saber cuánto voy a pagar de tarjeta y en qué se me va la plata.' },
  { value: 'save', title: 'Ahorrar en dólares', subtitle: 'Seguir cuánto tengo en pesos y en dólares, con el dólar que elija.' },
  { value: 'invest', title: 'Invertir', subtitle: 'Seguir mi cartera y tener alertas del mercado.' },
] as const;

const FX_OPTIONS = [
  { value: 'mep', title: 'Dólar MEP', subtitle: 'El que conseguís en el banco o el broker de forma legal. Recomendado.' },
  { value: 'oficial', title: 'Dólar oficial', subtitle: 'El del Banco Nación.' },
  { value: 'blue', title: 'Dólar blue', subtitle: 'El del mercado informal.' },
] as const;

const CURRENCY_OPTIONS = [
  { value: 'ARS', label: 'Pesos' },
  { value: 'USD', label: 'Dólares' },
] as const;

type Goal = NonNullable<UserSettings['goal']>;

function isEmptyCard(v: CardFormValue): boolean {
  return Object.values(v).every((field) => field === null || field === '');
}

/** Bienvenida de 3 pasos (01 §1, D6): objetivo, dólar y moneda, y la primera tarjeta, que es opcional. */
export default function Welcome() {
  const { colors } = useTheme();
  const { updateSettings } = useSession();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<Goal>('control');
  const [fx, setFx] = useState<UserSettings['fx_reference']>('mep');
  const [currency, setCurrency] = useState<UserSettings['display_currency']>('ARS');
  const [card, setCard] = useState(EMPTY_CARD);
  const [cardErrors, setCardErrors] = useState<CardFormErrors | null>(null);
  const [rates, setRates] = useState<Partial<Record<FxKind, LatestRate>>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Sin cotizaciones, las opciones se muestran igual, sin el valor.
    latestRates().then(setRates, () => {});
  }, []);

  async function finish() {
    const skipCard = isEmptyCard(card);
    if (!skipCard) {
      const found = validateCard(card);
      setCardErrors(found);
      if (found) return;
    }
    setSaving(true);
    setError(null);
    try {
      // La tarjeta va primero: si falla, la bienvenida no queda marcada y se puede reintentar.
      if (!skipCard) await createCard(card);
      await updateSettings({ goal, fx_reference: fx, display_currency: currency, onboarded_at: new Date().toISOString() });
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
      <View style={styles.steps} accessibilityLabel={`Paso ${step + 1} de ${STEPS}`}>
        {Array.from({ length: STEPS }, (_, i) => (
          <View key={i} style={[styles.step, { backgroundColor: i <= step ? colors.primary : colors.line }]} />
        ))}
      </View>

      <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" bottomOffset={80}>
        {step === 0 ? (
          <>
            <Text style={[type.displayOnb, { color: colors.text }]} accessibilityRole="header">
              Toda tu plata en un solo lugar
            </Text>
            <Text style={[type.body, { color: colors.textMuted }]}>
              Cuentas en pesos y dólares, tarjetas con sus cuotas y el dólar del día. En dos minutos lo dejás andando.
            </Text>
            <Text style={[type.label, { color: colors.textMuted }]}>¿Para qué la vas a usar más?</Text>
            <View style={styles.options} accessibilityRole="radiogroup">
              {GOALS.map((g) => (
                <Option key={g.value} title={g.title} subtitle={g.subtitle} selected={goal === g.value} onPress={() => setGoal(g.value)} />
              ))}
            </View>
          </>
        ) : null}

        {step === 1 ? (
          <>
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
            <Text style={[type.label, { color: colors.textMuted }]}>Mostrar mi patrimonio en</Text>
            <Segmented options={CURRENCY_OPTIONS} value={currency} onChange={setCurrency} accessibilityLabel="Moneda del patrimonio" />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text style={[type.displayOnb, { color: colors.text }]} accessibilityRole="header">
              ¿Usás tarjeta de crédito?
            </Text>
            <Text style={[type.body, { color: colors.textMuted }]}>
              Con el día de cierre y de vencimiento calculamos en qué resumen cae cada compra y cuánto vas a pagar.
            </Text>
            <CardForm value={card} onChange={setCard} errors={cardErrors} />
            <Text style={[type.caption, { color: colors.textMuted }]}>¿No usás? Dejá todo vacío y tocá Listo.</Text>
          </>
        ) : null}

        {error ? (
          <Text style={[type.caption, { color: colors.error }]} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
      </KeyboardAwareScrollView>

      <View style={[styles.footer, { borderTopColor: colors.line }]}>
        {step > 0 ? <Button title="Atrás" variant="ghost" onPress={() => setStep(step - 1)} disabled={saving} /> : <View />}
        {step < STEPS - 1 ? (
          <Button title={step === 0 ? 'Empezar' : 'Siguiente'} variant="primary" onPress={() => setStep(step + 1)} />
        ) : (
          <Button title="Listo" variant="primary" onPress={finish} loading={saving} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  steps: { flexDirection: 'row', gap: 6, paddingHorizontal: layout.gutter, paddingTop: 12 },
  step: { flex: 1, height: 4, borderRadius: 2 },
  content: { padding: layout.gutter, gap: layout.sectionGap },
  options: { gap: 8 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: layout.gutter,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
});
