import {
  formatMoney,
  formatShortDate,
  moneyInWords,
  type GroupDetail,
  type GroupExpenseView,
  type GroupMemberView,
  type GroupPaymentView,
  type GroupTransferView,
  type Money,
} from '@mangos/core';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { layout, radius, type } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { Button } from './Button';

// Las secciones del detalle de grupo (1A). Las usan la app (G-4, con acciones) y la web de
// invitados (W-3, de solo lectura): mismos datos de core, mismo dibujo.

const MAX_EXPENSES = 30;

export const absMoney = (m: Money): Money => ({ minor: Math.abs(m.minor), currency: m.currency });

/** "+$60.000" o "−$10.000"; "$0" si está al día. */
export function signed(m: Money): string {
  if (m.minor === 0) return formatMoney(m);
  return `${m.minor > 0 ? '+' : '−'}${formatMoney(absMoney(m))}`;
}

/** "sesenta mil pesos a favor", "diez mil pesos en contra" o "al día". */
export function balanceInWords(m: Money): string {
  if (m.minor === 0) return 'al día';
  return `${moneyInWords(absMoney(m))} ${m.minor > 0 ? 'a favor' : 'en contra'}`;
}

/** "Vos" para tu lugar; si no, el nombre. */
export const memberName = (m: Pick<GroupMemberView, 'isMe' | 'name'>) => (m.isMe ? 'Vos' : m.name);

/** El nombre a mostrar de un integrante por id ("Vos" si es tu lugar). */
export function nameIn(data: GroupDetail, memberId: string, fallback: string): string {
  return data.members.find((m) => m.id === memberId)?.isMe ? 'Vos' : fallback;
}

function Panel({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.line }]}>{children}</View>;
}

/** Cómo saldar: las transferencias de `simplifyDebts`. */
export function TransferList({
  data,
  rowAction,
  footer,
}: {
  data: GroupDetail;
  rowAction?: (t: GroupTransferView, from: string, to: string) => ReactNode;
  footer?: ReactNode;
}) {
  const { colors } = useTheme();
  const n = data.transfers.length;
  return (
    <Panel>
      <Text style={[type.subtitle, { color: colors.text }]}>
        Cómo saldar{n ? ` · ${n === 1 ? '1 transferencia' : `${n} transferencias`}` : ''}
      </Text>
      {n === 0 ? (
        <Text style={[type.body, { color: colors.textMuted }]}>Están todos al día.</Text>
      ) : (
        data.transfers.map((t, i) => {
          const from = nameIn(data, t.fromId, t.fromName);
          const to = nameIn(data, t.toId, t.toName);
          return (
            <View
              key={`${t.fromId}-${t.toId}`}
              accessible={!rowAction}
              accessibilityLabel={`${from} le paga a ${to} ${moneyInWords(t.amount)}`}
              style={[styles.row, i < n - 1 && { borderBottomWidth: 1, borderBottomColor: colors.line }]}
            >
              <Text style={[type.body, styles.flex, { color: colors.text }, t.involvesMe && type.bodyStrong]} numberOfLines={1}>
                {from} → {to}
              </Text>
              <Text style={[type.money, { color: colors.text }]} maxFontSizeMultiplier={1.3}>
                {formatMoney(t.amount)}
              </Text>
              {rowAction?.(t, from, to)}
            </View>
          );
        })
      )}
      {footer}
    </Panel>
  );
}

/** Integrantes con su saldo y las marcas "sin cuenta", "se sumó 2/10" y "se fue". */
export function MemberList({
  data,
  rowAction,
  below,
}: {
  data: GroupDetail;
  rowAction?: (m: GroupMemberView) => ReactNode;
  /** Algo debajo de la lista (una confirmación, un panel). */
  below?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Panel>
      <Text style={[type.subtitle, { color: colors.text }]}>Integrantes</Text>
      {data.members.map((m, i) => {
        const marks = [
          m.isProvisional ? 'sin cuenta' : null,
          m.claimedOn ? `se sumó ${formatShortDate(m.claimedOn)}` : null,
          m.left ? 'se fue' : null,
        ].filter(Boolean);
        const color = m.balance.minor > 0 ? colors.success : m.balance.minor < 0 ? colors.error : colors.textMuted;
        const action = rowAction?.(m);
        return (
          <View
            key={m.id}
            accessible={!action}
            accessibilityLabel={`${memberName(m)}${marks.length ? `, ${marks.join(', ')}` : ''}, ${balanceInWords(m.balance)}`}
            style={[
              styles.row,
              i < data.members.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.line },
              m.left && styles.faded,
            ]}
          >
            <View style={[styles.initial, { backgroundColor: m.isMe ? colors.primary : colors.primarySoft }]}>
              <Text style={[type.bodyStrong, { color: m.isMe ? colors.onPrimary : colors.primary }]}>
                {memberName(m).trim().charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={[type.body, styles.flex, { color: colors.text }]} numberOfLines={1}>
              <Text style={type.bodyStrong}>{memberName(m)}</Text>
              {marks.length ? <Text style={{ color: colors.textMuted }}> · {marks.join(' · ')}</Text> : null}
            </Text>
            <Text style={[type.money, { color }]} maxFontSizeMultiplier={1.3}>
              {signed(m.balance)}
            </Text>
            {action}
          </View>
        );
      })}
      {below}
    </Panel>
  );
}

