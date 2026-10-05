import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { type } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { Button } from './Button';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Botones fijos abajo (`SheetFooter`). */
  footer: ReactNode;
}

/** Contenido de una hoja (`BottomSheet` de DESIGN.md) presentada con `formSheet`. */
export function Sheet({ title, onClose, children, footer }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
      <View style={styles.head}>
        <Text style={[type.title, { color: colors.text }]} accessibilityRole="header">
          {title}
        </Text>
        <Button title="✕" variant="ghost" onPress={onClose} accessibilityLabel="Cerrar" />
      </View>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        bottomOffset={80}
      >
        {children}
      </KeyboardAwareScrollView>
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  content: { padding: 20, paddingTop: 8, gap: 14 },
});
