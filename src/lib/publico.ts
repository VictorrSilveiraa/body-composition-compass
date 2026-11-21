import { BMI_LMS, LMS_FIRST_MONTH, LMS_LAST_MONTH } from './oms-imc';

/*
 * Público do paciente (criança, adolescente, adulto, idoso) e as referências de classificação de cada um.
 * Só cálculo — sem tela. Usado pelo app do nutricionista, pelo portal do paciente e pelos PDFs.
 *
 * IMC
 *  · 5 a 19 anos: IMC para idade, referência OMS 2007 (escore-z), com os pontos de corte do SISVAN/Ministério da Saúde.
 *  · 20 a 59 anos: OMS (1995/2000).
 *  · 60 anos ou mais: Lipschitz (1994), adotado pelo SISVAN para idosos.
 * % de gordura
 *  · até 17 anos: Lohman (1987).  · 18 anos ou mais: American Council on Exercise (ACE).
 * Relação cintura/estatura: 0,5 serve para crianças (6+), adolescentes e adultos. RCQ: só adultos (OMS).
 * Panturrilha (idosos): 34 cm homens / 33 cm mulheres (Barbosa-Silva et al., 2016, idosos brasileiros).
 */

export type Sex = 'M' | 'F';
export type Group = 'baby' | 'child' | 'teen' | 'adult' | 'elder';
export type Tone = 'neu' | 'good' | 'warn' | 'bad';
export type Ctx = { sex: Sex; age: number | null; ageM: number | null; group: Group };
/** faixa de uma escala: até o valor `to` vale o rótulo `l` */
export type Band = { to: number; l: string; short: string; tone: Tone };
export type Info = {
  cls: string; tone: Tone;
  /** de onde vem a classificação (para a metodologia e para o rodapé dos cartões) */
  ref: string;
  /** linhas "Classificação — faixa", já com os números desta idade */
  ranges: [string, string][];
  /** frase curta do que é o normal/adequado */
  normal: string;
  /** escala desenhada (mín., máx. e faixas) */
  scale: { min: number; max: number; bands: Band[] } | null;
  z?: number; pct?: number;
  note?: string | undefined;
};

const nf = (v: number, d = 1) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const signed = (z: number) => (z > 0 ? '+' : z < 0 ? '−' : '') + nf(Math.abs(z), 1);

export const GROUP_LABEL: Record<Group, string> = { baby: 'Menor de 5 anos', child: 'Criança', teen: 'Adolescente', adult: 'Adulto', elder: 'Idoso' };

/** idade em meses completos na data */
export function ageMonths(birth: string | null | undefined, date: string | null | undefined): number | null {
  if (!birth || !date) return null;
  const [by, bm, bd] = birth.split('-').map(Number), [y, m, d] = date.split('-').map(Number);
  if (!by || !y) return null;
  let n = (y - by!) * 12 + (m! - bm!);
  if (d! < bd!) n--;
  return n;
}
export function groupOf(age: number | null, ageM: number | null = null): Group {
  if (age == null) return 'adult';
  const mo = ageM ?? age * 12 + 6;
  if (mo < LMS_FIRST_MONTH) return 'baby';
  if (age < 10) return 'child';
  if (age < 20) return 'teen';
  if (age < 60) return 'adult';
  return 'elder';
}
/** aceita o sexo ('M'/'F') ou um objeto com sexo e idade (o resultado de calc serve) */
export type CtxIn = string | null | undefined | { sex?: string | null; age?: number | null; ageM?: number | null };
export function ctxOf(c: CtxIn): Ctx {
  if (!c || typeof c === 'string') return { sex: c === 'F' ? 'F' : 'M', age: null, ageM: null, group: 'adult' };
  const age = c.age ?? null, ageM = c.ageM ?? (age != null ? age * 12 + 6 : null);
  return { sex: c.sex === 'F' ? 'F' : 'M', age, ageM, group: groupOf(age, ageM) };
}
export const isMinor = (c: Ctx) => c.age != null && c.age < 18;

/* =========================================================
   IMC para idade (OMS 2007) — escore-z pelo método LMS
   ========================================================= */
