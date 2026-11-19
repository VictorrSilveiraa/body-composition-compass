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
