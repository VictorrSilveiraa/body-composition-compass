import { describe, expect, it } from 'vitest';
import { bmiInfo, bfInfo, whrInfo, calfInfo, lmsAt, zOf, ageMonths, groupOf } from '@/lib/publico';
import { calc, PROTOCOLS, protoFits, matGuess } from '@/lib/calculos.js';
import { energyOf } from '@/lib/plano';

const kid = (sex: 'M' | 'F', ageM: number) => ({ sex, age: Math.floor(ageM / 12), ageM });

describe('IMC para idade (OMS 2007)', () => {
  it('na mediana o escore-z é 0', () => {
    const l = lmsAt('M', 120)!; // 10 anos
    expect(zOf(l[1], l)).toBeCloseTo(0, 6);
  });
  it('bate com os valores de SD da planilha oficial (meninos 61 meses: +2 = 18,259; −2 = 13,031)', () => {
    const l = lmsAt('M', 61)!;
    expect(zOf(18.259, l)).toBeCloseTo(2, 2);
    expect(zOf(13.031, l)).toBeCloseTo(-2, 2);
  });
  it('acima de +3 usa a correção da OMS (meninas 228 meses: +3 = 36,179; +4 = 42,689)', () => {
    const l = lmsAt('F', 228)!;
    expect(zOf(42.689, l)).toBeCloseTo(4, 2);
  });
  it('classifica com os cortes do SISVAN', () => {
    const l = lmsAt('F', 150)!, M = l[1];
    expect(bmiInfo(M, kid('F', 150))!.cls).toBe('Eutrofia');
    expect(bmiInfo(M * 1.25, kid('F', 150))!.cls).toMatch(/Sobrepeso|Obesidade/);
    expect(bmiInfo(M * 0.7, kid('F', 150))!.cls).toMatch(/Magreza/);
  });
  it('IMC 24 é normal para adulto e sobrepeso para menino de 10 anos', () => {
    expect(bmiInfo(24, { sex: 'M', age: 30 })!.cls).toBe('Peso normal');
    expect(bmiInfo(24, kid('M', 126))!.cls).not.toBe('Eutrofia');
  });
});

describe('idosos (Lipschitz) e panturrilha', () => {
  it('IMC 23 em idoso é adequado; 21 é baixo peso; 28 é sobrepeso', () => {
    const c = { sex: 'F', age: 70 };
    expect(bmiInfo(23, c)!.cls).toBe('Peso adequado');
    expect(bmiInfo(21, c)!.cls).toBe('Baixo peso');
    expect(bmiInfo(28, c)!.cls).toBe('Sobrepeso');
    expect(bmiInfo(27, c)!.cls).toBe('Peso adequado');
  });
  it('panturrilha só é avaliada em idosos', () => {
    expect(calfInfo(32, { sex: 'M', age: 70 })!.tone).toBe('bad');
    expect(calfInfo(35, { sex: 'M', age: 70 })!.tone).toBe('good');
    expect(calfInfo(32, { sex: 'M', age: 40 })).toBeNull();
  });
});

describe('% de gordura e RCQ por idade', () => {
  it('menores de 18 usam Lohman', () => {
    expect(bfInfo(18, { sex: 'M', age: 12 })!.cls).toBe('Adequado');
    expect(bfInfo(27, { sex: 'M', age: 12 })!.cls).toBe('Alto');
    expect(bfInfo(18, { sex: 'M', age: 30 })!.cls).toBe('Média');
  });
  it('RCQ não classifica criança', () => {
    expect(whrInfo(0.9, { sex: 'M', age: 10 })!.tone).toBe('neu');
    expect(whrInfo(0.9, { sex: 'M', age: 30 })!.cls).toBe('Risco baixo');
  });
  it('compatível com a chamada antiga (só o sexo)', () => {
    expect(bfInfo(16, 'M')!.cls).toBe('Boa forma');
  });
});

describe('idade e público', () => {
  it('meses completos', () => {
    expect(ageMonths('2015-05-20', '2025-05-19')).toBe(119);
    expect(ageMonths('2015-05-20', '2025-05-20')).toBe(120);
  });
  it('grupos', () => {
    expect(groupOf(4, 50)).toBe('baby');
    expect(groupOf(8)).toBe('child');
    expect(groupOf(15)).toBe('teen');
    expect(groupOf(19)).toBe('teen');
    expect(groupOf(45)).toBe('adult');
    expect(groupOf(60)).toBe('elder');
  });
});

const P = (sex: 'M' | 'F', birth: string) => ({ sex, birth });
const A = (protocol: string, folds: Record<string, number>, extra: Record<string, unknown> = {}) => ({ date: '2026-01-10', weight: 70, height: 170, protocol, circ: {}, folds, extra });

