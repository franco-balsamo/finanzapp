import { addDays, formatShortDate, parseShortDate, type ISODate } from '@mangos/core';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip } from './Chip';
import { TextField } from './TextField';

/** "Hoy", "Ayer", "Anteayer" o "28/9". */
export function dateLabel(date: ISODate, today: ISODate): string {
  if (date === today) return 'Hoy';
  if (date === addDays(today, -1)) return 'Ayer';
  if (date === addDays(today, -2)) return 'Anteayer';
  return formatShortDate(date);
}

interface Props {
  today: ISODate;
  value: ISODate;
  onChange: (date: ISODate) => void;
  /** Avisa si el texto de "Otra fecha" no sirve (o null cuando se corrige). */
  onError: (error: string | null) => void;
  error?: string | null;
}

/**
 * Fichas Hoy, Ayer y Anteayer, más "Otra fecha (dd/mm)" con `parseShortDate` de core: la misma regla
 * que la carga por texto. No acepta fechas futuras.
 */
export function DateChooser({ today, value, onChange, onError, error }: Props) {
  const [text, setText] = useState('');

  function onText(t: string) {
    setText(t);
    const parsed = parseShortDate(t, today);
    if (parsed && parsed !== 'invalid' && !parsed.future) {
      onChange(parsed.date);
      onError(null);
    } else {
      onError(t.trim() ? 'Escribí la fecha como dd/mm, que no sea futura.' : null);
    }
  }

  return (
    <View style={styles.block}>
      <View style={styles.chips}>
        {[0, -1, -2].map((d) => {
          const date = addDays(today, d);
          return (
            <Chip
              key={d}
              label={dateLabel(date, today)}
              selected={value === date}
              onPress={() => {
                onChange(date);
                setText('');
                onError(null);
              }}
            />
          );
        })}
      </View>
      <TextField
        label="Otra fecha (dd/mm)"
        value={text}
        onChangeText={onText}
        error={error}
        mono
        keyboardType="numbers-and-punctuation"
        placeholder="28/09"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
