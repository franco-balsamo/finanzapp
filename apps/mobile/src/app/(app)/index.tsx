import { router } from 'expo-router';
import { Text } from 'react-native';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { useSession } from '../../lib/session';
import { type } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

// Provisoria (E1 y E3): la Billetera va en E4.
export default function Wallet() {
  const { colors } = useTheme();
  const { session, signOut } = useSession();

  return (
    <Screen>
      <Text style={[type.display, { color: colors.text }]} accessibilityRole="header">
        Billetera
      </Text>
      <Text style={[type.body, { color: colors.textMuted }]}>{session?.user.email}</Text>
      <Button title="Sumar tarjeta" onPress={() => router.push('/tarjeta-nueva')} />
      <Button title="Sumar cuenta" onPress={() => router.push('/cuenta-nueva')} />
      <Button title="Cerrar sesión" variant="ghost" onPress={signOut} />
    </Screen>
  );
}