export function lmsAt(sex: Sex, months: number | null): [number, number, number] | null {
  if (months == null || months < LMS_FIRST_MONTH || months >= 240) return null;
  const rows = BMI_LMS[sex];
  return rows[Math.min(months, LMS_LAST_MONTH) - LMS_FIRST_MONTH] ?? null;
}
const atZ = ([L, M, S]: [number, number, number], z: number) => M * Math.pow(1 + L * S * z, 1 / L);
/** escore-z da OMS (com a correção oficial acima de +3 e abaixo de −3) */
export function zOf(x: number, lms: [number, number, number]): number {
  const [L, M, S] = lms;
  const z = (Math.pow(x / M, L) - 1) / (L * S);
  if (z > 3) { const sd3 = atZ(lms, 3), d = sd3 - atZ(lms, 2); return 3 + (x - sd3) / d; }
  if (z < -3) { const sd3 = atZ(lms, -3), d = atZ(lms, -2) - sd3; return -3 + (x - sd3) / d; }
  return z;
}
/** percentil (0–100) de um escore-z */
export function pctOf(z: number): number {
  // aproximação de Abramowitz-Stegun para a normal acumulada (erro < 1e-7)
  const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return (z > 0 ? 1 - p : p) * 100;
}
/** IMC que corresponde a um escore-z na idade (para mostrar as faixas em kg/m²) */
export function bmiAtZ(sex: Sex, months: number, z: number): number | null { const l = lmsAt(sex, months); return l ? atZ(l, z) : null; }

const ADULT_BMI: Band[] = [
  { to: 18.5, l: 'Abaixo do peso', short: 'Baixo', tone: 'neu' },
  { to: 25, l: 'Peso normal', short: 'Normal', tone: 'good' },
  { to: 30, l: 'Sobrepeso', short: 'Sobrepeso', tone: 'warn' },
  { to: 35, l: 'Obesidade grau I', short: 'Obes. I', tone: 'bad' },
  { to: 40, l: 'Obesidade grau II', short: 'Obes. II', tone: 'bad' },
  { to: Infinity, l: 'Obesidade grau III', short: 'Obes. III', tone: 'bad' },
];
const ELDER_BMI: Band[] = [
  { to: 22, l: 'Baixo peso', short: 'Baixo', tone: 'warn' },
  { to: 27.0000001, l: 'Peso adequado', short: 'Adequado', tone: 'good' },
  { to: Infinity, l: 'Sobrepeso', short: 'Sobrepeso', tone: 'warn' },
];
/* cortes do SISVAN para IMC/idade (5 a 19 anos): z < −3, −3 a −2, −2 a +1, +1 a +2, +2 a +3, > +3 */
const KID_Z: { to: number; l: string; short: string; tone: Tone; strict: boolean }[] = [
  { to: -3, l: 'Magreza acentuada', short: 'Magreza +', tone: 'bad', strict: true },
  { to: -2, l: 'Magreza', short: 'Magreza', tone: 'warn', strict: true },
  { to: 1, l: 'Eutrofia', short: 'Eutrofia', tone: 'good', strict: false },
  { to: 2, l: 'Sobrepeso', short: 'Sobrepeso', tone: 'warn', strict: false },
  { to: 3, l: 'Obesidade', short: 'Obesidade', tone: 'bad', strict: false },
  { to: Infinity, l: 'Obesidade grave', short: 'Obes. grave', tone: 'bad', strict: false },
];
const pick = (bands: Band[], v: number) => bands.find((b) => v < b.to) ?? bands[bands.length - 1]!;
const rangesOf = (bands: Band[], u: string, d = 1): [string, string][] => bands.map((b, i) => {
  const lo = i ? bands[i - 1]!.to : null, hi = b.to;
  if (lo == null) return [b.l, `menor que ${nf(hi, d)}${u}`];
  if (!isFinite(hi)) return [b.l, `${nf(lo, d)}${u} ou mais`];
  return [b.l, `${nf(lo, d)} a ${nf(hi - 0.1 ** d, d)}${u}`];
});
const ageTxt = (c: Ctx) => { if (c.ageM == null) return ''; const y = Math.floor(c.ageM / 12), m = c.ageM % 12; return `${y} ${y === 1 ? 'ano' : 'anos'}${m ? ` e ${m} ${m === 1 ? 'mês' : 'meses'}` : ''}`; };

