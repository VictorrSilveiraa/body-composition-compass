import { describe, expect, it } from 'vitest';
import { bmrBy, energyInputs, energyOf, goalSeries, goalStatus, goalsStatus, type Goal } from '@/lib/plano';
import { reportHtml } from '@/lib/report.js';

const person = { sex: 'F', birth: '1994-05-10', height: '165' };
const folds = { chest: [12], midaxillary: [14], triceps: [20], subscapular: [16], abdominal: [24], suprailiac: [18], thigh: [28] };
const a = { date: '2026-11-17', weight: '68,4', height: '165', protocol: 'jp7', multi: false, circ: { waist: 74 }, extra: {}, folds };

describe('Gasto energético', () => {
  const x = energyInputs(person, a); // mulher, 32 anos, 68,4 kg, 165 cm, 50,8459 kg de massa magra
  it('fórmulas do basal', () => {
    expect(bmrBy('mifflin', x)).toBeCloseTo(10 * 68.4 + 6.25 * 165 - 5 * 32 - 161, 6);
    expect(bmrBy('harris', x)).toBeCloseTo(447.593 + 9.247 * 68.4 + 3.098 * 165 - 4.33 * 32, 6);
    expect(bmrBy('katch', x)).toBeCloseTo(370 + 21.6 * 50.8459, 3);
    expect(bmrBy('cunningham', x)).toBeCloseTo(500 + 22 * 50.8459, 3);
    expect(bmrBy('fao', x)).toBeCloseTo(8.7 * 68.4 + 829, 6); // mulher 30–60 anos
    expect(bmrBy('fao', { ...x, age: 25 })).toBeCloseTo(14.7 * 68.4 + 496, 6);
  });
  it('automática usa Katch-McArdle com massa magra e Mifflin sem', () => {
    expect(energyOf(null, x)!.formula).toBe('katch');
    expect(energyOf(null, { ...x, lean: null })!.formula).toBe('mifflin');
  });
  it('gasto total, meta e macros fecham a conta', () => {
    const e = energyOf({ formula: 'mifflin', activity: 1.55, adjust: -500, protein: 2, fat: 0.8 }, x)!;
    expect(e.tdee).toBeCloseTo(e.bmr * 1.55, 6);
    expect(e.target).toBeCloseTo(e.tdee - 500, 6);
    expect(e.macros.p.g).toBeCloseTo(136.8, 6);
    expect(e.macros.p.kcal + e.macros.f.kcal + e.macros.c.kcal).toBeCloseTo(e.target, 6);
    expect(e.macros.p.pct + e.macros.f.pct + e.macros.c.pct).toBeCloseTo(1, 6);
  });
  it('fórmula de massa magra sem % de gordura cai para Mifflin e avisa', () => {
    const e = energyOf({ formula: 'cunningham' }, { ...x, lean: null })!;
    expect(e.formula).toBe('mifflin'); expect(e.fallback).toBe(true); expect(e.warn.join(' ')).toMatch(/Mifflin/);
  });
  it('avisa meta abaixo do basal e carboidrato negativo', () => {
    const e = energyOf({ formula: 'mifflin', activity: 1.2, adjust: -750, protein: 3, fat: 2 }, x)!;
    expect(e.macros.c.g).toBe(0);
    expect(e.warn.some((w) => /basal/.test(w))).toBe(true);
    expect(e.warn.some((w) => /reduza/.test(w))).toBe(true);
  });
});

