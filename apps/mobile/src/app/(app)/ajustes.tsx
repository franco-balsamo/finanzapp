import type { CardAlertSettings } from '@mangos/core';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { Mono } from '../../components/Mono';
import { Screen } from '../../components/Screen';
import { Section } from '../../components/Section';
import { Segmented } from '../../components/Segmented';
import { Switch } from '../../components/Switch';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/Toast';
import { useSession, type UserSettings } from '../../lib/session';
import { exportAccount, loadCardAlerts, setCardAlert } from '../../lib/settings';
import { layout, radius, type } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

const FX_OPTIONS = [
  { value: 'mep', label: 'MEP' },
  { value: 'oficial', label: 'Oficial' },
  { value: 'blue', label: 'Blue' },
] as const;
const THEME_OPTIONS = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
] as const;
const DAYS_OPTIONS = (['1', '2', '3', '4', '5'] as const).map((d) => ({ value: d, label: d }));
const HOURS = Array.from({ length: 24 }, (_, h) => h);
// D7: al prender no molestar, de 22:00 a 8:00.
const QUIET_DEFAULT = { quiet_from: 22, quiet_to: 8 };

const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`;

/** Ajustes (spec del 9/10, A-4): perfil, preferencias, avisos y cuenta. Cada cambio se guarda solo. */
export default function Settings() {
  const { colors } = useTheme();
  const { session, settings, updateSettings, signOut } = useSession();
  const toast = useToast();
  // El control muestra el valor nuevo mientras se guarda; si falla, vuelve al de la base.
  const [pending, setPending] = useState<Partial<UserSettings>>({});
  const [name, setName] = useState(settings?.name ?? '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<CardAlertSettings[] | null>(null);
  const [alertsFailed, setAlertsFailed] = useState(false);
  const [editingHour, setEditingHour] = useState<'quiet_from' | 'quiet_to' | null>(null);
  const [exporting, setExporting] = useState(false);

  const loadAlerts = useCallback(() => {
    setAlertsFailed(false);
    loadCardAlerts().then(setAlerts, () => setAlertsFailed(true));
  }, []);
  useEffect(loadAlerts, [loadAlerts]);

  if (!settings) return null;
  const current = { ...settings, ...pending };

  async function save(changes: Partial<UserSettings>) {
    setPending((p) => ({ ...p, ...changes }));
    try {
      await updateSettings(changes);
      toast('Guardado');
    } catch {
      toast('No se pudo guardar. Probá de nuevo.');
    }
    setPending((p) => {
      const rest = { ...p };
      for (const k of Object.keys(changes)) delete rest[k as keyof UserSettings];
      return rest;
    });
  }

  function saveName() {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Poné un nombre.');
      return;
    }
    setNameError(null);
    if (trimmed !== settings?.name) save({ name: trimmed });
  }

  async function saveAlert(cardId: string, changes: Partial<Pick<CardAlertSettings, 'closing' | 'due' | 'daysBefore'>>) {
    const before = alerts;
    const next = alerts?.map((a) => (a.card.id === cardId ? { ...a, ...changes } : a)) ?? null;
    const updated = next?.find((a) => a.card.id === cardId);
    if (!updated) return;
    setAlerts(next);
    try {
      if ('closing' in changes) await setCardAlert(cardId, 'card_closing', updated.closing);
      else await setCardAlert(cardId, 'card_due', updated.due, updated.daysBefore);
      toast('Guardado');
    } catch {
      setAlerts(before);
      toast('No se pudo guardar. Probá de nuevo.');
    }
  }

  function chooseHour(h: number) {
    if (!editingHour) return;
    const changes = { quiet_from: current.quiet_from, quiet_to: current.quiet_to, [editingHour]: h };
    setEditingHour(null);
    // Dos horas iguales no son un horario: se apaga.
    save(changes.quiet_from === changes.quiet_to ? { quiet_from: null, quiet_to: null } : changes);
  }

  async function exportData() {
    setExporting(true);
    try {
      if ((await exportAccount()) === 'unavailable') toast('No se puede compartir desde este dispositivo.');
    } catch {
      toast('No se pudo exportar. Probá de nuevo.');
    }
    setExporting(false);
  }

  const quietOn = current.quiet_from !== null && current.quiet_to !== null;
  const muted = [type.body, { color: colors.textMuted }];
  const help = [type.caption, { color: colors.textMuted }];
  const label = [type.bodyStrong, styles.flex, { color: colors.text }];

  return (
    <Screen>
      <View style={styles.header}>
        <Button title="‹" variant="ghost" onPress={() => router.back()} accessibilityLabel="Volver" />
        <Text style={[type.title, { color: colors.text }]} accessibilityRole="header">
          Ajustes
        </Text>
      </View>

      <Section title="Perfil">
        <View style={styles.field}>
          <TextField
            label="Tu nombre"
            value={name}
            onChangeText={setName}
            onBlur={saveName}
            onSubmitEditing={saveName}
            error={nameError}
            autoCapitalize="words"
            returnKeyType="done"
          />
          {nameError ? null : <Text style={help}>Así te ven en los grupos nuevos.</Text>}
        </View>
        <View style={styles.field}>
          <Text style={help}>Mail</Text>
          <Text style={[type.body, { color: colors.text }]}>{session?.user.email}</Text>
        </View>
      </Section>

      <Section title="Preferencias">
        <View style={styles.field}>
          <Text style={help}>Dólar de referencia</Text>
          <Segmented
            options={FX_OPTIONS}
            value={current.fx_reference}
            onChange={(fx_reference) => save({ fx_reference })}
            accessibilityLabel="Dólar de referencia"
          />
          <Text style={help}>Para pasar a pesos tus cuentas y el patrimonio.</Text>
        </View>
        <View style={styles.field}>
          <Text style={help}>Tema</Text>
          <Segmented options={THEME_OPTIONS} value={current.theme} onChange={(theme) => save({ theme })} accessibilityLabel="Tema" />
        </View>
      </Section>

      <Section title="Avisos">
        {alertsFailed ? (
          <View style={styles.field}>
            <Text style={muted}>No se pudieron cargar los avisos.</Text>
            <Button title="Reintentar" onPress={loadAlerts} style={styles.start} />
          </View>
        ) : !alerts ? (
          <Text style={muted}>Cargando…</Text>
        ) : alerts.length === 0 ? (
          <Text style={muted}>Cuando sumes una tarjeta, vas a poder elegir sus avisos acá.</Text>
        ) : (
          alerts.map((a) => (
            <View key={a.card.id} style={[styles.card, { borderBottomColor: colors.line }]}>
              <Text style={[type.bodyStrong, { color: colors.text }]} numberOfLines={1}>
                {a.card.name} <Mono>·· {a.card.last4}</Mono>
              </Text>
              <View style={styles.row}>
                <Text style={label}>Cuando cierra</Text>
                <Switch
                  value={a.closing}
                  onChange={(closing) => saveAlert(a.card.id, { closing })}
                  accessibilityLabel={`${a.card.name}: aviso cuando cierra`}
                />
              </View>
              <View style={styles.row}>
                <Text style={label}>Antes del vencimiento</Text>
                <Switch
                  value={a.due}
                  onChange={(due) => saveAlert(a.card.id, { due })}
                  accessibilityLabel={`${a.card.name}: aviso antes del vencimiento`}
                />
              </View>
              {a.due ? (
                <View style={styles.row}>
                  <Text style={[type.body, styles.flex, { color: colors.textMuted }]}>Días antes</Text>
                  <Segmented
                    options={DAYS_OPTIONS}
                    value={String(a.daysBefore) as (typeof DAYS_OPTIONS)[number]['value']}
                    onChange={(d) => saveAlert(a.card.id, { daysBefore: Number(d) })}
                    accessibilityLabel={`${a.card.name}: días antes del vencimiento`}
                  />
                </View>
              ) : null}
            </View>
          ))
        )}

        <View style={styles.field}>
          <View style={styles.row}>
            <Text style={label}>No molestar</Text>
            <Switch
              value={quietOn}
              onChange={(on) => {
                setEditingHour(null);
                save(on ? QUIET_DEFAULT : { quiet_from: null, quiet_to: null });
              }}
              accessibilityLabel="No molestar"
            />
          </View>
          {quietOn ? (
            <>
              <View style={styles.hours}>
                <Text style={muted}>De</Text>
                <Chip
                  label={hourLabel(current.quiet_from!)}
                  selected={editingHour === 'quiet_from'}
                  onPress={() => setEditingHour(editingHour === 'quiet_from' ? null : 'quiet_from')}
                  accessibilityLabel={`Desde las ${current.quiet_from}. Cambiar`}
                />
                <Text style={muted}>a</Text>
                <Chip
                  label={hourLabel(current.quiet_to!)}
                  selected={editingHour === 'quiet_to'}
                  onPress={() => setEditingHour(editingHour === 'quiet_to' ? null : 'quiet_to')}
                  accessibilityLabel={`Hasta las ${current.quiet_to}. Cambiar`}
                />
              </View>
              {editingHour ? (
                <View style={[styles.hourGrid, { borderColor: colors.line }]} accessibilityRole="radiogroup">
                  {HOURS.map((h) => (
                    <Chip key={h} label={hourLabel(h)} selected={current[editingHour] === h} onPress={() => chooseHour(h)} />
                  ))}
                </View>
              ) : null}
              <Text style={help}>Los avisos de ese horario te llegan al terminar.</Text>
            </>
          ) : null}
        </View>
      </Section>

      {/* En la web no se exporta (la web de producción es solo de invitados). */}
      {Platform.OS !== 'web' ? (
        <Section title="Tus datos">
          <View style={styles.field}>
            <Button title={exporting ? 'Exportando…' : 'Exportar mis datos'} onPress={exportData} disabled={exporting} style={styles.start} />
            <Text style={help}>Un archivo con todo lo que cargaste.</Text>
          </View>
        </Section>
      ) : null}

      <Section title="Cuenta">
        <Button title="Cerrar sesión" onPress={signOut} style={styles.start} />
        <Button title="Borrar mi cuenta" variant="danger" onPress={() => router.push('/borrar-cuenta')} style={styles.start} />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  start: { alignSelf: 'flex-start' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  field: { gap: 6 },
  card: { gap: 4, paddingBottom: 12, borderBottomWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: layout.minTouch },
  hours: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hourGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, borderWidth: 1, borderRadius: radius.md, padding: 10 },
});