export function bmiInfo(v: number | null | undefined, cIn: CtxIn): Info | null {
  if (v == null || !isFinite(v)) return null;
  const c = ctxOf(cIn);
  if (c.group === 'baby') return { cls: 'Ver curvas 0–5 anos', tone: 'neu', ref: 'OMS 2006 (0 a 5 anos)', ranges: [], normal: 'Menores de 5 anos: use as curvas da OMS 2006', scale: null, note: 'Para menores de 5 anos o IMC é lido nas curvas da OMS 2006, que não estão no sistema.' };
  if (c.group === 'child' || c.group === 'teen') {
    const lms = lmsAt(c.sex, c.ageM);
    if (lms) {
      const z = zOf(v, lms), b = KID_Z.find((x) => (x.strict ? z < x.to : z <= x.to)) ?? KID_Z[KID_Z.length - 1]!;
      const cut = (zz: number) => atZ(lms, zz);
      const bands: Band[] = KID_Z.map((x) => ({ to: isFinite(x.to) ? cut(x.to) : Infinity, l: x.l, short: x.short, tone: x.tone }));
      const ranges: [string, string][] = bands.map((x, i) => {
        const lo = i ? bands[i - 1]!.to : null, zl = i ? KID_Z[i - 1]!.to : null, zh = KID_Z[i]!.to;
        const zt = zl == null ? `z < ${signed(zh)}` : !isFinite(zh) ? `z > ${signed(zl)}` : `z ${signed(zl)} a ${signed(zh)}`;
        const kg = lo == null ? `abaixo de ${nf(x.to)}` : !isFinite(x.to) ? `acima de ${nf(lo)}` : `${nf(lo)} a ${nf(x.to)}`;
        return [x.l, `${kg} kg/m² · ${zt}`];
      });
      return {
        cls: b.l, tone: b.tone, z, pct: pctOf(z), ref: 'OMS 2007 · IMC para idade',
        ranges, normal: `Eutrofia para ${ageTxt(c)}: ${nf(cut(-2))} a ${nf(cut(1))} kg/m²`,
        scale: { min: cut(-3.6), max: cut(3.6), bands },
      };
    }
  }
  if (c.group === 'elder') return { cls: pick(ELDER_BMI, v).l, tone: pick(ELDER_BMI, v).tone, ref: 'Lipschitz (1994) · idosos', ranges: [['Baixo peso', 'menor que 22'], ['Peso adequado', '22 a 27'], ['Sobrepeso', 'maior que 27']], normal: 'Adequado (idosos): 22 a 27', scale: { min: 16, max: 36, bands: ELDER_BMI } };
  const b = pick(ADULT_BMI, v);
  return { cls: b.l, tone: b.tone, ref: 'OMS', ranges: rangesOf(ADULT_BMI, ''), normal: 'Normal: 18,5 a 24,9', scale: { min: 15, max: 40, bands: ADULT_BMI } };
}

/* =========================================================
   % de gordura
   ========================================================= */
const ACE: Record<Sex, number[]> = { F: [13, 20, 24, 31], M: [5, 13, 17, 24] };
const LOHMAN: Record<Sex, number[]> = { M: [6, 10, 20, 25, 31], F: [12, 15, 25, 30, 36] };
const upTo = (cuts: number[], labels: [string, string, Tone][]): Band[] => labels.map(([l, short, tone], i) => ({ to: i < cuts.length ? cuts[i]! + 1e-9 : Infinity, l, short, tone }));
export function bfBands(cIn: CtxIn): { bands: Band[]; ref: string; normal: string; min: number; max: number } {
  const c = ctxOf(cIn);
  if (isMinor(c)) {
    const t = LOHMAN[c.sex];
    return { ref: 'Lohman (1987) · crianças e adolescentes', normal: `Adequado: ${t[1]! + 1}–${t[2]} %`, min: c.sex === 'F' ? 6 : 2, max: c.sex === 'F' ? 44 : 38,
      bands: upTo(t, [['Muito baixo', 'Muito baixo', 'warn'], ['Baixo', 'Baixo', 'neu'], ['Adequado', 'Adequado', 'good'], ['Moderadamente alto', 'Mod. alto', 'warn'], ['Alto', 'Alto', 'bad'], ['Muito alto', 'Muito alto', 'bad']]) };
  }
  const t = ACE[c.sex];
  return { ref: 'American Council on Exercise (ACE)', normal: c.sex === 'F' ? 'Boa forma: 21–24 % · Média: 25–31 %' : 'Boa forma: 14–17 % · Média: 18–24 %', min: c.sex === 'F' ? 8 : 2, max: c.sex === 'F' ? 42 : 36,
    bands: upTo(t, [['Gordura essencial', 'Essencial', 'neu'], ['Atlético', 'Atlético', 'good'], ['Boa forma', 'Boa forma', 'good'], ['Média', 'Média', 'warn'], ['Acima do ideal', 'Acima', 'bad']]) };
}
export function bfInfo(v: number | null | undefined, cIn: CtxIn): Info | null {
  if (v == null || !isFinite(v)) return null;
  const { bands, ref, normal, min, max } = bfBands(cIn), b = pick(bands, v);
  const ranges: [string, string][] = bands.map((x, i) => {
    const lo = i ? Math.round(bands[i - 1]!.to) : null, hi = Math.round(x.to);
    return [x.l, lo == null ? `até ${hi}%` : !isFinite(x.to) ? `${lo + 1}% ou mais` : `${lo + 1}–${hi}%`];
  });
  return { cls: b.l, tone: b.tone, ref, ranges, normal, scale: { min, max, bands } };
}

