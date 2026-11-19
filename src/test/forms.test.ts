import { describe, expect, it } from 'vitest';
import { ANAMNESE_FORM, PRE_FORM, answerText, answersHtml, cleanAnswers, fieldsOf, filledCount } from '@/lib/forms';

describe('Formulários do paciente', () => {
  it('chaves únicas em cada formulário', () => {
    for (const def of [PRE_FORM, ANAMNESE_FORM]) { const ks = fieldsOf(def).map((f) => f.k); expect(new Set(ks).size).toBe(ks.length); }
  });
  it('limpeza: só campos conhecidos, valores válidos e textos curtos', () => {
    const a = cleanAnswers(PRE_FORM, { peso: '82,4', adesao: 4, fome: 'muita', sono_h: 30, sono_q: 9, intestino: 'xx', duvidas: '  posso trocar o jantar?  ', hack: '<script>', dificuldades: 'x'.repeat(5000) });
    expect(a).toEqual({ peso: 82.4, adesao: 4, fome: 'muita', duvidas: 'posso trocar o jantar?', dificuldades: 'x'.repeat(1500) });
  });
  it('chips: opções válidas, "nenhuma" exclui as outras e texto em "outros"', () => {
    expect(cleanAnswers(ANAMNESE_FORM, { doencas: ['diabetes', 'nada', 'diabetes'], doencas_o: 'enxaqueca' })).toEqual({ doencas: ['diabetes'], doencas_o: 'enxaqueca' });
    expect(cleanAnswers(ANAMNESE_FORM, { alergias: ['lactose', 'nenhuma'] })).toEqual({ alergias: ['nenhuma'] });
    expect(cleanAnswers(ANAMNESE_FORM, { acorda: '06:30', dorme: '25:00' })).toEqual({ acorda: '06:30' });
  });
  it('texto das respostas e contagem', () => {
    const a = cleanAnswers(PRE_FORM, { peso: 70, adesao: 2, treino_x: 3, agua: '1-2' });
    const f = (k: string) => fieldsOf(PRE_FORM).find((x) => x.k === k)!;
    expect(answerText(f('peso'), a)).toBe('70 kg');
    expect(answerText(f('adesao'), a)).toBe('2/5 · Muito difícil');
    expect(answerText(f('treino_x'), a)).toBe('3x');
    expect(answerText(f('agua'), a)).toBe('1 a 2 litros');
    expect(filledCount(PRE_FORM, a)).toBe(4);
    expect(answersHtml(PRE_FORM, a)).toContain('Seu peso em casa');
    expect(answersHtml(PRE_FORM, {})).toContain('Nada preenchido');
  });
});

import { anamMissing, changedKeys, mergeAnswers, plural, preAlerts, sectionsProgress } from '@/lib/forms';
describe('Anamnese única e pontos de atenção', () => {
  it('junta a versão revisada com os envios do paciente (o mais novo vale)', () => {
    const base = { medicamentos: 'losartana', sono_h: 7 }, env1 = { sono_h: 6, alergias: ['lactose'] }, env2 = { sono_h: 5 };
    const m = mergeAnswers(base, env1, env2);
    expect(m).toEqual({ medicamentos: 'losartana', sono_h: 5, alergias: ['lactose'] });
    expect(changedKeys(ANAMNESE_FORM, base, m).sort()).toEqual(['alergias', 'sono_h']);
    expect(changedKeys(ANAMNESE_FORM, m, m)).toEqual([]);
  });
  it('progresso por seção e seções essenciais que faltam', () => {
    const a = { doencas: ['nenhuma'], medicamentos: 'nenhum' };
    expect(sectionsProgress(ANAMNESE_FORM, a).find((s) => s.k === 'saude')).toMatchObject({ n: 1, total: 2 });
    expect(anamMissing(a).map((s) => s.k)).toEqual(['alergias', 'rotina']);
    expect(anamMissing(null).length).toBe(4);
  });
  it('pré-consulta: pontos de atenção', () => {
    expect(preAlerts({ adesao: 2, fome: 'emocional', sono_h: 5, intestino: 'preso', agua: '<1' })).toEqual(['Dificuldade com o plano (2/5)', 'Fome emocional', 'Dorme pouco (5 h)', 'Intestino preso', 'Pouca água']);
    expect(preAlerts({ adesao: 5, fome: 'normal', sono_h: 8, sono_q: 4 })).toEqual([]);
    expect(plural(1, 'resposta', 'respostas')).toBe('1 resposta');
    expect(plural(3, 'resposta', 'respostas')).toBe('3 respostas');
  });
});

import { currentAnamnese } from '@/lib/forms';
import { reportHtml } from '@/lib/report.js';
describe('Ficha de saúde como envio completo e PDF', () => {
  it('o envio mais novo que a revisão vale como está (inclusive campos apagados)', () => {
    const rev = { data: { medicamentos: 'losartana', sono_h: 7 }, at: '2026-11-10T00:00:00Z' };
    const sent = [{ data: { sono_h: 6 }, at: '2026-11-12T00:00:00Z' }, { data: { medicamentos: 'nenhum' }, at: '2026-11-09T00:00:00Z' }];
    const c = currentAnamnese(rev, sent);
    expect(c.pending).toBe(true);
    expect(c.data).toEqual({ sono_h: 6 });
    expect(changedKeys(ANAMNESE_FORM, rev.data, c.data).sort()).toEqual(['medicamentos', 'sono_h']);
    expect(currentAnamnese(rev, sent.slice(1))).toMatchObject({ pending: false, data: rev.data });
  });
  it('PDF da pré-consulta: respostas, em branco e pontos de atenção', () => {
    const html = reportHtml('form', { p: { name: 'Ana Lima', birth: '1990-01-01' }, def: PRE_FORM, answers: { adesao: 2, peso: 70 }, sentAt: '2026-11-18T12:00:00Z', list: [] });
    expect(html).toContain('Pré-consulta');
    expect(html).toContain('70 kg');
    expect(html).toContain('Dificuldade com o plano');
    expect(html).toContain('2 de 11');
  });
});
