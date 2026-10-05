import { Text } from 'react-native';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { useSession } from '../../lib/session';
import { type } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

// Provisoria (E1): la Billetera va en E4.
export default function Wallet() {
  const { colors } = useTheme();
  const { session, signOut } = useSession();

  return (
    <Screen>
      <Text style={[type.display, { color: colors.text }]} accessibilityRole="header">
        Billetera
      </Text>
      <Text style={[type.body, { color: colors.textMuted }]}>{session?.user.email}</Text>
      <Text style={[type.moneyHero, { color: colors.text }]}>$0</Text>
      <Button title="Cerrar sesión" onPress={signOut} />
    </Screen>
  );
}
