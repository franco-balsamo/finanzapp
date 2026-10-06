import { formatMoney, newGroupErrors, type GroupDetail, type Money, type NewGroupErrors } from '@mangos/core';
import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../components/Button';
import { Sheet } from '../../../components/Sheet';
import { SheetFooter } from '../../../components/SheetFooter';
import { TextField } from '../../../components/TextField';
import { useToast } from '../../../components/Toast';
import { walletChanged } from '../../../lib/events';
import {
  addProvisionalMembers,
  deleteGroup,
  leaveGroup,
  loadGroupDetail,
  removeMember,
  renameGroup,
} from '../../../lib/groups';
import { useSession } from '../../../lib/session';
import { radius, type } from '../../../theme/tokens';
import { useTheme } from '../../../theme/useTheme';

interface PersonField {
  id: string;
  name: string;
}

type Confirm = { kind: 'leave' } | { kind: 'delete' } | { kind: 'remove'; memberId: string; name: string };

const abs = (m: Money): Money => ({ minor: Math.abs(m.minor), currency: m.currency });

/** Editar grupo (G-7, desde el ⋯ del detalle): nombre, sumar y quitar personas, abandonar y eliminar. */
export default function EditGroup() {
  const { colors } = useTheme();
  const toast = useToast();
  const { session } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [data, setData] = useState<GroupDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [name, setName] = useState('');
  const [people, setPeople] = useState<PersonField[]>([]);
  const [errors, setErrors] = useState<NewGroupErrors | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Los que se suman en esta edición ya pueden haber entrado si falló a mitad: no se duplican.
  const nameSaved = useRef(false);

  const load = useCallback(() => {
    if (!session || !id) return;
    setFailed(false);
    loadGroupDetail(session.user.id, id).then(
      (d) => {
        setData(d);
        setName((current) => current || d.name);
      },
      () => setFailed(true),
    );
  }, [session, id]);
  useEffect(load, [load]);

  const me = data?.members.find((m) => m.isMe);
  const active = data?.members.filter((m) => !m.leftOn) ?? [];

  async function save() {
    if (!data || !me) return;
    const found = newGroupErrors({
      name,
      myName: me.name,
      people: people.map((p) => p.name),
      taken: active.filter((m) => !m.isMe).map((m) => m.name),
    });
    setErrors(found);
    if (!found.ok) return;
    setBusy(true);
    setMessage(null);
    try {
      if (!nameSaved.current && name.trim() !== data.name) await renameGroup(data.id, name);
      nameSaved.current = true;
      await addProvisionalMembers(data.id, people.filter((p) => p.name.trim()));
      walletChanged();
      router.back();
      toast('Guardaste los cambios');
    } catch {
      setBusy(false);
      setMessage('No pudimos guardar los cambios. Probá de nuevo.');
    }
  }

  async function run(action: Confirm) {
    if (!data) return;
    setBusy(true);
    setMessage(null);
    if (action.kind === 'remove') {
      const failure = await removeMember(action.memberId);
      setBusy(false);
      setConfirm(null);
      if (failure) {
        setMessage(
          failure === 'not_allowed'
            ? `No se puede quitar a ${action.name}: ya participó en un gasto o un pago.`
            : 'No pudimos quitar a esa persona. Probá de nuevo.',
        );
        return;
      }
      walletChanged();
      toast(`Quitaste a ${action.name}`);
      load();
      return;
    }
    const failure = action.kind === 'leave' ? await leaveGroup(data.id) : await deleteGroup(data.id);
    if (failure) {
      setBusy(false);
      setConfirm(null);
      setMessage(
        failure === 'not_allowed'
          ? action.kind === 'leave'
            ? 'Para irte tenés que estar al día.'
            : 'Solo el dueño puede eliminar el grupo.'
          : 'No pudimos hacerlo. Probá de nuevo.',
      );
      return;
    }
    walletChanged();
    // Vuelve a la lista de Grupos: el detalle ya no se puede ver.
    router.dismissAll();
    toast(action.kind === 'leave' ? `Saliste de ${data.name}` : `Eliminaste ${data.name}`);
  }

  if (failed || !data || !me) {
    return (
      <Sheet title="Editar grupo" onClose={() => router.back()} footer={null}>
        {failed ? (
          <>
            <Text style={[type.body, { color: colors.textMuted }]}>No pudimos traer el grupo.</Text>
            <Button title="Reintentar" onPress={load} style={styles.start} />
          </>
        ) : (
          <View style={[styles.skeleton, { backgroundColor: colors.surface2 }]} accessibilityLabel="Cargando" />
        )}
      </Sheet>
    );
  }

  const pending = active.filter((m) => !m.settled && m.balance.minor < 0);
  const confirmBox = (text: string, action: Confirm, actionTitle: string) => (
    <View style={[styles.confirm, { borderColor: colors.line }]} accessibilityLiveRegion="polite">
      <Text style={[type.body, { color: colors.text }]}>{text}</Text>
      <View style={styles.buttons}>
        <Button title="Cancelar" onPress={() => setConfirm(null)} disabled={busy} />
        <Button title={actionTitle} variant="primary" onPress={() => run(action)} loading={busy} />
      </View>
    </View>
  );

  return (
    <Sheet
      title="Editar grupo"
      onClose={() => router.back()}
      footer={<SheetFooter actionTitle="Guardar" onAction={save} onCancel={() => router.back()} loading={busy && !confirm} />}
    >
      <TextField
        label="Nombre del grupo"
        value={name}
        onChangeText={(t) => {
          setName(t);
          setErrors(null);
        }}
        error={errors?.name ? 'Poné un nombre.' : undefined}
        maxLength={40}
      />

      {/* Personas: las de ahora, con "Quitar" para el dueño, y las que se suman en esta edición. */}
      <View style={styles.field}>
        <Text style={[type.caption, { color: colors.textMuted }]}>Personas</Text>
        {active.map((m) => {
          const canRemove = data.isOwner && !m.isMe && !m.participated && m.settled;
          return (
            <View key={m.id} style={styles.member}>
              <Text style={[type.body, styles.flex, { color: colors.text }]} numberOfLines={1}>
                {m.isMe ? 'Vos' : m.name}
                {m.isProvisional ? <Text style={{ color: colors.textMuted }}> · sin cuenta</Text> : null}
              </Text>
              {canRemove ? (
                <Button
                  title="Quitar"
                  variant="ghost"
                  onPress={() => setConfirm({ kind: 'remove', memberId: m.id, name: m.name })}
                  accessibilityLabel={`Quitar a ${m.name}`}
                />
              ) : null}
            </View>
          );
        })}
        {confirm?.kind === 'remove'
          ? confirmBox(`¿Quitás a ${confirm.name}? Nunca participó en un gasto ni en un pago.`, confirm, 'Quitar')
          : null}
        {people.map((p, i) => (
          <View key={p.id} style={styles.person}>
            <View style={styles.flex}>
              <TextField
                label="Persona nueva"
                value={p.name}
                onChangeText={(t) => {
                  setPeople((list) => list.map((x) => (x.id === p.id ? { ...x, name: t } : x)));
                  setErrors(null);
                }}
                error={errors?.people[i] ? 'Ya hay alguien con ese nombre.' : undefined}
                placeholder="Nombre"
                autoCapitalize="words"
                maxLength={30}
              />
            </View>
            <Button
              title="✕"
              variant="ghost"
              onPress={() => setPeople((list) => list.filter((x) => x.id !== p.id))}
              accessibilityLabel={`Sacar a ${p.name.trim() || 'la persona nueva'}`}
              style={styles.remove}
            />
          </View>
        ))}
        <Button
          title="+ Sumar persona"
          variant="link"
          onPress={() => setPeople((list) => [...list, { id: randomUUID(), name: '' }])}
          style={styles.start}
        />
      </View>

      {message ? (
        <Text style={[type.caption, { color: colors.error }]} accessibilityLiveRegion="polite">
          {message}
        </Text>
      ) : null}

      {/* Abandonar: solo al día (02 §7). */}
      <View style={[styles.section, { borderTopColor: colors.line }]}>
        {me.settled ? (
          confirm?.kind === 'leave' ? (
            confirmBox(
              `Dejás de ver el grupo. Para volver hace falta otra invitación.${data.isOwner ? ' El rol de dueño pasa a otra persona con cuenta.' : ''}`,
              confirm,
              'Abandonar',
            )
          ) : (
            <Button title="Abandonar el grupo" variant="link" onPress={() => setConfirm({ kind: 'leave' })} style={styles.start} />
          )
        ) : (
          <Text style={[type.caption, { color: colors.textMuted }]}>
            Para irte tenés que estar al día ({me.balance.minor < 0 ? 'debés' : 'te deben'} {formatMoney(abs(me.balance))}).
          </Text>
        )}

        {/* Eliminar: solo el dueño, para todos. */}
        {data.isOwner ? (
          confirm?.kind === 'delete' ? (
            confirmBox(
              `Se elimina para todos.${
                pending.length
                  ? ` Hay saldos sin saldar: ${pending.map((m) => `${m.isMe ? 'vos debés' : `${m.name} debe`} ${formatMoney(abs(m.balance))}`).join(', ')}.`
                  : ''
              } Tus gastos de este grupo vuelven a contar completos.`,
              confirm,
              'Eliminar',
            )
          ) : (
            <Button title="Eliminar el grupo" variant="link" onPress={() => setConfirm({ kind: 'delete' })} style={styles.start} />
          )
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  field: { gap: 8 },
  member: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  person: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  remove: { marginBottom: 2 },
  start: { alignSelf: 'flex-start' },
  section: { borderTopWidth: 1, paddingTop: 14, gap: 10 },
  confirm: { borderWidth: 1, borderRadius: radius.md, padding: 12, gap: 10 },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  skeleton: { height: 120, borderRadius: radius.sm },
});
