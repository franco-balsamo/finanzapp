import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { CATEGORIES, type CategoryIconName } from '../lib/categories';
import { tint16 } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

/** Glifos de 24 × 24 copiados tal cual de `CAT_ICONS` (prototipo/mangos.html). Solo los 6 de la v1. */
const GLYPHS: Record<CategoryIconName, string> = {
  cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3.5h3l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.5-1.1L21 8H6.6"/>',
  food: '<path d="M7 3v8a2 2 0 0 0 2 2v8M5 3v5a2 2 0 0 0 4 0V3"/><path d="M17 21V3c-2 1.5-3 4-3 7 0 1.7 1.3 3 3 3"/>',
  bus: '<rect x="4.5" y="3.5" width="15" height="14" rx="3"/><path d="M4.5 11h15M8 17.5V20M16 17.5V20"/><circle cx="8.5" cy="14.3" r=".6"/><circle cx="15.5" cy="14.3" r=".6"/>',
  bolt: '<path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12z"/>',
  play: '<rect x="3" y="4.5" width="18" height="13" rx="2.5"/><path d="M10.5 8.5v5l4-2.5zM8 20.5h8"/>',
  box: '<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>',
};

/** DESIGN.md "Ícono de categoría": lado, radio y glifo (fracción del lado). */
const SIZES = {
  md: { side: 36, radius: 10, glyph: 0.55 },
  sm: { side: 30, radius: 8, glyph: 0.62 },
  xs: { side: 18, radius: 5, glyph: 1 },
  inline: { side: 16, radius: 0, glyph: 1 },
} as const;

const xml = (glyph: string, color: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${glyph}</svg>`;

/**
 * Cuadrado redondeado con el color de la categoría al 16% y el glifo en ese color. `inline` va sin
 * fondo y en `color` (el del chip). Decorativo: el nombre de la categoría va al lado.
 */
export function CategoryIcon({ categoryId, size, color }: { categoryId: string | null; size: keyof typeof SIZES; color?: string }) {
  const { colors } = useTheme();
  const category = CATEGORIES.find((c) => c.id === categoryId);
  const icon = category?.icon ?? 'box';
  const tone = colors.cat[category?.colorIndex ?? 5];
  const { side, radius, glyph } = SIZES[size];
  const glyphSide = side * glyph;
  const inline = size === 'inline';
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{
        width: side,
        height: side,
        borderRadius: radius,
        backgroundColor: inline ? undefined : tint16(tone),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <SvgXml xml={xml(GLYPHS[icon], inline && color ? color : tone)} width={glyphSide} height={glyphSide} />
    </View>
  );
}
