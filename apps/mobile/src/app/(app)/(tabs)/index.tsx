import {
  add,
  convert,
  formatMoney,
  formatShortDate,
  formatTotal,
  home,
  money,
  moneyInWords,
  SYSTEM_CATEGORY_IDS,
  todayInArgentina,
  UNCATEGORIZED,
  zero,
  type HomeDue,
  type HomeNotice,
  type Money,
  type WalletInput,
} from '@mangos/core';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Button } from '../../../components/Button';
import { CategoryIcon } from '../../../components/CategoryIcon';
import { Chip } from '../../../components/Chip';
import { Fab, FAB_SPACE } from '../../../components/Fab';
import { absMoney } from '../../../components/GroupSections';
import { Pill } from '../../../components/Pill';
import { Screen } from '../../../components/Screen';
import { Section } from '../../../components/Section';
import { useToast } from '../../../components/Toast';
import { CATEGORIES, categoryLabel } from '../../../lib/categories';
import { onWalletChanged } from '../../../lib/events';
import type { FxKind } from '../../../lib/fx';
import { loadHome, markNoticeRead } from '../../../lib/home';
import { useSession, type UserSettings } from '../../../lib/session';
import { layout, radius, type } from '../../../theme/tokens';
import { useTheme } from '../../../theme/useTheme';

const HOUR_MS = 60 * 60 * 1000;
// DESIGN.md: el patrimonio va en 38, y en 30 en pantallas angostas.
const NARROW_WIDTH = 360;

type Currency = UserSettings['display_currency'];
const CURRENCY_CHIP: Record<Currency, { label: string; name: string; other: string }> = {
  ARS: { label: '🇦🇷 AR$', name: 'pesos', other: 'dólares' },
  USD: { label: '🇺🇸 US$', name: 'dólares', other: 'pesos' },
};

const FX_KINDS: { kind: FxKind; label: string }[] = [
  { kind: 'mep', label: 'MEP' },
  { kind: 'oficial', label: 'Oficial' },
  { kind: 'blue', label: 'Blue' },
  { kind: 'tarjeta', label: 'Tarjeta' },
];

const AR_TIME = 'America/Argentina/Buenos_Aires';

function rateTime(fetchedAt: string): string {
  return new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: AR_TIME }).format(
    new Date(fetchedAt),
  );
}

