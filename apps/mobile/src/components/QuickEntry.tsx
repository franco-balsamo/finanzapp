import {
  assignLineIds,
  batchSavedText,
  batchSaveLabel,
  batchTexts,
  formatMoney,
  formatShortDate,
  moneyInWords,
  parseQuickEntryLine,
  paymentChips,
  paymentMethodLabel,
  resolveLine,
  type BatchLine,
  type LineOverride,
  type PaymentMethod,
  type ResolvedLine,
} from '@mangos/core';
import { randomUUID } from 'expo-crypto';
import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { deleteExpenses, loadEntryContext, saveBatch, WARNING_TEXT, type EntryContext } from '../lib/entry';
import { walletChanged } from '../lib/events';
import { radius, type } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { Button } from './Button';
import { Chip } from './Chip';
import { Pill } from './Pill';
import { useToast } from './Toast';

const VISIBLE_LINES = 4;

interface Props {
  /** En el detalle de una tarjeta: esa tarjeta, salvo que la línea nombre otro medio (R3-6). */
  defaultCardId?: string;
}

/** `QuickEntry` de DESIGN.md: una línea por gasto, con la vista previa de lo que entendió (D-5). */
export function QuickEntry({ defaultCardId }: Props) {
  const { colors } = useTheme();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [ctx, setCtx] = useState<EntryContext | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [text, setText] = useState('');
  const [overrides, setOverrides] = useState<Record<string, LineOverride>>({});
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // Los ids viven mientras la línea no cambie: reintentar después de un corte no duplica.
  const linesRef = useRef<BatchLine[]>([]);

  const lines = useMemo(() => {
    const next = assignLineIds(linesRef.current, batchTexts(text), randomUUID);
    linesRef.current = next;
    return next;
  }, [text]);

  const resolved = useMemo<ResolvedLine[]>(() => {
    if (!ctx) return [];
    const parseCtx = { today: ctx.today, methods: ctx.methods, uses: ctx.uses, keywords: ctx.keywords, defaultCardId };
    return lines.map((l) => resolveLine(l, parseQuickEntryLine(l.text, parseCtx), overrides[l.id], ctx.methods, ctx.keywords));
  }, [ctx, lines, overrides, defaultCardId]);

  const chips = useMemo(() => (ctx ? paymentChips(ctx.methods, ctx.uses, ctx.today) : []), [ctx]);
  const ready = resolved.filter((l) => l.status === 'ready');

  function load() {
    setLoadFailed(false);
    loadEntryContext().then(setCtx, () => setLoadFailed(true));
  }

  function expand() {
    setOpen(true);
    if (!ctx) load();
  }

  function override(id: string, fields: LineOverride) {
    setOverrides((o) => ({ ...o, [id]: { ...o[id], ...fields } }));
  }

  /** Deja en el campo solo las líneas que no se sacan, en el mismo orden. */
  function keepOnly(remove: ReadonlySet<string>) {
    const kept = linesRef.current.filter((l) => !remove.has(l.id));
    setText(kept.map((l) => l.text).join('\n'));
    setOverrides((o) => Object.fromEntries(Object.entries(o).filter(([id]) => !remove.has(id))));
  }

  async function save() {
    if (!ctx || !ready.length) return;
    setSaving(true);
    setNote(null);
    const result = await saveBatch(ready, ctx);
    setSaving(false);
    keepOnly(new Set(result.saved));

    const problems: string[] = [];
    if (result.failure) {
      problems.push(result.failure === 'offline' ? 'Sin conexión: las que quedan no se guardaron.' : 'No pudimos guardar las que quedan.');
    }
    if (result.noRate.length) problems.push('Falta el dólar tarjeta para descontar de la cuenta.');
    setNote(problems.length ? `${problems.join(' ')} Probá de nuevo.` : null);

    if (!result.saved.length) return;
    walletChanged();
    const saved = result.saved;
    toast(batchSavedText(saved.length), {
      label: 'Deshacer',
      onPress: async () => {
        const ok = await deleteExpenses(saved);
        walletChanged();
        toast(ok ? (saved.length === 1 ? 'Gasto borrado' : 'Gastos borrados') : 'No se pudieron borrar. Probá de nuevo.');
      },
    });
  }

  if (!open) {
    return (
      <Pressable
        onPress={expand}
        accessibilityRole="button"
        accessibilityLabel="¿Te falta cargar algo? Carga por texto, una línea por gasto"
        style={[styles.input, styles.folded, { backgroundColor: colors.surface, borderColor: colors.line }]}
      >
        <Text style={[type.body, { color: colors.textMuted }]}>¿Te falta cargar algo?</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.block}>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={'Una línea por gasto:\n12000 súper\n28/09 3500 café mp'}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel="Carga por texto, una línea por gasto"
        style={[type.body, styles.input, styles.field, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.line }]}
      />

      {!ctx ? (
        loadFailed ? (
          <Button title="No pudimos traer tus medios de pago. Reintentar" variant="link" onPress={load} style={styles.start} />
        ) : null
      ) : (
        resolved.map((line) => (
          <PreviewRow
            key={line.id}
            line={line}
            ctx={ctx}
            chips={chips}
            onPick={(methodId) => override(line.id, { methodId })}
            onDescribe={(description) => override(line.id, { description })}
            onConfirm={() => override(line.id, { confirmed: true })}
            onDiscard={() => keepOnly(new Set([line.id]))}
          />
        ))
      )}

      {note ? (
        <Text style={[type.caption, { color: colors.error }]} accessibilityLiveRegion="polite">
          {note}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Button title="Cerrar" variant="ghost" onPress={() => setOpen(false)} disabled={saving} />
        {resolved.length ? (
          <Button title={batchSaveLabel(resolved)} variant="primary" onPress={save} loading={saving} disabled={!ready.length} />
        ) : null}
      </View>
    </View>
  );
}

interface RowProps {
  line: ResolvedLine;
  ctx: EntryContext;
  chips: readonly PaymentMethod[];
  onPick: (methodId: string) => void;
  onDescribe: (description: string) => void;
  onConfirm: () => void;
  onDiscard: () => void;
}

function PreviewRow({ line, ctx, chips, onPick, onDescribe, onConfirm, onDiscard }: RowProps) {
  const { colors } = useTheme();
  const method = ctx.methods.find((m) => m.id === line.methodId);
  const details = [
    method ? paymentMethodLabel(method) : null,
    line.installments > 1 ? `${line.installments} cuotas` : null,
    line.date !== ctx.today ? formatShortDate(line.date) : null,
  ].filter(Boolean);
  const warnings = line.warnings.map((w) => WARNING_TEXT[w]).join(' ');
  const confirmable = line.amount !== null;
  const options = line.candidates.length ? ctx.methods.filter((m) => line.candidates.includes(m.id)) : chips;

  return (
    <View style={[styles.row, { borderBottomColor: colors.line }]}>
      <View style={styles.rowHead}>
        <View
          style={styles.rowMiddle}
          accessible
          accessibilityLabel={[line.description || line.text, ...details, line.amount ? moneyInWords(line.amount) : null]
            .filter(Boolean)
            .join(', ')}
        >
          <Text style={[type.bodyStrong, { color: colors.text }]} numberOfLines={1}>
            {line.description || line.text}
          </Text>
          {details.length ? (
            <Text style={[type.caption, { color: colors.textMuted }]} numberOfLines={1}>
              {details.join(' · ')}
            </Text>
          ) : null}
        </View>
        {line.status === 'no_amount' ? (
          <Pill label="Falta el monto" variant="error" />
        ) : line.status === 'review' ? (
          <Pressable
            onPress={onConfirm}
            disabled={!confirmable}
            accessibilityRole="button"
            accessibilityLabel={confirmable ? `Revisar: ${warnings} Tocá para confirmar` : `Revisar: ${warnings}`}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          >
            <Pill label="Revisar" variant="warning" />
          </Pressable>
        ) : line.amount ? (
          <Text style={[type.money, { color: colors.text }]} maxFontSizeMultiplier={1.3}>
            {formatMoney(line.amount)}
          </Text>
        ) : null}
      </View>

      {line.status === 'review' && warnings ? (
        <Text style={[type.caption, { color: colors.warning }]}>
          {warnings}
          {confirmable ? ' Tocá "Revisar" si está bien.' : ' Corregilo en el texto.'}
        </Text>
      ) : null}

      {line.status === 'incomplete' ? (
        <View style={styles.block}>
          {!line.methodId ? (
            <View style={styles.chips}>
              {options.map((m) => (
                <Chip
                  key={m.id}
                  label={`${m.kind === 'card' && m.isFavorite ? '★ ' : ''}${paymentMethodLabel(m)}`}
                  onPress={() => onPick(m.id)}
                />
              ))}
            </View>
          ) : null}
          {!line.description ? (
            <TextInput
              onEndEditing={(e) => onDescribe(e.nativeEvent.text)}
              onSubmitEditing={(e) => onDescribe(e.nativeEvent.text)}
              placeholder="Descripción"
              placeholderTextColor={colors.textMuted}
              maxLength={60}
              accessibilityLabel="Descripción del gasto"
              style={[type.body, styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.line }]}
            />
          ) : null}
          <Button title="Descartar" variant="link" onPress={onDiscard} style={styles.start} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  input: { borderWidth: 1, borderRadius: radius.sm, paddingVertical: 9, paddingHorizontal: 10, minHeight: 44 },
  folded: { justifyContent: 'center' },
  // Hasta 4 líneas a la vista; después, el campo se desplaza.
  field: { maxHeight: 22 * VISIBLE_LINES + 18, textAlignVertical: 'top' },
  row: { gap: 6, paddingVertical: 8, borderBottomWidth: 1 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowMiddle: { flex: 1, minWidth: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  start: { alignSelf: 'flex-start' },
});
