import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { layout, radius, shadow, type } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

/**
 * FAB "+ Gasto" (DESIGN.md, Botón fab), a la derecha y arriba de la barra de pestañas.
 * La barra ya respeta el área segura de abajo, así que acá no se suma.
 */
export function Fab() {
  const { name, colors } = useTheme();
  return (
    <Pressable
      onPress={() => router.push('/cargar')}
      accessibilityRole="button"
      accessibilityLabel="Cargar gasto"
      style={({ pressed }) => [
        styles.fab,
        { backgroundColor: colors.primary },
        name === 'dark' ? shadow.floatDark : shadow.float,
        pressed && { opacity: 0.9 },
      ]}
    >
      <Text style={[type.button, { color: colors.onPrimary }]}>+ Gasto</Text>
    </Pressable>
  );
}

/** Lugar al final de una lista para que el FAB no tape la última fila. */
export const FAB_SPACE = 64;

const styles = StyleSheet.create({
  fab: {
    position: 'absolute', right: layout.gutter, bottom: 16, paddingVertical: 12, paddingHorizontal: 18,
    borderRadius: radius.full, minHeight: 48, justifyContent: 'center',
  },
});
