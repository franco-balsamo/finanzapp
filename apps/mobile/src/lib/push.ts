// Push de los avisos (spec del 14/10, P-6). Solo Android en un development
// build: en la web y en Expo Go (que no recibe push remoto) todo es no-op.
import { pushRoute, type PushData } from '@mangos/core';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { markNoticeRead } from './home';
import { supabase } from './supabase';

const enabled = Platform.OS === 'android' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
const ASKED_KEY = 'push.asked';
const TOKEN_KEY = 'push.token';

// En Android 13+ el canal tiene que existir antes de pedir el permiso.
const channel = enabled
  ? Notifications.setNotificationChannelAsync('avisos', { name: 'Avisos', importance: Notifications.AndroidImportance.HIGH }).catch(
      () => undefined,
    )
  : null;

// Banner también con la app abierta.
if (enabled) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

export type PushPermission = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export async function pushPermission(): Promise<PushPermission> {
  if (!enabled) return 'unsupported';
  return (await Notifications.getPermissionsAsync()).status;
}

/**
 * Registra el token de este teléfono. Con `ask`, pide el permiso si nunca se
 * pidió (D5: una sola vez; si lo niega, no se vuelve a pedir).
 */
export async function registerPush({ ask }: { ask: boolean }): Promise<void> {
  if (!enabled) return;
  await channel;
  let { status } = await Notifications.getPermissionsAsync();
  if (status === 'undetermined' && ask && !(await AsyncStorage.getItem(ASKED_KEY))) {
    await AsyncStorage.setItem(ASKED_KEY, '1');
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  const { error } = await supabase.rpc('register_push_token', { token });
  if (error) throw error;
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

/** Antes de cerrar sesión: este teléfono deja de recibir los avisos de la cuenta. */
export async function unregisterPush(): Promise<void> {
  const token = enabled ? await AsyncStorage.getItem(TOKEN_KEY) : null;
  if (!token) return;
  const { error } = await supabase.rpc('unregister_push_token', { token });
  if (error) throw error;
  await AsyncStorage.removeItem(TOKEN_KEY);
}

// El hook devuelve la misma respuesta en cada montaje: se abre una sola vez.
let handled: string | null = null;

/** Tocar el push (con la app abierta, en segundo plano o cerrada): lo marca leído y abre la tarjeta o Inicio. */
export const usePushTaps: () => void = enabled
  ? () => {
      const response = Notifications.useLastNotificationResponse();
      useEffect(() => {
        if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
        const { identifier, content } = response.notification.request;
        if (handled === identifier) return;
        handled = identifier;
        const data = content.data as (PushData & { notification_id?: string }) | null;
        if (data?.notification_id) markNoticeRead(data.notification_id).catch(() => undefined);
        router.push(pushRoute(data));
      }, [response]);
    }
  : () => undefined;
