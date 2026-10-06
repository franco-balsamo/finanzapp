import { Tabs } from 'expo-router';
import { StyleSheet, View, type ColorValue } from 'react-native';
import { fonts, layout } from '../../../theme/tokens';
import { useTheme } from '../../../theme/useTheme';

type IconName = 'wallet' | 'groups';

/**
 * Íconos dibujados con View hasta que esté react-native-svg (spec de grupos, G-3): una billetera
 * y dos personas, como en el prototipo. Trazo de 1.7, en el color de la pestaña.
 */
function TabIcon({ name, color }: { name: IconName; color: ColorValue }) {
  if (name === 'wallet') {
    return (
      <View style={[styles.wallet, { borderColor: color }]}>
        <View style={[styles.walletClasp, { borderColor: color }]} />
      </View>
    );
  }
  return (
    <View style={styles.groups}>
      <View style={[styles.head, styles.headBig, { borderColor: color }]} />
      <View style={[styles.head, styles.headSmall, { borderColor: color }]} />
      <View style={[styles.body, styles.bodyBig, { borderColor: color }]} />
      <View style={[styles.body, styles.bodySmall, { borderColor: color }]} />
    </View>
  );
}

/** Barra de pestañas (DESIGN.md): `surface` con borde `line`, texto de 11 en `textMuted` y el activo en `primary`. */
export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line, borderTopWidth: 1 },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11, marginTop: layout.tabBarIconGap },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Billetera', tabBarIcon: ({ color }) => <TabIcon name="wallet" color={color} /> }}
      />
      <Tabs.Screen
        name="grupos"
        options={{ title: 'Grupos', tabBarIcon: ({ color }) => <TabIcon name="groups" color={color} /> }}
      />
    </Tabs>
  );
}

const stroke = 1.7;
const styles = StyleSheet.create({
  wallet: { width: 20, height: 15, borderWidth: stroke, borderRadius: 3.5, justifyContent: 'center', alignItems: 'flex-end' },
  walletClasp: { width: 7, height: 6, borderWidth: stroke, borderRightWidth: 0, borderTopLeftRadius: 3, borderBottomLeftRadius: 3 },
  groups: { width: 22, height: 18 },
  head: { position: 'absolute', borderWidth: stroke, borderRadius: 999 },
  headBig: { width: 7, height: 7, left: 3, top: 1 },
  headSmall: { width: 6, height: 6, left: 13, top: 3 },
  body: { position: 'absolute', borderWidth: stroke, borderBottomWidth: 0, borderTopLeftRadius: 999, borderTopRightRadius: 999 },
  bodyBig: { width: 11, height: 6, left: 1, top: 11 },
  bodySmall: { width: 9, height: 5, left: 12, top: 12 },
});
