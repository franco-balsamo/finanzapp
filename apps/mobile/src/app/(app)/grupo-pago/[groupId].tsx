import { amountInputText, formatAmountInput, formatMoney, money, todayInArgentina, type DbWalletGroup, type ISODate } from '@mangos/core';
import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../components/Button';
import { Chip } from '../../../components/Chip';
import { DateChooser } from '../../../components/DateChooser';
import { Sheet } from '../../../components/Sheet';
import { SheetFooter } from '../../../components/SheetFooter';
import { TextField } from '../../../components/TextField';
import { useToast } from '../../../components/Toast';
import { walletChanged } from '../../../lib/events';
import { loadAccountsIn, registerGroupPayment, voidGroupPayment } from '../../../lib/groups';
import { useSession } from '../../../lib/session';
import { loadGroups } from '../../../lib/wallet';
import { type } from '../../../theme/tokens';
import { useTheme } from '../../../theme/useTheme';

interface Errors {
  people?: string;
  amount?: string;
  date?: string;
}

/**
 * Registrar un pago entre integrantes (G-6). Desde "Cómo saldar" llega con quién paga, a quién y
 * el monto propuestos; desde "+ Registrar pago", vacía. Mangos lo anota: no mueve plata.
 */
export default function GroupPayment() {
  const { colors } = useTheme();
  const toast = useToast();
  const { session } = useSession();
  const params = useLocalSearchParams<{ groupId: string; from?: string; to?: string; amount?: string }>();
  const id = useRef(randomUUID()).current;
  const today = todayInArgentina();

  const [group, setGroup] = useState<DbWalletGroup | null>(null);
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [failed, setFailed] = useState(false);
  const [fromId, setFromId] = useState<string | null>(params.from ?? null);
  const [toId, setToId] = useState<string | null>(params.to ?? null);
  const [amount, setAmount] = useState(params.amount ? amountInputText(Number(params.amount)) : '');
  const [date, setDate] = useState<ISODate>(today);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    loadGroups(session.user.id).then((groups) => {
      const g = groups.find((x) => x.id === params.groupId) ?? null;
      setGroup(g);
      if (!g) return setFailed(true);
      loadAccountsIn(g.currency).then(setAccounts, () => setAccounts([]));
    }, () => setFailed(true));
  }, [session, params.groupId]);

  const active = group ? group.members.filter((m) => !m.left_at) : [];
  const label = (memberId: string) =>
    memberId === group?.my_member_id ? 'Vos' : (group?.members.find((m) => m.id === memberId)?.display_name ?? '');
  // "Mover saldo de…" solo si sos el que paga o el que cobra (D7).
  const involvesMe = !!group && (fromId === group.my_member_id || toId === group.my_member_id);
  const iGetPaid = !!group && toId === group.my_member_id;

  async function save() {
    if (!group) return;
    const found: Errors = {};
    const minor = formatAmountInput(amount).minor;
    if (!fromId || !toId) found.people = 'Elegí quién pagó y a quién.';
    else if (fromId === toId) found.people = 'Elegí a dos personas distintas.';
    if (!minor) found.amount = 'Poné un monto mayor a cero.';
    if (errors.date) found.date = errors.date;
    setErrors(found);
    if (Object.keys(found).length || !fromId || !toId || !minor) return;

    setSaving(true);
    setSaveError(null);
    const paid = money(minor, group.currency);
    const failure = await registerGroupPayment({
      id,
      groupId: group.id,
      fromMemberId: fromId,
      toMemberId: toId,
      amount: paid,
      date,
      accountId: involvesMe ? accountId : null,
    });
    if (failure) {
      setSaving(false);
      setSaveError(failure === 'offline' ? 'Sin conexión. Probá de nuevo.' : 'No pudimos registrar el pago. Probá de nuevo.');
      return;
    }
    walletChanged();
    router.back();
    toast(`Pago registrado · ${label(fromId)} → ${label(toId)} ${formatMoney(paid)}`, {
      label: 'Deshacer',
      onPress: async () => {
        const ok = await voidGroupPayment(id);
        walletChanged();
        toast(ok ? 'Pago anulado' : 'No se pudo anular el pago. Probá de nuevo.');
      },
    });
  }

  const people = (selected: string | null, onPick: (memberId: string) => void) => (
    <View style={styles.chips}>
      {active.map((m) => (
        <Chip key={m.id} label={label(m.id)} selected={m.id === selected} onPress={() => onPick(m.id)} />
      ))}
    </View>
  );

  return (
    <Sheet
      title="Registrar pago"
      onClose={() => router.back()}
      footer={<SheetFooter actionTitle="Registrar" onAction={save} onCancel={() => router.back()} loading={saving} />}
    >
      {failed ? (
        <Text style={[type.body, { color: colors.textMuted }]}>No pudimos traer el grupo.</Text>
      ) : !group ? (
        <View style={[styles.skeleton, { backgroundColor: colors.surface2 }]} accessibilityLabel="Cargando" />
      ) : (
        <>
          <View style={styles.field}>
            <Text style={[type.caption, { color: errors.people ? colors.error : colors.textMuted }]}>Quién pagó</Text>
            {people(fromId, (m) => {
              setFromId(m);
              setErrors((e) => ({ ...e, people: undefined }));
            })}
          </View>
          <View style={styles.field}>
            <Text style={[type.caption, { color: errors.people ? colors.error : colors.textMuted }]}>A quién</Text>
            {people(toId, (m) => {
              setToId(m);
              setErrors((e) => ({ ...e, people: undefined }));
            })}
            {errors.people ? <Text style={[type.caption, { color: colors.error }]}>{errors.people}</Text> : null}
          </View>

          <TextField
            label={`Monto (${group.currency === 'ARS' ? '$' : 'US$'})`}
            value={amount}
            onChangeText={(t) => {
              setAmount(formatAmountInput(t).text);
              setErrors((e) => ({ ...e, amount: undefined }));
            }}
            error={errors.amount}
            mono
            keyboardType="decimal-pad"
            placeholder="0"
            style={type.moneyInput}
            maxFontSizeMultiplier={1.3}
          />

          <View style={styles.field}>
            <Text style={[type.caption, { color: colors.textMuted }]}>Fecha</Text>
            <DateChooser
              today={today}
              value={date}
              onChange={setDate}
              onError={(error) => setErrors((e) => ({ ...e, date: error ?? undefined }))}
              error={errors.date}
            />
          </View>

          {/* Mover saldo de… (D7): "No mover saldos" por defecto. */}
          {involvesMe ? (
            <View style={styles.field}>
              <Text style={[type.caption, { color: colors.textMuted }]}>{iGetPaid ? 'Mover saldo: entra en' : 'Mover saldo: sale de'}</Text>
              <View style={styles.chips}>
                <Chip label="No mover saldos" selected={accountId === null} onPress={() => setAccountId(null)} />
                {accounts.map((a) => (
                  <Chip key={a.id} label={a.name} selected={a.id === accountId} onPress={() => setAccountId(a.id)} />
                ))}
              </View>
              {accounts.length === 0 ? (
                <Text style={[type.caption, { color: colors.textMuted }]}>
                  No tenés cuentas en {group.currency === 'ARS' ? 'pesos' : 'dólares'}.
                </Text>
              ) : null}
            </View>
          ) : null}

          <Text style={[type.caption, { color: colors.textMuted }]}>Mangos anota el pago; la plata la mueven ustedes.</Text>
        </>
      )}

      {saveError ? (
        <Text style={[type.caption, { color: colors.error }]} accessibilityLiveRegion="polite">
          {saveError}
        </Text>
      ) : null}
      {failed ? <Button title="Volver" onPress={() => router.back()} style={styles.start} /> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  skeleton: { height: 120, borderRadius: 8 },
  start: { alignSelf: 'flex-start' },
});
