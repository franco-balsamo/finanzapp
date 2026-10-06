import { addMonths, closeDate, dueDate, formatShortDate, money, parseDateNear, validateOverride, type CreditCard } from '@mangos/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { Button } from '../../../../components/Button';
import { Sheet } from '../../../../components/Sheet';
import { SheetFooter } from '../../../../components/SheetFooter';
import { TextField } from '../../../../components/TextField';
import { useToast } from '../../../../components/Toast';
import { deleteOverride, saveOverride } from '../../../../lib/cardActions';
import { walletChanged } from '../../../../lib/events';
import { useSession } from '../../../../lib/session';
import { loadCardDetail, type CardDetailData } from '../../../../lib/wallet';
import { type } from '../../../../theme/tokens';
import { useTheme } from '../../../../theme/useTheme';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const dm = (date: string) => {
  const [, m, d] = date.split('-');
  return `${Number(d)}/${Number(m)}`;
};

/** Corregir el cierre real de un resumen (D-4, 02 §3): el día fijo de la tarjeta es solo una estimación. */
export default function FixClose() {
  const { colors } = useTheme();
  const toast = useToast();
  const { session, settings } = useSession();
  const { cardId, period } = useLocalSearchParams<{ cardId: string; period: string }>();
  const [data, setData] = useState<CardDetailData | null>(null);
  const [close, setClose] = useState('');
  const [due, setDue] = useState('');
  const [error, setError] = useState<{ close?: string; due?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!session || !settings || !cardId) return;
    loadCardDetail(session.user.id, settings, cardId).then((d) => {
      setData(d);
      const statement = d.detail.statements.find((s) => s.period === period);
      if (statement) {
        setClose(dm(statement.closeDate));
        setDue(dm(statement.dueDate));
      }
    }, () => setSaveError('No pudimos traer la tarjeta.'));
  }, [session, settings, cardId, period]);

  const detail = data?.detail;
  const card: CreditCard | null = detail
    ? { id: detail.card.id, closeDay: detail.card.closeDay, dueDay: detail.card.dueDay, creditLimit: money(0, 'ARS') }
    : null;
  const others = detail?.overrides.filter((o) => o.period !== period) ?? [];
  const hasOverride = !!detail?.overrides.some((o) => o.period === period);
  // Lo que da el día fijo de la tarjeta, sin corrección.
  const estimatedClose = card && period ? closeDate(card, period) : null;
  const estimatedDue = card && period ? dueDate(card, period) : null;

  async function save() {
    if (!card || !period || !estimatedClose || !estimatedDue || !cardId) return;
    const closeDateValue = parseDateNear(close, estimatedClose);
    const dueDateValue = parseDateNear(due, estimatedDue);
    if (!closeDateValue || !dueDateValue) {
      setError({
        close: closeDateValue ? undefined : 'Escribí la fecha como dd/mm.',
        due: dueDateValue ? undefined : 'Escribí la fecha como dd/mm.',
      });
      return;
    }
    const check = validateOverride(card, period, { closeDate: closeDateValue, dueDate: dueDateValue }, others);
    if (!check.ok) {
      const previous = formatShortDate(closeDate(card, addMonths(period, -1), others));
      const next = formatShortDate(closeDate(card, addMonths(period, 1), others));
      setError(
        check.reason === 'out_of_range'
          ? { close: `Tiene que quedar a 10 días o menos del cierre estimado (${formatShortDate(estimatedClose)}).` }
          : check.reason === 'not_after_previous'
            ? { close: `Tiene que ser después del cierre anterior (${previous}).` }
            : check.reason === 'not_before_next'
              ? { close: `Tiene que ser antes del cierre siguiente (${next}).` }
              : { due: 'El vencimiento tiene que ser después del cierre.' },
      );
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await saveOverride(cardId, period, closeDateValue, dueDateValue);
      walletChanged();
      router.back();
      toast(`Cierre corregido: ${formatShortDate(closeDateValue)}`);
    } catch {
      setSaving(false);
      setSaveError('No pudimos guardar la corrección. Probá de nuevo.');
    }
  }

  async function reset() {
    if (!cardId || !period) return;
    setSaving(true);
    try {
      await deleteOverride(cardId, period);
      walletChanged();
      router.back();
      toast('Volvió a la fecha estimada');
    } catch {
      setSaving(false);
      setSaveError('No pudimos borrar la corrección. Probá de nuevo.');
    }
  }

  const month = period ? MONTHS[Number(period.slice(5, 7)) - 1] : '';

  return (
    <Sheet
      title={`Cierre real de ${month}`}
      onClose={() => router.back()}
      footer={<SheetFooter actionTitle="Guardar" onAction={save} onCancel={() => router.back()} loading={saving} />}
    >
      <Text style={[type.body, { color: colors.textMuted }]}>
        Si el banco corrió el cierre o el vencimiento, ponelos como figuran en el resumen.
      </Text>
      <TextField
        label="Cierre (dd/mm)"
        value={close}
        onChangeText={setClose}
        error={error?.close}
        mono
        keyboardType="numbers-and-punctuation"
        placeholder="27/10"
      />
      <TextField
        label="Vencimiento (dd/mm)"
        value={due}
        onChangeText={setDue}
        error={error?.due}
        mono
        keyboardType="numbers-and-punctuation"
        placeholder="8/11"
      />
      {estimatedClose && estimatedDue ? (
        <Text style={[type.caption, { color: colors.textMuted }]}>
          Según la tarjeta: cierra {formatShortDate(estimatedClose)} y vence {formatShortDate(estimatedDue)}.
        </Text>
      ) : null}
      {hasOverride ? <Button title="Volver a la fecha estimada" variant="link" onPress={reset} disabled={saving} /> : null}
      {saveError ? <Text style={[type.caption, { color: colors.error }]}>{saveError}</Text> : null}
    </Sheet>
  );
}

