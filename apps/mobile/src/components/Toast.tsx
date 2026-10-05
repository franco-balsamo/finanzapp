import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, shadow, type } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

interface ToastAction {
  label: string;
  onPress: () => void;
}

interface ToastState {
  id: number;
  text: string;
  action?: ToastAction;
}

const ToastContext = createContext<((text: string, action?: ToastAction) => void) | null>(null);

/** `Toast` de DESIGN.md: 3 s sin acción y 5 s con acción ("Deshacer"). Va 84 sobre el borde de abajo. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { name, colors } = useTheme();
  const [toast, setToast] = useState<ToastState | null>(null);
  const nextId = useRef(0);

  const show = useCallback((text: string, action?: ToastAction) => {
    nextId.current += 1;
    setToast({ id: nextId.current, text, action });
    AccessibilityInfo.announceForAccessibility(text);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast((t) => (t?.id === toast.id ? null : t)), toast.action ? 5000 : 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? (
        <View pointerEvents="box-none" style={styles.layer}>
          <View
            accessibilityLiveRegion="polite"
            style={[styles.toast, { backgroundColor: colors.text }, name === 'dark' ? shadow.floatDark : shadow.float]}
          >
            <Text style={[type.button, styles.text, { color: colors.bg }]}>{toast.text}</Text>
            {toast.action ? (
              <Pressable
                onPress={() => {
                  setToast(null);
                  toast.action!.onPress();
                }}
                accessibilityRole="button"
                hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                style={styles.action}
              >
                <Text style={[type.button, { color: colors.primarySoft }]}>{toast.action.label}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast va adentro de ToastProvider');
  return show;
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 16, right: 16, bottom: 84, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    maxWidth: 520,
  },
  text: { flexShrink: 1, fontSize: 14 },
  action: { minHeight: 44, justifyContent: 'center' },
});
