import { num, fmt, fmtDate, foldVal, toDate, FOLDS, CIRC_TRUNK, CIRC_LIMBS } from './calculos.js';

/*
 * "Confere?" — valores estranhos durante a consulta.
 * Compara cada medida com a avaliação anterior e com limites do corpo humano, para pegar erro de digitação
 * (vírgula no lugar errado, metro em vez de centímetro, dígito a mais) antes de salvar.
 * Só cálculo — sem tela. O nutricionista pode responder "Está certo" e o aviso some até o valor mudar.
 */

export type Step = 'start' | 'body' | 'trunk' | 'limbs' | 'folds' | 'extra';
export type Alert = {
  /** identificador do aviso (campo + tipo) — usado para "Está certo" */
  id: string;
  /** campo onde o aviso aparece (data-k do campo ou do par direito/esquerdo) */
  at: string;
  step: Step;
  /** nome da medida, para a lista do resumo */
  label: string;
  msg: string;
  /** assinatura dos valores envolvidos: se mudar, o aviso volta */
  sig: string;
  /** err = quase certamente errado (unidade trocada, impossível); warn = fora do esperado */
  sev: 'err' | 'warn';
};
type Rec = Record<string, unknown>;
export type Draftish = { date: string; weight?: unknown; height?: unknown; multi?: boolean; circ?: Rec | null; folds?: Rec | null; extra?: Rec | null; protocol?: string; _ok?: Record<string, string> | null };
export type CheckCtx = {
  prev: Draftish | null;
  /** idade na data (anos) */
  age: number | null;
  birth?: string | null;
  /** datas das outras avaliações do paciente (para avisar data repetida) */
  otherDates?: string[];
  /** % de gordura calculado pelas dobras nesta avaliação (para comparar com a bioimpedância) */
  bfFolds?: number | null;
};

const n1 = (v: number | null | undefined) => fmt(v, 1) as string;
const near10 = (a: number, b: number) => { const r = a / b; return (r > 8 && r < 12.5) || (r > 1 / 12.5 && r < 1 / 8); };
const days = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / 864e5);
const when = (prev: Draftish, date: string) => { const d = days(prev.date, date); return `${fmtDate(prev.date, prev.date.slice(0, 4) === date.slice(0, 4) ? { day: '2-digit', month: 'short' } : { day: '2-digit', month: 'short', year: 'numeric' })}${d > 0 ? ` (há ${d} ${d === 1 ? 'dia' : 'dias'})` : ''}`; };
const more = (d: number, u: string) => `${n1(Math.abs(d))} ${u} ${d > 0 ? 'a mais' : 'a menos'}`;

/* faixas que o corpo humano realmente alcança (bem largas: o objetivo é pegar digitação, não diagnosticar) */
const CIRC_RANGE: Record<string, [number, number]> = {
  neck: [18, 70], shoulder: [55, 190], chest: [45, 190], waist: [35, 210], abdomen: [35, 220], hip: [45, 210],
  arm: [10, 70], biceps: [10, 75], forearm: [10, 50], thighp: [20, 120], thighm: [18, 105], calf: [14, 70],
};
const CIRC_L: Record<string, string> = Object.fromEntries([...CIRC_TRUNK, ...CIRC_LIMBS].map((c: { k: string; l: string }) => [c.k, c.l]));
const FOLD_L: Record<string, string> = Object.fromEntries(FOLDS.map((f: { k: string; l: string }) => [f.k, f.l]));
const STEP_OF_CIRC = (k: string): Step => (CIRC_TRUNK.some((c: { k: string }) => c.k === k) ? 'trunk' : 'limbs');

/** limite de variação de peso para o intervalo: ~8 kg num retorno de 30 dias, mais folga em intervalos longos */
export function weightLimit(prevW: number, gapDays: number) {
  const weeks = Math.max(1, gapDays) / 7;
  return Math.min(Math.max(5, 2 + 1.5 * weeks), Math.max(15, prevW * 0.25));
}

