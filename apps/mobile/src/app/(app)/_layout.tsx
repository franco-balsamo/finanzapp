import { Stack } from 'expo-router';

const sheet = {
  presentation: 'formSheet' as const,
  sheetAllowedDetents: [1],
  sheetGrabberVisible: true,
  sheetCornerRadius: 16,
};

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="tarjeta/[id]" />
      <Stack.Screen name="grupo/[id]" />
      <Stack.Screen name="movimientos" />
      <Stack.Screen name="cargar" options={sheet} />
      <Stack.Screen name="tarjeta-nueva" options={sheet} />
      <Stack.Screen name="cuenta-nueva" options={sheet} />
      <Stack.Screen name="pagar/[cardId]/[period]" options={sheet} />
      <Stack.Screen name="cierre/[cardId]/[period]" options={sheet} />
      <Stack.Screen name="tarjeta-editar/[id]" options={sheet} />
      <Stack.Screen name="grupo-nuevo" options={sheet} />
      <Stack.Screen name="grupo-pago/[groupId]" options={sheet} />
      <Stack.Screen name="grupo-editar/[id]" options={sheet} />
    </Stack>
  );
}
