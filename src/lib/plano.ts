import { ageAt, calc, num, toDate, today } from './calculos.js';

/*
 * Plano de acompanhamento do paciente: METAS (com progresso) e GASTO ENERGÉTICO (basal × atividade, meta calórica e macros).
 * Só cálculo — sem tela. Usado no app do nutricionista (care-screens.js) e no portal do paciente.
 * Fica guardado na ficha do paciente (coluna "plano" da tabela pacientes).
 */

/* =========================================================
   METAS
   ========================================================= */
export type GoalKind = 'weight' | 'bf' | 'waist' | 'lean';
export type Goal = { id: string; k: GoalKind; to: number; from: number; fromDate: string; by?: string | null };
export type FormulaKey = 'auto' | 'mifflin' | 'harris' | 'katch' | 'cunningham' | 'fao';
export type EnergyCfg = { formula: FormulaKey; activity: number; adjust: number; protein: number; fat: number; share?: boolean };
export type CarePlan = { goals?: Goal[]; energy?: EnergyCfg | null };

type Person = { sex: string; birth: string; height?: unknown };
type Assess = { id?: string; date: string; weight?: unknown; height?: unknown; circ?: Record<string, unknown> | null };
type Res = { bf?: number | null; leanMass?: number | null };

export const GOAL_KINDS: Record<GoalKind, { l: string; short: string; u: string; tone: string }> = {
  weight: { l: 'Peso', short: 'peso', u: 'kg', tone: 'blue' },
  bf: { l: '% de gordura', short: 'gordura', u: '%', tone: 'peach' },
  waist: { l: 'Cintura', short: 'cintura', u: 'cm', tone: 'yellow' },
  lean: { l: 'Massa magra', short: 'massa magra', u: 'kg', tone: 'green' },
};
export const GOAL_ORDER: GoalKind[] = ['weight', 'bf', 'waist', 'lean'];

export function goalValue(k: GoalKind, a: Assess, r: Res): number | null {
  if (k === 'weight') { const w = num(a.weight); return w != null && w > 0 ? w : null; }
  if (k === 'bf') return r.bf ?? null;
  if (k === 'waist') return num(a.circ?.['waist']);
  return r.leanMass ?? null;
}
/** valores da medida ao longo das avaliações (em ordem de data) */
export function goalSeries(k: GoalKind, list: Assess[], p: Person) {
  return list.map((a) => ({ date: a.date, v: goalValue(k, a, calc(a, p) as Res) })).filter((x): x is { date: string; v: number } => x.v != null);
}

