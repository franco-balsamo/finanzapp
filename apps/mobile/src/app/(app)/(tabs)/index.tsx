import { daysBetween, formatMoney, moneyInWords, todayInArgentina, wallet, type WalletInput } from '@mangos/core';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AccountRow } from '../../../components/AccountRow';
import { Button } from '../../../components/Button';
import { CardRow } from '../../../components/CardRow';
import { Chip } from '../../../components/Chip';
import { Fab, FAB_SPACE } from '../../../components/Fab';
import { Pill } from '../../../components/Pill';
import { Screen } from '../../../components/Screen';
import { Tabs } from '../../../components/Tabs';
import { useToast } from '../../../components/Toast';
import { unarchiveCard } from '../../../lib/cardActions';
import { onWalletChanged, walletChanged } from '../../../lib/events';
import { useSession, type UserSettings } from '../../../lib/session';
import { loadWalletInput, type WalletData } from '../../../lib/wallet';
import { layout, radius, type } from '../../../theme/tokens';
import { useTheme } from '../../../theme/useTheme';

type Tab = 'cards' | 'accounts';
const TABS = [
  { value: 'cards', label: 'Tarjetas' },
  { value: 'accounts', label: 'Cuentas' },
] as const;

const HOUR_MS = 60 * 60 * 1000;

type Currency = UserSettings['display_currency'];
const CURRENCY_CHIP: Record<Currency, { label: string; name: string; other: string }> = {
  ARS: { label: '🇦🇷 AR$', name: 'pesos', other: 'dólares' },
  USD: { label: '🇺🇸 US$', name: 'dólares', other: 'pesos' },
};

function rateTime(fetchedAt: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date(fetchedAt));
}

/** Billetera (E4): patrimonio, tarjetas con lo que viene y cuentas con su saldo. */
export default function Wallet() {
  const { colors } = useTheme();
  const { session, settings, signOut, updateSettings } = useSession();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('cards');
  const [loaded, setLoaded] = useState<Awaited<ReturnType<typeof loadWalletInput>> | null>(null);
  const [failed, setFailed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // La moneda cambia al toque: se recalcula con las filas que ya están, sin volver a pedirlas.
  const [display, setDisplay] = useState<Currency>(settings?.display_currency ?? 'ARS');

  const userId = session?.user.id;
  const fxReference = settings?.fx_reference;
  const load = useCallback(() => {
    if (!userId || !fxReference) return;
    setFailed(false);
    loadWalletInput(userId, { fx_reference: fxReference, display_currency: 'ARS' }).then(setLoaded, () => setFailed(true));
  }, [userId, fxReference]);

  const data = useMemo<WalletData | null>(() => {
    if (!loaded) return null;
    const input: WalletInput = { ...loaded.input, display };
    return { ...wallet(input), referenceRate: loaded.referenceRate };
  }, [loaded, display]);

  async function toggleCurrency() {
    const previous = display;
    const next: Currency = previous === 'ARS' ? 'USD' : 'ARS';
    setDisplay(next);
    try {
      await updateSettings({ display_currency: next });
    } catch {
      setDisplay(previous);
      toast('No se pudo cambiar la moneda. Probá de nuevo.');
    }
  }

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
          <View style={styles.heroHead}>
            <Text style={[type.label, { color: colors.textMuted }]}>Patrimonio</Text>
            <Chip
              label={CURRENCY_CHIP[display].label}
              onPress={toggleCurrency}
              accessibilityLabel={`Patrimonio en ${CURRENCY_CHIP[display].name}. Tocá para verlo en ${CURRENCY_CHIP[display].other}.`}
            />
          </View>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  menu: { borderWidth: 1, borderRadius: radius.lg, padding: layout.panelPadding, gap: 10 },
  hero: { gap: 4 },
  heroHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  skeletonHero: { height: 42, width: 220, borderRadius: radius.sm },
  skeletonRow: { height: 46, borderRadius: radius.md, marginVertical: 6 },
  state: { gap: 12, paddingVertical: 16, paddingHorizontal: 4 },
  add: { alignSelf: 'flex-start', marginTop: 4 },
  archived: { gap: 6, marginTop: 8 },
  archivedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  archivedText: { flex: 1, minWidth: 0 },
});
