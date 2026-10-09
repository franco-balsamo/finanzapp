import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/useTheme';
import { Button } from './Button';

interface Props {
  actionTitle: string;
  onAction: () => void;
  onCancel: () => void;
  loading?: boolean;
  /** `danger` para una acción que no se deshace. */
  actionVariant?: 'primary' | 'danger';
}

/** Botones de una hoja: "Cancelar" y la acción con su verbo, a la derecha (DESIGN.md, Botón). */
export function SheetFooter({ actionTitle, onAction, onCancel, loading, actionVariant = 'primary' }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.footer,
        { backgroundColor: colors.surface, borderTopColor: colors.line, paddingBottom: 12 + insets.bottom },
      ]}
    >
      <Button title="Cancelar" onPress={onCancel} disabled={loading} />
      <Button title={actionTitle} variant={actionVariant} onPress={onAction} loading={loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
});
