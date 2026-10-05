import { useColorScheme } from 'react-native';
import { useSession } from '../lib/session';
import { palette, type Palette, type ThemeName } from './tokens';

/** Claro u oscuro según Ajustes; con "sistema" (o sin sesión), el del teléfono. */
export function useTheme(): { name: ThemeName; colors: Palette } {
  const system = useColorScheme();
  const { settings } = useSession();
  const preference = settings?.theme ?? 'system';
  const name: ThemeName = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
  return { name, colors: palette[name] };
}
