import { newGroupErrors, type Currency, type NewGroupErrors } from '@mangos/core';
import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Segmented } from '../../components/Segmented';
import { Sheet } from '../../components/Sheet';
import { SheetFooter } from '../../components/SheetFooter';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/Toast';
import { walletChanged } from '../../lib/events';
import { addProvisionalMembers, createGroup } from '../../lib/groups';
import { useSession } from '../../lib/session';
import { type } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

const CURRENCY_OPTIONS = [
  { value: 'ARS', label: 'Pesos' },
  { value: 'USD', label: 'Dólares' },
] as const;

const ERROR_TEXT = {
  name: 'Poné un nombre.',
  myName: '¿Cómo te llaman en el grupo?',
  duplicate: 'Ya hay alguien con ese nombre.',
} as const;

/** Cada campo lleva el id del integrante desde que aparece: un reintento no lo duplica. */
interface PersonField {
  id: string;
  name: string;
}

const newField = (): PersonField => ({ id: randomUUID(), name: '' });

/** Nuevo grupo (G-3): nombre, moneda y las personas, que entran como provisorias. */
export default function NewGroup() {
  const { colors } = useTheme();
  const toast = useToast();
  const { settings, updateSettings } = useSession();
  const savedName = settings?.name?.trim() ?? '';

  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<Currency>('ARS');
  const [myName, setMyName] = useState(savedName);
  const [people, setPeople] = useState<PersonField[]>([newField()]);
  const [errors, setErrors] = useState<NewGroupErrors | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Si el grupo ya se creó y falló al sumar a alguien, reintentar no crea otro grupo.
  const createdId = useRef<string | null>(null);

  function setPerson(id: string, value: string) {
    setPeople((list) => list.map((p) => (p.id === id ? { ...p, name: value } : p)));
    setErrors(null);
  }

  async function save() {
    const found = newGroupErrors({ name, myName, people: people.map((p) => p.name) });
    setErrors(found);
    if (!found.ok) return;

    setSaving(true);
    setSaveError(null);
    try {
      if (!savedName) await updateSettings({ name: myName.trim() });
      createdId.current ??= await createGroup(name, currency, myName);
      await addProvisionalMembers(createdId.current, people.filter((p) => p.name.trim()));
      walletChanged();
      router.back();
      toast(`Creaste ${name.trim()}`);
    } catch {
      setSaving(false);
      setSaveError('No pudimos crear el grupo. Probá de nuevo.');
    }
  }

  return (
    <Sheet
      title="Nuevo grupo"
      onClose={() => router.back()}
      footer={<SheetFooter actionTitle="Crear grupo" onAction={save} onCancel={() => router.back()} loading={saving} />}
    >
      <TextField
        label="Nombre del grupo"
        value={name}
        onChangeText={(t) => {
          setName(t);
          setErrors(null);
        }}
        error={errors?.name ? ERROR_TEXT.name : undefined}
        placeholder="ej. Cabaña en Bariloche"
        autoCapitalize="sentences"
        maxLength={40}
      />

      <View style={styles.field}>
        <Text style={[type.caption, { color: colors.textMuted }]}>Moneda del grupo</Text>
        <Segmented options={CURRENCY_OPTIONS} value={currency} onChange={setCurrency} accessibilityLabel="Moneda del grupo" />
      </View>

      {/* Tu nombre: solo si todavía no está en tus ajustes. */}
      {!savedName ? (
        <TextField
          label="¿Cómo te llaman en el grupo?"
          value={myName}
          onChangeText={(t) => {
            setMyName(t);
            setErrors(null);
          }}
          error={errors?.myName ? ERROR_TEXT.myName : undefined}
          placeholder="ej. Fran"
          autoCapitalize="words"
          maxLength={30}
        />
      ) : null}

      <View style={styles.field}>
        <Text style={[type.caption, { color: colors.textMuted }]}>Personas</Text>
        <Text style={[type.body, { color: colors.text }]}>Vos{savedName ? ` (${savedName})` : ''}</Text>
        {people.map((p, i) => (
          <View key={p.id} style={styles.person}>
            <View style={styles.flex}>
              <TextField
                label={`Persona ${i + 1}`}
                value={p.name}
                onChangeText={(t) => setPerson(p.id, t)}
                error={errors?.people[i] ? ERROR_TEXT.duplicate : undefined}
                placeholder="Nombre"
                autoCapitalize="words"
                maxLength={30}
              />
            </View>
            {people.length > 1 ? (
              <Button
                title="✕"
                variant="ghost"
                onPress={() => setPeople((list) => list.filter((x) => x.id !== p.id))}
                accessibilityLabel={`Sacar a ${p.name.trim() || `la persona ${i + 1}`}`}
                style={styles.remove}
              />
            ) : null}
          </View>
        ))}
        <Button title="+ Sumar otra" variant="link" onPress={() => setPeople((list) => [...list, newField()])} style={styles.start} />
        <Text style={[type.caption, { color: colors.textMuted }]}>
          Entran sin cuenta. Los gastos y los saldos funcionan igual con ellos.
        </Text>
      </View>

      {saveError ? (
        <Text style={[type.caption, { color: colors.error }]} accessibilityLiveRegion="polite">
          {saveError}
        </Text>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  field: { gap: 8 },
  person: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  remove: { marginBottom: 2 },
  start: { alignSelf: 'flex-start' },
});
