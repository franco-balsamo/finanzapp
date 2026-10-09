import {
  alreadyPaidQuestion,
  amountInputText,
  checkSplit,
  expenseShareFor,
  rate as toRate,
  recentGroups,
  savedToastText,
  splitParts,
  splitRemainder,
  closeDate,
  deduceCategory,
  formatAmountInput,
  formatMoney,
  formatShortDate,
  fromDbNumeric,
  money,
  orderedMethods,
  parseAmountMinor,
  parseQuickEntryLine,
  paymentChips,
  paymentMethodLabel,
  paymentsToastSuffix,
  proposedPaymentText,
  statementFor,
  SYSTEM_CATEGORY_IDS,
  toDbNumeric,
  convert,
  type Currency,
  type DbWalletGroup,
  type GroupExpense,
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
import { GroupSplit } from '../../components/GroupSplit';
import { Mono } from '../../components/Mono';
import { Segmented } from '../../components/Segmented';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/Toast';
import {
  cardRateOn,
  deleteExpense,
  editLatePayment,
  learnCategory,
  loadEntryContext,
  loadExpense,
  loadLateImpacts,
  mayBeLate,
  rateOn,
  saveExpense,
  toastFor,
  updateExpense,
  withIds,
  type EntryContext,
  type ExpenseDraft,
  type LatePayment,
  type SavedExpense,
  WARNING_TEXT,
} from '../../lib/entry';
import { CATEGORIES } from '../../lib/categories';
import { walletChanged } from '../../lib/events';
import {
  deleteGroupExpense,
  loadMoneyLocked,
  loadMyGroupMovement,
  saveGroupExpense,
  type MovementChange,
  type MyGroupMovement,
} from '../../lib/groupExpense';
import { loadGroups } from '../../lib/wallet';
import { revertPayments } from '../../lib/payments';
import { useSession } from '../../lib/session';
import { radius, type } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

const CURRENCY_OPTIONS = [
  { value: 'ARS', label: '$' },
  { value: 'USD', label: 'US$' },
] as const;

const QUICK_INSTALLMENTS = [1, 3, 6, 12];

const FX_LABEL = { mep: 'MEP', oficial: 'oficial', blue: 'blue' } as const;

/** "1.500" a partir de una cotización ("1500.0000"); se edita como un monto. */
const rateText = (r: Rate) => amountInputText(Math.round(Number(r) * 100));
function textToRate(text: string): Rate | null {
  const minor = formatAmountInput(text).minor;
  return minor ? toRate(`${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, '0')}`) : null;
}
const parseMinor = (text: string) => formatAmountInput(text).minor ?? 0;
/** El nombre del medio sin los últimos 4, que van aparte en Plex Mono ("Visa" + "·· 2337"). */
const methodName = (m: PaymentMethod) => paymentMethodLabel(m).replace(/ ·· \d{4}$/, '');

/** Al editar un gasto de grupo: lo que no se puede cambiar y tu gasto personal vinculado. */
interface EditState {
  memberIds: string[];
  payerLocked: boolean;
  movement: MyGroupMovement | null;
}

interface Errors {
  amount?: string;
  method?: string;
  description?: string;
  installments?: string;
  date?: string;
  debited?: string;
  split?: string;
  fx?: string;
}

/** Hoja de carga (E5, diseño 2A): monto, medio de pago, descripción y Guardar en menos de 10 segundos. */
export default function AddExpense() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { session, settings } = useSession();
  // Desde el detalle de una tarjeta, la hoja abre con esa tarjeta elegida (02 §5).
  // Desde el detalle de un grupo, abre con ese grupo; con `groupExpenseId`, edita ese gasto (G-5).
  // Con `movementId`, edita un gasto personal o completa un "Sin medio de pago" (L-5).
  const { cardId, groupId: groupParam, groupExpenseId, movementId: editId } = useLocalSearchParams<{
    cardId?: string;
    groupId?: string;
    groupExpenseId?: string;
    movementId?: string;
  }>();

  // El id lo genera el teléfono al abrir la hoja: reintentar nunca duplica (02 §5).
  const newId = useRef(randomUUID()).current;
  const id = groupExpenseId ?? editId ?? newId;
  // Tu gasto personal cuando el gasto es de grupo y pagaste vos: otro id, también estable.
  const movementId = useRef(randomUUID()).current;
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
  const [detailsOpen, setDetailsOpen] = useState(!!groupParam);
  const [debited, setDebited] = useState('');
  const [debitedTouched, setDebitedTouched] = useState(false);
  const [cardRate, setCardRate] = useState<Rate | null>(null);

  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [otherOpen, setOtherOpen] = useState(false);
  // "¿Ya lo pagaste?" (D-6): reemplaza al pie. Los pagos llevan su id desde que aparece la pregunta.
  const [question, setQuestion] = useState<{ draft: ExpenseDraft; payments: LatePayment[] } | null>(null);
  const [paidAmount, setPaidAmount] = useState('');
  const [paidError, setPaidError] = useState<string | null>(null);

  // Gasto de grupo (G-5). Los grupos se traen solo si se abre la línea plegada o viene un grupo.
  const [groups, setGroups] = useState<DbWalletGroup[] | null>(null);
  const [groupsFailed, setGroupsFailed] = useState(false);
  const [groupId, setGroupId] = useState<string | null>(groupParam ?? null);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [payerId, setPayerId] = useState<string | null>(null);
  const [splitMode, setSplitMode] = useState<'equal' | 'exact'>('equal');
  const [included, setIncluded] = useState<string[]>([]);
  const [exact, setExact] = useState<Record<string, string>>({});
  const [addToMine, setAddToMine] = useState(true);
  const [fxText, setFxText] = useState('');
  const [fxTouched, setFxTouched] = useState(false);
  const [fxFound, setFxFound] = useState<boolean | null>(null);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // El gasto personal que se edita (L-5). Del reclamo: monto, moneda y fecha copian el grupo (L7).
  const [saved, setSaved] = useState<SavedExpense | null>(null);
  const [savedFailed, setSavedFailed] = useState(false);
  const locked = saved?.origin === 'claim';
  const defaultsFor = useRef<string | null>(null);

  const load = useCallback(() => {
    setLoadFailed(false);
    loadEntryContext().then(setCtx, () => setLoadFailed(true));
  }, []);
  // También al volver de "Sumá una tarjeta o una cuenta".
  useFocusEffect(load);

  useEffect(() => {
    // El foco va al monto (regla de los 10 segundos). Con un pequeño retraso, para que la hoja ya esté abierta.
    if (editId) return;
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

  // ── Gasto de grupo (G-5) ──
  const wantsGroups = !!groupParam || (detailsOpen && !editId);
  const loadGroupsList = useCallback(() => {
    if (!session) return;
    setGroupsFailed(false);
    loadGroups(session.user.id).then(setGroups, () => setGroupsFailed(true));
  }, [session]);
  useEffect(() => {
    if (wantsGroups && !groups) loadGroupsList();
  }, [wantsGroups, groups, loadGroupsList]);

  const group = groups?.find((g) => g.id === groupId) ?? null;
  const myMemberId = group?.my_member_id ?? null;
  const iPay = !group || payerId === myMemberId;
  // El medio de pago se pide sin grupo, o si pagaste vos y lo sumás a tus finanzas.
  const needsMethod = !group || (iPay && addToMine);
  const groupNeedsFx = !!group && currency !== group.currency;
  const activeIds = useMemo(() => (group ? group.members.filter((m) => !m.left_at).map((m) => m.id) : []), [group]);
  const memberIds = editing?.memberIds ?? activeIds;
  const exactMinor = useMemo(
    () => Object.fromEntries(Object.entries(exact).map(([k, v]) => [k, parseMinor(v)])),
    [exact],
  );
  const splitDraft = { amountMinor: amountMinor ?? 0, currency, mode: splitMode, included, exactMinor };

  // Al elegir un grupo (no al editar): pagaste vos y se divide en partes iguales entre todos.
  useEffect(() => {
    if (!group || groupExpenseId || defaultsFor.current === group.id) return;
    defaultsFor.current = group.id;
    setPayerId(group.my_member_id);
    setSplitMode('equal');
    setIncluded(group.members.filter((m) => !m.left_at).map((m) => m.id));
    setExact({});
    setFxTouched(false);
  }, [group, groupExpenseId]);

  // Editar: la hoja abre con el gasto de grupo y, si lo tenés en tus finanzas, con tu medio de pago.
  useEffect(() => {
    if (!groupExpenseId || !groups || !ctx || editing) return;
    const g = groups.find((x) => x.id === groupParam);
    const e = g?.expenses.find((x) => x.id === groupExpenseId);
    if (!g || !e) return;
    Promise.all([loadMyGroupMovement(e.id), loadMoneyLocked(e.id)]).then(
      ([mine, payerLocked]) => {
        const ids = [...new Set([...g.members.filter((m) => !m.left_at).map((m) => m.id), ...e.parts.map((p) => p.member_id), e.payer_member_id])];
        setEditing({
          memberIds: g.members.map((m) => m.id).filter((m) => ids.includes(m)),
          payerLocked,
          movement: mine,
        });
        defaultsFor.current = g.id;
        setGroupId(g.id);
        setAmount(amountInputText(fromDbNumeric(e.amount, e.currency).minor));
        setCurrency(e.currency);
        setDescription(e.description);
        setPickedCategory(e.category_id);
        setDate(e.date === ctx.today ? null : e.date);
        setPayerId(e.payer_member_id);
        setSplitMode(e.split_mode);
        setIncluded(e.parts.map((p) => p.member_id));
        setExact(
          e.split_mode === 'exact'
            ? Object.fromEntries(e.parts.map((p) => [p.member_id, amountInputText(fromDbNumeric(p.value, e.currency).minor)]))
            : {},
        );
        if (e.fx_rate) {
          setFxText(rateText(toRate(e.fx_rate)));
          setFxTouched(true);
        }
        setAddToMine(!!mine);
        if (mine) {
          setMethodId(mine.card_id ?? mine.account_id);
          setExtraChipId(mine.card_id ?? mine.account_id);
          setInstallments(String(mine.installments));
          if (mine.debited_amount) {
            setDebited(amountInputText(fromDbNumeric(mine.debited_amount, 'ARS').minor));
            setDebitedTouched(true);
          }
        }
      },
      () => setGroupsFailed(true),
    );
  }, [groupExpenseId, groupParam, groups, ctx, editing]);

  // Editar un gasto personal: la hoja abre con todo lo guardado, también el medio actual en las fichas.
  useEffect(() => {
    if (!editId || !ctx || saved || savedFailed) return;
    loadExpense(editId).then(
      (e) => {
        setSaved(e);
        setAmount(amountInputText(fromDbNumeric(e.amount, e.currency).minor));
        setCurrency(e.currency);
        setDescription(e.description);
        setPickedCategory(e.category_id);
        setDate(e.date === ctx.today ? null : e.date);
        const current = e.card_id ?? e.account_id;
        setMethodId(current);
        setExtraChipId(current);
        setInstallments(String(e.installments));
        const debitedIn = e.account_id ? ctx.accounts.get(e.account_id)?.currency : undefined;
        if (e.debited_amount && debitedIn) {
          setDebited(amountInputText(fromDbNumeric(e.debited_amount, debitedIn).minor));
          setDebitedTouched(true);
        }
      },
      () => setSavedFailed(true),
    );
  }, [editId, ctx, saved, savedFailed]);

  // Gasto en otra moneda que el grupo: se propone tu dólar de referencia de la fecha (D8), editable.
  useEffect(() => {
    if (!groupNeedsFx || fxTouched || !expenseDate || !settings) return;
    let cancelled = false;
    rateOn(settings.fx_reference, expenseDate).then((r) => {
      if (cancelled) return;
      setFxFound(!!r);
      setFxText(r ? rateText(r) : '');
    });
    return () => {
      cancelled = true;
    };
  }, [groupNeedsFx, fxTouched, expenseDate, settings]);

  function chooseGroup(next: string | null) {
    setGroupId(next);
    setErrors((e) => ({ ...e, split: undefined, fx: undefined, method: undefined }));
  }

  function chooseMethod(m: PaymentMethod, fromOther = false) {
    setAddToMine(true);
    setMethodId(m.id);
    setCandidates([]);
    setDebitedTouched(false);
    if (fromOther) setExtraChipId(m.id);
    setErrors((e) => ({ ...e, method: undefined }));
  }

  function onAmountChange(text: string) {
    setErrors((e) => ({ ...e, amount: undefined }));
    // Lo descontado de la cuenta sigue al monto, también al editar (como al cambiar la moneda).
    setDebitedTouched(false);
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
    if (needsMethod && !method) found.method = 'Elegí con qué pagaste.';
    if (!description.trim()) found.description = 'Escribí una descripción.';
    const n = Number(installments);
    if (needsMethod && method?.kind === 'card' && !(Number.isInteger(n) && n >= 1 && n <= 24)) found.installments = 'Las cuotas van de 1 a 24.';
    const debitedMinor = needsDebited ? formatAmountInput(debited).minor : null;
    if (needsMethod && needsDebited && !debitedMinor) found.debited = 'Poné cuánto se descontó de la cuenta.';
    if (errors.date) found.date = errors.date;
    if (group && amountMinor) {
      const split = checkSplit(splitDraft);
      if (!split.ok && split.error === 'nobody') found.split = 'Elegí al menos una persona.';
      if (!split.ok && split.error === 'mismatch') {
        const assigned = money(amountMinor - split.diffMinor, currency);
        found.split = `Los montos suman ${formatMoney(assigned)} y el gasto es ${formatMoney(money(amountMinor, currency))}.`;
      }
      if (groupNeedsFx && !textToRate(fxText)) found.fx = 'Escribí la cotización.';
    }
    setErrors(found);
    if (Object.keys(found).length || !amountMinor) return;
    if (group) return saveGroup(group, n, debitedMinor);
    if (!method) return;

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

    // Un gasto en un resumen que ya cerró: si ese resumen estaba pagado, se pregunta antes de guardar.
    if (method.kind === 'card' && mayBeLate(ctx, method.id, expenseDate)) {
      setSaving(true);
      const impacts = await loadLateImpacts(session.user.id, settings, [
        { id, cardId: method.id, date: expenseDate, amount: draft.amount, installments: draft.installments },
      ]);
      setSaving(false);
      const impact = impacts?.[0];
      if (impact?.askAlreadyPaid) {
        const payments = withIds(impact.proposedPayments, randomUUID);
        setQuestion({ draft, payments });
        setPaidAmount(amountInputText(payments[0]!.debitedAmount.minor));
        setPaidError(null);
        return;
      }
    }
    await commit(draft, []);
  }

  /** Gasto de grupo (G-5): el gasto, las partes y, si pagaste vos, tu gasto personal en una transacción. */
  async function saveGroup(g: DbWalletGroup, n: number, debitedMinor: number | null) {
    if (!ctx || !expenseDate || !payerId || !amountMinor) return;
    const amountMoney = money(amountMinor, currency);
    const fxRate = groupNeedsFx ? textToRate(fxText) : null;
    const parts = splitParts(splitDraft, memberIds);
    let movement: MovementChange = null;
    if (iPay && addToMine && method) {
      movement = {
        id: editing?.movement?.id ?? movementId,
        origin: quick.trim() ? 'text' : 'manual',
        ...(method.kind === 'card' ? { card_id: method.id } : { account_id: method.id }),
        installments: method.kind === 'card' ? n : 1,
        ...(needsDebited && account && debitedMinor ? { debited_amount: toDbNumeric(money(debitedMinor, account.currency)) } : {}),
      };
    } else if (iPay && editing?.movement) {
      movement = { remove: true };
    }

    setSaving(true);
    setSaveError(null);
    const failure = await saveGroupExpense({
      id,
      groupId: g.id,
      date: expenseDate,
      description,
      amount: amountMoney,
      fxRate,
      payerMemberId: payerId,
      splitMode,
      categoryId: categoryId ?? SYSTEM_CATEGORY_IDS.otros,
      parts,
      movement,
    });
    if (failure) {
      setSaving(false);
      setSaveError(
        failure === 'payer_only'
          ? 'El monto, la moneda y quién pagó los puede cambiar solo quien pagó.'
          : failure === 'offline'
            ? 'Sin conexión. Probá de nuevo.'
            : 'No pudimos guardar el gasto. Probá de nuevo.',
      );
      return;
    }

    if (pickedCategory && pickedCategory !== deduced) {
      learnCategory(description, pickedCategory, ctx.methods).catch(() => {});
    }
    walletChanged();
    router.back();

    if (groupExpenseId) {
      toast('Gasto actualizado');
      return;
    }
    const expense: GroupExpense = {
      id,
      amount: amountMoney,
      fxRate,
      payerMemberId: payerId,
      splitMode,
      parts: parts.map((p) => ({ memberId: p.member_id, value: p.value ? fromDbNumeric(p.value, currency) : null })),
    };
    const createdMovement = movement && 'id' in movement ? movement.id : null;
    toast(savedToastText({ kind: 'group', ...expenseShareFor(g, expense) }), {
      label: 'Deshacer',
      onPress: async () => {
        // Justo después de guardar, "Deshacer" borra los dos (D6).
        let ok = await deleteGroupExpense(id);
        if (ok && createdMovement) ok = await deleteExpense(createdMovement);
        walletChanged();
        toast(ok ? 'Gasto borrado' : 'No se pudo borrar el gasto. Probá de nuevo.');
      },
    });
  }

  /** Borrar un gasto de grupo desde la edición (D6): tu gasto personal, si había, queda completo. */
  async function deleteFromGroup() {
    setSaving(true);
    const ok = await deleteGroupExpense(id);
    if (!ok) {
      setSaving(false);
      setSaveError('No pudimos borrar el gasto. Probá de nuevo.');
      return;
    }
    walletChanged();
    router.back();
    toast(editing?.movement ? 'Borraste el gasto del grupo · en tus finanzas cuenta completo' : 'Borraste el gasto del grupo');
  }

  /** Borrar un gasto personal (L9 y L10): no toca ningún pago. */
  async function removeExpense() {
    setSaving(true);
    setSaveError(null);
    const ok = await deleteExpense(id);
    if (!ok) {
      setSaving(false);
      setSaveError('No pudimos borrar el gasto. Probá de nuevo.');
      return;
    }
    walletChanged();
    router.back();
    toast('Borraste el gasto');
  }

  /** "Sí": con el monto corregido si hay un solo pago. */
  async function answerYes() {
    if (!question) return;
    let payments = question.payments;
    if (payments.length === 1) {
      const proposed = payments[0]!;
      const minor = formatAmountInput(paidAmount).minor;
      if (!minor) return setPaidError('Poné cuánto pagaste.');
      if (minor > proposed.debitedAmount.minor) return setPaidError(`No puede ser más que el gasto (${formatMoney(proposed.debitedAmount)}).`);
      payments = [editLatePayment(proposed, minor)];
    }
    setPaidError(null);
    await commit(question.draft, payments);
  }

  async function commit(draft: ExpenseDraft, payments: LatePayment[]) {
    if (!ctx || !session || !settings) return;
    setSaving(true);
    setSaveError(null);
    const failure = editId ? await updateExpense(draft, payments) : await saveExpense(draft, payments);
    if (failure) {
      setSaving(false);
      setSaveError(failure === 'offline' ? 'Sin conexión. Probá de nuevo.' : 'No pudimos guardar el gasto. Probá de nuevo.');
      return;
    }

    // Al editar, enseña solo si la categoría cambió respecto de la guardada.
    if (pickedCategory && pickedCategory !== deduced && pickedCategory !== saved?.category_id) {
      learnCategory(description, pickedCategory, ctx.methods).catch(() => {});
    }
    walletChanged();
    router.back();

    // Editar no tiene "Deshacer" (fuera de alcance de la lista de movimientos).
    if (editId) {
      toast('Guardaste los cambios' + paymentsToastSuffix(payments));
      return;
    }
    const text = await toastFor(draft, session.user.id, settings);
    toast(text + paymentsToastSuffix(payments), {
      label: 'Deshacer',
      onPress: async () => {
        let ok = true;
        if (payments.length) ok = await revertPayments(payments.map((p) => p.id)).then(() => true, () => false);
        if (ok) ok = await deleteExpense(draft.id);
        walletChanged();
        toast(ok ? 'Gasto borrado' : 'No se pudo borrar el gasto. Probá de nuevo.');
      },
    });
  }

  const cardSelected = method?.kind === 'card';
  const accountName = (p: LatePayment) => ctx?.accounts.get(p.fromAccountId)?.name ?? 'una cuenta';

  return (
    <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
      <View style={styles.head}>
        <Text style={[type.title, { color: colors.text }]} accessibilityRole="header">
          {groupExpenseId || editId ? 'Editar gasto' : group ? 'Gasto de grupo' : 'Cargar gasto'}
        </Text>
        <Button title="✕" variant="ghost" onPress={() => router.back()} accessibilityLabel="Cerrar" />
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={[styles.content, question && styles.frozen]}
        pointerEvents={question ? 'none' : 'auto'}
        keyboardShouldPersistTaps="handled"
        bottomOffset={90}
      >
        {/* 1. Carga por texto, plegada: no se lleva el foco. Al editar no va. */}
        {groupExpenseId || editId ? null : quickOpen ? (
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

        {savedFailed ? (
          <Button title="No pudimos traer el gasto. Reintentar" variant="link" onPress={() => setSavedFailed(false)} style={styles.start} />
        ) : null}

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
              editable={!editing?.payerLocked && !locked}
            />
          </View>
          {editing?.payerLocked || locked ? null : (
            <View style={styles.currency}>
              <Segmented options={CURRENCY_OPTIONS} value={currency} onChange={(c) => { setCurrency(c); setDebitedTouched(false); }} accessibilityLabel="Moneda" />
            </View>
          )}
        </View>
        {editing?.payerLocked ? (
          <Text style={[type.caption, { color: colors.textMuted }]}>El monto y la moneda los puede cambiar solo quien pagó.</Text>
        ) : locked ? (
          <Text style={[type.caption, { color: colors.textMuted }]}>El monto, la moneda y la fecha se cambian desde el grupo.</Text>
        ) : null}

        {/* 3. Medio de pago: ninguna ficha marcada al abrir. En un gasto de grupo, solo si pagaste vos. */}
        {iPay ? (
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
                  label={`${m.kind === 'card' && m.isFavorite ? '★ ' : ''}${methodName(m)}`}
                  mono={m.kind === 'card' ? `·· ${m.last4}` : undefined}
                  selected={addToMine && m.id === methodId}
                  onPress={() => chooseMethod(m)}
                />
              ))}
              <Chip label="Otro…" onPress={() => setOtherOpen(true)} />
              {group ? (
                <Chip
                  label="No sumarlo a mis finanzas"
                  selected={!addToMine}
                  onPress={() => {
                    setAddToMine(!addToMine);
                    setErrors((e) => ({ ...e, method: undefined }));
                  }}
                />
              ) : null}
            </View>
          )}
          {errors.method ? <Text style={[type.caption, { color: colors.error }]}>{errors.method}</Text> : null}
        </View>
        ) : null}

        {/* 4. Cuotas, solo con tarjeta de crédito. */}
        {cardSelected && needsMethod ? (
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

        {/* Gasto de grupo: quién pagó, cómo se divide y la cotización si la moneda es otra. */}
        {group && payerId ? (
          <GroupSplit
            group={group}
            memberIds={memberIds}
            payerId={payerId}
            onPayer={(m) => {
              setPayerId(m);
              setErrors((e) => ({ ...e, method: undefined }));
            }}
            payerLocked={!!editing?.payerLocked}
            mode={splitMode}
            onMode={(m) => {
              setSplitMode(m);
              setErrors((e) => ({ ...e, split: undefined }));
            }}
            included={included}
            onToggle={(m) => {
              setIncluded((list) => (list.includes(m) ? list.filter((x) => x !== m) : memberIds.filter((x) => x === m || list.includes(x))));
              setErrors((e) => ({ ...e, split: undefined }));
            }}
            exact={exact}
            onExact={(m, t) => {
              setExact((v) => ({ ...v, [m]: formatAmountInput(t).text }));
              setErrors((e) => ({ ...e, split: undefined }));
            }}
            remainderMinor={splitRemainder(splitDraft)}
            currency={currency}
            error={errors.split}
          />
        ) : null}
        {groupNeedsFx && group ? (
          <TextField
            label={`Cotización (${FX_LABEL[settings?.fx_reference ?? 'mep']}${expenseDate ? ` del ${formatShortDate(expenseDate)}` : ''})`}
            value={fxText}
            onChangeText={(t) => {
              setFxTouched(true);
              setFxText(formatAmountInput(t).text);
              setErrors((e) => ({ ...e, fx: undefined }));
            }}
            error={errors.fx}
            mono
            keyboardType="decimal-pad"
            placeholder={fxFound === false ? 'Escribí la cotización.' : '0'}
          />
        ) : null}
        {groupNeedsFx && group ? (
          <Text style={[type.caption, { color: colors.textMuted }]}>
            Pesos por dólar. La deuda del grupo queda en {group.currency === 'ARS' ? 'pesos' : 'dólares'} con esta cotización.
          </Text>
        ) : null}

        {/* 8. Lo descontado de una cuenta en otra moneda. */}
        {needsMethod && needsDebited && account ? (
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
          disabled={locked}
          accessibilityRole="button"
          accessibilityState={{ expanded: detailsOpen, disabled: locked }}
          hitSlop={8}
          style={styles.details}
        >
          <Text style={[type.small, { color: errors.date ? colors.error : colors.textMuted }]}>
            {locked ? '' : detailsOpen ? '▾ ' : '▸ '}
            {expenseDate && today ? dateLabel(expenseDate, today) : 'Hoy'}
            {editId ? '' : ` · ${group ? group.name : 'Sin grupo'}`}
          </Text>
        </Pressable>
        {detailsOpen && !locked && today && expenseDate ? (
          <DateChooser
            today={today}
            value={expenseDate}
            onChange={(d) => setDate(d === today ? null : d)}
            onError={(error) => setErrors((e) => ({ ...e, date: error ?? undefined }))}
            error={errors.date}
          />
        ) : null}
        {/* Grupo: fichas de los 3 grupos con actividad más reciente. Al editar, el grupo no cambia. */}
        {detailsOpen && !groupExpenseId && !editId ? (
          <View style={styles.block}>
            <Text style={[type.caption, { color: colors.textMuted }]}>Grupo</Text>
            {groupsFailed ? (
              <Button title="No pudimos traer tus grupos. Reintentar" variant="link" onPress={loadGroupsList} style={styles.start} />
            ) : !groups ? (
              <View style={[styles.skeleton, { backgroundColor: colors.surface2 }]} />
            ) : (
              <View style={styles.chips}>
                <Chip label="Sin grupo" selected={!group} onPress={() => chooseGroup(null)} />
                {[...recentGroups(groups), ...(group && !recentGroups(groups).includes(group) ? [group] : [])].map((g) => (
                  <Chip key={g.id} label={g.name} selected={g.id === groupId} onPress={() => chooseGroup(g.id)} />
                ))}
                {groups.length > 3 ? <Chip label="Otro…" onPress={() => setGroupsOpen(true)} /> : null}
              </View>
            )}
          </View>
        ) : null}

        {/* 9. En qué resumen entra. */}
        {statementHint && needsMethod ? <Text style={[type.caption, { color: colors.textMuted }]}>{statementHint}</Text> : null}

        {saveError ? (
          <Text style={[type.caption, { color: colors.error }]} accessibilityLiveRegion="polite">
            {saveError}
          </Text>
        ) : null}

        {/* Borrar con confirmación en la misma hoja: un gasto de grupo (D6) o uno personal (L10, sin "Deshacer"). */}
        {(groupExpenseId && editing) || (editId && saved) ? (
          confirmDelete ? (
            <View style={[styles.confirm, { borderColor: colors.line }]} accessibilityLiveRegion="polite">
              <Text style={[type.body, { color: colors.text }]}>
                {editId
                  ? '¿Borrás este gasto? No se puede deshacer.'
                  : `¿Borrás este gasto del grupo?${editing?.movement ? ' En tus finanzas queda y vuelve a contar completo.' : ''}`}
              </Text>
              <View style={styles.questionButtons}>
                <Button title="Cancelar" onPress={() => setConfirmDelete(false)} disabled={saving} />
                <Button title="Borrar" variant="primary" onPress={editId ? removeExpense : deleteFromGroup} loading={saving} />
              </View>
            </View>
          ) : (
            <Button title={editId ? 'Eliminar gasto' : 'Borrar gasto'} variant="link" onPress={() => setConfirmDelete(true)} style={styles.start} />
          )
        ) : null}
      </KeyboardAwareScrollView>

      {/* 10. Guardar, siempre arriba del teclado. */}
      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        {question ? (
          <View
            style={[styles.question, { backgroundColor: colors.surface, borderTopColor: colors.line, paddingBottom: 12 + insets.bottom }]}
            accessibilityLiveRegion="polite"
          >
            <Text style={[type.subtitle, { color: colors.text }]}>{alreadyPaidQuestion(question.payments, ctx!.today)}</Text>
            {question.payments.length === 1 ? (
              <TextField
                label={`Pago desde ${accountName(question.payments[0]!)}, ${formatShortDate(question.payments[0]!.paidAt)} (${question.payments[0]!.debitedAmount.currency === 'ARS' ? '$' : 'US$'})`}
                value={paidAmount}
                onChangeText={(t) => {
                  setPaidAmount(formatAmountInput(t).text);
                  setPaidError(null);
                }}
                error={paidError ?? undefined}
                mono
                keyboardType="decimal-pad"
              />
            ) : (
              question.payments.map((p) => (
                <Text key={p.id} style={[type.small, { color: colors.text }]}>
                  {proposedPaymentText(p, accountName(p))}
                </Text>
              ))
            )}
            {saveError ? (
              <Text style={[type.caption, { color: colors.error }]} accessibilityLiveRegion="polite">
                {saveError}
              </Text>
            ) : null}
            <View style={styles.questionButtons}>
              <Button title="Volver" variant="ghost" onPress={() => setQuestion(null)} disabled={saving} />
              <Button title="No" onPress={() => commit(question.draft, [])} disabled={saving} />
              <Button title="Sí" variant="primary" onPress={answerYes} loading={saving} />
            </View>
          </View>
        ) : (
          <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.line, paddingBottom: 12 + insets.bottom }]}>
            <Button title="Cancelar" onPress={() => router.back()} disabled={saving} />
            <Button
              title={editId ? 'Guardar cambios' : 'Guardar gasto'}
              variant="primary"
              onPress={save}
              loading={saving}
              disabled={!ctx || (!!editId && !saved)}
            />
          </View>
        )}
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
                          {methodName(m)}
                          {m.kind === 'card' ? (
                            <>
                              {' '}
                              <Mono>·· {m.last4}</Mono>
                            </>
                          ) : null}
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

      {/* "Otro…" de grupos: todos tus grupos. */}
      <Modal visible={groupsOpen} transparent animationType="fade" onRequestClose={() => setGroupsOpen(false)}>
        <Pressable style={[styles.scrim, { backgroundColor: colors.scrim }]} onPress={() => setGroupsOpen(false)} accessibilityLabel="Cerrar">
          <Pressable style={[styles.picker, { backgroundColor: colors.surface, paddingBottom: 20 + insets.bottom }]}>
            <Text style={[type.title, { color: colors.text }]} accessibilityRole="header">
              ¿De qué grupo?
            </Text>
            <ScrollView contentContainerStyle={styles.pickerList}>
              {(groups ?? []).map((g) => (
                <Pressable
                  key={g.id}
                  onPress={() => {
                    chooseGroup(g.id);
                    setGroupsOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: g.id === groupId }}
                  style={({ pressed }) => [styles.pickerRow, { borderBottomColor: colors.line }, pressed && { backgroundColor: colors.surface2 }]}
                >
                  <Text style={[type.bodyStrong, { color: g.id === groupId ? colors.primary : colors.text }]}>{g.name}</Text>
                </Pressable>
              ))}
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
  frozen: { opacity: 0.45 },
  start: { alignSelf: 'flex-start' },
  confirm: { borderWidth: 1, borderRadius: radius.md, padding: 12, gap: 10 },
  question: { gap: 10, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1 },
  questionButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1 },
  scrim: { flex: 1, justifyContent: 'flex-end' },
  picker: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: 20, gap: 14, maxHeight: '80%' },
  pickerList: { gap: 14 },
  pickerRow: { minHeight: 48, justifyContent: 'center', borderBottomWidth: 1 },
});
