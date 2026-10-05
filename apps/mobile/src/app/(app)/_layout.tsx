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
      <Stack.Screen name="index" />
      <Stack.Screen name="tarjeta-nueva" options={sheet} />
      <Stack.Screen name="cuenta-nueva" options={sheet} />
    </Stack>
  );
}
