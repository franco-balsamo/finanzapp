import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabase';

export interface UserSettings {
  /** Cómo te llaman en los grupos. null hasta que se carga (al crear el primer grupo). */
  name: string | null;
  display_currency: 'ARS' | 'USD';
  fx_reference: 'mep' | 'oficial' | 'blue';
  theme: 'system' | 'light' | 'dark';
  onboarded_at: string | null;
}

const SETTINGS_COLUMNS = 'name, display_currency, fx_reference, theme, onboarded_at';

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionKnown(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setSessionKnown(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase
      .from('user_settings')
      .select(SETTINGS_COLUMNS)
      .eq('user_id', userId)
      .single()
      .then(({ data, error }) => {
        // Sin ajustes no se puede elegir pantalla: se trata como bienvenida pendiente.
        if (!cancelled) setLoaded({ userId, settings: error ? null : (data as UserSettings) });
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