describe('protocolos novos', () => {
  it('Petroski homem (25 anos, ΣSE+TR+SI+PM = 60 mm)', () => {
    const r = calc(A('petroski', { subscapular: 15, triceps: 12, suprailiac: 18, calf: 15 }), P('M', '2000-06-01'));
    const D = 1.10726863 - 0.00081201 * 60 + 0.00000212 * 3600 - 0.00041761 * 25;
    expect(r.density).toBeCloseTo(D, 8);
    expect(r.bf).toBeCloseTo((4.95 / D - 4.5) * 100, 6);
    expect(r.bfMethod).toBe('proto');
  });
  it('Petroski mulher usa log10(AX+SI+CX+PM)', () => {
    const r = calc(A('petroski', { midaxillary: 12, suprailiac: 20, thigh: 30, calf: 18 }), P('F', '1996-01-01'));
    expect(r.density).toBeCloseTo(1.19547130 - 0.07513507 * Math.log10(80) - 0.00041072 * 30, 8);
  });
  it('Guedes', () => {
    const r = calc(A('guedes', { triceps: 10, suprailiac: 14, abdominal: 20 }), P('M', '2004-01-01'));
    expect(r.density).toBeCloseTo(1.17136 - 0.06706 * Math.log10(44), 8);
  });
  it('Faulkner dá o % direto', () => {
    const r = calc(A('faulkner', { triceps: 10, subscapular: 12, suprailiac: 14, abdominal: 20 }), P('M', '1990-01-01'));
    expect(r.bf).toBeCloseTo(0.153 * 56 + 5.783, 6);
    expect(r.density).toBeUndefined();
  });
  it('Slaughter tríceps + panturrilha', () => {
    expect(calc(A('sl_tc', { triceps: 12, calf: 10 }), P('M', '2014-01-01')).bf).toBeCloseTo(0.735 * 22 + 1, 6);
    expect(calc(A('sl_tc', { triceps: 12, calf: 10 }), P('F', '2014-01-01')).bf).toBeCloseTo(0.61 * 22 + 5.1, 6);
  });
  it('Slaughter tríceps + subescapular: maturação e soma acima de 35 mm', () => {
    const S = 20;
    expect(calc(A('sl_ts', { triceps: 12, subscapular: 8 }, { mat: 1 }), P('M', '2016-01-01')).bf).toBeCloseTo(1.21 * S - 0.008 * S * S - 1.7, 6);
    expect(calc(A('sl_ts', { triceps: 12, subscapular: 8 }, { mat: 3, afro: 1 }), P('M', '2010-01-01')).bf).toBeCloseTo(1.21 * S - 0.008 * S * S - 6.8, 6);
    expect(calc(A('sl_ts', { triceps: 25, subscapular: 15 }), P('M', '2012-01-01')).bf).toBeCloseTo(0.783 * 40 + 1.6, 6);
    expect(calc(A('sl_ts', { triceps: 12, subscapular: 8 }), P('F', '2012-01-01')).bf).toBeCloseTo(1.33 * S - 0.013 * S * S - 2.5, 6);
  });
  it('faixa de idade validada', () => {
    expect(protoFits('jp7', 12, 'M')).toBe(false);
    expect(protoFits('sl_tc', 12, 'M')).toBe(true);
    expect(protoFits('dw', 70, 'F')).toBe(true);
    expect(protoFits('petroski', 55, 'F')).toBe(false);
    expect(Object.keys(PROTOCOLS)).toEqual(expect.arrayContaining(['jp7', 'jp3', 'dw', 'petroski', 'guedes', 'faulkner', 'sl_tc', 'sl_ts']));
  });
  it('maturação estimada pela idade', () => {
    expect(matGuess(10, 'M')).toBe(1);
    expect(matGuess(13, 'M')).toBe(2);
    expect(matGuess(16, 'M')).toBe(3);
  });
  it('criança: sem fórmula da Marinha e basal pela FAO/OMS', () => {
    const r = calc({ ...A('sl_tc', {}), weight: 35, height: 140, circ: { neck: 28, waist: 62, hip: 70 } }, P('M', '2015-06-01'));
    expect(r.navy).toBeUndefined();
    expect(r.bmrBy).toBe('fao');
    expect(r.bmr).toBeCloseTo(17.5 * 35 + 651, 6);
  });
  it('gasto energético automático usa FAO/OMS em menores de 18', () => {
    const e = energyOf({ formula: 'auto' }, { sex: 'M', age: 12, w: 40, h: 150, lean: 32 })!;
    expect(e.formula).toBe('fao');
    expect(e.warn.join(' ')).not.toMatch(/adultos \(/);
  });
});
