import { formatMoney, formatShortDate, moneyInWords, type GroupDetail, type GroupMemberView, type Money } from '@mangos/core';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../components/Button';
import { Screen } from '../../../components/Screen';
import { useToast } from '../../../components/Toast';
import { onWalletChanged, walletChanged } from '../../../lib/events';
import { loadGroupDetail, voidGroupPayment } from '../../../lib/groups';
import { useSession } from '../../../lib/session';
import { layout, radius, type } from '../../../theme/tokens';
import { useTheme } from '../../../theme/useTheme';

const MAX_EXPENSES = 30;
const MAX_FACES = 4;

const abs = (m: Money): Money => ({ minor: Math.abs(m.minor), currency: m.currency });

/** "+$60.000" o "−$10.000"; "$0" si está al día. */
function signed(m: Money): string {
  if (m.minor === 0) return formatMoney(m);
  return `${m.minor > 0 ? '+' : '−'}${formatMoney(abs(m))}`;
}

/** "sesenta mil pesos a favor", "diez mil pesos en contra" o "al día". */
function balanceInWords(m: Money): string {
  if (m.minor === 0) return 'al día';
  return `${moneyInWords(abs(m))} ${m.minor > 0 ? 'a favor' : 'en contra'}`;
}

const nameOf = (m: Pick<GroupMemberView, 'isMe' | 'name'>) => (m.isMe ? 'Vos' : m.name);