describe('Relatório em PDF', () => {
  it('traz as metas (na data da avaliação) e o gasto energético quando configurado', () => {
    const list = [{ ...a, id: 'x1', date: '2026-10-01', weight: 70, circ: { waist: 80 } }, { ...a, id: 'x2', date: '2026-11-01', weight: 68, circ: { waist: 78 } }];
    const goals: Goal[] = [{ id: 'p', k: 'weight', from: 70, to: 66, fromDate: '2026-10-01', by: '2027-01-01' }];
    const cfg = { formula: 'mifflin' as const, activity: 1.55, adjust: -500, protein: 1.8, fat: 0.8 };
    const html = reportHtml('assessment', { a: list[1], p: person, list, ctx: { goals, energy: (x: typeof a) => energyOf(cfg, energyInputs(person, x)) } });
    expect(html).toContain('Metas do acompanhamento');
    expect(html).toContain('50%'); // 70 → 68 de 70 → 66
    expect(html).toContain('Gasto energético total');
    expect(html).toContain('Meta calórica diária');
    const plain = reportHtml('assessment', { a: list[1], p: person, list, ctx: {} });
    expect(plain).not.toContain('Metas do acompanhamento');
    expect(plain).not.toContain('Gasto energético total');
  });
});

describe('Metas', () => {
  const g: Goal = { id: '1', k: 'weight', from: 80, to: 72, fromDate: '2026-09-01', by: '2027-03-01' };
  it('progresso, quanto falta e ritmo', () => {
    const s = goalStatus(g, [{ date: '2026-08-01', v: 82 }, { date: '2026-09-01', v: 80 }, { date: '2026-10-01', v: 77 }], '2026-10-05');
    expect(s.cur).toBe(77); expect(s.pct).toBeCloseTo(3 / 8, 6); expect(s.left).toBeCloseTo(5, 6); expect(s.dir).toBe(-1);
    expect(s.done).toBe(false); expect(s.eta).toBe('2026-11-20'); expect(s.pace).toBe('on'); expect(s.daysLeft).toBe(147);
  });
  it('alcançada: data em que chegou e progresso cheio', () => {
    const s = goalStatus(g, [{ date: '2026-10-01', v: 74 }, { date: '2026-11-01', v: 71.8 }, { date: '2026-12-01', v: 71.5 }]);
    expect(s.done).toBe(true); expect(s.doneOn).toBe('2026-11-01'); expect(s.pct).toBe(1); expect(s.left).toBe(0);
  });
  it('meta de aumentar (massa magra) e afastando-se da meta', () => {
    const up: Goal = { id: '2', k: 'lean', from: 50, to: 54, fromDate: '2026-09-01' };
    expect(goalStatus(up, [{ date: '2026-10-01', v: 51 }]).pct).toBeCloseTo(0.25, 6);
    expect(goalStatus(up, [{ date: '2026-10-01', v: 49 }]).pace).toBe('away');
    expect(goalStatus(up, [{ date: '2026-10-01', v: 49 }]).pct).toBe(0);
  });
  it('quadro: em ordem de medida e como estavam numa data passada', () => {
    const goals: Goal[] = [{ id: 'w', k: 'waist', from: 80, to: 74, fromDate: '2026-11-01' }, { id: 'p', k: 'weight', from: 70, to: 66, fromDate: '2026-11-01' }];
    const list = [{ ...a, date: '2026-11-01', weight: 70, circ: { waist: 80 } }, { ...a, date: '2026-12-01', weight: 68, circ: { waist: 77 } }];
    const now = goalsStatus(goals, list, person);
    expect(now.map((s) => s.goal.k)).toEqual(['weight', 'waist']);
    expect(now[0]!.pct).toBeCloseTo(0.5, 6);
    const then = goalsStatus(goals, list, person, '2026-11-01');
    expect(then[0]!.cur).toBe(70); expect(then[0]!.pct).toBe(0);
    expect(goalsStatus(goals, list, person, '2026-10-01')).toEqual([]); // metas definidas depois desta data não aparecem
  });
  it('série da medida a partir das avaliações', () => {
    expect(goalSeries('waist', [a, { ...a, date: '2026-12-01', circ: {} }], person)).toEqual([{ date: '2026-11-17', v: 74 }]);
    expect(goalSeries('bf', [a], person)[0]!.v).toBeCloseTo(25.6639, 3);
  });
});
