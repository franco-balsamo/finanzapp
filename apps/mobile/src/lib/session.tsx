import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { settingsKey, usePendingSender } from './pending';
import { authStorageKey, supabase } from './supabase';

export interface UserSettings {
  /** Cómo te llaman en los grupos. null hasta que se carga (al crear el primer grupo). */
  name: string | null;
  display_currency: 'ARS' | 'USD';
  fx_reference: 'mep' | 'oficial' | 'blue';
  theme: 'system' | 'light' | 'dark';
  onboarded_at: string | null;
  /** No molestar (02 §9): hora de 0 a 23, o null sin horario. */
  quiet_from: number | null;
  quiet_to: number | null;
}

const SETTINGS_COLUMNS = 'name, display_currency, fx_reference, theme, onboarded_at, quiet_from, quiet_to';

interface SessionState {
  /** true hasta saber si hay sesión y, si la hay, hasta traer los ajustes. */
  loading: boolean;
  session: Session | null;
  settings: UserSettings | null;
  /** Guarda columnas de `user_settings` y actualiza el estado. */
  updateSettings: (changes: Partial<UserSettings>) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionKnown, setSessionKnown] = useState(false);
  // Los ajustes van con el usuario al que pertenecen, así un cambio de sesión no muestra los de otro.
  const [loaded, setLoaded] = useState<{ userId: string; settings: UserSettings | null } | null>(null);
  const loadedRef = useRef(loaded);
  loadedRef.current = loaded;

  useEffect(() => {
    // Sin red y con el token vencido, getSession reintenta el refresco hasta 30 s y da null aunque la
    // sesión siga guardada: se arranca con la guardada (02 §5, "Sin conexión"). Solo SIGNED_OUT la saca.
    AsyncStorage.getItem(authStorageKey)
      .then((raw) => {
        const stored = raw ? (JSON.parse(raw) as Session) : null;
        if (!stored?.user) return;
        setSession((current) => current ?? stored);
        setSessionKnown(true);
      })
      .catch(() => undefined);
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSession(data.session);
      setSessionKnown(true);
    });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (next || event === 'SIGNED_OUT') setSession(next);
      setSessionKnown(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  usePendingSender(userId);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    // Primero la copia del teléfono (sin red la app abre igual) y después lo que trae la base.
    AsyncStorage.getItem(settingsKey(userId))
      .then((raw) => {
        if (raw && !cancelled) setLoaded((current) => (current?.userId === userId ? current : { userId, settings: JSON.parse(raw) }));
      })
      .catch(() => undefined);
    supabase
      .from('user_settings')
      .select(SETTINGS_COLUMNS)
      .eq('user_id', userId)
      .single()
      .retry(false)
      .then(({ data, error, status }) => {
        // status 0: sin red. Queda la copia; sin copia, se trata como bienvenida pendiente.
        if (cancelled || (status === 0 && loadedRef.current?.userId === userId)) return;
        const settings = error ? null : (data as UserSettings);
        if (settings) AsyncStorage.setItem(settingsKey(userId), JSON.stringify(settings)).catch(() => undefined);
        setLoaded({ userId, settings });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const settings = userId && loaded?.userId === userId ? loaded.settings : null;
  const loading = !sessionKnown || (!!userId && loaded?.userId !== userId);

  const updateSettings = useCallback(
    async (changes: Partial<UserSettings>) => {
      if (!userId) throw new Error('Sin sesión');
      const { data, error } = await supabase
        .from('user_settings')
        .update(changes)
        .eq('user_id', userId)
        .select(SETTINGS_COLUMNS)
        .single();
      if (error) throw error;
      setLoaded({ userId, settings: data as UserSettings });
      AsyncStorage.setItem(settingsKey(userId), JSON.stringify(data)).catch(() => undefined);
    },
    [userId],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <SessionContext.Provider value={{ loading, session, settings, updateSettings, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionState {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession va adentro de SessionProvider');
  return value;
}
