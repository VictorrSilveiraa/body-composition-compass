import { esc, fmt, fmtDate, today } from './calculos.js';
import { GOAL_KINDS, activityLabel, type Energy, type GoalKind, type GoalStatus } from './plano';

/*
 * Cartões de META e de ENERGIA DIÁRIA — o mesmo HTML no app do nutricionista e no portal do paciente.
 * O app desenha com html-react-parser; no portal entra via parseHtml. Estilos: .gl-* e .en-* em styles.css.
 */
const S: Record<string, string> = {
  weight: '<rect x="3" y="3" width="18" height="18" rx="6"/><path d="M8 10a5 5 0 0 1 8 0"/><path d="M12 10l1.5-2"/>',
  bf: '<path d="M12 21a7 7 0 0 0 7-7c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-2 2-5 5-5 8a7 7 0 0 0 7 7z"/>',
  waist: '<path d="M4 16 16 4l4 4L8 20z"/><path d="M8 12l2 2M11 9l1.5 1.5M14 6l2 2"/>',
  lean: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  right: '<path d="M9 18l6-6-6-6"/>',
  flame: '<path d="M12 21a7 7 0 0 0 7-7c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-2 2-5 5-5 8a7 7 0 0 0 7 7z"/>',
};
export const plIcon = (n: string, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${S[n] ?? ''}</svg>`;
const dShort = (iso: string) => fmtDate(iso, { day: 'numeric', month: 'short' });
const dYear = (iso: string) => fmtDate(iso, { day: 'numeric', month: 'short', year: 'numeric' });
const monthOf = (iso: string) => fmtDate(iso, { month: 'long', year: 'numeric' });
const plural = (n: number, a: string, b: string) => `${n} ${n === 1 ? a : b}`;
export const kcal = (v: number) => Math.round(v).toLocaleString('pt-BR');
export const factor = (v: number) => String(v).replace('.', ',');

/** "Chegar a 72 kg", "Cintura de 80 cm"… */
export function goalTitle(k: GoalKind, to: number) {
  const v = fmt(to);
  return k === 'weight' ? `Chegar a ${v} kg` : k === 'bf' ? `Chegar a ${v}% de gordura` : k === 'waist' ? `Cintura de ${v} cm` : `${v} kg de massa magra`;
}
const amount = (k: GoalKind, v: number) => (k === 'bf' ? `${fmt(v)} pontos` : `${fmt(v)} ${GOAL_KINDS[k].u}`);

/** frase de situação da meta (o paciente lê em 2ª pessoa) */
export function goalLine(s: GoalStatus, mode: 'nutri' | 'patient') {
  const g = s.goal, you = mode === 'patient';
  if (s.done) return you ? `Meta alcançada em ${fmtDate(s.doneOn!, { day: 'numeric', month: 'long' })}. Parabéns!` : `Alcançada em ${dYear(s.doneOn!)}.`;
  const left = `Faltam <b>${amount(g.k, s.left)}</b>`;
  if (!s.curDate || s.curDate <= g.fromDate) return `${left}. ${you ? 'Seu progresso aparece a partir da próxima avaliação.' : 'O progresso aparece a partir da próxima avaliação.'}`;
  if (s.pace === 'away') return `${left}. ${you ? 'A última medida se afastou um pouco da meta: vamos retomar juntos!' : 'A última medida se afastou da meta.'}`;
  // previsão que já passou (a última avaliação é antiga e o ritmo era bom): a próxima avaliação deve mostrar a meta
  if (s.eta && s.eta <= today()) return `${left}. No ritmo atual, ${you ? 'você pode alcançar a meta' : 'a meta pode ser alcançada'} já na próxima avaliação.`;
  if (s.eta && s.pace === 'on') return `${left}. No ritmo atual, ${you ? 'você chega lá' : 'chega lá'} por volta de ${monthOf(s.eta)}${g.by ? ', dentro do prazo' : ''}.`;
  if (s.eta && s.pace === 'behind') return `${left}. No ritmo atual, a previsão é ${monthOf(s.eta)}, depois do prazo.`;
  return `${left}.`;
}

export function goalCardHtml(s: GoalStatus, o: { mode: 'nutri' | 'patient'; pid?: string; edit?: boolean; cls?: string }) {
  const g = s.goal, K = GOAL_KINDS[g.k], p = s.done ? 1 : s.pct, pct = Math.round(p * 100);
  const due = g.by ? (s.done ? '' : s.daysLeft! > 0 ? `${plural(s.daysLeft!, 'dia', 'dias')} até ${dShort(g.by)}` : s.daysLeft === 0 ? 'Prazo é hoje' : `Prazo era ${dShort(g.by)}`) : '';
  const late = !!g.by && !s.done && (s.daysLeft ?? 0) < 0;
  const acts = o.edit && o.pid ? `<div class="gl-acts">
      <button type="button" class="gl-a" data-act="glEdit" data-id="${o.pid}" data-g="${g.id}" aria-label="Editar meta">${plIcon('edit', 'sm')}</button>
      <button type="button" class="gl-a" data-act="glDel" data-id="${o.pid}" data-g="${g.id}" aria-label="Remover meta">${plIcon('trash', 'sm')}</button></div>` : '';
  return `<article class="card gl-card t-${K.tone}${s.done ? ' done' : ''}${o.cls ? ' ' + o.cls : ''}" data-key="gl-${g.id}-${s.done ? 1 : 0}" style="--p:${p.toFixed(4)}">
    <div class="gl-top">
      <span class="chip-ico">${plIcon(s.done ? 'check' : g.k)}</span>
      <span class="gl-h"><small>Meta · ${esc(K.l)}</small><b>${esc(goalTitle(g.k, g.to))}</b></span>
      ${s.done ? `<span class="gl-done">${plIcon('check', 'sm')}Alcançada</span>` : `<span class="gl-pct" aria-label="${pct}% do caminho"><b>${pct}</b>%</span>`}
    </div>
    <div class="gl-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Progresso da meta">
      <div class="gl-bar"><i></i></div>
      <span class="gl-knob"><em>${fmt(s.cur)}<small>${esc(K.u)}</small></em></span>
    </div>
    <div class="gl-ends"><span><small>Início · ${dShort(g.fromDate)}</small>${fmt(g.from)} ${esc(K.u)}</span><span><small>Meta${g.by ? ' · ' + dShort(g.by) : ''}</small>${fmt(g.to)} ${esc(K.u)}</span></div>
    <p class="gl-msg">${goalLine(s, o.mode)}</p>
    ${due || acts ? `<div class="gl-foot">${due ? `<span class="gl-due${late ? ' late' : ''}">${plIcon('clock', 'sm')}${due}</span>` : '<span></span>'}${acts}</div>` : ''}
  </article>`;
}

/* ---------- energia diária ---------- */
export const MACRO_COLOR = { p: 'var(--peach)', f: 'var(--yellow-2)', c: 'var(--blue-2)' };
export const MACRO_LABEL = { p: 'Proteínas', f: 'Gorduras', c: 'Carboidratos' };
export function macroBarHtml(e: Energy, big = false) {
  const m = e.macros, keys = ['p', 'f', 'c'] as const;
  return `<div class="en-mbar${big ? ' big' : ''}">${keys.map((k, i) => `<span style="--w:${(m[k].pct * 100).toFixed(2)}%;--c:${MACRO_COLOR[k]};--i:${i}"></span>`).join('')}</div>
  <div class="en-mleg">${keys.map((k) => `<span><i style="background:${MACRO_COLOR[k]}"></i><b>${Math.round(m[k].g)} g</b><small>${MACRO_LABEL[k]} · ${Math.round(m[k].pct * 100)}%</small></span>`).join('')}</div>`;
}

export function energyCardHtml(e: Energy, o: { mode: 'nutri' | 'patient'; pid?: string; date?: string; nutri?: string }) {
  if (o.mode === 'patient') return `<article class="card en-card en-pt">
    <div class="card-head"><span class="chip-ico">${plIcon('flame', 'sm')}</span><span class="label"><b>Sua energia do dia</b><br><span class="small muted">Calculada por ${esc(o.nutri || 'seu nutricionista')}${o.date ? ` na avaliação de ${dShort(o.date)}` : ''}</span></span></div>
    <div class="en-goal"><b>${kcal(e.target)}</b><span>kcal por dia</span></div>
    ${macroBarHtml(e)}
    <p class="small muted en-note">Seu corpo gasta cerca de ${kcal(e.tdee)} kcal por dia. Siga o plano alimentar: ele já respeita estes números.</p>
  </article>`;
  return `<article class="card en-card"${o.pid ? ` data-act="go" data-to="energy" data-id="${o.pid}"` : ''}>
    <div class="card-head"><span class="chip-ico">${plIcon('flame', 'sm')}</span><span class="label"><b>Energia diária</b><br><span class="small muted">${esc(e.label)} · ${esc(activityLabel(e.activity))} ×${factor(e.activity)}</span></span>${o.pid ? `<span class="right" style="margin-left:auto">${plIcon('right')}</span>` : ''}</div>
    <div class="en-flow">
      <div><small>Basal</small><b>${kcal(e.bmr)}</b></div>
      <i aria-hidden="true">${plIcon('right', 'sm')}</i>
      <div><small>Gasto total</small><b>${kcal(e.tdee)}</b></div>
      <i aria-hidden="true">${plIcon('right', 'sm')}</i>
      <div class="on"><small>Meta${e.adjust ? ` (${e.adjust > 0 ? '+' : '−'}${Math.abs(e.adjust)})` : ''}</small><b>${kcal(e.target)}</b></div>
    </div>
    ${macroBarHtml(e)}
  </article>`;
}
