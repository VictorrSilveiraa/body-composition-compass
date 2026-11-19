import { esc, fmt, fmtDate } from './calculos.js';

/*
 * FORMULÁRIOS DO PACIENTE — descritos uma vez e usados em três lugares:
 *  · portal (o paciente responde: src/components/patient-portal.tsx)
 *  · app do nutricionista (lê, revisa e edita a anamnese: src/lib/care-screens.js)
 *  · servidor (limpa e valida antes de gravar: src/lib/portal.functions.ts)
 */
export type FormKind = 'pre_consulta' | 'anamnese';
export type FieldType = 'num' | 'scale' | 'choice' | 'chips' | 'text' | 'long' | 'time';
export type Field = {
  k: string; l: string; t: FieldType; u?: string; ph?: string; hint?: string;
  min?: number; max?: number; step?: number;
  /** opções [valor, rótulo] (choice e chips) */
  opts?: [string, string][];
  /** rótulos das pontas da escala 1–5 */
  ends?: [string, string];
  /** chips: aceita "outros" em texto (guardado em k + '_o') */
  other?: boolean;
};
export type Section = { k: string; l: string; d?: string; icon: string; fields: Field[] };
export type FormDef = { k: FormKind; title: string; sub: string; sections: Section[] };
export type Answers = Record<string, string | number | string[]>;

const AGUA: [string, string][] = [['<1', 'Menos de 1 litro'], ['1-2', '1 a 2 litros'], ['2-3', '2 a 3 litros'], ['>3', 'Mais de 3 litros']];

export const PRE_FORM: FormDef = {
  k: 'pre_consulta', title: 'Pré-consulta', sub: 'Como foram as últimas semanas · leva uns 2 minutos',
  sections: [
    { k: 'corpo', l: 'Alimentação', d: 'Como foi seguir o plano nas últimas semanas', icon: 'apple', fields: [
      { k: 'adesao', l: 'Como foi seguir o plano alimentar?', t: 'scale', ends: ['Muito difícil', 'Segui tudo'] },
      { k: 'fome', l: 'Como esteve sua fome?', t: 'choice', opts: [['pouca', 'Pouca'], ['normal', 'Normal'], ['muita', 'Muita'], ['emocional', 'Fome emocional']] },
      { k: 'peso', l: 'Seu peso em casa', t: 'num', u: 'kg', min: 20, max: 400, step: 0.1, hint: 'Se tiver balança. Pode deixar em branco.' },
    ] },
    { k: 'rotina', l: 'Rotina', d: 'Sono, intestino, água e treinos', icon: 'moon', fields: [
      { k: 'sono_h', l: 'Horas de sono por noite', t: 'num', u: 'h', min: 0, max: 16, step: 0.5 },
      { k: 'sono_q', l: 'Qualidade do sono', t: 'scale', ends: ['Péssima', 'Ótima'] },
      { k: 'intestino', l: 'Intestino', t: 'choice', opts: [['regular', 'Regular'], ['preso', 'Preso'], ['solto', 'Solto'], ['variavel', 'Variável']] },
      { k: 'agua', l: 'Água por dia', t: 'choice', opts: AGUA },
      { k: 'treino_x', l: 'Treinos por semana', t: 'num', u: 'x', min: 0, max: 14, step: 1 },
      { k: 'treino_d', l: 'Como foram os treinos?', t: 'text', ph: 'Ex.: musculação 4x, corrida no sábado' },
    ] },
    { k: 'consulta', l: 'Para a consulta', d: 'O que você quer conversar no retorno', icon: 'chat', fields: [
      { k: 'dificuldades', l: 'O que foi mais difícil?', t: 'long', ph: 'Ex.: lanche da tarde no trabalho, fim de semana…' },
      { k: 'duvidas', l: 'Dúvidas ou pedidos', t: 'long', ph: 'Ex.: trocar o jantar, receitas para levar marmita…' },
    ] },
  ],
};

