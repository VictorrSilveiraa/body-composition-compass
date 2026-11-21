import { describe, expect, it } from 'vitest';
import {
  crnParts, crnJoin, crnLabel, displayName, shortName, signLine, splitTreat, specialtiesOf, igHandle, webUrl, waUrl, placeLine,
  validate, cleanNutri, checklist, completeness, pdfPrefs, workPrefs, brandColor,
} from '@/lib/nutri';

describe('CRN', () => {
  it('entende os jeitos comuns de digitar', () => {
    expect(crnParts('3-12345')).toEqual({ reg: '3', num: '12345' });
    expect(crnParts('CRN-3 54321')).toEqual({ reg: '3', num: '54321' });
    expect(crnParts('crn 10/1234')).toEqual({ reg: '10', num: '1234' });
    expect(crnParts('12345')).toEqual({ reg: '', num: '12345' });
  });
  it('monta e exibe no padrão CRN-3 12345', () => {
    expect(crnJoin('3', '12345')).toBe('3-12345');
    expect(crnLabel('3-12345')).toBe('CRN-3 12345');
    expect(crnLabel('12345')).toBe('CRN 12345');
    expect(crnLabel('')).toBe('');
  });
});

describe('nome com tratamento', () => {
  it('Dra./Dr. pelo campo ou digitado no nome, sem repetir', () => {
    expect(displayName({ name: 'Helena Duarte', treat: 'dra' })).toBe('Dra. Helena Duarte');
    expect(displayName({ name: 'Dra. Helena Duarte' })).toBe('Dra. Helena Duarte');
    expect(displayName({ name: 'Dra. Helena Duarte', treat: 'dra' })).toBe('Dra. Helena Duarte');
    expect(shortName({ name: 'Dra Helena Duarte' })).toBe('Dra. Helena');
    expect(shortName({ name: 'Paulo Lima' })).toBe('Paulo');
    expect(splitTreat('Dr. João')).toEqual({ treat: 'dr', rest: 'João' });
    expect(signLine({ name: 'Helena', treat: 'dra', crn: '3-1234' })).toBe('Dra. Helena · CRN-3 1234');
  });
});

describe('contatos', () => {
  it('Instagram aceita @, link ou nome', () => {
    expect(igHandle('@nutri.helena')).toBe('nutri.helena');
    expect(igHandle('https://www.instagram.com/nutri.helena/')).toBe('nutri.helena');
    expect(igHandle('nutri helena!!')).toBe('');
  });
  it('site e agendamento viram link https', () => {
    expect(webUrl('helena.com.br')).toBe('https://helena.com.br');
    expect(webUrl('calendly.com/helena')).toBe('https://calendly.com/helena');
    expect(webUrl('não é site')).toBe('');
  });
  it('WhatsApp com DDI do Brasil', () => {
    expect(waUrl('(11) 98765-4321')).toBe('https://wa.me/5511987654321');
    expect(waUrl('123')).toBe('');
  });
  it('linha de atendimento', () => {
    expect(placeLine({ mode: 'online' })).toBe('Atendimento online');
    expect(placeLine({ mode: 'ambos', place: 'Clínica Vida' })).toBe('Clínica Vida · também online');
    expect(placeLine({ place: 'Clínica Vida' })).toBe('Clínica Vida');
  });
});

describe('salvar', () => {
  it('valida o que foi digitado', () => {
    expect(validate({ name: '' })).toMatch(/nome/);
    expect(validate({ name: 'Ana', phone: '1199' })).toMatch(/WhatsApp/);
    expect(validate({ name: 'Ana', instagram: 'a b' })).toMatch(/Instagram/);
    expect(validate({ name: 'Ana', site: 'xx' })).toMatch(/site/);
    expect(validate({ name: 'Ana', email: 'ana@' })).toMatch(/E-mail/);
    expect(validate({ name: 'Ana', crn: '3-12' })).toMatch(/CRN/);
    expect(validate({ name: 'Ana', crn: '3-12345', instagram: '@ana.nutri', site: 'ana.com' })).toBeNull();
  });
  it('limpa e mantém o texto antigo de especialidade', () => {
    const n = cleanNutri({ name: '  Ana ', specialties: ['Esportiva', 'Clínica'], instagram: 'https://instagram.com/ana.nutri', site: 'https://www.ana.com/' });
    expect(n.name).toBe('Ana');
    expect(n.specialty).toBe('Esportiva · Clínica');
    expect(n.instagram).toBe('@ana.nutri');
    expect(n.site).toBe('ana.com');
  });
  it('perfil antigo (só texto) vira lista de especialidades', () => {
    expect(specialtiesOf({ specialty: 'Esportiva · Clínica' })).toEqual(['Esportiva', 'Clínica']);
    expect(specialtiesOf({ specialty: 'Nutrição Esportiva' })).toEqual(['Esportiva']);
    expect(specialtiesOf({ specialty: 'Nutrição esportiva e emagrecimento' })).toEqual(['Nutrição esportiva e emagrecimento']);
  });
});

describe('perfil completo e padrões', () => {
  it('lista o que falta', () => {
    const c = checklist({ name: 'Ana', crn: '3-12345' });
    expect(c.find((x) => x.k === 'photo')!.done).toBe(false);
    expect(completeness({ name: 'Ana', crn: '3-12345', photoPath: 'a', specialties: ['Clínica'], phone: '11987654321', mode: 'online', logoPath: 'b', signPath: 'c' })).toBe(100);
  });
  it('padrões de PDF e de trabalho', () => {
    expect(pdfPrefs({})).toEqual({ head: 'logo', contacts: true, sign: 'line', note: '' });
    expect(workPrefs({ prefs: { multi: true } }).multi).toBe(true);
    expect(workPrefs({}).proto).toBe('jp7');
    expect(brandColor('nao-existe').k).toBe('sol');
  });
});
