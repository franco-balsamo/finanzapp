import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { type } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

const MAX_WIDTH = 560;

/**
 * La web publicada, fuera de `/g/…` (decisión 2026-10-07-web-completa): en la beta la app se usa
 * en el teléfono. La app completa en la web va después de la beta.
 */
export default function Install() {
  const { colors } = useTheme();
  return (
    <Screen>
      <View style={styles.page}>
        <Text style={[type.label, { color: colors.primary }]}>Mangos</Text>
        <Text style={[type.displayOnb, { color: colors.text }]} accessibilityRole="header">
          Mangos está en el teléfono
        </Text>
        <Text style={[type.body, { color: colors.textMuted }]}>
          Instalá la app para llevar tus gastos, tus tarjetas en cuotas y tus grupos. Si te pasaron el link de un grupo,
          abrilo para verlo sin instalar nada.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', gap: 18, marginTop: 48 },
});
