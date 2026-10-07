import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import {
  SchibstedGrotesk_400Regular,
  SchibstedGrotesk_500Medium,
  SchibstedGrotesk_700Bold,
} from '@expo-google-fonts/schibsted-grotesk';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { ToastProvider } from '../components/Toast';
import { SessionProvider, useSession } from '../lib/session';
import { useTheme } from '../theme/useTheme';

SplashScreen.preventAutoHideAsync();

// La web publicada es solo la de invitados hasta después de la beta (decisión 2026-10-07-web-completa).
// En desarrollo (`npx expo start --web`) la app completa sigue andando en el navegador.
const GUEST_WEB_ONLY = Platform.OS === 'web' && !__DEV__;

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    SchibstedGrotesk_400Regular,
    SchibstedGrotesk_500Medium,
    SchibstedGrotesk_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });

  return (
    <KeyboardProvider>
      <SessionProvider>
        <ToastProvider>
          <RootNavigator fontsLoaded={fontsLoaded} />
        </ToastProvider>
      </SessionProvider>
    </KeyboardProvider>
  );
}

/**
 * Sin sesión: ingresar. Con sesión y sin la bienvenida hecha (`onboarded_at`): la bienvenida.
 * Con las dos: la app. La web de invitados (`/g/[token]`) no pide nada. En la web publicada, todo lo
 * demás muestra "Instalá Mangos" (`instala`).
 */
function RootNavigator({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { loading, session, settings } = useSession();
  const { name, colors } = useTheme();
  // Mientras cargan los ajustes de una sesión nueva, quedan los permisos anteriores. Si se
  // desmontara la navegación, al volver arrancaría en la Billetera y no en la página del grupo
  // donde se acaba de iniciar sesión para reclamar un lugar (W-5).
  const guards = useRef<{ signedIn: boolean; onboarded: boolean } | null>(null);
  if (!loading) guards.current = { signedIn: !!session, onboarded: !!settings?.onboarded_at };
  const ready = fontsLoaded && guards.current !== null;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready || !guards.current) return null;

  const { signedIn, onboarded } = guards.current;
  return (
    <>
      <StatusBar style={name === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Protected guard={GUEST_WEB_ONLY}>
          <Stack.Screen name="instala" />
        </Stack.Protected>
        <Stack.Protected guard={!GUEST_WEB_ONLY && signedIn && onboarded}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!GUEST_WEB_ONLY && signedIn && !onboarded}>
          <Stack.Screen name="bienvenida" />
        </Stack.Protected>
        <Stack.Protected guard={!GUEST_WEB_ONLY && !signedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Screen name="g/[token]" />
      </Stack>
    </>
  );
}