/** Detalle de grupo (G-4, diseño 1A): "+ Gasto" (G-5), "Registrar" y "Anular" (G-6) y ⋯ = Editar grupo (G-7). */
export default function GroupDetailScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const [data, setData] = useState<GroupDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [paymentsOpen, setPaymentsOpen] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState<string | null>(null);
  const [voiding, setVoiding] = useState(false);
  const toast = useToast();

  async function voidPayment(paymentId: string) {
    setVoiding(true);
    const ok = await voidGroupPayment(paymentId);
    setVoiding(false);
    setConfirmVoid(null);
    walletChanged();
    toast(ok ? 'Pago anulado · si estaba mal, registralo de nuevo' : 'No se pudo anular el pago. Probá de nuevo.');
  }

  const load = useCallback(() => {
    if (!session || !id) return;
    setFailed(false);
    loadGroupDetail(session.user.id, id).then(setData, () => setFailed(true));
  }, [session, id]);

  useFocusEffect(load);
  useEffect(() => onWalletChanged(load), [load]);

  const back = <Button title="‹ Grupos" variant="ghost" onPress={() => router.back()} style={styles.start} />;
  const header = (
    <View style={styles.topBar}>
      {back}
      {data ? (
        <Button
          title="⋯"
          variant="ghost"
          onPress={() => router.push({ pathname: '/grupo-editar/[id]', params: { id: data.id } })}
          accessibilityLabel="Editar grupo"
        />
      ) : null}
    </View>
  );

  if (failed && !data) {
    return (
      <Screen>
        {back}
        <Text style={[type.body, { color: colors.textMuted }]}>No pudimos traer el grupo.</Text>
        <Button title="Reintentar" onPress={load} style={styles.start} />
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen>
        {back}
        <View accessibilityLabel="Cargando" style={styles.block}>
          <View style={[styles.skeletonTitle, { backgroundColor: colors.surface2 }]} />
          <View style={[styles.skeletonHero, { backgroundColor: colors.surface2 }]} />
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.skeletonRow, { backgroundColor: colors.surface2 }]} />
          ))}
        </View>
      </Screen>
    );
  }

  const active = data.members.filter((m) => !m.leftOn);
  const faces = active.slice(0, MAX_FACES);
  const balanceColor = data.myBalance.minor > 0 ? colors.success : data.myBalance.minor < 0 ? colors.error : colors.textMuted;
  const expenses = showAll ? data.expenses : data.expenses.slice(0, MAX_EXPENSES);
  const activePayments = data.payments.filter((p) => !p.voided).length;
  const name = (memberId: string, fallback: string) => (data.members.find((m) => m.id === memberId)?.isMe ? 'Vos' : fallback);

  return (
    <Screen>
      {header}

      {/* Encabezado: personas y moneda, nombre, caritas, tu saldo y el total. */}
      <View style={styles.block}>
        <Text style={[type.caption, { color: colors.textMuted }]}>
          {data.memberCount === 1 ? '1 persona' : `${data.memberCount} personas`} · {data.currency === 'ARS' ? 'pesos' : 'dólares'}
        </Text>
        <View style={styles.titleRow}>
          <Text style={[type.title, styles.flex, { color: colors.text }]} accessibilityRole="header" numberOfLines={2}>
            {data.name}
          </Text>
          <View style={styles.faces} accessible accessibilityLabel={`Integrantes: ${active.map(nameOf).join(', ')}`}>
            {faces.map((m, i) => (
              <View
                key={m.id}
                style={[
                  styles.face,
                  { backgroundColor: m.isMe ? colors.primary : colors.primarySoft, borderColor: colors.bg },
                  i > 0 && styles.faceOverlap,
                ]}
              >
                <Text style={[type.caption, { color: m.isMe ? colors.onPrimary : colors.primary }]}>
                  {nameOf(m).trim().charAt(0).toUpperCase()}
                </Text>
              </View>
            ))}
            {active.length > MAX_FACES ? (
              <View style={[styles.face, styles.faceOverlap, { backgroundColor: colors.surface2, borderColor: colors.bg }]}>
                <Text style={[type.caption, { color: colors.textMuted }]}>+{active.length - MAX_FACES}</Text>
              </View>
            ) : null}
          </View>
        </View>
        {data.myBalance.minor === 0 ? (
          <Text style={[type.title, { color: colors.textMuted }]}>Estás al día</Text>
        ) : (
          <View
            style={styles.balance}
            accessible
            accessibilityLabel={data.myBalance.minor > 0 ? `Te deben ${moneyInWords(data.myBalance)}` : `Debés ${moneyInWords(abs(data.myBalance))}`}
          >
            <Text style={[type.moneyLg, { color: balanceColor }]} maxFontSizeMultiplier={1.3}>
              {signed(data.myBalance)}
            </Text>
            <Text style={[type.body, { color: colors.textMuted }]}>{data.myBalance.minor > 0 ? 'te deben' : 'debés'}</Text>
          </View>
        )}
        <Text style={[type.small, { color: colors.textMuted }]} accessibilityLabel={`Total gastado: ${moneyInWords(data.totalSpent)}`}>
          Total gastado: {formatMoney(data.totalSpent)}
        </Text>
        {!data.isOwner ? (
          <Text style={[type.caption, { color: colors.textMuted }]}>
            {data.ownerName ? `Dueño: ${data.ownerName}` : 'El grupo no tiene dueño.'}
          </Text>
        ) : null}
        <Button
          title="+ Gasto"
          variant="primary"
          onPress={() => router.push({ pathname: '/cargar', params: { groupId: data.id } })}
          style={styles.start}
        />
      </View>

      {/* Cómo saldar. */}
      <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <Text style={[type.subtitle, { color: colors.text }]}>
          Cómo saldar{data.transfers.length ? ` · ${data.transfers.length === 1 ? '1 transferencia' : `${data.transfers.length} transferencias`}` : ''}
        </Text>
        {data.transfers.length === 0 ? (
          <Text style={[type.body, { color: colors.textMuted }]}>Están todos al día.</Text>
        ) : (
          data.transfers.map((t, i) => {
            const from = name(t.fromId, t.fromName);
            const to = name(t.toId, t.toName);
            return (
              <View
                key={`${t.fromId}-${t.toId}`}
                accessible
                accessibilityLabel={`${from} le paga a ${to} ${moneyInWords(t.amount)}`}
                style={[styles.row, i < data.transfers.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.line }]}
              >
                <Text style={[type.body, styles.flex, { color: colors.text }, t.involvesMe && type.bodyStrong]} numberOfLines={1}>
                  {from} → {to}
                </Text>
                <Text style={[type.money, { color: colors.text }]} maxFontSizeMultiplier={1.3}>
                  {formatMoney(t.amount)}
                </Text>
                <Button
                  title="Registrar"
                  variant="ghost"
                  onPress={() =>
                    router.push({
                      pathname: '/grupo-pago/[groupId]',
                      params: { groupId: data.id, from: t.fromId, to: t.toId, amount: String(t.amount.minor) },
                    })
                  }
                  accessibilityLabel={`Registrar que ${from} le pagó a ${to} ${moneyInWords(t.amount)}`}
                />
              </View>
            );
          })
        )}
        <Button
          title="+ Registrar pago"
          variant="link"
          onPress={() => router.push({ pathname: '/grupo-pago/[groupId]', params: { groupId: data.id } })}
          style={styles.start}
        />
      </View>

      {/* Integrantes. */}
      <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <Text style={[type.subtitle, { color: colors.text }]}>Integrantes</Text>
        {data.members.map((m, i) => {
          const marks = [
            m.isProvisional ? 'sin cuenta' : null,
            m.claimedOn ? `se sumó ${formatShortDate(m.claimedOn)}` : null,
            m.leftOn ? 'se fue' : null,
          ].filter(Boolean);
          const color = m.balance.minor > 0 ? colors.success : m.balance.minor < 0 ? colors.error : colors.textMuted;
          return (
            <View
              key={m.id}
              accessible
              accessibilityLabel={`${nameOf(m)}${marks.length ? `, ${marks.join(', ')}` : ''}, ${balanceInWords(m.balance)}`}
              style={[
                styles.row,
                i < data.members.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.line },
                m.leftOn && styles.left,
              ]}
            >
              <View style={[styles.initial, { backgroundColor: m.isMe ? colors.primary : colors.primarySoft }]}>
                <Text style={[type.bodyStrong, { color: m.isMe ? colors.onPrimary : colors.primary }]}>
                  {nameOf(m).trim().charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={[type.body, styles.flex, { color: colors.text }]} numberOfLines={1}>
                <Text style={type.bodyStrong}>{nameOf(m)}</Text>
                {marks.length ? <Text style={{ color: colors.textMuted }}> · {marks.join(' · ')}</Text> : null}
              </Text>
              <Text style={[type.money, { color }]} maxFontSizeMultiplier={1.3}>
                {signed(m.balance)}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Gastos. */}
      <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <Text style={[type.subtitle, { color: colors.text }]}>Gastos · {data.expenses.length}</Text>
        {data.expenses.length === 0 ? (
          <Text style={[type.body, { color: colors.textMuted }]}>Todavía no hay gastos. Cargá el primero con "+ Gasto".</Text>
        ) : (
          expenses.map((e, i) => {
            const payer = name(e.payerId, e.payerName);
            return (
              <Pressable
                key={e.id}
                onPress={() => router.push({ pathname: '/cargar', params: { groupId: data.id, groupExpenseId: e.id } })}
                accessibilityRole="button"
                accessibilityHint="Abre el gasto para editarlo"
                accessibilityLabel={`${e.description}, ${formatShortDate(e.date)}, pagó ${payer}, ${moneyInWords(e.amount)}, tu parte ${moneyInWords(e.myShare)}`}
                style={({ pressed }) => [
                  styles.row,
                  i < expenses.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.line },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <View style={styles.flex}>
                  <Text style={[type.bodyStrong, { color: colors.text }]} numberOfLines={1}>
                    {e.description}
                  </Text>
                  <Text style={[type.caption, { color: colors.textMuted }]} numberOfLines={1}>
                    {formatShortDate(e.date)} · pagó {payer}
                  </Text>
                </View>
                <View style={styles.right}>
                  <Text style={[type.money, { color: colors.text }]} maxFontSizeMultiplier={1.3}>
                    {formatMoney(e.amount)}
                  </Text>
                  <Text style={[type.caption, { color: colors.textMuted }]}>
                    {e.myShare.minor ? `tu parte ${formatMoney(e.myShare)}` : 'no participás'}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}
        {!showAll && data.expenses.length > MAX_EXPENSES ? (
          <Button title={`Ver todos (${data.expenses.length})`} variant="link" onPress={() => setShowAll(true)} style={styles.start} />
        ) : null}
      </View>

      {/* Pagos registrados, plegados. */}
      {data.payments.length ? (
        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <Pressable
            onPress={() => setPaymentsOpen(!paymentsOpen)}
            accessibilityRole="button"
            accessibilityState={{ expanded: paymentsOpen }}
            hitSlop={8}
            style={styles.toggle}
          >
            <Text style={[type.subtitle, { color: colors.text }]}>
              {paymentsOpen ? '▾' : '▸'} Pagos registrados ({activePayments})
            </Text>
          </Pressable>
          {confirmVoid ? (
            <View style={[styles.confirm, { borderColor: colors.line }]} accessibilityLiveRegion="polite">
              <Text style={[type.body, { color: colors.text }]}>¿Anulás este pago? Si estaba mal, se registra de nuevo.</Text>
              <View style={styles.confirmButtons}>
                <Button title="Cancelar" onPress={() => setConfirmVoid(null)} disabled={voiding} />
                <Button title="Anular" variant="primary" onPress={() => voidPayment(confirmVoid)} loading={voiding} />
              </View>
            </View>
          ) : null}
          {paymentsOpen
            ? data.payments.map((p, i) => {
                const from = name(p.fromId, p.fromName);
                const to = name(p.toId, p.toName);
                return (
                  <View
                    key={p.id}
                    accessible
                    accessibilityLabel={`${p.voided ? 'Anulado: ' : ''}${from} le pagó a ${to} ${moneyInWords(p.amount)}, el ${formatShortDate(p.date)}`}
                    style={[
                      styles.row,
                      i < data.payments.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.line },
                      p.voided && styles.left,
                    ]}
                  >
                    <View style={styles.flex}>
                      <Text style={[type.body, { color: colors.text }, p.voided && styles.voided]} numberOfLines={1}>
                        {from} → {to}
                      </Text>
                      <Text style={[type.caption, { color: colors.textMuted }]}>
                        {formatShortDate(p.date)}
                        {p.voided ? ' · anulado' : ''}
                      </Text>
                    </View>
                    <Text style={[type.money, { color: colors.text }, p.voided && styles.voided]} maxFontSizeMultiplier={1.3}>
                      {formatMoney(p.amount)}
                    </Text>
                    {!p.voided ? (
                      <Button
                        title="Anular"
                        variant="ghost"
                        onPress={() => setConfirmVoid(p.id)}
                        accessibilityLabel={`Anular el pago de ${from} a ${to}`}
                      />
                    ) : null}
                  </View>
                );
              })
            : null}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  start: { alignSelf: 'flex-start' },
  block: { gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  faces: { flexDirection: 'row' },
  face: { width: 28, height: 28, borderRadius: radius.full, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  faceOverlap: { marginLeft: -8 },
  panel: { borderWidth: 1, borderRadius: radius.lg, padding: layout.panelPadding, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: layout.rowPaddingV, minHeight: layout.minTouch },
  initial: { width: layout.rowIcon, height: layout.rowIcon, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  right: { alignItems: 'flex-end' },
  balance: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  left: { opacity: 0.5 },
  voided: { textDecorationLine: 'line-through' },
  confirm: { borderWidth: 1, borderRadius: radius.md, padding: 12, gap: 10 },
  confirmButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  toggle: { minHeight: layout.minTouch, justifyContent: 'center' },
  skeletonTitle: { height: 22, width: 200, borderRadius: radius.sm },
  skeletonHero: { height: 35, width: 240, borderRadius: radius.sm },
  skeletonRow: { height: 46, borderRadius: radius.md, marginVertical: 6 },
});