export const ANAMNESE_FORM: FormDef = {
  k: 'anamnese', title: 'Ficha de saúde', sub: 'Anamnese · preencha só o que souber',
  sections: [
    { k: 'saude', l: 'Saúde', d: 'Condições que você tem ou já teve', icon: 'heart', fields: [
      { k: 'doencas', l: 'Doenças ou condições', t: 'chips', other: true, opts: [['hipertensao', 'Pressão alta'], ['diabetes', 'Diabetes'], ['pre_diabetes', 'Pré-diabetes'], ['hipotireoidismo', 'Hipotireoidismo'], ['colesterol', 'Colesterol alto'], ['sop', 'SOP'], ['refluxo', 'Gastrite / refluxo'], ['ansiedade', 'Ansiedade / depressão'], ['nenhuma', 'Nenhuma']] },
      { k: 'cirurgias', l: 'Cirurgias', t: 'text', ph: 'Ex.: vesícula (2019)' },
    ] },
    { k: 'remedios', l: 'Medicamentos e suplementos', d: 'O que você toma hoje, com a dose se souber', icon: 'pill', fields: [
      { k: 'medicamentos', l: 'Medicamentos em uso', t: 'long', ph: 'Nome e dose. Ex.: levotiroxina 50 mcg' },
      { k: 'suplementos', l: 'Suplementos', t: 'long', ph: 'Ex.: whey, creatina 5 g, vitamina D' },
    ] },
    { k: 'alergias', l: 'Alergias e intolerâncias', d: 'E os alimentos que você não come', icon: 'alert', fields: [
      { k: 'alergias', l: 'Alergias ou intolerâncias', t: 'chips', other: true, opts: [['lactose', 'Lactose'], ['gluten', 'Glúten'], ['frutos_mar', 'Frutos do mar'], ['castanhas', 'Amendoim / castanhas'], ['ovo', 'Ovo'], ['nenhuma', 'Nenhuma']] },
      { k: 'aversoes', l: 'Alimentos que não come ou não gosta', t: 'text', ph: 'Ex.: fígado, quiabo' },
    ] },
    { k: 'rotina', l: 'Rotina', d: 'Trabalho, horários e refeições', icon: 'clock', fields: [
      { k: 'profissao', l: 'Trabalho e rotina', t: 'text', ph: 'Ex.: escritório, 8h às 18h' },
      { k: 'acorda', l: 'Acorda às', t: 'time' },
      { k: 'dorme', l: 'Dorme às', t: 'time' },
      { k: 'refeicoes', l: 'Refeições por dia', t: 'num', min: 1, max: 12, step: 1 },
      { k: 'come_fora', l: 'Come fora de casa', t: 'choice', opts: [['raro', 'Raramente'], ['1-2', '1 a 2x por semana'], ['3-5', '3 a 5x por semana'], ['diario', 'Quase todo dia']] },
    ] },
    { k: 'sono', l: 'Sono e água', d: 'Como você dorme e quanto bebe', icon: 'moon', fields: [
      { k: 'sono_h', l: 'Horas de sono por noite', t: 'num', u: 'h', min: 0, max: 16, step: 0.5 },
      { k: 'sono_q', l: 'Qualidade do sono', t: 'scale', ends: ['Péssima', 'Ótima'] },
      { k: 'agua', l: 'Água por dia', t: 'choice', opts: AGUA },
    ] },
    { k: 'intestino', l: 'Intestino', d: 'Como funciona no dia a dia', icon: 'drop', fields: [
      { k: 'int_freq', l: 'Frequência', t: 'choice', opts: [['diario', 'Todo dia'], ['alternado', 'Dia sim, dia não'], ['raro', '2x por semana ou menos']] },
      { k: 'int_cons', l: 'Como costuma ser', t: 'choice', opts: [['normal', 'Normal'], ['preso', 'Endurecido'], ['solto', 'Amolecido'], ['variavel', 'Varia']] },
    ] },
    { k: 'treino', l: 'Atividade física', d: 'Treinos e esportes', icon: 'bolt', fields: [
      { k: 'modalidade', l: 'O que pratica', t: 'text', ph: 'Ex.: musculação e corrida' },
      { k: 'treino_x', l: 'Vezes por semana', t: 'num', u: 'x', min: 0, max: 14, step: 1 },
      { k: 'treino_min', l: 'Duração de cada treino', t: 'num', u: 'min', min: 0, max: 600, step: 5 },
    ] },
    { k: 'peso', l: 'Histórico de peso', d: 'Como seu peso mudou ao longo dos anos', icon: 'scale', fields: [
      { k: 'peso_max', l: 'Maior peso na vida adulta', t: 'num', u: 'kg', min: 20, max: 400, step: 0.1 },
      { k: 'peso_min', l: 'Menor peso na vida adulta', t: 'num', u: 'kg', min: 20, max: 400, step: 0.1 },
      { k: 'dietas', l: 'Dietas ou tratamentos que já fez', t: 'long', ph: 'Ex.: low carb em 2023, perdeu 6 kg e voltou' },
    ] },
    { k: 'exames', l: 'Exames', d: 'Resultados recentes, se tiver', icon: 'clip', fields: [
      { k: 'exames', l: 'Exames recentes e alterações', t: 'long', ph: 'Ex.: glicemia 104, vitamina D 18 (março de 2026)' },
    ] },
    { k: 'objetivo', l: 'Expectativas', d: 'Aonde você quer chegar', icon: 'target', fields: [
      { k: 'expectativa', l: 'O que você espera do acompanhamento?', t: 'long' },
    ] },
  ],
};
export const FORMS: Record<FormKind, FormDef> = { pre_consulta: PRE_FORM, anamnese: ANAMNESE_FORM };
export const fieldsOf = (def: FormDef) => def.sections.flatMap((s) => s.fields);