/** "jueves 8 de octubre". */
function longDate(): string {
  const parts = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: AR_TIME }).formatToParts(new Date());
  const part = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${part('weekday')} ${part('day')} de ${part('month')}`;
}

/** D3: "Vencido", "Vence hoy", "Vence en 3 días" (en una pill) o "Vence 24/10". */
function dueTag(d: HomeDue): { label: string; variant: 'error' | 'warning' | null } {
  if (d.overdue) return { label: 'Vencido', variant: 'error' };
  if (d.daysToDue === 0) return { label: 'Vence hoy', variant: 'error' };
  if (d.daysToDue === 1) return { label: 'Vence mañana', variant: 'error' };
  if (d.daysToDue <= 3) return { label: `Vence en ${d.daysToDue} días`, variant: 'warning' };
  return { label: `Vence ${formatShortDate(d.dueDate)}`, variant: null };
}

const byCurrencyInWords = (b: HomeDue['pending']) =>
  [b.ARS, b.USD].filter((m) => m.minor !== 0).map(moneyInWords).join(' más ') || moneyInWords(b.ARS);

/** Inicio (spec del 8/10): patrimonio, dólar del día, vencimientos, gastos del mes, grupos y avisos. */
export default function Home() {
  const { colors } = useTheme();
  const { session, settings, updateSettings } = useSession();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const [loaded, setLoaded] = useState<Awaited<ReturnType<typeof loadHome>> | null>(null);
  const [failed, setFailed] = useState(false);
  // La moneda cambia al toque: se recalcula con las filas que ya están, sin volver a pedirlas.
  const [display, setDisplay] = useState<Currency>(settings?.display_currency ?? 'ARS');
  // Avisos tocados en esta visita: el punto se va sin esperar a la base.
  const [readIds, setReadIds] = useState<ReadonlySet<string>>(new Set());

  const userId = session?.user.id;
  const fxReference = settings?.fx_reference;
  const load = useCallback(() => {
    if (!userId || !fxReference) return;
    setFailed(false);
    loadHome(userId, { fx_reference: fxReference, display_currency: 'ARS' }).then(setLoaded, () => setFailed(true));
  }, [userId, fxReference]);

  useFocusEffect(load);
  useEffect(() => onWalletChanged(load), [load]);

  const data = useMemo(() => {
    if (!loaded) return null;
    const input: WalletInput = { ...loaded.input, display };
    return home(input, loaded.notifications ?? []);
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

  function openNotice(n: HomeNotice) {
    if (!n.read && !readIds.has(n.id)) {
      setReadIds(new Set(readIds).add(n.id));
      markNoticeRead(n.id).catch(() => {});
    }
    if (n.cardId) router.push({ pathname: '/tarjeta/[id]', params: { id: n.cardId } });
  }

  const nw = data?.netWorth;
  const reference = loaded?.referenceRate;
  const staleRate = reference && Date.now() - new Date(reference.fetchedAt).getTime() > HOUR_MS ? rateTime(reference.fetchedAt) : null;
  const hasCards = !!loaded?.input.cards.some((c) => !c.archived_at);
  const name = settings?.name?.trim();

  const panel = [styles.panel, { backgroundColor: colors.surface, borderColor: colors.line }];
  const muted = [type.body, { color: colors.textMuted }];
  const divider = (i: number, n: number) => i < n - 1 && { borderBottomWidth: 1, borderBottomColor: colors.line };

  return (
    <View style={styles.flex}>
      <Screen>
        <View style={styles.header}>
          <View style={styles.rowMiddle}>
            <Text style={[type.display, { color: colors.text }]} accessibilityRole="header">
              {name ? `Hola, ${name}` : 'Hola'}
            </Text>
            <Text style={[type.caption, { color: colors.textMuted }]}>{longDate()}</Text>
          </View>
          <Pressable
            onPress={() => router.push('/ajustes')}
            accessibilityRole="button"
            accessibilityLabel="Ajustes"
            style={({ pressed }) => [styles.gear, pressed && { backgroundColor: colors.surface2 }]}
          >
            {({ pressed }) => (
              <Svg width={22} height={22} viewBox="0 0 20 20" fill="none" stroke={pressed ? colors.text : colors.textMuted} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                <Circle cx={10} cy={10} r={2.6} />
                <Path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" />
              </Svg>
            )}
          </Pressable>
        </View>

        {failed ? (
          <View style={styles.state}>
            <Text style={muted}>No pudimos traer tus datos.</Text>
            <Button title="Reintentar" onPress={load} style={styles.start} />
          </View>
        ) : !data || !loaded ? (
          <View accessibilityLabel="Cargando" style={styles.gap}>
            <View style={[styles.skeletonHero, { backgroundColor: colors.surface2 }]} />
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.skeletonRow, { backgroundColor: colors.surface2 }]} />
            ))}
          </View>
        ) : (
          <>
            {/* D6: "Cerró tu Visa" hasta el vencimiento. */}
            {data.closingBanners.map((n) => (
              <Pressable
                key={n.id}
                onPress={() => openNotice(n)}
                accessibilityRole="button"
                accessibilityHint="Abre la tarjeta para cargar lo que falta"
                style={({ pressed }) => [panel, styles.banner, pressed && styles.pressed]}
              >
                <Text style={[type.bodyStrong, styles.flex, { color: colors.text }]}>{n.body}</Text>
                <Text style={[type.title, { color: colors.textMuted }]}>›</Text>
              </Pressable>
            ))}

            {/* Patrimonio (02 §8). */}
            <View style={panel}>
              <View style={styles.sectionHead}>
                <Text style={[type.label, { color: colors.textMuted }]}>Patrimonio</Text>
                <Chip
                  label={CURRENCY_CHIP[display].label}
                  onPress={toggleCurrency}
                  accessibilityLabel={`Patrimonio en ${CURRENCY_CHIP[display].name}. Tocá para verlo en ${CURRENCY_CHIP[display].other}.`}
                />
              </View>
              {nw ? (
                <>
                  <Text
                    style={[width < NARROW_WIDTH ? type.moneyHeroCompact : type.moneyHero, { color: nw.total.minor < 0 ? colors.error : colors.text }]}
                    maxFontSizeMultiplier={1.3}
                    adjustsFontSizeToFit
                    numberOfLines={1}
                    accessibilityLabel={`Patrimonio: ${moneyInWords(nw.total)}`}
                  >
                    {formatMoney(nw.total)}
                  </Text>
                  <View>
                    {(
                      [
                        ['Cuentas', nw.accounts],
                        ['Tarjetas (lo que falta pagar)', { minor: -nw.cards.minor, currency: nw.cards.currency }],
                        ['Grupos (neto)', nw.groups],
                      ] as [string, Money][]
                    ).map(([label, m]) => (
                      <View key={label} style={styles.breakdown} accessible accessibilityLabel={`${label}: ${moneyInWords(m)}`}>
                        <Text style={[type.small, styles.flex, { color: colors.textMuted }]}>{label}</Text>
                        <Text style={[type.moneySm, { color: m.minor < 0 ? colors.error : colors.text }]} maxFontSizeMultiplier={1.3}>
                          {formatMoney(m)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : (
                <Text style={muted}>Falta la cotización del dólar para calcular el patrimonio.</Text>
              )}
              {staleRate ? <Text style={[type.caption, { color: colors.textMuted }]}>Dólar de las {staleRate}</Text> : null}
            </View>

            {/* D8: dólar del día. */}
            <Section title="Dólar hoy">
              <View style={styles.fxRow}>
                {FX_KINDS.map(({ kind, label }) => {
                  const r = loaded.rates[kind];
                  const value = r ? formatMoney(convert(money(100, 'USD'), r.sell, 'ARS')) : '—';
                  return (
                    <View key={kind} style={styles.fxCell} accessible accessibilityLabel={`${label}: ${r ? value : 'sin cotización'}`}>
                      <Text style={[type.caption, { color: colors.textMuted }]}>{label}</Text>
                      <Text style={[type.moneySm, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.3}>
                        {value}
                      </Text>
                    </View>
                  );
                })}
              </View>
              {(() => {
                const latest = FX_KINDS.map(({ kind }) => loaded.rates[kind]?.fetchedAt)
                  .filter((t): t is string => !!t)
                  .sort()
                  .at(-1);
                return latest ? <Text style={[type.caption, { color: colors.textMuted }]}>Actualizado a las {rateTime(latest)}</Text> : null;
              })()}
            </Section>

            {/* D3: próximos vencimientos. */}
            <Section title="Próximos vencimientos" link={hasCards ? 'Ver tarjetas' : undefined} onLink={() => router.push('/billetera')}>
              {!hasCards ? (
                <View style={styles.state}>
                  <Text style={muted}>Sumá una tarjeta de crédito para ver cuándo vence.</Text>
                  <Button title="Sumar tarjeta" variant="link" onPress={() => router.push('/tarjeta-nueva')} style={styles.start} />
                </View>
              ) : data.dues.length === 0 ? (
                <Text style={muted}>No tenés vencimientos próximos.</Text>
              ) : (
                <View>
                  {data.dues.map((d, i) => {
                    const tag = dueTag(d);
                    const when = d.kind === 'current' ? `En curso, cierra el ${formatShortDate(d.closeDate!)}` : tag.label;
                    return (
                      <Pressable
                        key={`${d.cardId}-${d.period}`}
                        onPress={() => router.push({ pathname: '/tarjeta/[id]', params: { id: d.cardId } })}
                        accessibilityRole="button"
                        accessibilityLabel={`${d.cardName}, ${when}: ${byCurrencyInWords(d.pending)}`}
                        style={({ pressed }) => [styles.row, divider(i, data.dues.length), pressed && styles.pressed]}
                      >
                        <View style={styles.rowMiddle}>
                          <Text style={[type.bodyStrong, { color: colors.text }]} numberOfLines={1}>
                            {d.cardName}
                          </Text>
                          {d.kind === 'closed' && tag.variant ? (
                            <Pill label={tag.label} variant={tag.variant} />
                          ) : (
                            <Text style={[type.caption, { color: colors.textMuted }]}>{when}</Text>
                          )}
                        </View>
                        <Text style={[type.money, styles.amount, { color: colors.text }]} maxFontSizeMultiplier={1.3}>
                          {formatTotal(d.pending)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </Section>

            {/* D4: gastos del mes. */}
            <Section
              title="Gastos del mes"
              link="Ver movimientos"
              onLink={() => router.push({ pathname: '/movimientos', params: { month: todayInArgentina().slice(0, 7) } })}
            >
              {!data.spend ? (
                <Text style={muted}>Falta la cotización del dólar para sumar los gastos en dólares.</Text>
              ) : data.spend.total.minor === 0 ? (
                <Text style={muted}>Todavía no cargaste gastos este mes.</Text>
              ) : (
                <SpendList spend={data.spend} />
              )}
              {data.spend?.approximate ? (
                <Text style={[type.caption, { color: colors.textMuted }]}>Aproximado: algún gasto en dólares usa el dólar de hoy.</Text>
              ) : null}
            </Section>

            {/* D9: grupos. */}
            {data.hasGroups ? (
              <Section title="Grupos" link="Ver grupos" onLink={() => router.push('/grupos')}>
                {data.groups.length === 0 ? (
                  <Text style={muted}>Estás al día en todos tus grupos.</Text>
                ) : (
                  <View>
                    {data.groups.map((g, i) => {
                      const owed = g.balance.minor > 0;
                      const text = `${owed ? 'Te deben' : 'Debés'} ${formatMoney(absMoney(g.balance))}`;
                      return (
                        <Pressable
                          key={g.id}
                          onPress={() => router.push({ pathname: '/grupo/[id]', params: { id: g.id } })}
                          accessibilityRole="button"
                          accessibilityLabel={`${g.name}, ${owed ? 'te deben' : 'debés'} ${moneyInWords(absMoney(g.balance))}`}
                          style={({ pressed }) => [styles.row, divider(i, data.groups.length), pressed && styles.pressed]}
                        >
                          <Text style={[type.bodyStrong, styles.rowMiddle, { color: colors.text }]} numberOfLines={1}>
                            {g.name}
                          </Text>
                          <Text style={[type.money, styles.amount, { color: owed ? colors.success : colors.error }]} maxFontSizeMultiplier={1.3}>
                            {text}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </Section>
            ) : null}

            {/* D7: avisos recientes. */}
            <Section title="Avisos">
              {loaded.notifications === null ? (
                <Text style={muted}>No pudimos traer tus avisos.</Text>
              ) : data.recentNotices.length === 0 ? (
                <Text style={muted}>Acá van a aparecer los avisos de cierre y vencimiento de tus tarjetas.</Text>
              ) : (
                <View>
                  {data.recentNotices.map((n, i) => {
                    const unread = !n.read && !readIds.has(n.id);
                    return (
                      <Pressable
                        key={n.id}
                        onPress={() => openNotice(n)}
                        accessibilityRole="button"
                        accessibilityLabel={`${unread ? 'No leído. ' : ''}${n.title}. ${n.body}`}
                        style={({ pressed }) => [styles.row, styles.noticeRow, divider(i, data.recentNotices.length), pressed && styles.pressed]}
                      >
                        <View style={[styles.dot, unread && { backgroundColor: colors.primary }]} />
                        <View style={styles.rowMiddle}>
                          <Text style={[type.bodyStrong, { color: colors.text }]}>{n.title}</Text>
                          <Text style={[type.small, { color: colors.textMuted }]}>{n.body}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </Section>
          </>
        )}
        {/* Lugar para que el FAB no tape la última fila. */}
        <View style={{ height: FAB_SPACE }} />
      </Screen>
      <Fab />
    </View>
  );
}

/** D4: el total y cada categoría con gasto, de mayor a menor, con una barra de su parte. */
function SpendList({ spend }: { spend: NonNullable<ReturnType<typeof home>['spend']> }) {
  const { colors } = useTheme();
  // Los gastos sin categoría se muestran como "Otros".
  const totals = new Map<string, Money>();
  for (const [id, m] of Object.entries(spend.byCategory)) {
    const key = id === UNCATEGORIZED ? SYSTEM_CATEGORY_IDS.otros : id;
    totals.set(key, add(totals.get(key) ?? zero('ARS'), m));
  }
  const rows = [...totals].filter(([, m]) => m.minor > 0).sort((a, b) => b[1].minor - a[1].minor);
  return (
    <View style={styles.gap}>
      <Text style={[type.moneyMd, { color: colors.text }]} maxFontSizeMultiplier={1.3} accessibilityLabel={`Total del mes: ${moneyInWords(spend.total)}`}>
        {formatMoney(spend.total)}
      </Text>
      {rows.map(([id, m]) => {
        const share = spend.total.minor > 0 ? Math.min(1, m.minor / spend.total.minor) : 0;
        return (
          <View key={id} style={styles.spendRow} accessible accessibilityLabel={`${categoryLabel(id)}: ${moneyInWords(m)}`}>
            <CategoryIcon categoryId={id} size="md" />
            <View style={styles.rowMiddle}>
              <View style={styles.breakdown}>
                <Text style={[type.bodyStrong, styles.flex, { color: colors.text }]} numberOfLines={1}>
                  {categoryLabel(id)}
                </Text>
                <Text style={[type.money, { color: colors.text }]} maxFontSizeMultiplier={1.3}>
                  {formatMoney(m)}
                </Text>
              </View>
              <View style={[styles.track, { backgroundColor: colors.surface2 }]}>
                <View style={[styles.fill, { width: `${share * 100}%`, backgroundColor: colors.cat[CATEGORIES.find((c) => c.id === id)?.colorIndex ?? 5] }]} />
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // Botón `icon` de DESIGN.md: padding 7 y área de toque de 44.
  gear: { width: layout.minTouch, height: layout.minTouch, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  gap: { gap: 10 },
  start: { alignSelf: 'flex-start' },
  pressed: { opacity: 0.7 },
  panel: { borderWidth: 1, borderRadius: radius.lg, padding: layout.panelPadding, gap: 14 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 24 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  skeletonHero: { height: 42, width: 220, borderRadius: radius.sm },
  skeletonRow: { height: 46, borderRadius: radius.md },
  state: { gap: 12 },
  breakdown: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  fxRow: { flexDirection: 'row', gap: 8 },
  fxCell: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: layout.rowPaddingV, minHeight: layout.minTouch },
  rowMiddle: { flex: 1, minWidth: 0, gap: 2 },
  amount: { flexShrink: 1, textAlign: 'right' },
  noticeRow: { alignItems: 'flex-start' },
  dot: { width: 8, height: 8, borderRadius: radius.full, marginTop: 7 },
  spendRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  track: { height: 8, borderRadius: radius.xs, overflow: 'hidden', marginTop: 4 },
  fill: { height: 8, borderRadius: radius.xs },
});
