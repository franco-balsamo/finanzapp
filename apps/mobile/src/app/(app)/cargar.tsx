import {
  amountInputText,
  closeDate,
  deduceCategory,
  formatAmountInput,
  formatShortDate,
  money,
  orderedMethods,
  parseAmountMinor,
  parseQuickEntryLine,
  paymentChips,
  paymentMethodLabel,
  statementFor,
  SYSTEM_CATEGORY_IDS,
  convert,
  type Currency,
  type ISODate,
  type PaymentMethod,
  type Rate,
} from '@mangos/core';
import { randomUUID } from 'expo-crypto';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { DateChooser, dateLabel } from '../../components/DateChooser';
import { Segmented } from '../../components/Segmented';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/Toast';
import {
  cardRateOn,
  deleteExpense,
  learnCategory,
  loadEntryContext,
  saveExpense,
  toastFor,
  type EntryContext,
  type ExpenseDraft,
  WARNING_TEXT,
} from '../../lib/entry';
import { CATEGORIES } from '../../lib/categories';
import { walletChanged } from '../../lib/events';
import { useSession } from '../../lib/session';
import { radius, type } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

const CURRENCY_OPTIONS = [
  { value: 'ARS', label: '$' },
  { value: 'USD', label: 'US$' },
] as const;


const QUICK_INSTALLMENTS = [1, 3, 6, 12];



interface Errors {
  amount?: string;
  method?: string;
  description?: string;
  installments?: string;
  date?: string;
  debited?: string;
}

