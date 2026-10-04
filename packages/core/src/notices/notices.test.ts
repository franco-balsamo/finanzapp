import { describe, expect, it } from 'vitest';
import { money } from '../money.ts';
import { ars, cardA, expense, payment, usd } from '../cards/fixtures.ts';
import type { CreditCard } from '../cards/types.ts';
import { formatDay, formatMoney, formatTotal, joinList } from './format.ts';
import { closingNotices, dueNotices, type NoticeCard } from './notices.ts';
import { noticeInputFromDb, todayInArgentina, type DbNoticeUser } from './fromDb.ts';

// Calendario de 2026: jueves 24/9, martes 6/10.

function noticeCard(name: string, card: CreditCard, fields: Partial<NoticeCard> = {}): NoticeCard {
  return {
    card,
    name,
    expenses: [],
    payments: [],
    overrides: [],
    closingEnabled: true,
    dueEnabled: true,
    dueDaysBefore: 2,
    noticed: [],
    ...fields,
  };
}

const visa = (fields: Partial<NoticeCard> = {}) =>
  noticeCard('Visa', cardA, { expenses: [expense('e1', '2026-09-10', ars(187_000))], ...fields });
const master: CreditCard = { id: 'M', closeDay: 24, dueDay: 7, creditLimit: ars(500_000) };
const amex: CreditCard = { id: 'X', closeDay: 24, dueDay: 6, creditLimit: ars(500_000) };

const closing = (today: string, ...cards: NoticeCard[]) => closingNotices({ today, users: [{ userId: 'ana', cards }] });
const due = (today: string, ...cards: NoticeCard[]) => dueNotices({ today, users: [{ userId: 'ana', cards }] });

describe('formato de los avisos', () => {
  it('montos en pesos y en dólares', () => {
    expect(formatMoney(ars(187_000))).toBe('$187.000');
    expect(formatMoney(money(18_700_050, 'ARS'))).toBe('$187.000,50');
    expect(formatMoney(ars(950))).toBe('$950');
    expect(formatMoney(usd(50))).toBe('US$ 50');
    expect(formatMoney(usd(1_250.25))).toBe('US$ 1.250,25');
  });

  it('totales por moneda', () => {
    expect(formatTotal({ ARS: ars(187_000), USD: usd(50) })).toBe('$187.000 + US$ 50');
    expect(formatTotal({ ARS: ars(0), USD: usd(50) })).toBe('US$ 50');
    expect(formatTotal({ ARS: ars(0), USD: usd(0) })).toBe('$0');
  });

  it('días y listas', () => {
    expect(formatDay('2026-10-06')).toBe('martes 6/10');
    expect(formatDay('2026-10-04')).toBe('domingo 4/10');
    expect(joinList(['a'])).toBe('a');
    expect(joinList(['a', 'b'])).toBe('a y b');
    expect(joinList(['a', 'b', 'c'])).toBe('a, b y c');
  });
});

