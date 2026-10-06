import {
  amountInputText,
  convert,
  formatAmountInput,
  formatMoney,
  formatTotal,
  money,
  todayInArgentina,
  type ISODate,
  type Rate,
} from '@mangos/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Chip } from '../../../../components/Chip';
import { DateChooser } from '../../../../components/DateChooser';
import { Sheet } from '../../../../components/Sheet';
import { SheetFooter } from '../../../../components/SheetFooter';
import { TextField } from '../../../../components/TextField';
import { useToast } from '../../../../components/Toast';
import { cardRateOn } from '../../../../lib/entry';
import { walletChanged } from '../../../../lib/events';
import { impliedRate, registerPayments, revertPayments, type PaymentDraft } from '../../../../lib/payments';
import { useSession } from '../../../../lib/session';
import { loadCardDetail, type CardDetailData } from '../../../../lib/wallet';
import { type } from '../../../../theme/tokens';
import { useTheme } from '../../../../theme/useTheme';

interface Errors {
  amount?: string;
  ars?: string;
  arsAccount?: string;
  usd?: string;
  usdAccount?: string;
  debited?: string;
  date?: string;
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Pagar resumen (D-3, 02 §3): el total, el mínimo o cualquier monto, desde una cuenta. */
export default function PayStatement() {
  const { colors } = useTheme();
  const toast = useToast();
  const { session, settings } = useSession();
  const { cardId, period } = useLocalSearchParams<{ cardId: string; period: string }>();
  const today = todayInArgentina();

  const [data, setData] = useState<CardDetailData | null>(null);
  const [failed, setFailed] = useState(false);
  const [ars, setArs] = useState('');
  const [arsAccount, setArsAccount] = useState<string | null>(null);
  const [usd, setUsd] = useState('');
  const [usdAccount, setUsdAccount] = useState<string | null>(null);
  const [debited, setDebited] = useState('');
  const [debitedTouched, setDebitedTouched] = useState(false);
  const [rate, setRate] = useState<Rate | null>(null);
  const [date, setDate] = useState<ISODate>(today);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!session || !settings || !cardId) return;
    loadCardDetail(session.user.id, settings, cardId).then((d) => {
      setData(d);
      // Se propone el total pendiente; se puede cambiar por el mínimo o cualquier monto.
      const s = d.detail.statements.find((x) => x.period === period);
      if (s?.pending.ARS.minor) setArs(amountInputText(s.pending.ARS.minor));
      if (s?.pending.USD.minor) setUsd(amountInputText(s.pending.USD.minor));
    }, () => setFailed(true));
  }, [session, settings, cardId, period]);

  const statement = data?.detail.statements.find((s) => s.period === period) ?? null;
  const accounts = data ? [...data.accounts.entries()].map(([id, a]) => ({ id, ...a })) : [];
  const arsAccounts = accounts.filter((a) => a.currency === 'ARS');
  const usdMinor = formatAmountInput(usd).minor ?? 0;
  const arsMinor = formatAmountInput(ars).minor ?? 0;
  const usdFrom = accounts.find((a) => a.id === usdAccount);
  // Dólares pagados desde una cuenta en pesos: con el dólar tarjeta de la fecha del pago (02 §3).
  const usdInPesos = !!usdFrom && usdFrom.currency === 'ARS';

  useEffect(() => {
    if (!usdInPesos) return;
    let cancelled = false;
    cardRateOn(date).then((r) => !cancelled && setRate(r));
    return () => {
      cancelled = true;
    };
  }, [usdInPesos, date]);

  useEffect(() => {
    if (!usdInPesos || debitedTouched) return;
    setDebited(rate && usdMinor ? amountInputText(convert(money(usdMinor, 'USD'), rate, 'ARS').minor) : '');
  }, [usdInPesos, debitedTouched, rate, usdMinor]);

  async function save() {
    if (!statement || !cardId || !period) return;
    const found: Errors = {};
    const pending = statement.pending;
    if (!arsMinor && !usdMinor) found.amount = 'Poné cuánto pagaste.';
    if (arsMinor > pending.ARS.minor) found.ars = `No puede ser más que lo pendiente (${formatMoney(pending.ARS)}).`;
    if (usdMinor > pending.USD.minor) found.usd = `No puede ser más que lo pendiente (${formatMoney(pending.USD)}).`;
    if (arsMinor && !arsAccount) found.arsAccount = 'Elegí de qué cuenta salió.';
    if (usdMinor && !usdAccount) found.usdAccount = 'Elegí de qué cuenta salió.';
    const debitedMinor = formatAmountInput(debited).minor;
    if (usdMinor && usdInPesos && !debitedMinor) found.debited = 'Poné cuántos pesos se descontaron.';
    if (errors.date) found.date = errors.date;
    setErrors(found);
    if (Object.keys(found).length) return;

    const drafts: PaymentDraft[] = [];
    if (arsMinor) {
      drafts.push({ appliesTo: 'ARS', amount: money(arsMinor, 'ARS'), fromAccountId: arsAccount!, debited: money(arsMinor, 'ARS'), fxCardRate: null });
    }
    if (usdMinor && usdFrom) {
      drafts.push({
        appliesTo: 'USD',
        amount: money(usdMinor, 'USD'),
        fromAccountId: usdFrom.id,
        debited: usdInPesos ? money(debitedMinor!, 'ARS') : money(usdMinor, 'USD'),
        // El dólar tarjeta de la fecha; si se corrigió lo descontado a mano, la cotización que le corresponde.
        fxCardRate: usdInPesos ? (debitedTouched || !rate ? impliedRate(debitedMinor!, usdMinor) : rate) : null,
      });
    }

    setSaving(true);
    setSaveError(null);
    try {
      const ids = await registerPayments(cardId, period, date, drafts);
      walletChanged();
      router.back();
      const left = {
        ARS: money(pending.ARS.minor - arsMinor, 'ARS'),
        USD: money(pending.USD.minor - usdMinor, 'USD'),
      };
      const done = left.ARS.minor === 0 && left.USD.minor === 0;
      toast(done ? 'Pago registrado · resumen pagado' : `Pago registrado · quedan ${formatTotal(left)}`, {
        label: 'Deshacer',
        onPress: async () => {
          try {
            await revertPayments(ids);
            toast('Pago deshecho');
          } catch {
            toast('No se pudo deshacer el pago. Probá de nuevo.');
          }
          walletChanged();
        },
      });
    } catch {
      setSaving(false);
      setSaveError('No pudimos registrar el pago. Probá de nuevo.');
    }
  }

  const [year, month] = (period ?? '').split('-').map(Number);
  const title = month ? `Pagar resumen de ${MONTHS[month - 1]}${year !== Number(today.slice(0, 4)) ? ` de ${year}` : ''}` : 'Pagar resumen';

  return (
    <Sheet
      title={title}
      onClose={() => router.back()}
      footer={<SheetFooter actionTitle="Registrar pago" onAction={save} onCancel={() => router.back()} loading={saving} />}
    >
      {failed ? <Text style={[type.body, { color: colors.error }]}>No pudimos traer el resumen.</Text> : null}
      {statement ? (
        <>
          <Text style={[type.body, { color: colors.textMuted }]}>
            Quedan <Text style={[type.money, { color: colors.text }]}>{formatTotal(statement.pending)}</Text>
          </Text>

          {statement.pending.ARS.minor > 0 ? (
            <View style={styles.block}>
              <TextField
                label="Pesos"
                value={ars}
                onChangeText={(t) => setArs(formatAmountInput(t).text)}
                error={errors.ars ?? errors.amount}
                mono
                keyboardType="decimal-pad"
                placeholder="0"
              />
              <View style={styles.chips}>
                <Chip label="Total" selected={arsMinor === statement.pending.ARS.minor} onPress={() => setArs(amountInputText(statement.pending.ARS.minor))} />
                <Chip
                  label={`Mínimo ${formatMoney(statement.minimumPayment)}`}
                  selected={arsMinor === statement.minimumPayment.minor}
                  onPress={() => setArs(amountInputText(statement.minimumPayment.minor))}
                />
              </View>
              <Text style={[type.caption, { color: errors.arsAccount ? colors.error : colors.textMuted }]}>Desde</Text>
              <View style={styles.chips}>
                {arsAccounts.map((a) => (
                  <Chip key={a.id} label={a.name} selected={arsAccount === a.id} onPress={() => setArsAccount(a.id)} />
                ))}
              </View>
              {arsAccounts.length === 0 ? (
                <Text style={[type.caption, { color: colors.textMuted }]}>No tenés cuentas en pesos. Sumá una desde la Billetera.</Text>
              ) : null}
              {errors.arsAccount ? <Text style={[type.caption, { color: colors.error }]}>{errors.arsAccount}</Text> : null}
            </View>
          ) : null}

          {statement.pending.USD.minor > 0 ? (
            <View style={styles.block}>
              <TextField
                label="Dólares"
                value={usd}
                onChangeText={(t) => {
                  setUsd(formatAmountInput(t).text);
                  setDebitedTouched(false);
                }}
                error={errors.usd ?? (statement.pending.ARS.minor > 0 ? undefined : errors.amount)}
                mono
                keyboardType="decimal-pad"
                placeholder="0"
              />
              <Text style={[type.caption, { color: errors.usdAccount ? colors.error : colors.textMuted }]}>
                Desde (una cuenta en dólares, o en pesos con el dólar tarjeta)
              </Text>
              <View style={styles.chips}>
                {accounts.map((a) => (
                  <Chip
                    key={a.id}
                    label={`${a.name}${a.currency === 'USD' ? ' (US$)' : ' ($)'}`}
                    selected={usdAccount === a.id}
                    onPress={() => {
                      setUsdAccount(a.id);
                      setDebitedTouched(false);
                    }}
                  />
                ))}
              </View>
              {errors.usdAccount ? <Text style={[type.caption, { color: colors.error }]}>{errors.usdAccount}</Text> : null}
              {usdInPesos ? (
                <TextField
                  label={`Se descuentan de ${usdFrom!.name} ($)`}
                  value={debited}
                  onChangeText={(t) => {
                    setDebitedTouched(true);
                    setDebited(formatAmountInput(t).text);
                  }}
                  error={errors.debited}
                  mono
                  keyboardType="decimal-pad"
                  placeholder={rate ? '0' : 'Sin dólar tarjeta de esa fecha: escribilo'}
                />
              ) : null}
            </View>
          ) : null}

          <View style={styles.block}>
            <Text style={[type.caption, { color: colors.textMuted }]}>Fecha del pago</Text>
            <DateChooser
              today={today}
              value={date}
              onChange={(d) => {
                setDate(d);
                setDebitedTouched(false);
              }}
              onError={(error) => setErrors((e) => ({ ...e, date: error ?? undefined }))}
              error={errors.date}
            />
          </View>

          {saveError ? <Text style={[type.caption, { color: colors.error }]}>{saveError}</Text> : null}
        </>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  block: { gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});

