import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, shadow, type } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

interface Props<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
  accessibilityLabel: string;
}

/** `Segmented` de DESIGN.md: Pesos / Dólares, red de la tarjeta. */
export function Segmented<T extends string>({ options, value, onChange, accessibilityLabel }: Props<T>) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[styles.box, { backgroundColor: colors.surface2 }]}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected, checked: selected }}
            hitSlop={{ top: 8, bottom: 8 }}
            style={[styles.option, selected && [{ backgroundColor: colors.surface }, shadow.segmentSelected]]}
          >
            <Text style={[type.small, { color: selected ? colors.text : colors.textMuted }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', padding: 3, borderRadius: radius.sm, alignSelf: 'flex-start' },
  option: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: radius.sm - 3, minHeight: 32, justifyContent: 'center' },
});
