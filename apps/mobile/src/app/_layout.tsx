import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import {
  SchibstedGrotesk_400Regular,
  SchibstedGrotesk_500Medium,
  SchibstedGrotesk_700Bold,
} from '@expo-google-fonts/schibsted-grotesk';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { ToastProvider } from '../components/Toast';
import { SessionProvider, useSession } from '../lib/session';
import { useTheme } from '../theme/useTheme';

SplashScreen.preventAutoHideAsync();

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
 * Con las dos: la app. La web de invitados (`/g/[token]`) no pide nada.
 */
function RootNavigator({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { loading, session, settings } = useSession();
  const { name, colors } = useTheme();
  const ready = fontsLoaded && !loading;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  const onboarded = !!settings?.onboarded_at;
  return (
    <>
      <StatusBar style={name === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Protected guard={!!session && onboarded}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!!session && !onboarded}>
          <Stack.Screen name="bienvenida" />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Screen name="g/[token]" />
      </Stack>
    </>
  );
}