/** Gastos, del más nuevo al más viejo: 30 y "Ver todos (N)". */
export function ExpenseList({
  data,
  onPress,
  showMyShare,
  emptyText,
}: {
  data: GroupDetail;
  /** En la app: abre el gasto para editarlo. */
  onPress?: (e: GroupExpenseView) => void;
  /** "tu parte $X": solo con un lugar propio (no en la web de invitados). */
  showMyShare: boolean;
  emptyText: string;
}) {
  const { colors } = useTheme();
  const [showAll, setShowAll] = useState(false);
  const expenses = showAll ? data.expenses : data.expenses.slice(0, MAX_EXPENSES);
  return (
    <Panel>
      <Text style={[type.subtitle, { color: colors.text }]}>Gastos · {data.expenses.length}</Text>
      {data.expenses.length === 0 ? (
        <Text style={[type.body, { color: colors.textMuted }]}>{emptyText}</Text>
      ) : (
        expenses.map((e, i) => {
          const payer = nameIn(data, e.payerId, e.payerName);
          const label = `${e.description}, ${formatShortDate(e.date)}, pagó ${payer}, ${moneyInWords(e.amount)}${
            showMyShare ? `, tu parte ${moneyInWords(e.myShare)}` : ''
          }`;
          const content = (
            <>
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
                {showMyShare ? (
                  <Text style={[type.caption, { color: colors.textMuted }]}>
                    {e.myShare.minor ? `tu parte ${formatMoney(e.myShare)}` : 'no participás'}
                  </Text>
                ) : null}
              </View>
            </>
          );
          const border = i < expenses.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.line };
          return onPress ? (
            <Pressable
              key={e.id}
              onPress={() => onPress(e)}
              accessibilityRole="button"
              accessibilityHint="Abre el gasto para editarlo"
              accessibilityLabel={label}
              style={({ pressed }) => [styles.row, border, pressed && { opacity: 0.7 }]}
            >
              {content}
            </Pressable>
          ) : (
            <View key={e.id} accessible accessibilityLabel={label} style={[styles.row, border]}>
              {content}
            </View>
          );
        })
      )}
      {!showAll && data.expenses.length > MAX_EXPENSES ? (
        <Button title={`Ver todos (${data.expenses.length})`} variant="link" onPress={() => setShowAll(true)} style={styles.start} />
      ) : null}
    </Panel>
  );
}

/** Pagos registrados, plegados; los anulados, tachados. */
export function PaymentList({
  data,
  rowAction,
  above,
}: {
  data: GroupDetail;
  rowAction?: (p: GroupPaymentView, from: string, to: string) => ReactNode;
  /** Arriba de la lista (la confirmación de "Anular"). */
  above?: ReactNode;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  if (!data.payments.length) return null;
  const active = data.payments.filter((p) => !p.voided).length;
  return (
    <Panel>
      <Pressable
        onPress={() => setOpen(!open)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        hitSlop={8}
        style={styles.toggle}
      >
        <Text style={[type.subtitle, { color: colors.text }]}>
          {open ? '▾' : '▸'} Pagos registrados ({active})
        </Text>
      </Pressable>
      {above}
      {open
        ? data.payments.map((p, i) => {
            const from = nameIn(data, p.fromId, p.fromName);
            const to = nameIn(data, p.toId, p.toName);
            const action = rowAction?.(p, from, to);
            return (
              <View
                key={p.id}
                accessible={!action}
                accessibilityLabel={`${p.voided ? 'Anulado: ' : ''}${from} le pagó a ${to} ${moneyInWords(p.amount)}, el ${formatShortDate(p.date)}`}
                style={[
                  styles.row,
                  i < data.payments.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.line },
                  p.voided && styles.faded,
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
                {action}
              </View>
            );
          })
        : null}
    </Panel>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  start: { alignSelf: 'flex-start' },
  panel: { borderWidth: 1, borderRadius: radius.lg, padding: layout.panelPadding, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: layout.rowPaddingV, minHeight: layout.minTouch },
  initial: { width: layout.rowIcon, height: layout.rowIcon, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  right: { alignItems: 'flex-end' },
  faded: { opacity: 0.5 },
  voided: { textDecorationLine: 'line-through' },
  toggle: { minHeight: layout.minTouch, justifyContent: 'center' },
});
