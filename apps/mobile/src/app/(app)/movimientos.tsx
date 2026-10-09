import {
  addDays,
  formatMoney,
  moneyInWords,
  movementList,
  periodMonthName,
  todayInArgentina,
  type ISODate,
  type MovementFilter,
  type MovementListRow,
  type Period,
} from '@mangos/core';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { CategoryIcon } from '../../components/CategoryIcon';
import { Chip } from '../../components/Chip';
import { Fab, FAB_SPACE } from '../../components/Fab';
import { Mono } from '../../components/Mono';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { categoryLabel } from '../../lib/categories';
import { onWalletChanged } from '../../lib/events';
import { useSession } from '../../lib/session';
import { loadWalletInput } from '../../lib/wallet';
import { layout, radius, type } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** "Hoy", "Ayer" o "jueves 1 de octubre" (con el año si no es este). */
function dayLabel(date: ISODate, today: ISODate): string {
  if (date === today) return 'Hoy';
  if (date === addDays(today, -1)) return 'Ayer';
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${weekday} ${day} de ${periodMonthName(date.slice(0, 7), today)}`;
}

/** "Octubre 2026". */
function monthLabel(period: Period): string {
  const name = periodMonthName(period, `${period}-01`);
  return `${name[0]!.toUpperCase()}${name.slice(1)} ${period.slice(0, 4)}`;
}

// Montos ("$12.000", "US$ 30"), los últimos 4 ("·· 2337") y "3/6".
const NUMBERS = /((?:US)?\$ ?[\d.,]+|·· \d{4}|\d+\/\d+)/;

/** Un texto corrido con sus números en Plex Mono (DESIGN.md, Do's). */
function withMono(text: string) {
  return text.split(NUMBERS).map((part, i) => (i % 2 ? <Mono key={i}>{part}</Mono> : part));
}

/** Lista de movimientos (L-4): mes, búsqueda, "Sin medio de pago" y el total del filtro. */
export default function Movements() {
  const { colors } = useTheme();
  const { session, settings } = useSession();
  const params = useLocalSearchParams<{ month?: string }>();
  const [loaded, setLoaded] = useState<Awaited<ReturnType<typeof loadWalletInput>> | null>(null);
  const [failed, setFailed] = useState(false);
  const today = todayInArgentina();
  const [filter, setFilter] = useState<MovementFilter>({
    month: params.month ?? today.slice(0, 7),
    query: '',
    missingMethodOnly: false,
  });
  const [monthsOpen, setMonthsOpen] = useState(false);

  const userId = session?.user.id;
  const fxReference = settings?.fx_reference;
  const load = useCallback(() => {
    if (!userId || !fxReference) return;
    setFailed(false);
    loadWalletInput(userId, { fx_reference: fxReference, display_currency: 'ARS' }).then(setLoaded, () => setFailed(true));
  }, [userId, fxReference]);

  // Al volver de editar o borrar, se recarga.
  useFocusEffect(load);
  useEffect(() => onWalletChanged(load), [load]);

  const list = useMemo(() => (loaded ? movementList(loaded.input, filter) : null), [loaded, filter]);
  // El gasto de grupo se edita desde su grupo: hace falta el id del grupo para abrir la hoja.
  const groupOf = useMemo(() => new Map(loaded?.input.groups.flatMap((g) => g.expenses.map((e) => [e.id, g.id] as const)) ?? []), [loaded]);

  function open(row: MovementListRow) {
    if (row.action === 'edit' || row.action === 'complete') {
      router.push({ pathname: '/cargar', params: { movementId: row.id } });
    } else if (row.action === 'group' && row.groupExpenseId && groupOf.has(row.groupExpenseId)) {
      router.push({ pathname: '/cargar', params: { groupId: groupOf.get(row.groupExpenseId)!, groupExpenseId: row.groupExpenseId } });
    }
  }

  // El mes que llega de Inicio aparece aunque no tenga movimientos.
  const months =
    list && filter.month !== 'all' && !list.months.includes(filter.month) ? [filter.month, ...list.months] : (list?.months ?? []);
  const hasMovements = !!loaded?.input.movements.length;
  const filtered = filter.month !== today.slice(0, 7) || filter.query !== '' || filter.missingMethodOnly;
  const totalText = list
    ? [
        list.totals.ARS.minor !== 0 || !list.totals.USD ? formatMoney(list.totals.ARS) : null,
        list.totals.USD ? formatMoney(list.totals.USD) : null,
      ]
        .filter(Boolean)
        .join(' + ')
    : '';

  return (
    <View style={styles.flex}>
      <Screen>
        <View style={styles.header}>
          <Button title="‹" variant="ghost" onPress={() => router.back()} accessibilityLabel="Volver" />
          <Text style={[type.title, { color: colors.text }]} accessibilityRole="header">
            Movimientos
          </Text>
        </View>

        {failed && !loaded ? (
          <View style={styles.state}>
            <Text style={[type.body, { color: colors.textMuted }]}>No pudimos cargar tus movimientos.</Text>
            <Button title="Reintentar" onPress={load} />
          </View>
        ) : !list ? (
          <View accessibilityLabel="Cargando">
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.skeletonRow, { backgroundColor: colors.surface2 }]} />
            ))}
          </View>
        ) : !hasMovements ? (
          <Text style={[type.body, styles.state, { color: colors.textMuted }]}>Todavía no cargaste gastos. Tocá + Gasto para empezar.</Text>
        ) : (
          <View style={styles.block}>
            <TextField
              label="Buscar por descripción o monto"
              value={filter.query}
              onChangeText={(query) => setFilter({ ...filter, query })}
              autoCorrect={false}
              returnKeyType="search"
            />
            <View style={styles.chips}>
              <Chip
                label={`${filter.month === 'all' ? 'Todos los meses' : monthLabel(filter.month)} ${monthsOpen ? '▴' : '▾'}`}
                selected={monthsOpen}
                onPress={() => setMonthsOpen(!monthsOpen)}
                accessibilityLabel={`Mes: ${filter.month === 'all' ? 'todos los meses' : monthLabel(filter.month)}. Cambiar`}
              />
              {list.missingMethodCount ? (
                <Chip
                  label="Sin medio de pago"
                  mono={String(list.missingMethodCount)}
                  selected={filter.missingMethodOnly}
                  onPress={() => setFilter({ ...filter, missingMethodOnly: !filter.missingMethodOnly })}
                />
              ) : null}
            </View>
            {monthsOpen ? (
              <View style={[styles.months, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                {['all' as const, ...months].map((m) => (
                  <Chip
                    key={m}
                    label={m === 'all' ? 'Todos los meses' : monthLabel(m)}
                    selected={filter.month === m}
                    onPress={() => {
                      setFilter({ ...filter, month: m, missingMethodOnly: false });
                      setMonthsOpen(false);
                    }}
                  />
                ))}
              </View>
            ) : null}

            <Text style={[type.small, { color: colors.textMuted }]} accessibilityLiveRegion="polite">
              {list.count === 1 ? '1 movimiento' : `${list.count} movimientos`} · {withMono(totalText)}
            </Text>

            {list.count === 0 ? (
              <View style={styles.state}>
                <Text style={[type.body, { color: colors.textMuted }]}>No hay movimientos con este filtro.</Text>
                {filtered ? (
                  <Button
                    title="Limpiar filtros"
                    onPress={() => setFilter({ month: today.slice(0, 7), query: '', missingMethodOnly: false })}
                    style={styles.start}
                  />
                ) : null}
              </View>
            ) : (
              list.days.map((day) => (
                <View key={day.date}>
                  <Text style={[styles.dayHeader, { color: colors.textMuted, borderBottomColor: colors.line }]} accessibilityRole="header">
                    {dayLabel(day.date, today)}
                  </Text>
                  {day.rows.map((row, i) => (
                    <MovementRow
                      key={row.id}
                      // Un grupo que abandonaste ya no se ve: su gasto no se puede abrir.
                      row={row.action === 'group' && !groupOf.has(row.groupExpenseId!) ? { ...row, action: 'none' } : row}
                      last={i === day.rows.length - 1}
                      onPress={() => open(row)}
                    />
                  ))}
                </View>
              ))
            )}
          </View>
        )}
        <View style={{ height: FAB_SPACE }} />
      </Screen>
      <Fab />
    </View>
  );
}

/** `MovementRow` de DESIGN.md: ícono, descripción con su subtítulo y el monto con la categoría. */
function MovementRow({ row, last, onPress }: { row: MovementListRow; last: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const category = categoryLabel(row.categoryId);
  const right = row.isGroup ? `Grupo · ${category}` : category;
  const amountColor = row.sign === 'plus' ? colors.success : row.sign === 'minus' ? colors.error : colors.text;
  const amountText = `${row.sign === 'plus' ? '+ ' : row.sign === 'minus' ? '− ' : ''}${formatMoney(row.amount)}`;
  const parts = [row.installmentsLabel, row.myShare ? `tu parte ${formatMoney(row.myShare)}` : null].filter(Boolean);
  const actionable = row.action !== 'none';

  return (
    <Pressable
      onPress={actionable ? onPress : undefined}
      disabled={!actionable}
      accessibilityRole={actionable ? 'button' : 'text'}
      accessibilityLabel={[
        row.description || 'Sin descripción',
        row.methodLabel ?? 'Sin medio de pago',
        ...parts,
        `${row.sign === 'plus' ? 'más ' : row.sign === 'minus' ? 'menos ' : ''}${moneyInWords(row.amount)}`,
        right,
      ].join(', ')}
      accessibilityHint={row.action === 'complete' && !row.methodLabel ? 'Completá con qué pagaste' : undefined}
      style={({ pressed }) => [
        styles.row,
        !last && { borderBottomWidth: 1, borderBottomColor: colors.line },
        pressed && actionable && { backgroundColor: colors.surface2 },
      ]}
    >
      <CategoryIcon categoryId={row.categoryId} size="md" />
      <View style={styles.rowMiddle}>
        <Text style={[type.bodyStrong, { color: colors.text }]} numberOfLines={1}>
          {row.description || 'Sin descripción'}
        </Text>
        <Text style={[type.caption, { color: colors.textMuted }]} numberOfLines={1}>
          {row.methodLabel ? withMono(row.methodLabel) : <Text style={{ color: colors.warning }}>Sin medio de pago</Text>}
          {parts.length ? withMono(` · ${parts.join(' · ')}`) : null}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={[type.money, { color: amountColor }]} maxFontSizeMultiplier={1.3}>
          {amountText}
        </Text>
        <Text style={[type.caption, { color: colors.textMuted }]} numberOfLines={1}>
          {right}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  block: { gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  months: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, borderWidth: 1, borderRadius: radius.lg, padding: 12 },
  skeletonRow: { height: 46, borderRadius: radius.md, marginVertical: 6 },
  state: { gap: 12, paddingVertical: 16, paddingHorizontal: 4 },
  start: { alignSelf: 'flex-start' },
  // DayHeader: 12 / 500 con 0.06em, distinto de `label` (I-5).
  dayHeader: {
    ...type.label,
    fontSize: 12,
    letterSpacing: 0.72,
    paddingTop: 14,
    paddingBottom: 4,
    borderBottomWidth: 1,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, minHeight: layout.minTouch },
  rowMiddle: { flex: 1, minWidth: 0 },
  rowRight: { alignItems: 'flex-end', maxWidth: '45%' },
});