export function checkAssessment(d: Draftish, cx: CheckCtx): Alert[] {
  const out: Alert[] = [];
  const add = (a: Omit<Alert, 'id'> & { id?: string }) => out.push({ ...a, id: a.id ?? a.at });
  const pv = cx.prev, adult = cx.age == null || cx.age >= 18, grown = cx.age == null || cx.age >= 20;
  const gap = pv ? Math.max(0, days(pv.date, d.date)) : 0;

  /* ---------- início: data ---------- */
  if (d.date && cx.birth && d.date < cx.birth) add({ at: 'date', step: 'start', label: 'Data', msg: 'A data da avaliação é anterior ao nascimento do paciente.', sig: d.date, sev: 'err' });
  if (d.date && cx.otherDates?.includes(d.date)) add({ at: 'date', id: 'date:dup', step: 'start', label: 'Data', msg: 'Já existe uma avaliação deste paciente nesta data. É uma nova consulta mesmo?', sig: d.date, sev: 'warn' });

  /* ---------- peso ---------- */
  const w = num(d.weight), pw = pv ? num(pv.weight) : null;
  if (w != null) {
    if (w <= 0 || w > 350) add({ at: 'weight', step: 'body', label: 'Peso', msg: `${n1(w)} kg está fora do possível para uma pessoa.`, sig: String(w), sev: 'err' });
    else if (pw && near10(w, pw)) add({ at: 'weight', step: 'body', label: 'Peso', msg: `Parece que a vírgula ficou no lugar errado: antes era ${n1(pw)} kg.`, sig: String(w), sev: 'err' });
    else if (pw && pv) {
      const dw = w - pw, lim = weightLimit(pw, gap);
      if (Math.abs(dw) > lim) add({ at: 'weight', step: 'body', label: 'Peso', msg: `${more(dw, 'kg')} que em ${when(pv, d.date)}.`, sig: String(w), sev: 'warn' });
    } else if (adult && w < 30) add({ at: 'weight', step: 'body', label: 'Peso', msg: `${n1(w)} kg é muito baixo para um adulto.`, sig: String(w), sev: 'warn' });
  }

  /* ---------- altura ---------- */
  const h = num(d.height), ph = pv ? num(pv.height) : null;
  if (h != null) {
    if (h > 0 && h < 3) add({ at: 'height', step: 'body', label: 'Altura', msg: `Parece estar em metros. A altura vai em centímetros (ex.: ${Math.round(h * 100)}).`, sig: String(h), sev: 'err' });
    else if (h > 300) add({ at: 'height', step: 'body', label: 'Altura', msg: `Parece estar em milímetros. A altura vai em centímetros (ex.: ${n1(h / 10)}).`, sig: String(h), sev: 'err' });
    else if (h < 45 || h > 230) add({ at: 'height', step: 'body', label: 'Altura', msg: `${n1(h)} cm está fora do esperado para uma pessoa.`, sig: String(h), sev: 'err' });
    else if (ph && pv && ph >= 45) {
      const dh = h - ph, months = gap / 30.4;
      if (grown && Math.abs(dh) > (cx.age != null && cx.age >= 60 ? 3 : 2)) add({ at: 'height', step: 'body', label: 'Altura', msg: `${more(dh, 'cm')} que em ${when(pv, d.date)}. Em adultos a altura quase não muda.`, sig: String(h), sev: 'warn' });
      else if (!grown && dh < -1.5) add({ at: 'height', step: 'body', label: 'Altura', msg: `${n1(-dh)} cm a menos que em ${when(pv, d.date)}. Na fase de crescimento a altura não diminui.`, sig: String(h), sev: 'warn' });
      else if (!grown && dh > 3 + 1.5 * months) add({ at: 'height', step: 'body', label: 'Altura', msg: `Cresceu ${n1(dh)} cm desde ${when(pv, d.date)} — acima do ritmo de crescimento esperado.`, sig: String(h), sev: 'warn' });
    }
    if (w != null && w > 0 && h >= 45 && h <= 230 && !out.some((x) => x.at === 'weight' || x.at === 'height')) {
      const bmi = w / (h / 100) ** 2;
      if (bmi < 10 || bmi > 75) add({ at: 'height', id: 'height:bmi', step: 'body', label: 'Peso e altura', msg: `O IMC daria ${n1(bmi)} kg/m². Confira o peso e a altura.`, sig: `${w}|${h}`, sev: 'warn' });
    }
  }

  /* ---------- circunferências ---------- */
  const c = d.circ ?? {}, pc = pv?.circ ?? {};
  const one = (key: string, base: string, side: '' | 'D' | 'E'): void => {
    const v = num(c[key]); if (v == null) return;
    const label = (CIRC_L[base] ?? base) + (side ? ` (${side})` : ''), at = 'circ.' + (side ? base : key), step = STEP_OF_CIRC(base);
    const id = 'circ.' + key, r = CIRC_RANGE[base] ?? [5, 250], p = num(pc[key]);
    if (p && near10(v, p)) return void add({ id, at, step, label, msg: v > p ? `${label}: ${n1(v)} cm — parece estar em milímetros (antes era ${n1(p)} cm).` : `${label}: ${n1(v)} cm — faltou um dígito? Antes era ${n1(p)} cm.`, sig: String(v), sev: 'err' });
    if (v > r[1] * 1.6 && v / 10 >= r[0] * 0.6) return void add({ id, at, step, label, msg: `${label}: ${n1(v)} cm parece estar em milímetros (${n1(v / 10)} cm?).`, sig: String(v), sev: 'err' });
    if (v < r[0] * (adult ? 1 : 0.6) || v > r[1]) return void add({ id, at, step, label, msg: `${label}: ${n1(v)} cm está fora do esperado para essa medida.`, sig: String(v), sev: 'warn' });
    if (p && pv) {
      const dv = v - p, rel = Math.abs(dv) / p, minAbs = step === 'trunk' ? 5 : 3, lim = 0.12 + Math.min(0.13, gap / 365 * 0.1);
      if (rel > lim && Math.abs(dv) >= minAbs) return void add({ id, at, step, label, msg: `${label}: ${more(dv, 'cm')} que em ${when(pv, d.date)}.`, sig: String(v), sev: 'warn' });
    }
  };
  for (const t of CIRC_TRUNK as { k: string }[]) one(t.k, t.k, '');
  for (const l of CIRC_LIMBS as { k: string; l: string }[]) {
    one(l.k + '_r', l.k, 'D'); one(l.k + '_l', l.k, 'E');
    const R = num(c[l.k + '_r']), L = num(c[l.k + '_l']);
    if (R && L && !out.some((x) => x.at === 'circ.' + l.k)) {
      const diff = Math.abs(R - L);
      if (diff > Math.max(3, 0.12 * Math.max(R, L))) add({ id: 'circ.' + l.k + ':lr', at: 'circ.' + l.k, step: 'limbs', label: l.l, msg: `Direito e esquerdo diferem ${n1(diff)} cm. Lados costumam ficar a poucos centímetros um do outro.`, sig: `${R}|${L}`, sev: 'warn' });
    }
  }
  // medidas que não podem se inverter (mesmo lado)
  for (const s of ['_r', '_l'] as const) {
    const side = s === '_r' ? 'direito' : 'esquerdo';
    const arm = num(c['arm' + s]), bic = num(c['biceps' + s]), calf = num(c['calf' + s]), thm = num(c['thighm' + s]);
    if (arm && bic && bic < arm - 0.5 && !out.some((x) => x.at === 'circ.biceps')) add({ id: 'circ.biceps:inv' + s, at: 'circ.biceps', step: 'limbs', label: 'Bíceps contraído', msg: `Lado ${side}: bíceps contraído (${n1(bic)}) menor que o braço relaxado (${n1(arm)}). Os campos podem ter sido trocados.`, sig: `${arm}|${bic}`, sev: 'warn' });
    if (calf && thm && calf > thm + 1 && !out.some((x) => x.at === 'circ.calf')) add({ id: 'circ.calf:inv' + s, at: 'circ.calf', step: 'limbs', label: 'Panturrilha', msg: `Lado ${side}: panturrilha (${n1(calf)}) maior que a coxa medial (${n1(thm)}). Confere?`, sig: `${calf}|${thm}`, sev: 'warn' });
  }
  const neck = num(c['neck']), waist = num(c['waist']);
  if (neck && waist && neck >= waist && !out.some((x) => x.at === 'circ.neck')) add({ id: 'circ.neck:inv', at: 'circ.neck', step: 'trunk', label: 'Pescoço', msg: `Pescoço (${n1(neck)}) maior ou igual à cintura (${n1(waist)}). Os campos podem ter sido trocados.`, sig: `${neck}|${waist}`, sev: 'warn' });

  /* ---------- dobras ---------- */
  const f = d.folds ?? {};
  for (const fd of FOLDS as { k: string; l: string }[]) {
    const v = foldVal(d, fd.k); if (v == null) continue;
    const at = 'folds.' + fd.k, label = FOLD_L[fd.k] ?? fd.k, p = pv ? foldVal(pv, fd.k) : null;
    if (d.multi) {
      const reads = (Array.isArray(f[fd.k]) ? (f[fd.k] as unknown[]) : [f[fd.k]]).map(num).filter((x): x is number => x != null && x > 0);
      if (reads.length >= 2) {
        const lo = Math.min(...reads), hi = Math.max(...reads);
        if (hi - lo > Math.max(1.5, 0.1 * v) && (hi / lo >= 2.5 || hi - lo >= 4)) add({ id: at + ':reads', at, step: 'folds', label, msg: `Leituras de ${n1(lo)} a ${n1(hi)} mm. Uma delas pode ter sido digitada errada — vale medir de novo.`, sig: reads.join('|'), sev: 'warn' });
        else if (hi - lo > Math.max(1.5, 0.1 * v)) add({ id: at + ':reads', at, step: 'folds', label, msg: `As leituras variaram ${n1(hi - lo)} mm (${n1(lo)} a ${n1(hi)}). Acima de 10% vale uma nova medida.`, sig: reads.join('|'), sev: 'warn' });
      }
    }
    if (v > 70) { add({ at, step: 'folds', label, msg: `${n1(v)} mm passa do limite dos adipômetros (60–70 mm).`, sig: String(v), sev: 'err' }); continue; }
    if (v < 2) { add({ at, step: 'folds', label, msg: `${n1(v)} mm é menos que a pele dobrada. Faltou um dígito?`, sig: String(v), sev: 'warn' }); continue; }
    if (p && pv) {
      const ratio = v / p;
      if ((ratio >= 3 || ratio <= 1 / 3) && Math.abs(v - p) >= 5) add({ at, step: 'folds', label, msg: `${n1(p)} → ${n1(v)} mm: ${ratio >= 3 ? `${n1(ratio)}× maior` : `${n1(1 / ratio)}× menor`} que em ${when(pv, d.date)}.`, sig: String(v), sev: 'warn' });
    }
  }

  /* ---------- bioimpedância ---------- */
  const ex = d.extra ?? {}, bf = num(ex['bf']), mus = num(ex['muscle']), vis = num(ex['visceral']), wat = num(ex['water']);
  if (bf != null && (bf < 2 || bf > 65)) add({ at: 'extra.bf', step: 'extra', label: '% Gordura (bio)', msg: `${n1(bf)}% está fora do que a bioimpedância mede.`, sig: String(bf), sev: 'err' });
  else if (bf != null && cx.bfFolds != null && Math.abs(bf - cx.bfFolds) > 12) add({ at: 'extra.bf', id: 'extra.bf:folds', step: 'extra', label: '% Gordura (bio)', msg: `A balança indica ${n1(bf)}% e as dobras ${n1(cx.bfFolds)}%. Diferença grande — confira o valor ou a hidratação do paciente.`, sig: `${bf}|${Math.round(cx.bfFolds)}`, sev: 'warn' });
  if (mus != null && w && mus >= w) add({ at: 'extra.muscle', step: 'extra', label: 'Massa muscular', msg: `Massa muscular (${n1(mus)} kg) maior que o peso (${n1(w)} kg).`, sig: `${mus}|${w}`, sev: 'err' });
  else if (mus != null && w && mus < w * 0.15) add({ at: 'extra.muscle', step: 'extra', label: 'Massa muscular', msg: `${n1(mus)} kg é pouco para ${n1(w)} kg de peso. Está em kg ou em %?`, sig: `${mus}|${w}`, sev: 'warn' });
  if (vis != null && (vis < 1 || vis > 59)) add({ at: 'extra.visceral', step: 'extra', label: 'Gordura visceral', msg: `Nível ${n1(vis)} fora da escala dos aparelhos (1 a 59).`, sig: String(vis), sev: 'warn' });
  if (wat != null && (wat < 30 || wat > 80)) add({ at: 'extra.water', step: 'extra', label: 'Água corporal', msg: `${n1(wat)}% fora do esperado (30–80%). Se o aparelho dá em litros, converta para %.`, sig: String(wat), sev: 'warn' });

  return out;
}

/** avisos ainda não conferidos (os confirmados com "Está certo" só voltam se o valor mudar) */
export const openAlerts = (alerts: Alert[], ok: Record<string, string> | null | undefined) => alerts.filter((a) => ok?.[a.id] !== a.sig);
