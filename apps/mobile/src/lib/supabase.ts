import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  throw new Error('Faltan EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY (ver apps/mobile/.env.example)');
}

// En el export estático de la web no hay `window`: ahí no se guarda la sesión.
const canStore = Platform.OS !== 'web' || typeof window !== 'undefined';

export const supabase = createClient(url, key, {
  auth: {
    storage: canStore ? AsyncStorage : undefined,
    autoRefreshToken: canStore,
    persistSession: canStore,
    detectSessionInUrl: false,
  },
});

// Refresca el token solo con la app en primer plano (guía de Supabase para Expo).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