/** limpa as respostas: só campos conhecidos, números dentro do limite, opções válidas, textos curtos. Vazios saem. */
export function cleanAnswers(def: FormDef, raw: unknown): Answers {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out: Answers = {};
  const txt = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+$/g, '').replace(/^\s+/g, '').slice(0, max) : '');
  for (const f of fieldsOf(def)) {
    const v = src[f.k];
    if (f.t === 'num') { const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(',', '.')) : NaN; if (v !== '' && v != null && Number.isFinite(n) && n >= (f.min ?? -Infinity) && n <= (f.max ?? Infinity)) out[f.k] = Math.round(n * 10) / 10; }
    else if (f.t === 'scale') { const n = Number(v); if (Number.isInteger(n) && n >= 1 && n <= 5) out[f.k] = n; }
    else if (f.t === 'choice') { if (typeof v === 'string' && f.opts!.some((o) => o[0] === v)) out[f.k] = v; }
    else if (f.t === 'chips') {
      const arr = Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && f.opts!.some((o) => o[0] === x)))] : [];
      if (arr.length) out[f.k] = arr.includes('nenhuma') ? ['nenhuma'] : arr;
      if (f.other) { const o = txt(src[f.k + '_o'], 200); if (o) out[f.k + '_o'] = o; }
    }
    else if (f.t === 'time') { if (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)) out[f.k] = v; }
    else { const s = txt(v, f.t === 'long' ? 1500 : 300); if (s) out[f.k] = s; }
  }
  return out;
}

/** valor de um campo em texto (vazio quando não respondido) */
export function answerText(f: Field, a: Answers): string {
  const v = a[f.k];
  if (f.t === 'chips') { const arr = Array.isArray(v) ? v.map((x) => f.opts!.find((o) => o[0] === x)?.[1] ?? x) : []; const o = a[f.k + '_o']; return [...arr, ...(typeof o === 'string' && o ? [o] : [])].join(', '); }
  if (v == null || v === '') return '';
  if (f.t === 'num') return `${fmt(Number(v), Number.isInteger(Number(v)) ? 0 : 1)}${f.u ? (f.u === 'x' ? 'x' : ' ' + f.u) : ''}`;
  if (f.t === 'scale') return `${v}/5${f.ends ? ` · ${Number(v) <= 2 ? f.ends[0] : Number(v) >= 4 ? f.ends[1] : 'Regular'}` : ''}`;
  if (f.t === 'choice') return f.opts!.find((o) => o[0] === v)?.[1] ?? String(v);
  return String(v);
}
/** quantos campos foram respondidos */
export const filledCount = (def: FormDef, a: Answers | null | undefined) => (a ? fieldsOf(def).filter((f) => answerText(f, a)).length : 0);

/**
 * Resumo das respostas em HTML (mesmo visual no app e no portal): uma caixa por seção, só com o que foi respondido.
 * highlight: chaves que mudaram em relação a outra versão (o nutricionista vê o que o paciente alterou).
 */