describe('closingNotices (02 §9)', () => {
  it('el día del cierre: el texto de 02 §9', () => {
    expect(closing('2026-09-24', visa())).toEqual([
      {
        userId: 'ana',
        kind: 'card_closing',
        title: 'Cierre de tarjeta',
        body: 'Cerró tu Visa: te vienen $187.000. ¿Te falta cargar algo?',
        refs: [{ cardId: 'A', period: '2026-09' }],
      },
    ]);
  });

  it('con dólares suma las dos monedas', () => {
    const card = visa({ expenses: [expense('e1', '2026-09-10', ars(187_000)), expense('e2', '2026-09-12', usd(50))] });
    expect(closing('2026-09-24', card)[0]?.body).toBe('Cerró tu Visa: te vienen $187.000 + US$ 50. ¿Te falta cargar algo?');
  });

  it('las cuotas cuentan solo lo de este resumen', () => {
    const card = visa({ expenses: [expense('e1', '2026-08-20', ars(90_000), 3)] });
    expect(closing('2026-09-24', card)[0]?.body).toBe('Cerró tu Visa: te vienen $30.000. ¿Te falta cargar algo?');
  });

  it('antes del cierre no avisa; un día después avisa con "Ayer"; dos días después, nada', () => {
    expect(closing('2026-09-23', visa())).toEqual([]);
    expect(closing('2026-09-25', visa())[0]?.body).toBe('Ayer cerró tu Visa: te vienen $187.000. ¿Te falta cargar algo?');
    expect(closing('2026-09-26', visa())).toEqual([]);
  });

  it('en $0 con consumos el ciclo anterior: avisa que no hay nada cargado', () => {
    const card = visa({ expenses: [expense('e1', '2026-08-10', ars(50_000))] });
    expect(closing('2026-09-24', card)[0]?.body).toBe(
      'Cerró tu Visa y no tiene consumos cargados este ciclo. ¿Te falta cargar algo?',
    );
  });

  it('en $0 sin consumos el ciclo anterior: no avisa', () => {
    expect(closing('2026-09-24', visa({ expenses: [] }))).toEqual([]);
  });

  it('usa el cierre real si se corrigió', () => {
    const card = visa({
      expenses: [expense('e1', '2026-09-26', ars(10_000))],
      overrides: [{ period: '2026-09', closeDate: '2026-09-27', dueDate: '2026-10-07' }],
    });
    expect(closing('2026-09-24', card)).toEqual([]);
    expect(closing('2026-09-27', card)[0]?.body).toBe('Cerró tu Visa: te vienen $10.000. ¿Te falta cargar algo?');
  });

  it('un cierre corregido al mes anterior también se avisa ese día', () => {
    const card = noticeCard('Visa', { ...cardA, closeDay: 2, dueDay: 12 }, {
      expenses: [expense('e1', '2026-08-25', ars(5_000))],
      overrides: [{ period: '2026-09', closeDate: '2026-08-30', dueDate: '2026-09-10' }],
    });
    expect(closing('2026-08-30', card)[0]?.refs).toEqual([{ cardId: 'A', period: '2026-09' }]);
  });

  it('no repite lo que ya se avisó ni avisa si el aviso está apagado', () => {
    expect(closing('2026-09-24', visa({ noticed: [{ kind: 'card_closing', period: '2026-09' }] }))).toEqual([]);
    expect(closing('2026-09-25', visa({ noticed: [{ kind: 'card_closing', period: '2026-09' }] }))).toEqual([]);
    expect(closing('2026-09-24', visa({ closingEnabled: false }))).toEqual([]);
  });

  it('si cierran varias el mismo día va un solo aviso', () => {
    const notices = closing(
      '2026-09-24',
      visa(),
      noticeCard('Master', master, { expenses: [expense('m1', '2026-09-01', usd(50))] }),
      noticeCard('Amex', amex, { expenses: [expense('x1', '2026-08-01', ars(1_000))] }),
      noticeCard('Cabal', { ...amex, id: 'C' }),
    );
    expect(notices).toHaveLength(1);
    expect(notices[0]?.body).toBe(
      'Cerraron tu Visa ($187.000), tu Master (US$ 50) y tu Amex (sin consumos cargados). ¿Te falta cargar algo?',
    );
    expect(notices[0]?.refs.map((r) => r.cardId)).toEqual(['A', 'M', 'X']);
  });

  it('una que cerró hoy y otra ayer sin avisar van en avisos separados', () => {
    const otra = noticeCard('Master', { ...master, closeDay: 23 }, { expenses: [expense('m1', '2026-09-01', ars(2_000))] });
    expect(closing('2026-09-24', visa(), otra).map((n) => n.body)).toEqual([
      'Cerró tu Visa: te vienen $187.000. ¿Te falta cargar algo?',
      'Ayer cerró tu Master: te vienen $2.000. ¿Te falta cargar algo?',
    ]);
  });

  it('un aviso por usuario', () => {
    const notices = closingNotices({
      today: '2026-09-24',
      users: [
        { userId: 'ana', cards: [visa()] },
        { userId: 'beto', cards: [visa()] },
        { userId: 'caro', cards: [] },
      ],
    });
    expect(notices.map((n) => n.userId)).toEqual(['ana', 'beto']);
  });
});

