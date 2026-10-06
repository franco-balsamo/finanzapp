import {
  formatMoney,
  formatShortDate,
  addDays,
  formatTotal,
  moneyInWords,
  todayInArgentina,
  type DetailStatement,
  type Period,
  type StatementStatus,
} from '@mangos/core';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../components/Button';
import { CreditCard } from '../../../components/CreditCard';
import { Pill, type PillVariant } from '../../../components/Pill';
import { Screen } from '../../../components/Screen';
import { useToast } from '../../../components/Toast';
import { categoryLabel } from '../../../lib/categories';
import { onWalletChanged, walletChanged } from '../../../lib/events';
import { revertPayments } from '../../../lib/payments';
import { archiveCard, setFavoriteCard, unarchiveCard } from '../../../lib/cardActions';
import { useSession } from '../../../lib/session';
import { loadCardDetail, type CardDetailData } from '../../../lib/wallet';
import { layout, radius, type } from '../../../theme/tokens';
import { useTheme } from '../../../theme/useTheme';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const STATUS: Record<StatementStatus, { label: string; variant: PillVariant }> = {
  current: { label: 'En curso', variant: 'neutral' },
  future: { label: 'Cuotas futuras', variant: 'neutral' },
  to_pay: { label: 'A pagar', variant: 'warning' },
  partial: { label: 'Pago parcial', variant: 'warning' },
  paid: { label: 'Pagado', variant: 'success' },
  overdue: { label: 'Vencido', variant: 'error' },
};

const MAX_ITEMS = 30;
const MAX_FUTURE = 6;

/** "octubre", o "enero de 2027" si no es de este año. */
function periodName(period: Period, short = false): string {
  const [year, month] = period.split('-').map(Number) as [number, number];
  const name = (short ? MONTHS_SHORT : MONTHS)[month - 1]!;
  return year === Number(todayInArgentina().slice(0, 4)) || short ? name : `${name} de ${year}`;
}

const hasPending = (s: DetailStatement) => s.pending.ARS.minor > 0 || s.pending.USD.minor > 0;

