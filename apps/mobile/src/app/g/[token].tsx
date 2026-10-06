import type { GroupDetail } from '@mangos/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { ClaimPanel } from '../../components/ClaimPanel';
import { ExpenseList, MemberList, PaymentList, TransferList } from '../../components/GroupSections';
import { Screen } from '../../components/Screen';
import { loadGuestGroup } from '../../lib/guest';
import { radius, type } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

const MAX_WIDTH = 560;

/**
 * Web de invitados (W-3, 02 §7): el grupo de solo lectura, sin instalar nada, y "Soy Juan" para reclamar un lugar provisorio (W-5). Nunca muestra el
 * alias ni datos personales: `get_guest_group` no los devuelve.
 */
export default function GuestGroup() {
  const { colors } = useTheme();
  // `claim` va en la URL: al iniciar sesión, el layout raíz se vuelve a montar y el estado se perdería.
  const { token, claim } = useLocalSearchParams<{ token: string; claim?: string }>();
  const [data, setData] = useState<GroupDetail | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'invalid' | 'failed'>('loading');

  const load = useCallback((quiet = false) => {
    if (!token) return;
    if (!quiet) setState('loading');
    loadGuestGroup(token).then(
      (group) => {
        setData(group);
        setState(group ? 'ready' : 'invalid');
      },
      () => setState('failed'),
    );
  }, [token]);
  useEffect(() => load(), [load]);

  // "Soy Juan" (W-5): el lugar que se está reclamando. Se mantiene aunque ya no sea provisorio,
  // para mostrar "Ya sos Juan".
  const claimingMember = claim ? data?.members.find((m) => m.id === claim) : undefined;
  const setClaim = (memberId: string | undefined) => router.setParams({ claim: memberId });

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
            <Button title="Reintentar" onPress={() => load()} style={styles.start} />
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
            <MemberList
              data={data}
              rowAction={(m) =>
                m.isProvisional && !m.left && !claimingMember ? (
                  <Button
                    title={`Soy ${m.name}`}
                    variant="ghost"
                    onPress={() => setClaim(m.id)}
                    accessibilityLabel={`Soy ${m.name}: tomar su lugar en el grupo`}
                  />
                ) : null
              }
              below={
                claimingMember && token ? (
                  <ClaimPanel
                    token={token}
                    memberId={claimingMember.id}
                    memberName={claimingMember.name}
                    groupName={data.name}
                    onClose={() => setClaim(undefined)}
                    onChanged={() => load(true)}
                  />
                ) : null
              }
            />
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
