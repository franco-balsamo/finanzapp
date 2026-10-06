import { formatMoney, moneyInWords, type GroupDetail } from '@mangos/core';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../components/Button';
import { absMoney as abs, ExpenseList, MemberList, memberName as nameOf, PaymentList, signed, TransferList } from '../../../components/GroupSections';
import { Screen } from '../../../components/Screen';
import { useToast } from '../../../components/Toast';
import { onWalletChanged, walletChanged } from '../../../lib/events';
import { loadGroupDetail, voidGroupPayment } from '../../../lib/groups';
import { useSession } from '../../../lib/session';
import { radius, type } from '../../../theme/tokens';
import { useTheme } from '../../../theme/useTheme';

const MAX_FACES = 4;

/** Detalle de grupo (G-4, diseño 1A): "+ Gasto" (G-5), "Registrar" y "Anular" (G-6) y ⋯ = Editar grupo (G-7). */
export default function GroupDetailScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const [data, setData] = useState<GroupDetail | null>(null);
  const [failed, setFailed] = useState(false);
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

  const active = data.members.filter((m) => !m.left);
  const faces = active.slice(0, MAX_FACES);
  const balanceColor = data.myBalance.minor > 0 ? colors.success : data.myBalance.minor < 0 ? colors.error : colors.textMuted;

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

      {/* Cómo saldar, con "Registrar" (G-6). */}
      <TransferList
        data={data}
        rowAction={(t, from, to) => (
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
        )}
        footer={
          <Button
            title="+ Registrar pago"
            variant="link"
            onPress={() => router.push({ pathname: '/grupo-pago/[groupId]', params: { groupId: data.id } })}
            style={styles.start}
          />
        }
      />

      <MemberList data={data} />

      {/* Gastos: tocar uno lo edita (G-5). */}
      <ExpenseList
        data={data}
        showMyShare
        emptyText='Todavía no hay gastos. Cargá el primero con "+ Gasto".'
        onPress={(e) => router.push({ pathname: '/cargar', params: { groupId: data.id, groupExpenseId: e.id } })}
      />

      {/* Pagos registrados, con "Anular" (G-6). */}
      <PaymentList
        data={data}
        above={
          confirmVoid ? (
            <View style={[styles.confirm, { borderColor: colors.line }]} accessibilityLiveRegion="polite">
              <Text style={[type.body, { color: colors.text }]}>¿Anulás este pago? Si estaba mal, se registra de nuevo.</Text>
              <View style={styles.confirmButtons}>
                <Button title="Cancelar" onPress={() => setConfirmVoid(null)} disabled={voiding} />
                <Button title="Anular" variant="primary" onPress={() => voidPayment(confirmVoid)} loading={voiding} />
              </View>
            </View>
          ) : null
        }
        rowAction={(p, from, to) =>
          p.voided ? null : (
            <Button title="Anular" variant="ghost" onPress={() => setConfirmVoid(p.id)} accessibilityLabel={`Anular el pago de ${from} a ${to}`} />
          )
        }
      />
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
  balance: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  confirm: { borderWidth: 1, borderRadius: radius.md, padding: 12, gap: 10 },
  confirmButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  skeletonTitle: { height: 22, width: 200, borderRadius: radius.sm },
  skeletonHero: { height: 35, width: 240, borderRadius: radius.sm },
  skeletonRow: { height: 46, borderRadius: radius.md, marginVertical: 6 },
});
