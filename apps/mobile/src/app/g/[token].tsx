import type { GroupDetail } from '@mangos/core';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { ExpenseList, MemberList, PaymentList, TransferList } from '../../components/GroupSections';
import { Screen } from '../../components/Screen';
import { loadGuestGroup } from '../../lib/guest';
import { radius, type } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

const MAX_WIDTH = 560;

/**
 * Web de invitados (W-3, 02 §7): el grupo de solo lectura, sin instalar nada. Nunca muestra el
 * alias ni datos personales: `get_guest_group` no los devuelve.
 */
export default function GuestGroup() {
  const { colors } = useTheme();
  const { token } = useLocalSearchParams<{ token: string }>();
  const [data, setData] = useState<GroupDetail | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'invalid' | 'failed'>('loading');

  const load = useCallback(() => {
    if (!token) return;
    setState('loading');
    loadGuestGroup(token).then(
      (group) => {
        setData(group);
        setState(group ? 'ready' : 'invalid');
      },
      () => setState('failed'),
    );
  }, [token]);
  useEffect(load, [load]);

  return (
    <Screen>
      <View style={styles.page}>
        <Text style={[type.label, { color: colors.primary }]}>Mangos</Text>

        {state === 'loading' ? (
          <View style={styles.block} accessibilityLabel="Cargando">
            <View style={[styles.skeletonTitle, { backgroundColor: colors.surface2 }]} />
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.skeletonRow, { backgroundColor: colors.surface2 }]} />
            ))}
          </View>
        ) : state === 'invalid' ? (
          <Text style={[type.body, { color: colors.text }]}>Este link ya no funciona. Pedile uno nuevo a alguien del grupo.</Text>
        ) : state === 'failed' || !data ? (
          <View style={styles.block}>
            <Text style={[type.body, { color: colors.textMuted }]}>No pudimos traer el grupo.</Text>
            <Button title="Reintentar" onPress={load} style={styles.start} />
          </View>
        ) : (
          <>
            <View style={styles.block}>
              <Text style={[type.title, { color: colors.text }]} accessibilityRole="header">
                {data.name}
              </Text>
              <Text style={[type.caption, { color: colors.textMuted }]}>
                {data.memberCount === 1 ? '1 persona' : `${data.memberCount} personas`} · {data.currency === 'ARS' ? 'pesos' : 'dólares'}
              </Text>
            </View>
            <MemberList data={data} />
            <TransferList data={data} />
            <ExpenseList data={data} showMyShare={false} emptyText="Todavía no hay gastos." />
            <PaymentList data={data} />
            <View style={[styles.footer, { borderTopColor: colors.line }]}>
              <Text style={[type.small, { color: colors.textMuted }]}>
                Mangos registra los gastos del grupo. Instalá la app para llevar los tuyos.
              </Text>
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', gap: 18 },
  block: { gap: 6 },
  start: { alignSelf: 'flex-start' },
  footer: { borderTopWidth: 1, paddingTop: 14 },
  skeletonTitle: { height: 22, width: 200, borderRadius: radius.sm },
  skeletonRow: { height: 46, borderRadius: radius.md, marginVertical: 6 },
});
