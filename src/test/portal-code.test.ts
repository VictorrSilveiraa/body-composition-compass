import { describe, expect, it } from 'vitest';
import { CODE_ALPHABET, CODE_LENGTH, fmtCode, isCode, newCode, normCode } from '@/lib/portal-code';

describe('código de acesso do paciente', () => {
  it('gera códigos válidos, com 8 caracteres do alfabeto sem ambiguidades', () => {
    for (let i = 0; i < 300; i++) {
      const c = newCode();
      expect(c).toHaveLength(CODE_LENGTH);
      expect(isCode(c)).toBe(true);
    }
    expect(CODE_ALPHABET).not.toMatch(/[01OILU]/);
  });
  it('não repete códigos em sequência', () => {
    const set = new Set(Array.from({ length: 2000 }, newCode));
    expect(set.size).toBe(2000);
  });
  it('aceita o código digitado de qualquer jeito', () => {
    expect(normCode(' k7qm-3hxa ')).toBe('K7QM3HXA');
    expect(isCode(normCode('k7qm 3hxa'))).toBe(true);
  });
  it('recusa códigos impossíveis', () => {
    expect(isCode('K7QM3HX')).toBe(false);
    expect(isCode('K7QM3HXO')).toBe(false); // O não existe no alfabeto
    expect(isCode('')).toBe(false);
  });
  it('formata com traço no meio', () => {
    expect(fmtCode('k7qm3hxa')).toBe('K7QM-3HXA');
    expect(fmtCode('k7q')).toBe('K7Q');
    expect(fmtCode('K7QM3HXA999')).toBe('K7QM-3HXA');
  });
});
