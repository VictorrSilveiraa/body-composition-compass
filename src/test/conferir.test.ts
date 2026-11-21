import { describe, expect, it } from 'vitest';
import { checkAssessment, openAlerts, weightLimit } from '@/lib/conferir';

const base = { date: '2026-03-01', weight: 80, height: 175, multi: false, circ: { waist: 90, arm_r: 32, arm_l: 32, biceps_r: 34, biceps_l: 34 }, folds: { triceps: 12, abdominal: 20 }, extra: {} };
const prev = { ...base, date: '2026-01-30' }; // 30 dias antes
const ids = (d: object, cx: object = {}) => checkAssessment({ ...base, ...d } as never, { prev, age: 35, ...cx }).map((a) => a.id);

describe('Confere? — valores estranhos', () => {
  it('valores normais não geram aviso', () => {
    expect(ids({ weight: 78.4 })).toEqual([]);
  });
  it('peso: mais de ~8 kg em 30 dias', () => {
    expect(ids({ weight: 89 })).toContain('weight');
    expect(ids({ weight: 86 })).not.toContain('weight');
    expect(weightLimit(80, 30)).toBeGreaterThan(8);
    expect(weightLimit(80, 30)).toBeLessThan(9);
  });
  it('peso: vírgula no lugar errado', () => {
    const a = checkAssessment({ ...base, weight: 8 } as never, { prev, age: 35 });
    expect(a[0]!.sev).toBe('err');
    expect(a[0]!.msg).toMatch(/vírgula/);
  });
  it('altura em metros', () => {
    expect(checkAssessment({ ...base, height: 1.75 } as never, { prev, age: 35 })[0]!.msg).toMatch(/metros/);
  });
  it('altura: adulto mudou 5 cm; criança diminuiu', () => {
    expect(ids({ height: 180 })).toContain('height');
    expect(ids({ height: 172 }, { age: 10 })).toContain('height');
    expect(ids({ height: 178 }, { age: 10 })).not.toContain('height');
  });
  it('dobra 3× maior que antes', () => {
    expect(ids({ folds: { triceps: 36, abdominal: 20 } })).toContain('folds.triceps');
    expect(ids({ folds: { triceps: 20, abdominal: 20 } })).not.toContain('folds.triceps');
    // dobras pequenas: 3 → 9 mm é só 6 mm de diferença, mas 2 → 6 não chega a 5 mm
    expect(ids({ folds: { triceps: 12, abdominal: 20 } }, {})).toEqual([]);
  });
  it('leituras triplas muito diferentes', () => {
    expect(ids({ multi: true, folds: { triceps: [12, 12.5, 21], abdominal: 20 } })).toContain('folds.triceps:reads');
  });
  it('circunferência em milímetros e lados diferentes', () => {
    expect(ids({ circ: { ...base.circ, waist: 900 } })).toContain('circ.waist');
    // com a anterior, a mudança de 32 → 42 já avisa; sem anterior, avisa a diferença entre os lados
    expect(ids({ circ: { ...base.circ, arm_l: 42, biceps_l: 44 } })).toContain('circ.arm_l');
    expect(checkAssessment({ ...base, circ: { ...base.circ, arm_l: 42, biceps_l: 44 } } as never, { prev: null, age: 35 }).map((a) => a.id)).toContain('circ.arm:lr');
  });
  it('bíceps contraído menor que o braço relaxado', () => {
    expect(ids({ circ: { ...base.circ, biceps_r: 30 } })).toContain('circ.biceps:inv_r');
  });
  it('massa muscular maior que o peso', () => {
    expect(ids({ extra: { muscle: 85 } })).toContain('extra.muscle');
  });
  it('data repetida e anterior ao nascimento', () => {
    expect(ids({}, { otherDates: ['2026-03-01'] })).toContain('date:dup');
    expect(ids({}, { birth: '2027-01-01' })).toContain('date');
  });
  it('"Está certo" esconde o aviso até o valor mudar', () => {
    const a = checkAssessment({ ...base, weight: 89 } as never, { prev, age: 35 });
    const ok = { weight: '89' };
    expect(openAlerts(a, ok)).toEqual([]);
    const b = checkAssessment({ ...base, weight: 91 } as never, { prev, age: 35 });
    expect(openAlerts(b, ok).map((x) => x.id)).toEqual(['weight']);
  });
  it('sem avaliação anterior só confere limites absolutos', () => {
    expect(checkAssessment({ ...base, weight: 89 } as never, { prev: null, age: 35 })).toEqual([]);
  });
});
