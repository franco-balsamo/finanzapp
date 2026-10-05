import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { CardForm } from '../../components/CardForm';
import { Sheet } from '../../components/Sheet';
import { SheetFooter } from '../../components/SheetFooter';
import { EMPTY_CARD, validateCard, type CardFormErrors } from '../../lib/cardForm';
import { createCard } from '../../lib/cards';
import { type } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

export default function NewCard() {
  const { colors } = useTheme();
  const [value, setValue] = useState(EMPTY_CARD);
  const [errors, setErrors] = useState<CardFormErrors | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    const found = validateCard(value);
    setErrors(found);
    if (found) return;
    setSaving(true);
    setSaveError(null);
    try {
      await createCard(value);
      router.back();
    } catch {
      setSaveError('No pudimos guardar la tarjeta. Probá de nuevo.');
      setSaving(false);
    }
  }

  return (
    <Sheet
      title="Sumar tarjeta de crédito"
      onClose={() => router.back()}
      footer={<SheetFooter actionTitle="Agregar" onAction={save} onCancel={() => router.back()} loading={saving} />}
    >
      <CardForm value={value} onChange={setValue} errors={errors} />
      {saveError ? <Text style={[type.caption, { color: colors.error }]}>{saveError}</Text> : null}
    </Sheet>
  );
}
