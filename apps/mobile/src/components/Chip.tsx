import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { radius, type } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { Mono } from './Mono';

interface Props {
  label: string;
  /** Un número que va después del texto, en Plex Mono ("·· 2337"). */
  mono?: string;
  selected?: boolean;
  /** Ícono antes del texto; recibe el color del texto del chip. */
  icon?: (color: string) => ReactNode;
  onPress: () => void;
  accessibilityLabel?: string;
}

/** `Chip` de DESIGN.md. Mide menos de 44 de alto: lleva `hitSlop` vertical de 8. */
export function Chip({ label, mono, selected = false, icon, onPress, accessibilityLabel }: Props) {
  const { colors } = useTheme();
  const textColor = selected ? colors.onPrimary : colors.textMuted;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (mono ? `${label} ${mono}` : label)}
      accessibilityState={{ selected }}
      hitSlop={{ top: 8, bottom: 8 }}
      style={[
        styles.chip,
        selected
          ? { backgroundColor: colors.primary, borderColor: colors.primary }
          : { backgroundColor: colors.surface, borderColor: colors.line },
        icon ? { paddingLeft: 8 } : null,
      ]}
    >
      {icon?.(textColor)}
      <Text style={[type.small, { color: textColor }]}>
        {label}
        {mono ? (
          <>
            {' '}
            <Mono>{mono}</Mono>
          </>
        ) : null}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: 11, borderRadius: radius.full, borderWidth: 1 },
});
