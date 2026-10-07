import type { ReactNode } from 'react';
import { Text } from 'react-native';
import { fonts } from '../theme/tokens';

const mono = { fontFamily: fonts.mono, fontVariant: ['tabular-nums' as const] };

/**
 * Un monto o un número adentro de un texto corrido, en IBM Plex Mono (DESIGN.md: "todo monto,
 * fecha corta, número de tarjeta o cotización en Plex Mono"). Toma el tamaño y el color del texto
 * que lo rodea.
 */
export function Mono({ children }: { children: ReactNode }) {
  return <Text style={mono}>{children}</Text>;
}
