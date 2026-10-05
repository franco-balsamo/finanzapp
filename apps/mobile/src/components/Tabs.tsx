import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, type } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

interface Props<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** `Tabs` de la Billetera (DESIGN.md): Tarjetas / Cuentas. */
export function Tabs<T extends string>({ options, value, onChange }: Props<T>) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="tablist" style={styles.row}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[styles.tab, { backgroundColor: selected ? colors.text : colors.surface2 }]}
          >
            <Text style={[styles.text, { color: selected ? colors.bg : colors.textMuted }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  tab: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: radius.full, minHeight: 44, justifyContent: 'center' },
  text: { ...type.button, fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.56 },
});
