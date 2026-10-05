import { formatMoney, moneyInWords } from '@mangos/core';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccountRow } from '../../components/AccountRow';
import { Button } from '../../components/Button';
import { CardRow } from '../../components/CardRow';
import { Screen } from '../../components/Screen';
import { Tabs } from '../../components/Tabs';
import { onWalletChanged } from '../../lib/events';
import { useSession } from '../../lib/session';
import { loadWallet, type WalletData } from '../../lib/wallet';
import { layout, radius, shadow, type } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

type Tab = 'cards' | 'accounts';
const TABS = [
  { value: 'cards', label: 'Tarjetas' },
  { value: 'accounts', label: 'Cuentas' },
] as const;

const HOUR_MS = 60 * 60 * 1000;

function rateTime(fetchedAt: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date(fetchedAt));
}

/** Billetera (E4): patrimonio, tarjetas con lo que viene y cuentas con su saldo. */
export default function Wallet() {
  const { name: theme, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { session, settings, signOut } = useSession();
  const [tab, setTab] = useState<Tab>('cards');
  const [data, setData] = useState<WalletData | null>(null);
  const [failed, setFailed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const load = useCallback(() => {
    if (!session || !settings) return;
    setFailed(false);
    loadWallet(session.user.id, settings).then(setData, () => setFailed(true));
  }, [session, settings]);

  // Al volver de "Sumar tarjeta" o de cargar un gasto, se vuelve a calcular.
  useFocusEffect(load);
  // El "Deshacer" del toast pasa con la Billetera a la vista: no hay cambio de foco.
  useEffect(() => onWalletChanged(load), [load]);

  const nw = data?.netWorth;
  const staleRate =
    data?.referenceRate && Date.now() - new Date(data.referenceRate.fetchedAt).getTime() > HOUR_MS
      ? rateTime(data.referenceRate.fetchedAt)
      : null;

  return (
    <View style={styles.flex}>
      <Screen>
        <View style={styles.header}>
          <Text style={[type.display, { color: colors.text }]} accessibilityRole="header">
            Billetera
          </Text>
          <Button title="⋯" variant="ghost" onPress={() => setMenuOpen(!menuOpen)} accessibilityLabel="Más opciones" />
        </View>
        {menuOpen ? (
          <View style={[styles.menu, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Text style={[type.caption, { color: colors.textMuted }]}>{session?.user.email}</Text>
            <Button title="Cerrar sesión" onPress={signOut} />
          </View>
        ) : null}

        <View style={styles.hero}>
          <Text style={[type.label, { color: colors.textMuted }]}>Patrimonio</Text>
          {!data && !failed ? (
            <View style={[styles.skeletonHero, { backgroundColor: colors.surface2 }]} />
          ) : nw ? (
            <Text
              style={[type.moneyHero, { color: nw.total.minor < 0 ? colors.error : colors.text }]}
              maxFontSizeMultiplier={1.3}
              adjustsFontSizeToFit
              numberOfLines={1}
              accessibilityLabel={`Patrimonio: ${moneyInWords(nw.total)}`}
            >
              {formatMoney(nw.total)}
            </Text>
          ) : data ? (
            <Text style={[type.body, { color: colors.textMuted }]}>
              Falta la cotización del dólar para calcular el patrimonio.
            </Text>
          ) : null}
          {staleRate ? <Text style={[type.caption, { color: colors.textMuted }]}>Dólar de las {staleRate}</Text> : null}
        </View>

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
        {/* Lugar para que el FAB no tape la última fila. */}
        <View style={styles.fabSpace} />
      </Screen>

      {/* FAB "+ Gasto" (DESIGN.md, Botón fab). */}
      <Pressable
        onPress={() => router.push('/cargar')}
        accessibilityRole="button"
        accessibilityLabel="Cargar gasto"
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.primary, bottom: 24 + insets.bottom },
          theme === 'dark' ? shadow.floatDark : shadow.float,
          pressed && { opacity: 0.9 },
        ]}
      >
        <Text style={[type.button, { color: colors.onPrimary, fontSize: 15 }]}>+ Gasto</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  menu: { borderWidth: 1, borderRadius: radius.lg, padding: layout.panelPadding, gap: 10 },
  hero: { gap: 4 },
  skeletonHero: { height: 42, width: 220, borderRadius: radius.sm },
  skeletonRow: { height: 46, borderRadius: radius.md, marginVertical: 6 },
  state: { gap: 12, paddingVertical: 16, paddingHorizontal: 4 },
  add: { alignSelf: 'flex-start', marginTop: 4 },
  fabSpace: { height: 64 },
  fab: { position: 'absolute', right: layout.gutter, paddingVertical: 12, paddingHorizontal: 18, borderRadius: radius.full, minHeight: 48, justifyContent: 'center' },
});
