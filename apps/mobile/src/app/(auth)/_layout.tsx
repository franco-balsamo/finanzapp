import { Stack } from 'expo-router';

export const unstable_settings = { initialRouteName: 'ingresar' };

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ingresar" />
      <Stack.Screen name="codigo" />
    </Stack>
  );
}
