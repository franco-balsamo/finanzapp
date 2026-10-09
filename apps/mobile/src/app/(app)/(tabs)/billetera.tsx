import { daysBetween, todayInArgentina, wallet } from '@mangos/core';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AccountRow } from '../../../components/AccountRow';
import { Button } from '../../../components/Button';
import { CardRow } from '../../../components/CardRow';
import { Fab, FAB_SPACE } from '../../../components/Fab';
import { Pill } from '../../../components/Pill';
import { Screen } from '../../../components/Screen';
import { Tabs } from '../../../components/Tabs';
import { useToast } from '../../../components/Toast';
import { unarchiveCard } from '../../../lib/cardActions';
import { onWalletChanged, walletChanged } from '../../../lib/events';
import { useSession } from '../../../lib/session';
import { loadWalletInput, type WalletData } from '../../../lib/wallet';
import { radius, type } from '../../../theme/tokens';
import { useTheme } from '../../../theme/useTheme';

type Tab = 'cards' | 'accounts';
const TABS = [
  { value: 'cards', label: 'Tarjetas' },
  { value: 'accounts', label: 'Cuentas' },
] as const;

/** Billetera (E4): tarjetas con lo que viene y cuentas con su saldo. El patrimonio está en Inicio. */
export default function Wallet() {
  const { colors } = useTheme();
  const { session, settings } = useSession();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('cards');
  const [loaded, setLoaded] = useState<Awaited<ReturnType<typeof loadWalletInput>> | null>(null);
  const [failed, setFailed] = useState(false);

  const userId = session?.user.id;
  const fxReference = settings?.fx_reference;
  const load = useCallback(() => {
    if (!userId || !fxReference) return;
    setFailed(false);
    loadWalletInput(userId, { fx_reference: fxReference, display_currency: 'ARS' }).then(setLoaded, () => setFailed(true));
  }, [userId, fxReference]);

  const data = useMemo<WalletData | null>(() => {
    if (!loaded) return null;
    return { ...wallet(loaded.input), referenceRate: loaded.referenceRate };
  }, [loaded]);

  // Al volver de "Sumar tarjeta" o de cargar un gasto, se vuelve a calcular.
  useFocusEffect(load);
  // El "Deshacer" del toast pasa con la Billetera a la vista: no hay cambio de foco.
  useEffect(() => onWalletChanged(load), [load]);

  async function recover(cardId: string, name: string) {
    try {
      await unarchiveCard(cardId);
      toast(`${name} volvió a la Billetera`);
    } catch {
      toast('No se pudo recuperar la tarjeta. Probá de nuevo.');
    }
    walletChanged();
  }

  return (
    <View style={styles.flex}>
      <Screen>
        <Text style={[type.display, { color: colors.text }]} accessibilityRole="header">
          Billetera
        </Text>

        <Button title="Ver movimientos" variant="link" onPress={() => router.push('/movimientos')} style={styles.add} />
        <Tabs options={TABS} value={tab} onChange={setTab} />

        {failed ? (
          <View style={styles.state}>
            <Text style={[type.body, { color: colors.textMuted }]}>
              {tab === 'cards' ? 'No pudimos traer tus tarjetas.' : 'No pudimos traer tus cuentas.'}
            </Text>
            <Button title="Reintentar" onPress={load} />
          </View>
        ) : !data ? (
          <View accessibilityLabel="Cargando">
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.skeletonRow, { backgroundColor: colors.surface2 }]} />
            ))}
          </View>
        ) : tab === 'cards' ? (
          data.cards.length ? (
            <View>
              {data.cards.map((c, i) => (
                <CardRow
                  key={c.id}
                  card={c}
                  last={i === data.cards.length - 1}
                  onPress={() => router.push({ pathname: '/tarjeta/[id]', params: { id: c.id } })}
                />
              ))}
              <Button title="Sumar tarjeta" variant="link" onPress={() => router.push('/tarjeta-nueva')} style={styles.add} />
            </View>
          ) : (
            <View style={styles.state}>
              <Text style={[type.body, { color: colors.textMuted }]}>
                Sumá tu primera tarjeta de crédito para saber cuánto te viene.
              </Text>
              <Button title="Sumar tarjeta" variant="primary" onPress={() => router.push('/tarjeta-nueva')} />
            </View>
          )
        ) : data.accounts.length ? (
          <View>
            {data.accounts.map((a, i) => (
              <AccountRow key={a.id} account={a} last={i === data.accounts.length - 1} />
            ))}
            <Button title="Sumar cuenta" variant="link" onPress={() => router.push('/cuenta-nueva')} style={styles.add} />
          </View>
        ) : (
          <View style={styles.state}>
            <Text style={[type.body, { color: colors.textMuted }]}>
              Sumá tu cuenta del banco, tu billetera o tu efectivo.
            </Text>
            <Button title="Sumar cuenta" variant="primary" onPress={() => router.push('/cuenta-nueva')} />
          </View>
        )}

        {/* Archivadas: se recuperan durante los 7 días antes de la purga (02 §3, D4). */}
        {tab === 'cards' && data?.archivedCards.length ? (
          <View style={styles.archived}>
            <Text style={[type.label, { color: colors.textMuted }]}>Archivadas</Text>
            {data.archivedCards.map((c) => {
              const days = Math.max(0, daysBetween(todayInArgentina(), c.deletesOn));
              const when = days === 0 ? 'Se borra hoy' : days === 1 ? 'Se borra mañana' : `Se borra en ${days} días`;
              return (
                <View key={c.id} style={styles.archivedRow}>
                  <View style={[styles.archivedText, { opacity: 0.5 }]} accessible accessibilityLabel={`${c.name}, archivada. ${when}.`}>
                    <Text style={[type.bodyStrong, { color: colors.text }]} numberOfLines={1}>
                      {c.name}
                    </Text>
                    <Text style={[type.moneySm, { color: colors.textMuted }]}>·· {c.last4}</Text>
                  </View>
                  <Pill label={when} variant="neutral" />
                  <Button title="Recuperar" variant="ghost" onPress={() => recover(c.id, c.name)} />
                </View>
              );
            })}
          </View>
        ) : null}
        {/* Lugar para que el FAB no tape la última fila. */}
        <View style={{ height: FAB_SPACE }} />
      </Screen>

      <Fab />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  skeletonRow: { height: 46, borderRadius: radius.md, marginVertical: 6 },
  state: { gap: 12, paddingVertical: 16, paddingHorizontal: 4 },
  add: { alignSelf: 'flex-start', marginTop: 4 },
  archived: { gap: 6, marginTop: 8 },
  archivedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  archivedText: { flex: 1, minWidth: 0 },
});