/* =========================================================
   Cintura: RCQ (adultos) e cintura/estatura (todos a partir de 6 anos)
   ========================================================= */
export function whrInfo(v: number | null | undefined, cIn: CtxIn): Info | null {
  if (v == null || !isFinite(v)) return null;
  const c = ctxOf(cIn);
  if (isMinor(c)) return { cls: 'Sem referência para a idade', tone: 'neu', ref: 'OMS (adultos)', ranges: [], normal: 'Sem ponto de corte antes dos 18 anos — use a cintura/estatura', scale: null };
  const lim = c.sex === 'F' ? [0.80, 0.85] : [0.95, 1.0];
  const cls = v < lim[0]! ? 'Risco baixo' : v < lim[1]! ? 'Risco moderado' : 'Risco alto';
  return { cls, tone: cls === 'Risco baixo' ? 'good' : cls === 'Risco moderado' ? 'warn' : 'bad', ref: 'OMS',
    ranges: c.sex === 'F' ? [['Risco baixo', 'menor que 0,80'], ['Risco moderado', '0,80 a 0,84'], ['Risco alto', '0,85 ou mais']] : [['Risco baixo', 'menor que 0,95'], ['Risco moderado', '0,95 a 0,99'], ['Risco alto', '1,00 ou mais']],
    normal: c.sex === 'F' ? 'Risco baixo: abaixo de 0,80' : 'Risco baixo: abaixo de 0,95', scale: null };
}
export function whtrInfo(v: number | null | undefined, cIn: CtxIn): Info | null {
  if (v == null || !isFinite(v)) return null;
  const c = ctxOf(cIn);
  const cls = v < 0.5 ? 'Adequada' : v < 0.6 ? 'Atenção' : 'Risco elevado';
  return { cls, tone: v < 0.5 ? 'good' : v < 0.6 ? 'warn' : 'bad', ref: 'Ashwell & Hsieh (2005)',
    ranges: [['Adequada', 'menor que 0,50'], ['Atenção', '0,50 a 0,59'], ['Risco elevado', '0,60 ou mais']],
    normal: isMinor(c) ? 'Ideal: abaixo de 0,50 (vale também para crianças)' : 'Ideal: abaixo de 0,50', scale: null };
}
/** panturrilha em idosos: abaixo do corte sugere massa muscular reduzida */
export const CALF_CUT: Record<Sex, number> = { M: 34, F: 33 };
export function calfInfo(v: number | null | undefined, cIn: CtxIn): Info | null {
  const c = ctxOf(cIn);
  if (v == null || !isFinite(v) || c.group !== 'elder') return null;
  const cut = CALF_CUT[c.sex], low = v < cut;
  return { cls: low ? 'Abaixo do ponto de corte' : 'Adequada', tone: low ? 'bad' : 'good', ref: 'Barbosa-Silva et al. (2016) · idosos brasileiros',
    ranges: [['Adequada', `${nf(cut, 0)} cm ou mais`], ['Abaixo do ponto de corte', `menor que ${nf(cut, 0)} cm`]],
    normal: `Adequada: ${nf(cut, 0)} cm ou mais`, scale: null,
    note: low ? 'Sugere massa muscular reduzida: vale investigar sarcopenia (força de preensão, velocidade de marcha).' : undefined };
}

/** frase que explica o público e as referências usadas (aparece no início da avaliação e nos PDFs) */
export function audienceNote(cIn: CtxIn, withLabel = true): string {
  const c = ctxOf(cIn), pre = withLabel ? GROUP_LABEL[c.group] + ': ' : '';
  switch (c.group) {
    case 'baby': return pre + 'o IMC é avaliado nas curvas da OMS 2006 (fora do sistema). As dobras servem para acompanhar a evolução.';
    case 'child': case 'teen': return pre + `IMC para idade pela OMS 2007 (escore-z)${isMinor(c) ? ', % de gordura pela classificação de Lohman e protocolos de Slaughter' : ''}.`;
    case 'elder': return pre + 'IMC pela classificação de Lipschitz (22 a 27 é adequado) e panturrilha como sinal de perda muscular.';
    default: return '';
  }
}
