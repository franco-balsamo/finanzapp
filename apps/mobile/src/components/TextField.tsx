import { forwardRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { radius, type } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

interface Props extends TextInputProps {
  label: string;
  error?: string | null;
  /** Montos y códigos: IBM Plex Mono. */
  mono?: boolean;
}

/** `Input` de DESIGN.md con su etiqueta y el error debajo. */
export const TextField = forwardRef<TextInput, Props>(function TextField({ label, error, mono, style, ...input }, ref) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={[type.caption, { color: error ? colors.error : colors.textMuted }]}>{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        {...input}
        onFocus={(e) => {
          setFocused(true);
          input.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          input.onBlur?.(e);
        }}
        style={[
          mono ? type.money : type.body,
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor: error ? colors.error : focused ? colors.primary : colors.line,
            borderWidth: focused || error ? 2 : 1,
            // El borde de 2 no corre el texto.
            paddingHorizontal: focused || error ? 9 : 10,
          },
          style,
        ]}
      />
      {error ? (
        <Text style={[type.caption, { color: colors.error }]} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  field: { gap: 5 },
  input: { minHeight: 44, borderRadius: radius.sm, paddingVertical: 9 },
});
