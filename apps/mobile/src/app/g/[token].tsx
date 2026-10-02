import { CURRENCIES } from '@mangos/core';
import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

// Web de invitados: por ahora solo prueba que la ruta exporta a web y que Metro resuelve @mangos/core.
export default function GuestGroup() {
  const { token } = useLocalSearchParams<{ token: string }>();
  return (
    <View>
      <Text>{token}</Text>
      <Text>{CURRENCIES.join(' · ')}</Text>
    </View>
  );
}
