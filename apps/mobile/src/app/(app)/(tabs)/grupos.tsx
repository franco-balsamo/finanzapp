import { formatMoney, formatTotal, moneyInWords, type GroupList, type Money } from '@mangos/core';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../components/Button';
import { Fab, FAB_SPACE } from '../../../components/Fab';
import { Screen } from '../../../components/Screen';
import { onWalletChanged } from '../../../lib/events';
import { loadGroupList } from '../../../lib/groups';
import { useSession } from '../../../lib/session';
import { layout, radius, type } from '../../../theme/tokens';
import { useTheme } from '../../../theme/useTheme';

/** "+$60.000" o "−$5.000". */
function signed(m: Money): string {
  if (m.minor === 0) return formatMoney(m);
  return `${m.minor > 0 ? '+' : '−'}${formatMoney({ minor: Math.abs(m.minor), currency: m.currency })}`;
}

/** Grupos (G-3, vista "grupos" del prototipo): lo que te deben y debés, y tus grupos. */
export default function Groups() {
  const { colors } = useTheme();
  const { session } = useSession();
  const [data, setData] = useState<GroupList | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    if (!session) return;
    setFailed(false);
    loadGroupList(session.user.id).then(setData, () => setFailed(true));
  }, [session]);

  useFocusEffect(load);
  useEffect(() => onWalletChanged(load), [load]);

  const owedText = data ? formatTotal(data.owed) : '';
  const oweText = data ? formatTotal(data.owe) : '';

  return (
    <View style={styles.flex}>
      <Screen>
        <Text style={[type.label, { color: colors.textMuted }]}>Grupos</Text>

        {/* Te deben · Debés */}
        {data ? (
          <View style={styles.totals}>
            <View accessible accessibilityLabel={`Te deben ${data.owed.ARS.minor || data.owed.USD.minor ? owedText : 'nada'}`}>
              <Text style={[type.caption, { color: colors.textMuted }]}>Te deben</Text>
              <Text style={[type.moneyLg, { color: colors.success }]} maxFontSizeMultiplier={1.3}>
                +{owedText}
              </Text>
            </View>
            <View accessible accessibilityLabel={`Debés ${data.owe.ARS.minor || data.owe.USD.minor ? oweText : 'nada'}`}>
              <Text style={[type.caption, { color: colors.textMuted }]}>Debés</Text>
              <Text
                style={[type.moneyLg, { color: data.owe.ARS.minor || data.owe.USD.minor ? colors.error : colors.textMuted }]}
                maxFontSizeMultiplier={1.3}
              >
                −{oweText}
              </Text>
            </View>
          </View>
        ) : !failed ? (
          <View style={[styles.skeletonTotals, { backgroundColor: colors.surface2 }]} accessibilityLabel="Cargando" />
        ) : null}

        <Button title="+ Nuevo grupo" variant="primary" onPress={() => router.push('/grupo-nuevo')} style={styles.start} />

        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          {failed && !data ? (
            <View style={styles.state}>
              <Text style={[type.body, { color: colors.textMuted }]}>No pudimos traer tus grupos.</Text>
              <Button title="Reintentar" onPress={load} style={styles.start} />
            </View>
          ) : !data ? (
            [0, 1, 2].map((i) => <View key={i} style={[styles.skeletonRow, { backgroundColor: colors.surface2 }]} />)
          ) : data.groups.length === 0 ? (
            <Text style={[type.body, styles.state, { color: colors.textMuted }]}>
              Todavía no tenés grupos. Creá uno para un viaje, la casa o el asado.
            </Text>
          ) : (
            data.groups.map((g, i) => {
              const balance = g.myBalance;
              const color = balance.minor > 0 ? colors.success : balance.minor < 0 ? colors.error : colors.textMuted;
              const status = balance.minor > 0 ? 'te deben' : balance.minor < 0 ? 'debés' : 'estás al día';
              return (
                <View
                  key={g.id}
                  accessible
                  accessibilityLabel={`${g.name}, ${g.memberCount} personas, ${
                    balance.minor === 0 ? status : `${status} ${moneyInWords({ minor: Math.abs(balance.minor), currency: balance.currency })}`
                  }`}
                  style={[styles.row, i < data.groups.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.line }]}
                >
                  <View style={[styles.initial, { backgroundColor: colors.primarySoft }]}>
                    <Text style={[type.bodyStrong, { color: colors.primary }]}>{g.name.trim().charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.rowMiddle}>
                    <Text style={[type.bodyStrong, { color: colors.text }]} numberOfLines={1}>
                      {g.name}
                    </Text>
                    <Text style={[type.caption, { color: colors.textMuted }]}>
                      {g.memberCount === 1 ? '1 persona' : `${g.memberCount} personas`}
                    </Text>
                  </View>
                  <Text style={[type.money, { color }]} maxFontSizeMultiplier={1.3}>
                    {balance.minor === 0 ? 'Al día' : signed(balance)}
                  </Text>
                </View>
              );
            })
          )}
        </View>
        <View style={{ height: FAB_SPACE }} />
      </Screen>
      <Fab />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  totals: { flexDirection: 'row', gap: 28, flexWrap: 'wrap' },
  skeletonTotals: { height: 52, width: 260, borderRadius: radius.sm },
  start: { alignSelf: 'flex-start' },
  panel: { borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: layout.panelPadding, paddingVertical: 4 },
  state: { paddingVertical: 16, gap: 12 },
  skeletonRow: { height: 46, borderRadius: radius.md, marginVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: layout.rowPaddingV, minHeight: layout.minTouch },
  initial: { width: layout.rowIcon, height: layout.rowIcon, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  rowMiddle: { flex: 1, minWidth: 0 },
});
