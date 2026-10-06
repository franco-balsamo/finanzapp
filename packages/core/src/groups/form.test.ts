import { describe, expect, it } from 'vitest';
import { newGroupErrors } from './form.ts';

describe('Nuevo grupo (G-3)', () => {
  it('nombre del grupo y tu nombre son obligatorios', () => {
    expect(newGroupErrors({ name: '  ', myName: '', people: [] })).toEqual({ name: 'required', myName: 'required', people: [], ok: false });
  });

  it('Cabaña con Ana y Juan está bien; los campos vacíos se ignoran', () => {
    expect(newGroupErrors({ name: 'Cabaña', myName: 'Fran', people: ['Ana', '', 'Juan'] })).toEqual({
      name: undefined, myName: undefined, people: [null, null, null], ok: true,
    });
  });

  it('un nombre repetido (sin importar mayúsculas ni tildes, y contando el tuyo) se marca en el segundo', () => {
    expect(newGroupErrors({ name: 'Cabaña', myName: 'Fran', people: ['Ana', 'ána', 'fran'] }).people).toEqual([null, 'duplicate', 'duplicate']);
  });
});
