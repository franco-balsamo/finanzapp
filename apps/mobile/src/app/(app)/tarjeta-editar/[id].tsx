import { amountInputText } from '@mangos/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { CardForm } from '../../../components/CardForm';
import { Sheet } from '../../../components/Sheet';
import { SheetFooter } from '../../../components/SheetFooter';
import { useToast } from '../../../components/Toast';
import { updateCard } from '../../../lib/cardActions';
import { EMPTY_CARD, validateCard, type CardFormErrors, type CardFormValue } from '../../../lib/cardForm';
import { walletChanged } from '../../../lib/events';
import { useSession } from '../../../lib/session';
import { loadCardDetail } from '../../../lib/wallet';
import { type } from '../../../theme/tokens';
import { useTheme } from '../../../theme/useTheme';

/** Editar una tarjeta (D-4): el mismo formulario de E3, con el límite obligatorio (02 §3). */
export default function EditCard() {
  const { colors } = useTheme();
  const toast = useToast();
  const { session, settings } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [value, setValue] = useState<CardFormValue>(EMPTY_CARD);
  const [loaded, setLoaded] = useState(false);
  const [errors, setErrors] = useState<CardFormErrors | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!session || !settings || !id) return;
    loadCardDetail(session.user.id, settings, id).then(({ detail }) => {
      const c = detail.card;
      setValue({
        bank: c.bank,
        name: c.name,
        network: c.network,
        last4: c.last4,
        expiry: c.expiry ?? '',
        closeDay: String(c.closeDay),
        dueDay: String(c.dueDay),
        // Una tarjeta vieja sin límite muestra el campo vacío: hay que cargarlo para guardar.
        limit: c.creditLimit.minor ? amountInputText(c.creditLimit.minor) : '',
      });
      setLoaded(true);
    }, () => setSaveError('No pudimos traer la tarjeta.'));
  }, [session, settings, id]);

  async function save() {
    const found = validateCard(value);
    setErrors(found);
    if (found || !id) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateCard(id, value);
      walletChanged();
      router.back();
      toast('Tarjeta actualizada');
    } catch {
      setSaving(false);
      setSaveError('No pudimos guardar los cambios. Probá de nuevo.');
    }
  }

  return (
    <Sheet
      title="Editar tarjeta"
      onClose={() => router.back()}
      footer={<SheetFooter actionTitle="Guardar" onAction={save} onCancel={() => router.back()} loading={saving || !loaded} />}
    >
      {loaded ? <CardForm value={value} onChange={setValue} errors={errors} /> : null}
      {saveError ? <Text style={[type.caption, { color: colors.error }]}>{saveError}</Text> : null}
    </Sheet>
  );
}
