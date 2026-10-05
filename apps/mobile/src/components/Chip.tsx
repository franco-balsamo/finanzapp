import { Pressable, StyleSheet, Text } from 'react-native';
import { radius, type } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

interface Props {
  label: string;
  selected?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}

/** `Chip` de DESIGN.md. Mide menos de 44 de alto: lleva `hitSlop` vertical de 8. */
export function Chip({ label, selected = false, onPress, accessibilityLabel }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      hitSlop={{ top: 8, bottom: 8 }}
      style={[
        styles.chip,
        selected
          ? { backgroundColor: colors.primary, borderColor: colors.primary }
          : { backgroundColor: colors.surface, borderColor: colors.line },
      ]}
    >
      <Text style={[type.small, { color: selected ? colors.onPrimary : colors.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { paddingVertical: 5, paddingHorizontal: 11, borderRadius: radius.full, borderWidth: 1 },
});
