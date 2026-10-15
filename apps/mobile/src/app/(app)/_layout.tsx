import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { registerPush, usePushTaps } from '../../lib/push';

const sheet = {
  presentation: 'formSheet' as const,
  sheetAllowedDetents: [1],
  sheetGrabberVisible: true,
  sheetCornerRadius: 16,
};

export default function AppLayout() {
  // Con el permiso ya dado, mantiene el token al día (cambió o el teléfono pasó a esta cuenta).
  useEffect(() => {
    registerPush({ ask: false }).catch(() => undefined);
  }, []);
  usePushTaps();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="tarjeta/[id]" />
      <Stack.Screen name="grupo/[id]" />
      <Stack.Screen name="movimientos" />
      <Stack.Screen name="ajustes" />
      <Stack.Screen name="cargar" options={sheet} />
      <Stack.Screen name="tarjeta-nueva" options={sheet} />
      <Stack.Screen name="cuenta-nueva" options={sheet} />
      <Stack.Screen name="pagar/[cardId]/[period]" options={sheet} />
      <Stack.Screen name="cierre/[cardId]/[period]" options={sheet} />
      <Stack.Screen name="tarjeta-editar/[id]" options={sheet} />
      <Stack.Screen name="grupo-nuevo" options={sheet} />
      <Stack.Screen name="grupo-pago/[groupId]" options={sheet} />
      <Stack.Screen name="grupo-editar/[id]" options={sheet} />
      <Stack.Screen name="borrar-cuenta" options={sheet} />
    </Stack>
  );
}