/** Hoja de carga (E5, diseño 2A): monto, medio de pago, descripción y Guardar en menos de 10 segundos. */
export default function AddExpense() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { session, settings } = useSession();
  // Desde el detalle de una tarjeta, la hoja abre con esa tarjeta elegida (02 §5).
  const { cardId } = useLocalSearchParams<{ cardId?: string }>();

  // El id lo genera el teléfono al abrir la hoja: reintentar nunca duplica (02 §5).
  const id = useRef(randomUUID()).current;
  const amountRef = useRef<TextInput>(null);

  const [ctx, setCtx] = useState<EntryContext | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const [quick, setQuick] = useState('');
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickNote, setQuickNote] = useState<string | null>(null);

  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('ARS');
  const [methodId, setMethodId] = useState<string | null>(cardId ?? null);
  const [extraChipId, setExtraChipId] = useState<string | null>(cardId ?? null);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [installments, setInstallments] = useState('1');
  const [description, setDescription] = useState('');
  const [pickedCategory, setPickedCategory] = useState<string | null>(null);
  const [date, setDate] = useState<ISODate | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [debited, setDebited] = useState('');
  const [debitedTouched, setDebitedTouched] = useState(false);
  const [cardRate, setCardRate] = useState<Rate | null>(null);

  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [otherOpen, setOtherOpen] = useState(false);

  const load = useCallback(() => {
    setLoadFailed(false);
    loadEntryContext().then(setCtx, () => setLoadFailed(true));
  }, []);
  // También al volver de "Sumá una tarjeta o una cuenta".
  useFocusEffect(load);

  useEffect(() => {
    // El foco va al monto (regla de los 10 segundos). Con un pequeño retraso, para que la hoja ya esté abierta.
    const timer = setTimeout(() => amountRef.current?.focus(), 350);
    return () => clearTimeout(timer);
  }, []);

  const today = ctx?.today ?? null;
  const expenseDate = date ?? today;
  const method = ctx?.methods.find((m) => m.id === methodId) ?? null;
  const account = method?.kind === 'account' ? ctx?.accounts.get(method.id) : undefined;
  const needsDebited = !!account && account.currency !== currency;
  const amountMinor = formatAmountInput(amount).minor;

  const chips = useMemo(() => {
    if (!ctx) return [];
    const base = paymentChips(ctx.methods, ctx.uses, ctx.today);
    // El medio elegido en "Otro…" (o por el texto) reemplaza a la tercera ficha mientras dura la carga.
    const extra = ctx.methods.find((m) => m.id === extraChipId);
    if (!extra || base.includes(extra)) return base;
    return base.length < 3 ? [...base, extra] : [...base.slice(0, 2), extra];
  }, [ctx, extraChipId]);

  const deduced = description.trim() && ctx ? deduceCategory(description, ctx.keywords) : null;
  const categoryId = pickedCategory ?? deduced;

  // "Entra en el resumen que cierra el 24/10".
  const statementHint = useMemo(() => {
    if (!ctx || method?.kind !== 'card' || !expenseDate) return null;
    const card = ctx.cards.get(method.id);
    if (!card) return null;
    const core = { id: card.id, closeDay: card.closeDay, dueDay: card.dueDay, creditLimit: money(0, 'ARS') };
    const period = statementFor(core, expenseDate, card.overrides);
    return `Entra en el resumen que cierra el ${formatShortDate(closeDate(core, period, card.overrides))}.`;
  }, [ctx, method, expenseDate]);

  // Lo descontado de una cuenta en otra moneda: se propone con el dólar tarjeta de la fecha (02 §2).
  useEffect(() => {
    if (!needsDebited || !expenseDate) return;
    let cancelled = false;
    cardRateOn(expenseDate).then((r) => !cancelled && setCardRate(r));
    return () => {
      cancelled = true;
    };
  }, [needsDebited, expenseDate]);

  useEffect(() => {
    if (!needsDebited || debitedTouched || !account) return;
    if (!cardRate || !amountMinor) {
      setDebited('');
      return;
    }
    const converted = convert(money(amountMinor, currency), cardRate, account.currency);
    setDebited(amountInputText(converted.minor));
  }, [needsDebited, debitedTouched, cardRate, amountMinor, currency, account]);

  function chooseMethod(m: PaymentMethod, fromOther = false) {
    setMethodId(m.id);
    setCandidates([]);
    setDebitedTouched(false);
    if (fromOther) setExtraChipId(m.id);
    setErrors((e) => ({ ...e, method: undefined }));
  }

  function onAmountChange(text: string) {
    setErrors((e) => ({ ...e, amount: undefined }));
    // Un texto pegado se lee con las reglas de la carga por texto: lo ambiguo se marca (11A).
    if (text.length - amount.length > 1) {
      const parsed = parseAmountMinor(text);
      if ('error' in parsed) {
        setAmount(text);
        setErrors((e) => ({ ...e, amount: 'Revisá el monto.' }));
        return;
      }
      setAmount(amountInputText(parsed.minor));
      return;
    }
    setAmount(formatAmountInput(text).text);
  }

  function onQuickChange(text: string) {
    setQuick(text);
    if (!ctx || !text.trim()) {
      setQuickNote(null);
      return;
    }
    const line = parseQuickEntryLine(text, {
      today: ctx.today,
      methods: ctx.methods,
      uses: ctx.uses,
      keywords: ctx.keywords,
      defaultCardId: cardId,
    });
    setCurrency(line.currency);
    setAmount(line.amount ? amountInputText(line.amount.minor) : '');
    setDescription(line.description.slice(0, 60));
    setPickedCategory(null);
    setDate(line.date === ctx.today ? null : line.date);
    setInstallments(String(line.requestedInstallments));
    setMethodId(line.methodId);
    setCandidates(line.candidates);
    if (line.methodId) setExtraChipId(line.methodId);
    setDebitedTouched(false);

    const notes = line.warnings.map((w) => WARNING_TEXT[w]);
    if (line.status === 'incomplete' && !line.methodId) notes.push('Elegí con qué pagaste.');
    if (line.status === 'incomplete' && !line.description) notes.push('Falta la descripción.');
    if (line.status === 'no_amount') notes.push('Falta el monto.');
    setQuickNote(notes.length ? notes.join(' ') : null);
    setErrors({
      amount: line.warnings.includes('ambiguous_amount') ? 'Revisá el monto.' : undefined,
    });
  }

  async function save() {
    if (!ctx || !session || !settings || !expenseDate) return;
    const found: Errors = {};
    const ambiguous = errors.amount === 'Revisá el monto.';
    if (ambiguous) found.amount = errors.amount;
    else if (!amountMinor) found.amount = 'Poné un monto mayor a cero.';
    if (!method) found.method = 'Elegí con qué pagaste.';
    if (!description.trim()) found.description = 'Escribí una descripción.';
    const n = Number(installments);
    if (method?.kind === 'card' && !(Number.isInteger(n) && n >= 1 && n <= 24)) found.installments = 'Las cuotas van de 1 a 24.';
    const debitedMinor = needsDebited ? formatAmountInput(debited).minor : null;
    if (needsDebited && !debitedMinor) found.debited = 'Poné cuánto se descontó de la cuenta.';
    if (errors.date) found.date = errors.date;
    setErrors(found);
    if (Object.keys(found).length || !method || !amountMinor) return;

    const draft: ExpenseDraft = {
      id,
      origin: quick.trim() ? 'text' : 'manual',
      date: expenseDate,
      description,
      amount: money(amountMinor, currency),
      method,
      installments: method.kind === 'card' ? n : 1,
      categoryId: categoryId ?? SYSTEM_CATEGORY_IDS.otros,
      debited: needsDebited && account && debitedMinor ? money(debitedMinor, account.currency) : null,
    };

    setSaving(true);
    setSaveError(null);
    const failure = await saveExpense(draft);
    if (failure) {
      setSaving(false);
      setSaveError(failure === 'offline' ? 'Sin conexión. Probá de nuevo.' : 'No pudimos guardar el gasto. Probá de nuevo.');
      return;
    }

    if (pickedCategory && pickedCategory !== deduced) {
      learnCategory(description, pickedCategory, ctx.methods).catch(() => {});
    }
    walletChanged();
    router.back();

    const text = await toastFor(draft, session.user.id, settings);
    toast(text, {
      label: 'Deshacer',
      onPress: async () => {
        const ok = await deleteExpense(draft.id);
        walletChanged();
        toast(ok ? 'Gasto borrado' : 'No se pudo borrar el gasto. Probá de nuevo.');
      },
    });
  }

  const cardSelected = method?.kind === 'card';

  return (
    <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
      <View style={styles.head}>
        <Text style={[type.title, { color: colors.text }]} accessibilityRole="header">
          Cargar gasto
        </Text>
        <Button title="✕" variant="ghost" onPress={() => router.back()} accessibilityLabel="Cerrar" />
      </View>

      <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" bottomOffset={90}>
        {/* 1. Carga por texto, plegada: no se lleva el foco. */}
        {quickOpen ? (
          <View style={styles.block}>
            <TextField
              label="Carga por texto"
              value={quick}
              onChangeText={onQuickChange}
              placeholder="12000 súper visa 3 cuotas"
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
            />
            {quickNote ? <Text style={[type.caption, { color: colors.warning }]}>{quickNote}</Text> : null}
          </View>
        ) : (
          <Pressable
            onPress={() => setQuickOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Carga por texto. Escribí, por ejemplo: 12000 súper visa"
            style={[styles.quick, { backgroundColor: colors.surface, borderColor: colors.line }]}
          >
            <Text style={[type.body, { color: colors.textMuted }]}>Escribí: 12000 súper visa</Text>
          </Pressable>
        )}

        {/* 2. Monto con la moneda al lado. */}
        <View style={styles.amountRow}>
          <View style={styles.flex}>
            <TextField
              ref={amountRef}
              label="Monto"
              value={amount}
              onChangeText={onAmountChange}
              error={errors.amount}
              mono
              keyboardType="decimal-pad"
              placeholder="0"
              style={type.moneyInput}
              maxFontSizeMultiplier={1.3}
            />
          </View>
          <View style={styles.currency}>
            <Segmented options={CURRENCY_OPTIONS} value={currency} onChange={(c) => { setCurrency(c); setDebitedTouched(false); }} accessibilityLabel="Moneda" />
          </View>
        </View>

        {/* 3. Medio de pago: ninguna ficha marcada al abrir. */}
        <View style={styles.block}>
          <Text style={[type.caption, { color: errors.method ? colors.error : colors.textMuted }]}>Medio de pago</Text>
          {!ctx ? (
            loadFailed ? (
              <Button title="No pudimos traer tus medios de pago. Reintentar" variant="link" onPress={load} />
            ) : (
              <View style={[styles.skeleton, { backgroundColor: colors.surface2 }]} />
            )
          ) : ctx.methods.length === 0 ? (
            <Button title="Sumá una tarjeta o una cuenta" onPress={() => router.push('/tarjeta-nueva')} />
          ) : (
            <View style={styles.chips}>
              {(candidates.length ? ctx.methods.filter((m) => candidates.includes(m.id)) : chips).map((m) => (
                <Chip
                  key={m.id}
                  label={`${m.kind === 'card' && m.isFavorite ? '★ ' : ''}${paymentMethodLabel(m)}`}
                  selected={m.id === methodId}
                  onPress={() => chooseMethod(m)}
                />
              ))}
              <Chip label="Otro…" onPress={() => setOtherOpen(true)} />
            </View>
          )}
          {errors.method ? <Text style={[type.caption, { color: colors.error }]}>{errors.method}</Text> : null}
        </View>

        {/* 4. Cuotas, solo con tarjeta de crédito. */}
        {cardSelected ? (
          <View style={styles.block}>
            <Text style={[type.caption, { color: errors.installments ? colors.error : colors.textMuted }]}>Cuotas</Text>
            <View style={styles.chips}>
              {QUICK_INSTALLMENTS.map((q) => (
                <Chip key={q} label={q === 1 ? '1 pago' : `${q}`} selected={installments === String(q)} onPress={() => setInstallments(String(q))} />
              ))}
              <TextInput
                value={QUICK_INSTALLMENTS.includes(Number(installments)) ? '' : installments}
                onChangeText={(t) => setInstallments(t.replace(/\D/g, '').slice(0, 2) || '1')}
                keyboardType="number-pad"
                placeholder="otra"
                placeholderTextColor={colors.textMuted}
                accessibilityLabel="Otra cantidad de cuotas, de 1 a 24"
                style={[type.moneySm, styles.otherInstallments, { color: colors.text, borderColor: colors.line }]}
              />
            </View>
            {errors.installments ? <Text style={[type.caption, { color: colors.error }]}>{errors.installments}</Text> : null}
          </View>
        ) : null}

        {/* 5. Descripción: deduce la categoría mientras se escribe. */}
        <TextField
          label="Descripción"
          value={description}
          onChangeText={(t) => {
            setDescription(t);
            setErrors((e) => ({ ...e, description: undefined }));
          }}
          error={errors.description}
          maxLength={60}
          placeholder="ej. Supermercado Coto"
        />

        {/* 6. Categoría: ninguna marcada hasta que se deduce. */}
        <View style={styles.block}>
          <Text style={[type.caption, { color: colors.textMuted }]}>Categoría</Text>
          <View style={styles.chips}>
            {CATEGORIES.map((c) => (
              <Chip key={c.id} label={c.label} selected={c.id === categoryId} onPress={() => setPickedCategory(c.id)} />
            ))}
          </View>
        </View>

        {/* 8. Lo descontado de una cuenta en otra moneda. */}
        {needsDebited && account ? (
          <TextField
            label={`Se descuentan de ${account.name} (${account.currency === 'ARS' ? '$' : 'US$'})`}
            value={debited}
            onChangeText={(t) => {
              setDebitedTouched(true);
              setDebited(formatAmountInput(t).text);
            }}
            error={errors.debited}
            mono
            keyboardType="decimal-pad"
            placeholder={cardRate ? '0' : 'Sin dólar tarjeta de esa fecha: escribilo'}
          />
        ) : null}

        {/* 7. Fecha, plegada. */}
        <Pressable
          onPress={() => setDetailsOpen(!detailsOpen)}
          accessibilityRole="button"
          accessibilityState={{ expanded: detailsOpen }}
          hitSlop={8}
          style={styles.details}
        >
          <Text style={[type.small, { color: errors.date ? colors.error : colors.textMuted }]}>
            {detailsOpen ? '▾' : '▸'} {expenseDate && today ? dateLabel(expenseDate, today) : 'Hoy'}
          </Text>
        </Pressable>
        {detailsOpen && today && expenseDate ? (
          <DateChooser
            today={today}
            value={expenseDate}
            onChange={(d) => setDate(d === today ? null : d)}
            onError={(error) => setErrors((e) => ({ ...e, date: error ?? undefined }))}
            error={errors.date}
          />
        ) : null}

        {/* 9. En qué resumen entra. */}
        {statementHint ? <Text style={[type.caption, { color: colors.textMuted }]}>{statementHint}</Text> : null}

        {saveError ? (
          <Text style={[type.caption, { color: colors.error }]} accessibilityLiveRegion="polite">
            {saveError}
          </Text>
        ) : null}
      </KeyboardAwareScrollView>

      {/* 10. Guardar, siempre arriba del teclado. */}
      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.line, paddingBottom: 12 + insets.bottom }]}>
          <Button title="Cancelar" onPress={() => router.back()} disabled={saving} />
          <Button title="Guardar gasto" variant="primary" onPress={save} loading={saving} disabled={!ctx} />
        </View>
      </KeyboardStickyView>

      {/* "Otro…": todos los medios, agrupados en Tarjetas y Cuentas. */}
      <Modal visible={otherOpen} transparent animationType="fade" onRequestClose={() => setOtherOpen(false)}>
        <Pressable style={[styles.scrim, { backgroundColor: colors.scrim }]} onPress={() => setOtherOpen(false)} accessibilityLabel="Cerrar">
          <Pressable style={[styles.picker, { backgroundColor: colors.surface, paddingBottom: 20 + insets.bottom }]}>
            <Text style={[type.title, { color: colors.text }]} accessibilityRole="header">
              ¿Con qué pagaste?
            </Text>
            <ScrollView contentContainerStyle={styles.pickerList}>
              {(['card', 'account'] as const).map((kind) => {
                const list = ctx ? orderedMethods(ctx.methods).filter((m) => m.kind === kind) : [];
                if (!list.length) return null;
                return (
                  <View key={kind} style={styles.block}>
                    <Text style={[type.label, { color: colors.textMuted }]}>{kind === 'card' ? 'Tarjetas' : 'Cuentas'}</Text>
                    {list.map((m) => (
                      <Pressable
                        key={m.id}
                        onPress={() => {
                          chooseMethod(m, true);
                          setOtherOpen(false);
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: m.id === methodId }}
                        style={({ pressed }) => [styles.pickerRow, { borderBottomColor: colors.line }, pressed && { backgroundColor: colors.surface2 }]}
                      >
                        <Text style={[type.bodyStrong, { color: m.id === methodId ? colors.primary : colors.text }]}>
                          {m.kind === 'card' && m.isFavorite ? '★ ' : ''}
                          {paymentMethodLabel(m)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  flex: { flex: 1 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16 },
  content: { padding: 20, paddingTop: 8, gap: 14 },
  block: { gap: 6 },
  quick: { borderWidth: 1, borderRadius: radius.sm, paddingVertical: 9, paddingHorizontal: 10, minHeight: 44, justifyContent: 'center' },
  amountRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  currency: { paddingTop: 22 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  skeleton: { height: 30, width: 240, borderRadius: radius.full },
  otherInstallments: { minWidth: 56, minHeight: 32, borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 11, textAlign: 'center' },
  details: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1 },
  scrim: { flex: 1, justifyContent: 'flex-end' },
  picker: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: 20, gap: 14, maxHeight: '80%' },
  pickerList: { gap: 14 },
  pickerRow: { minHeight: 48, justifyContent: 'center', borderBottomWidth: 1 },
});
