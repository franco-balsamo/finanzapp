import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { layout, radius, type } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { Button } from './Button';

/** Un panel con su título y, si hay, un link a la pantalla que amplía (Inicio, Ajustes). */
export function Section({ title, link, onLink, children }: { title: string; link?: string; onLink?: () => void; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <View style={styles.head}>
        <Text style={[type.label, { color: colors.textMuted }]} accessibilityRole="header">
          {title}
        </Text>
        {link && onLink ? <Button title={link} variant="link" onPress={onLink} /> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: radius.lg, padding: layout.panelPadding, gap: 14 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 24 },
});
