import { StyleSheet, Text, View } from 'react-native';
import { radius, type } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

export type PillVariant = 'success' | 'error' | 'warning' | 'neutral';

/** `Pill` de DESIGN.md: estado sin interacción ("A pagar", "Vencido", "Pagado"). */
export function Pill({ label, variant }: { label: string; variant: PillVariant }) {
  const { colors } = useTheme();
  const [bg, fg] = {
    success: [colors.successBg, colors.success],
    error: [colors.errorBg, colors.error],
    warning: [colors.warningBg, colors.warning],
    neutral: [colors.surface2, colors.textMuted],
  }[variant];
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[type.pill, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { paddingVertical: 2, paddingHorizontal: 9, borderRadius: radius.full, alignSelf: 'flex-start' },
});
