import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { layout, radius, type } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

type Variant = 'default' | 'primary' | 'ghost' | 'link' | 'danger';

interface Props {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/** `Button` de DESIGN.md: default, primary, ghost y link. `danger` es un default con el texto en `error` (borrar la cuenta). */
export function Button({ title, onPress, variant = 'default', disabled, loading, style, accessibilityLabel }: Props) {
  const { colors } = useTheme();
  const inactive = disabled || loading;

  const base = {
    default: { backgroundColor: colors.surface, borderColor: colors.line, color: colors.text },
    primary: { backgroundColor: colors.primary, borderColor: colors.primary, color: colors.onPrimary },
    ghost: { backgroundColor: 'transparent', borderColor: 'transparent', color: colors.textMuted },
    link: { backgroundColor: 'transparent', borderColor: 'transparent', color: colors.primary },
    danger: { backgroundColor: colors.surface, borderColor: colors.error, color: colors.error },
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      hitSlop={8}
      style={({ pressed }) => [
        styles.base,
        variant === 'ghost' || variant === 'link' ? styles.ghost : styles.solid,
        { backgroundColor: base.backgroundColor, borderColor: base.borderColor },
        pressed && variant === 'default' && { borderColor: colors.textMuted },
        pressed && variant === 'danger' && { opacity: 0.8 },
        pressed && variant === 'primary' && { opacity: 0.9 },
        pressed && variant === 'ghost' && { borderColor: colors.line },
        inactive && { opacity: 0.45 },
        style,
      ]}
    >
      {({ pressed }) =>
        loading ? (
          <ActivityIndicator size={14} color={base.color} />
        ) : (
          <Text
            style={[
              type.button,
              { color: pressed && variant === 'ghost' ? colors.text : base.color },
              variant === 'link' && { fontSize: 13, textDecorationLine: pressed ? 'underline' : 'none' },
            ]}
          >
            {title}
          </Text>
        )
      }
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: layout.minTouch,
    borderWidth: 1,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  solid: { paddingVertical: 8, paddingHorizontal: 13 },
  ghost: { paddingVertical: 5, paddingHorizontal: 9 },
});