/** Detalle de tarjeta de crédito (D-2, diseño 6A). */
export default function CardDetailScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, settings } = useSession();
  const toast = useToast();
  const [data, setData] = useState<CardDetailData | null>(null);
  const [failed, setFailed] = useState(false);
  const [period, setPeriod] = useState<Period | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!session || !settings || !id) return;
    setFailed(false);
    loadCardDetail(session.user.id, settings, id).then(setData, () => setFailed(true));
  }, [session, settings, id]);

  useFocusEffect(load);
  useEffect(() => onWalletChanged(load), [load]);

  const detail = data?.detail;
  const statements = detail?.statements ?? [];
  // Se abre en el más urgente de "A pagar"; si no hay, en el resumen en curso.
  const selectedPeriod = period ?? detail?.defaultPeriod ?? null;
  const index = statements.findIndex((s) => s.period === selectedPeriod);
  const statement = index >= 0 ? statements[index]! : null;
  const status = statement ? STATUS[statement.status] : null;

  const goTo = (i: number) => {
    const target = statements[i];
    if (!target) return;
    setPeriod(target.period);
    setShowAll(false);
  };

  if (failed && !data) {
    return (
      <Screen>
        <Button title="‹ Billetera" variant="ghost" onPress={() => router.back()} style={styles.back} />
        <Text style={[type.body, { color: colors.textMuted }]}>No pudimos traer la tarjeta.</Text>
        <Button title="Reintentar" onPress={load} />
      </Screen>
    );
  }

  // Solo los resúmenes cerrados se pagan (A pagar, Pago parcial o Vencido).
  const canPay = !!statement && hasPending(statement) && statement.status !== 'current' && statement.status !== 'future';

  async function undoPayment(paymentId: string, amount: string, accountName: string) {
    try {
      await revertPayments([paymentId]);
      toast(`Pago deshecho · ${amount} volvieron a ${accountName}`);
    } catch {
      toast('No se pudo deshacer el pago. Probá de nuevo.');
    }
    walletChanged();
  }

  async function makeFavorite() {
    if (!detail) return;
    setBusy(true);
    try {
      await setFavoriteCard(detail.card.id);
      toast(`${detail.card.name} es tu favorita`);
    } catch {
      toast('No se pudo marcar como favorita. Probá de nuevo.');
    }
    setBusy(false);
    walletChanged();
  }

  async function archive() {
    if (!detail) return;
    const cardId = detail.card.id;
    setBusy(true);
    try {
      await archiveCard(cardId);
      walletChanged();
      router.back();
      toast('Tarjeta archivada', {
        label: 'Deshacer',
        onPress: async () => {
          try {
            await unarchiveCard(cardId);
            toast('Tarjeta recuperada');
          } catch {
            toast('No se pudo recuperar. Probá desde "Archivadas" en la Billetera.');
          }
          walletChanged();
        },
      });
    } catch {
      setBusy(false);
      toast('No se pudo archivar la tarjeta. Probá de nuevo.');
    }
  }

  // Consumos distintos de la tarjeta (una compra en cuotas cuenta una vez), para el aviso al archivar.
  const expenseCount = new Set(statements.flatMap((s) => s.items.map((i) => i.expenseId))).size;

  const items = statement?.items ?? [];
  const visibleItems = showAll ? items : items.slice(0, MAX_ITEMS);
  const limitPercent =
    detail?.limitUsed && detail.card.creditLimit.minor > 0
      ? Math.min(100, Math.round((detail.limitUsed.minor / detail.card.creditLimit.minor) * 100))
      : null;

  return (
    <Screen>
      <Button title="‹ Billetera" variant="ghost" onPress={() => router.back()} style={styles.back} />

      {detail && statement ? (
        <CreditCard
          bank={detail.card.bank}
          network={detail.card.network}
          last4={detail.card.last4}
          expiry={detail.card.expiry}
          color={detail.card.color}
          isFavorite={detail.card.isFavorite}
          total={statement.total}
          dueLabel={`Vence ${formatShortDate(statement.dueDate)}`}
        />
      ) : (
        <View style={[styles.plasticSkeleton, { backgroundColor: colors.surface2 }]} accessibilityLabel="Cargando" />
      )}

      {statement && status ? (
        <View style={styles.block}>
          {/* ‹ Resumen de octubre › */}
          <View style={styles.nav}>
            <Button title="‹" variant="ghost" onPress={() => goTo(index - 1)} disabled={index <= 0} accessibilityLabel="Resumen anterior" />
            <View style={styles.navTitle} accessible accessibilityLabel={`Resumen de ${periodName(statement.period)}, ${status.label}`}>
              <Text style={[type.title, { color: colors.text }]}>Resumen de {periodName(statement.period)}</Text>
              <Pill label={status.label} variant={status.variant} />
            </View>
            <Button
              title="›"
              variant="ghost"
              onPress={() => goTo(index + 1)}
              disabled={index >= statements.length - 1}
              accessibilityLabel="Resumen siguiente"
            />
          </View>
          <Text style={[type.caption, styles.center, { color: colors.textMuted }]}>
            Cierra {formatShortDate(statement.closeDate)} · Vence {formatShortDate(statement.dueDate)}
          </Text>
          {hasPending(statement) && statement.status !== 'current' && statement.status !== 'future' ? (
            <Text style={[type.small, styles.center, { color: colors.text }]}>
              Quedan {formatTotal(statement.pending)}
              {statement.minimumPayment.minor > 0 ? ` · Pago mínimo aprox. ${formatMoney(statement.minimumPayment)}` : ''}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Carga por texto: en D-2 abre la hoja con esta tarjeta; D-5 la cambia por la de varias líneas. */}
      {detail ? (
        <Pressable
          onPress={() => router.push({ pathname: '/cargar', params: { cardId: detail.card.id } })}
          accessibilityRole="button"
          style={[styles.quick, { backgroundColor: colors.surface, borderColor: colors.line }]}
        >
          <Text style={[type.body, { color: colors.textMuted }]}>¿Te falta cargar algo?</Text>
        </Pressable>
      ) : null}

      {canPay && detail && statement ? (
        <Button
          title="Pagar resumen"
          variant="primary"
          onPress={() =>
            router.push({ pathname: '/pagar/[cardId]/[period]', params: { cardId: detail.card.id, period: statement.period } })
          }
        />
      ) : null}

      {/* Pagos de este resumen, con Deshacer. */}
      {statement && statement.payments.length ? (
        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <Text style={[type.subtitle, { color: colors.text }]}>Pagos de este resumen</Text>
          {statement.payments.map((p, i) => {
            const account = data?.accounts.get(p.fromAccountId)?.name ?? 'una cuenta';
            const debitedText = formatMoney(p.debitedAmount);
            return (
              <View
                key={p.id}
                style={[styles.row, i < statement.payments.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.line }]}
              >
                <View
                  style={styles.rowMiddle}
                  accessible
                  accessibilityLabel={`Pago de ${moneyInWords(p.amount)} desde ${account}, el ${formatShortDate(p.paidAt)}`}
                >
                  <Text style={[type.money, { color: colors.text }]}>{formatMoney(p.amount)}</Text>
                  <Text style={[type.caption, { color: colors.textMuted }]} numberOfLines={1}>
                    {formatShortDate(p.paidAt)} · desde {account}
                    {p.appliesTo !== p.debitedAmount.currency ? ` (${debitedText})` : ''}
                  </Text>
                </View>
                <Button title="Deshacer" variant="ghost" onPress={() => undoPayment(p.id, debitedText, account)} />
              </View>
            );
          })}
        </View>
      ) : null}

      {/* Cuotas que siguen. */}
      {detail && detail.futureInstallments.length ? (
        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <Text style={[type.subtitle, { color: colors.text }]}>Cuotas que siguen</Text>
          <Text style={[type.money, { color: colors.text }]}>
            {detail.futureInstallments
              .slice(0, MAX_FUTURE)
              .map((f) => `${periodName(f.period, true)} ${formatTotal(f.total)}`)
              .join(' · ')}
            {detail.futureInstallments.length > MAX_FUTURE ? ` · +${detail.futureInstallments.length - MAX_FUTURE}` : ''}
          </Text>
        </View>
      ) : null}

      {/* Consumos de este resumen. */}
      {statement ? (
        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <Text style={[type.subtitle, { color: colors.text }]}>Consumos de este resumen · {items.length}</Text>
          {items.length === 0 ? (
            <Text style={[type.body, { color: colors.textMuted }]}>No cargaste nada en este resumen.</Text>
          ) : (
            visibleItems.map((item, i) => (
              <View
                key={`${item.expenseId}-${item.index}`}
                accessible
                accessibilityLabel={`${item.description}, ${formatShortDate(item.date)}${item.of > 1 ? `, cuota ${item.index} de ${item.of}` : ''}, ${moneyInWords(item.amount)}, ${categoryLabel(item.categoryId)}`}
                style={[styles.row, i < visibleItems.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.line }]}
              >
                <View style={styles.rowMiddle}>
                  <Text style={[type.bodyStrong, { color: colors.text }]} numberOfLines={1}>
                    {item.description || 'Sin descripción'}
                  </Text>
                  <Text style={[type.caption, { color: colors.textMuted }]} numberOfLines={1}>
                    {formatShortDate(item.date)}
                    {item.of > 1 ? ` · cuota ${item.index}/${item.of}` : ''}
                  </Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={[type.money, { color: colors.text }]} maxFontSizeMultiplier={1.3}>
                    {formatMoney(item.amount)}
                  </Text>
                  <Text style={[type.caption, { color: colors.textMuted }]}>{categoryLabel(item.categoryId)}</Text>
                </View>
              </View>
            ))
          )}
          {!showAll && items.length > MAX_ITEMS ? (
            <Button title={`Ver todos (${items.length})`} variant="link" onPress={() => setShowAll(true)} style={styles.start} />
          ) : null}
        </View>
      ) : null}

      {/* Límite de compra. */}
      {detail ? (
        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <View style={styles.limitHead}>
            <Text style={[type.subtitle, { color: colors.text }]}>Límite de compra</Text>
            {limitPercent !== null ? <Text style={[type.money, { color: colors.text }]}>{limitPercent}%</Text> : null}
          </View>
          {limitPercent !== null && detail.limitUsed && detail.available ? (
            <>
              <View
                style={[styles.track, { backgroundColor: colors.surface2 }]}
                accessible
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: 100, now: limitPercent }}
              >
                <View style={[styles.fill, { width: `${limitPercent}%`, backgroundColor: colors.primary }]} />
              </View>
              <Text style={[type.caption, { color: colors.textMuted }]}>
                Usado {formatMoney(detail.limitUsed)} · Disponible {formatMoney(detail.available)} de {formatMoney(detail.card.creditLimit)}
              </Text>
            </>
          ) : (
            <Text style={[type.caption, { color: colors.textMuted }]}>
              {detail.card.creditLimit.minor > 0
                ? 'Falta el dólar tarjeta para calcular el límite usado.'
                : 'Sin límite cargado.'}
            </Text>
          )}
        </View>
      ) : null}

      {/* Configuración (D-4). */}
      {detail ? (
        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <Text style={[type.subtitle, { color: colors.text }]}>Configuración</Text>
          {statement ? (
            <Button
              title={`Corregir cierre de ${periodName(statement.period)}`}
              variant="link"
              onPress={() => router.push({ pathname: '/cierre/[cardId]/[period]', params: { cardId: detail.card.id, period: statement.period } })}
              style={styles.start}
            />
          ) : null}
          <Button
            title="Editar tarjeta"
            variant="link"
            onPress={() => router.push({ pathname: '/tarjeta-editar/[id]', params: { id: detail.card.id } })}
            style={styles.start}
          />
          {!detail.card.isFavorite ? (
            <Button title="Marcar como favorita" variant="link" onPress={makeFavorite} disabled={busy} style={styles.start} />
          ) : null}
          {confirmArchive ? (
            <View style={[styles.confirm, { borderColor: colors.line }]} accessibilityLiveRegion="polite">
              <Text style={[type.body, { color: colors.text }]}>
                {expenseCount === 1 ? 'Tiene 1 consumo.' : `Tiene ${expenseCount} consumos.`} Deja de verse y se borra el{' '}
                {formatShortDate(addDays(todayInArgentina(), 7))}, salvo que la recuperes antes. Su deuda sigue contando.
              </Text>
              <View style={styles.confirmButtons}>
                <Button title="Cancelar" onPress={() => setConfirmArchive(false)} disabled={busy} />
                <Button title="Archivar" variant="primary" onPress={archive} loading={busy} />
              </View>
            </View>
          ) : (
            <Button title="Archivar tarjeta" variant="link" onPress={() => setConfirmArchive(true)} style={styles.start} />
          )}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start' },
  plasticSkeleton: { aspectRatio: 1.586, borderRadius: radius.card },
  block: { gap: 4 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navTitle: { alignItems: 'center', gap: 4, flex: 1 },
  center: { textAlign: 'center' },
  quick: { borderWidth: 1, borderRadius: radius.sm, paddingVertical: 9, paddingHorizontal: 10, minHeight: 44, justifyContent: 'center' },
  panel: { borderWidth: 1, borderRadius: radius.lg, padding: layout.panelPadding, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  rowMiddle: { flex: 1, minWidth: 0 },
  rowRight: { alignItems: 'flex-end' },
  start: { alignSelf: 'flex-start' },
  confirm: { borderWidth: 1, borderRadius: radius.md, padding: 12, gap: 10 },
  confirmButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  limitHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  track: { height: 8, borderRadius: radius.xs, overflow: 'hidden' },
  fill: { height: 8, borderRadius: radius.xs },
});
