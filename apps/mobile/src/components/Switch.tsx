import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet } from 'react-native';
import { motion, radius } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

interface Props {
  value: boolean;
  onChange: (value: boolean) => void;
  accessibilityLabel: string;
}

/** `Switch` de DESIGN.md: 40 × 22, pista `line` o `primary`, perilla blanca de 16 que se corre 18 en `micro`. */
export function Switch({ value, onChange, accessibilityLabel }: Props) {
  const { colors } = useTheme();
  const x = useRef(new Animated.Value(value ? 18 : 0)).current;

  useEffect(() => {
    // Con "reducir movimiento", la perilla salta sin animar.
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) =>
      Animated.timing(x, { toValue: value ? 18 : 0, duration: reduce ? 0 : motion.micro, useNativeDriver: true }).start(),
    );
  }, [value, x]);

  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={11}
      style={[styles.track, { backgroundColor: value ? colors.primary : colors.line }]}
    >
      <Animated.View style={[styles.knob, { transform: [{ translateX: x }] }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: 40, height: 22, borderRadius: radius.full, padding: 3 },
  knob: { width: 16, height: 16, borderRadius: radius.full, backgroundColor: '#ffffff' },
});