export function answersHtml(def: FormDef, a: Answers, o: { only?: string[]; highlight?: string[]; empty?: string } = {}) {
  const secs = def.sections.filter((s) => !o.only || o.only.includes(s.k)).map((s) => {
    const rows = s.fields.map((f) => { const t = answerText(f, a); if (!t) return '';
      const scale = f.t === 'scale' ? `<span class="fa-dots" aria-hidden="true">${[1, 2, 3, 4, 5].map((n) => `<i class="${n <= Number(a[f.k]) ? 'on' : ''}"></i>`).join('')}</span>` : '';
      return `<div class="fa-row${o.highlight?.includes(f.k) ? ' new' : ''}"><dt>${esc(f.l)}</dt><dd>${scale}${esc(t).replace(/\n/g, '<br>')}</dd></div>`; }).join('');
    return rows ? `<section class="fa-sec"><h4>${esc(s.l)}</h4><dl>${rows}</dl></section>` : '';
  }).join('');
  return secs || `<p class="small muted">${esc(o.empty ?? 'Nada preenchido ainda.')}</p>`;
}

/** "1 resposta", "3 respostas" */
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** junta respostas: as mais novas valem por cima; o que ficou em branco nelas mantém o valor anterior */
export function mergeAnswers(base: Answers | null | undefined, ...newer: (Answers | null | undefined)[]): Answers {
  return newer.reduce<Answers>((acc, n) => ({ ...acc, ...(n ?? {}) }), { ...(base ?? {}) });
}
/** campos cujo texto mudou de uma versão para outra (inclusive os apagados) */
export function changedKeys(def: FormDef, before: Answers | null | undefined, after: Answers | null | undefined): string[] {
  const b = before ?? {}, a = after ?? {};
  return fieldsOf(def).filter((f) => answerText(f, a) !== answerText(f, b)).map((f) => f.k);
}
/**
 * Ficha de saúde atual: cada envio do paciente é a ficha inteira (ele parte da ficha atual, pré-preenchida),
 * então o envio mais novo que a revisão do nutricionista vale como está; sem envio novo, vale a revisada.
 */
export function currentAnamnese(reviewed: { data?: Answers | null; at?: string | null } | null | undefined, sent: { data: Answers; at: string }[]) {
  const newer = sent.filter((s) => !reviewed?.at || s.at > reviewed.at).sort((x, y) => (x.at < y.at ? -1 : 1));
  const last = newer.at(-1);
  return { data: last ? last.data : { ...(reviewed?.data ?? {}) }, newer, pending: !!last };
}
/** progresso por seção */
export function sectionsProgress(def: FormDef, a: Answers | null | undefined) {
  return def.sections.map((s) => ({ k: s.k, l: s.l, icon: s.icon, n: a ? s.fields.filter((f) => answerText(f, a)).length : 0, total: s.fields.length }));
}
/** seções essenciais da ficha de saúde (as que mudam o plano): sem elas, o portal pede para completar */
export const ANAM_ESSENTIAL = ['saude', 'remedios', 'alergias', 'rotina'];
export const anamMissing = (a: Answers | null | undefined) => sectionsProgress(ANAMNESE_FORM, a).filter((s) => ANAM_ESSENTIAL.includes(s.k) && !s.n);

/** pontos de atenção da pré-consulta (o nutricionista vê em destaque) */
export function preAlerts(a: Answers | null | undefined): string[] {
  if (!a) return [];
  const out: string[] = [], n = (k: string) => (a[k] == null || a[k] === '' ? null : Number(a[k]));
  const ad = n('adesao'); if (ad != null && ad <= 2) out.push(`Dificuldade com o plano (${ad}/5)`);
  if (a['fome'] === 'emocional') out.push('Fome emocional'); else if (a['fome'] === 'muita') out.push('Muita fome');
  const sq = n('sono_q'), sh = n('sono_h');
  if (sh != null && sh < 6) out.push(`Dorme pouco (${fmt(sh, Number.isInteger(sh) ? 0 : 1)} h)`); else if (sq != null && sq <= 2) out.push('Sono ruim');
  if (a['intestino'] === 'preso') out.push('Intestino preso'); else if (a['intestino'] === 'solto') out.push('Intestino solto');
  if (a['agua'] === '<1') out.push('Pouca água');
  return out;
}
/** data de envio por extenso ("19 de novembro") */
export const fmtSent = (iso: string) => fmtDate(iso.slice(0, 10), { day: 'numeric', month: 'long' }) as string;
