// Formulario "Nuevo grupo" (G-3) y "Editar grupo" (G-7): nombre, tu nombre y las personas que se suman como provisorias.

import { normalizeWord } from '../entry/categories.ts';

export interface NewGroupInput {
  name: string;
  /** Cómo te llaman en el grupo. */
  myName: string;
  /** Una por campo, en el orden en que se escribieron. Los campos vacíos se ignoran. */
  people: readonly string[];
  /** Al editar un grupo: los nombres que ya están (sin el tuyo). */
  taken?: readonly string[];
}

export type NewGroupError = 'required' | 'duplicate';

export interface NewGroupErrors {
  name?: NewGroupError;
  myName?: NewGroupError;
  /** Por campo, en el mismo orden que `people`; null si está bien. */
  people: (NewGroupError | null)[];
  /** true si no hay ningún error. */
  ok: boolean;
}

const key = (name: string) => normalizeWord(name.trim());

/** Nombres repetidos (sin importar mayúsculas ni tildes, y contando el tuyo): se marca el segundo. */
export function newGroupErrors(input: NewGroupInput): NewGroupErrors {
  const name = input.name.trim() ? undefined : 'required';
  const myName = input.myName.trim() ? undefined : 'required';
  const seen = new Set<string>([...(input.myName.trim() ? [input.myName] : []), ...(input.taken ?? [])].map(key));
  const people = input.people.map((person): NewGroupError | null => {
    if (!person.trim()) return null;
    const k = key(person);
    if (seen.has(k)) return 'duplicate';
    seen.add(k);
    return null;
  });
  return { name, myName, people, ok: !name && !myName && people.every((p) => p === null) };
}