const days = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / 864e5);
const isoAdd = (iso: string, n: number) => { const d = toDate(iso); d.setDate(d.getDate() + Math.round(n)); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export type GoalStatus = {
  goal: Goal; cur: number; curDate: string | null;
  /** 0–1 do caminho entre o início e a meta */
  pct: number;
  /** quanto falta, sempre positivo (0 = alcançada) */
  left: number;
  /** -1 = a meta é diminuir, 1 = aumentar */
  dir: -1 | 1;
  done: boolean; doneOn: string | null;
  /** dias até o prazo (negativo = passou) */
  daysLeft: number | null;
  /** data prevista no ritmo atual */
  eta: string | null;
  pace: 'on' | 'behind' | 'away' | null;
};

export function goalStatus(g: Goal, series: { date: string; v: number }[], now = today()): GoalStatus {
  const dir: -1 | 1 = g.to < g.from ? -1 : 1;
  const reached = (v: number) => (dir < 0 ? v <= g.to + 1e-9 : v >= g.to - 1e-9);
  const after = series.filter((x) => x.date >= g.fromDate);
  const last = after.at(-1) ?? null;
  const cur = last?.v ?? g.from;
  const span = g.to - g.from;
  const pct = span === 0 ? 1 : Math.max(0, Math.min(1, (cur - g.from) / span));
  const done = reached(cur);
  let doneOn: string | null = null;
  if (done) for (let i = after.length - 1; i >= 0 && reached(after[i]!.v); i--) doneOn = after[i]!.date;
  const left = done ? 0 : Math.abs(g.to - cur);
  const daysLeft = g.by ? days(now, g.by) : null;
  // ritmo: variação desde o início da meta, por dia (precisa de pelo menos 10 dias de acompanhamento)
  let eta: string | null = null, pace: GoalStatus['pace'] = null;
  if (!done && last) {
    const d = days(g.fromDate, last.date), moved = (cur - g.from) * dir;
    if (d >= 10 && Math.abs(cur - g.from) > 1e-9) {
      if (moved > 0) { eta = isoAdd(last.date, left / (moved / d)); pace = g.by ? (eta <= g.by ? 'on' : 'behind') : 'on'; }
      else pace = 'away';
    }
  }
  return { goal: g, cur, curDate: last?.date ?? null, pct, left, dir, done, doneOn, daysLeft, eta, pace };
}

/* =========================================================
   GASTO ENERGÉTICO
   ========================================================= */
export const FORMULAS: { k: FormulaKey; l: string; d: string; lean?: boolean }[] = [
  { k: 'auto', l: 'Automática', d: 'Katch-McArdle quando há massa magra; senão Mifflin-St Jeor' },
  { k: 'mifflin', l: 'Mifflin-St Jeor', d: 'Peso, altura, idade e sexo · a mais usada em adultos' },
  { k: 'harris', l: 'Harris-Benedict', d: 'Versão revisada (Roza & Shizgal, 1984)' },
  { k: 'katch', l: 'Katch-McArdle', d: 'Pela massa magra · boa quando o % de gordura é confiável', lean: true },
  { k: 'cunningham', l: 'Cunningham', d: 'Pela massa magra · indicada para atletas e muito ativos', lean: true },
  { k: 'fao', l: 'FAO/OMS', d: 'Pelo peso e faixa de idade (1985)' },
];
export const ACTIVITY: { v: number; l: string; d: string }[] = [
  { v: 1.2, l: 'Sedentário', d: 'Pouco ou nenhum exercício' },
  { v: 1.375, l: 'Leve', d: 'Exercício 1 a 3 dias por semana' },
  { v: 1.55, l: 'Moderado', d: 'Exercício 3 a 5 dias por semana' },
  { v: 1.725, l: 'Intenso', d: 'Exercício 6 a 7 dias por semana' },
  { v: 1.9, l: 'Muito intenso', d: 'Treino 2× ao dia ou trabalho físico pesado' },
];
export const ADJUSTS = [-750, -500, -300, 0, 300, 500];
export const DEFAULT_ENERGY: EnergyCfg = { formula: 'auto', activity: 1.55, adjust: 0, protein: 1.8, fat: 0.8, share: false };
export const energyCfg = (c?: Partial<EnergyCfg> | null): EnergyCfg => ({ ...DEFAULT_ENERGY, ...(c ?? {}) });

export type EnergyIn = { sex: 'F' | 'M'; age: number | null; w: number | null; h: number | null; lean: number | null };
export function energyInputs(p: Person, a: Assess): EnergyIn {
  const r = calc(a, p) as Res;
  return { sex: p.sex === 'F' ? 'F' : 'M', age: ageAt(p.birth, a.date) as number | null, w: num(a.weight), h: num(a.height) ?? num(p.height), lean: r.leanMass ?? null };
}

/** metabolismo basal (kcal/dia) por fórmula; null quando faltam dados */
export function bmrBy(k: Exclude<FormulaKey, 'auto'>, x: EnergyIn): number | null {
  const { sex, age, w, h, lean } = x, M = sex === 'M';
  if (!w || w <= 0) return null;
  if (k === 'katch') return lean ? 370 + 21.6 * lean : null;
  if (k === 'cunningham') return lean ? 500 + 22 * lean : null;
  if (age == null) return null;
  if (k === 'fao') {
    const t = M ? [[3, 22.7, 495], [10, 17.5, 651], [18, 15.3, 679], [30, 11.6, 879], [60, 13.5, 487]] : [[3, 22.5, 499], [10, 12.2, 746], [18, 14.7, 496], [30, 8.7, 829], [60, 10.5, 596]];
    const row = [...t].reverse().find((r) => age >= r[0]!) ?? t[0]!;
    return row[1]! * w + row[2]!;
  }
  if (!h) return null;
  if (k === 'mifflin') return 10 * w + 6.25 * h - 5 * age + (M ? 5 : -161);
  return M ? 88.362 + 13.397 * w + 4.799 * h - 5.677 * age : 447.593 + 9.247 * w + 3.098 * h - 4.33 * age; // harris
}

export type Macro = { g: number; kcal: number; pct: number; gkg: number };
export type Energy = {
  formula: Exclude<FormulaKey, 'auto'>; label: string; fallback: boolean;
  bmr: number; activity: number; tdee: number; adjust: number; target: number;
  macros: { p: Macro; f: Macro; c: Macro };
  warn: string[];
  all: { k: Exclude<FormulaKey, 'auto'>; l: string; v: number | null }[];
};

export function energyOf(cfgIn: Partial<EnergyCfg> | null | undefined, x: EnergyIn): Energy | null {
  const cfg = energyCfg(cfgIn);
  const all = FORMULAS.filter((f) => f.k !== 'auto').map((f) => ({ k: f.k as Exclude<FormulaKey, 'auto'>, l: f.l, v: bmrBy(f.k as Exclude<FormulaKey, 'auto'>, x) }));
  const want: Exclude<FormulaKey, 'auto'> = cfg.formula === 'auto' ? (x.lean ? 'katch' : 'mifflin') : cfg.formula;
  let k = want, bmr = bmrBy(k, x), fallback = false;
  if (bmr == null && want !== 'mifflin') { k = 'mifflin'; bmr = bmrBy(k, x); fallback = cfg.formula !== 'auto'; }
  if (bmr == null) { const any = all.find((f) => f.v != null); if (!any) return null; k = any.k; bmr = any.v!; fallback = true; }
  const w = x.w ?? 0;
  const tdee = bmr * cfg.activity, target = Math.max(0, tdee + cfg.adjust);
  const warn: string[] = [];
  if (fallback) warn.push(`Sem massa magra nesta avaliação: o basal usa ${FORMULAS.find((f) => f.k === k)!.l}.`);
  const pg = cfg.protein * w, fg = cfg.fat * w;
  let cg = (target - pg * 4 - fg * 9) / 4;
  if (cg < 0) { warn.push('Proteína e gordura já passam da meta calórica: reduza uma delas.'); cg = 0; }
  if (target < bmr - 1) warn.push('A meta calórica fica abaixo do metabolismo basal.');
  const floor = x.sex === 'F' ? 1200 : 1500;
  if (target < floor) warn.push(`Abaixo do mínimo usual para ${x.sex === 'F' ? 'mulheres' : 'homens'} adultos (${floor.toLocaleString('pt-BR')} kcal).`);
  const tot = Math.max(1, pg * 4 + fg * 9 + cg * 4);
  const mk = (g: number, k9: number): Macro => ({ g, kcal: g * k9, pct: (g * k9) / tot, gkg: w ? g / w : 0 });
  return { formula: k, label: FORMULAS.find((f) => f.k === k)!.l, fallback, bmr, activity: cfg.activity, tdee, adjust: cfg.adjust, target, macros: { p: mk(pg, 4), f: mk(fg, 9), c: mk(cg, 4) }, warn, all };
}
export const activityLabel = (v: number) => ACTIVITY.find((a) => Math.abs(a.v - v) < 1e-6)?.l ?? 'Personalizado';
export const adjustLabel = (v: number) => (v === 0 ? 'Manter o peso' : v < 0 ? `Déficit de ${Math.abs(v)} kcal` : `Superávit de ${v} kcal`);
