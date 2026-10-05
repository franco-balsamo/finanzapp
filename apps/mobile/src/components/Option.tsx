import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, type } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

interface Props {
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
  /** A la derecha del título, por ejemplo la cotización. */
  aside?: ReactNode;
}

/** `Option` de DESIGN.md (bienvenida): borde `primary` y anillo de 1 cuando está elegida. */
export function Option({ title, subtitle, selected, onPress, aside }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      style={[
        styles.box,
        { backgroundColor: colors.surface, borderColor: selected ? colors.primary : colors.line },
        selected && { outlineColor: colors.primary, outlineWidth: 1, outlineStyle: 'solid' },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: selected ? colors.primary : colors.line }]} />
      <View style={styles.text}>
        <View style={styles.titleRow}>
          <Text style={[type.bodyStrong, { color: colors.text }]}>{title}</Text>
          {aside}
        </View>
        <Text style={[type.caption, { color: colors.textMuted }]}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', gap: 10, padding: 14, borderWidth: 1, borderRadius: radius.md },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 5 },
  text: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' },
});