describe('dueNotices (02 §9)', () => {
  const conSaldo = (fields: Partial<NoticeCard> = {}) =>
    noticeCard('Visa', cardA, { expenses: [expense('e1', '2026-09-10', ars(80_000))], ...fields });

  it('2 días antes por defecto', () => {
    expect(due('2026-10-04', conSaldo())).toEqual([
      {
        userId: 'ana',
        kind: 'card_due',
        title: 'Vencimiento de tarjeta',
        body: 'Tu Visa vence el martes 6/10: quedan $80.000 por pagar.',
        refs: [{ cardId: 'A', period: '2026-09' }],
      },
    ]);
    expect(due('2026-10-03', conSaldo())).toEqual([]);
  });

  it('con 5 días configurados avisa antes', () => {
    expect(due('2026-10-01', conSaldo({ dueDaysBefore: 5 }))).toHaveLength(1);
    expect(due('2026-09-30', conSaldo({ dueDaysBefore: 5 }))).toEqual([]);
  });

  it('si no se avisó, sale igual mientras no haya vencido', () => {
    expect(due('2026-10-05', conSaldo())).toHaveLength(1);
    expect(due('2026-10-06', conSaldo())).toEqual([]);
    expect(due('2026-10-07', conSaldo())).toEqual([]);
  });

  it('pagado no avisa; con pago parcial dice lo que queda', () => {
    const pagado = conSaldo({ payments: [payment('p', '2026-09', ars(80_000), 'caja', '2026-10-01')] });
    expect(due('2026-10-04', pagado)).toEqual([]);
    const parcial = conSaldo({ payments: [payment('p', '2026-09', ars(30_000), 'caja', '2026-10-01')] });
    expect(due('2026-10-04', parcial)[0]?.body).toBe('Tu Visa vence el martes 6/10: quedan $50.000 por pagar.');
  });

  it('no repite lo que ya se avisó ni avisa si el aviso está apagado', () => {
    expect(due('2026-10-04', conSaldo({ noticed: [{ kind: 'card_due', period: '2026-09' }] }))).toEqual([]);
    expect(due('2026-10-04', conSaldo({ dueEnabled: false }))).toEqual([]);
  });

  it('el aviso de cierre ya enviado no frena el de vencimiento', () => {
    expect(due('2026-10-04', conSaldo({ noticed: [{ kind: 'card_closing', period: '2026-09' }] }))).toHaveLength(1);
  });

  it('si vencen varias va un solo aviso, por fecha', () => {
    const notices = due(
      '2026-10-05',
      noticeCard('Master', master, { expenses: [expense('m1', '2026-09-01', usd(50))] }),
      conSaldo(),
    );
    expect(notices).toHaveLength(1);
    expect(notices[0]?.body).toBe('Vencen tu Visa (martes 6/10, $80.000) y tu Master (miércoles 7/10, US$ 50).');
  });
});

describe('noticeInputFromDb', () => {
  const row: DbNoticeUser = {
    user_id: 'ana',
    notify_push: true,
    quiet_from: null,
    quiet_to: null,
    cards: [
      {
        id: 'A',
        name: 'Visa',
        close_day: 24,
        due_day: 6,
        credit_limit: '1000000.00',
        overrides: [],
        expenses: [
          { id: 'e1', date: '2026-09-10', amount: '187000.00', currency: 'ARS', installments: 1 },
          { id: 'e2', date: '2026-09-12', amount: '50.00', currency: 'USD', installments: 1 },
        ],
        payments: [
          {
            id: 'p1', period: '2026-08', applies_to: 'USD', amount: '20.00', debited_amount: '40560.00',
            debited_currency: 'ARS', fx_card_rate: '2028.0000', paid_at: '2026-09-06', reverted_at: null,
          },
        ],
        closing_enabled: true,
        due_enabled: true,
        due_days_before: 2,
        noticed: [],
      },
    ],
  };

  it('arma el input de core desde la respuesta de card_notice_input', () => {
    const notices = closingNotices(noticeInputFromDb('2026-09-24', [row]));
    expect(notices[0]?.body).toBe('Cerró tu Visa: te vienen $187.000 + US$ 50. ¿Te falta cargar algo?');
  });

  it('un usuario sin tarjetas no rompe', () => {
    expect(noticeInputFromDb('2026-09-24', [{ ...row, cards: null }]).users[0]?.cards).toEqual([]);
  });

  it('hoy en hora de Argentina', () => {
    // 02:00 UTC del 25/9 son las 23:00 del 24/9 en Argentina.
    expect(todayInArgentina(new Date('2026-09-25T02:00:00Z'))).toBe('2026-09-24');
    expect(todayInArgentina(new Date('2026-09-25T03:00:00Z'))).toBe('2026-09-25');
  });
});
