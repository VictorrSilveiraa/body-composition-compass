import { esc, fmt, fmtDate, today } from './calculos.js';
import { GOAL_KINDS, activityLabel, type Energy, type GoalHist, type GoalKind, type GoalStatus } from './plano';

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
const MON = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
/** "dez/26" */
const monYY = (iso: string) => `${MON[Number(iso.slice(5, 7)) - 1]}/${iso.slice(2, 4)}`;
const plural = (n: number, a: string, b: string) => `${n} ${n === 1 ? a : b}`;
export const kcal = (v: number) => Math.round(v).toLocaleString('pt-BR');
export const factor = (v: number) => String(v).replace('.', ',');

/** "Chegar a 72 kg", "Cintura de 80 cm"… */
export function goalTitle(k: GoalKind, to: number) {
  const v = fmt(to);
  return k === 'weight' ? `Chegar a ${v} kg` : k === 'bf' ? `Chegar a ${v}% de gordura` : k === 'waist' ? `Cintura de ${v} cm` : `${v} kg de massa magra`;
}
const amount = (k: GoalKind, v: number) => (k === 'bf' ? `${fmt(v)} pontos` : `${fmt(v)} ${GOAL_KINDS[k].u}`);

/** situação de uma meta em uma linha curta (o paciente lê em 2ª pessoa) */
export function goalShort(s: GoalStatus, mode: 'nutri' | 'patient', asOf?: string) {
  const g = s.goal, you = mode === 'patient';
  if (s.done) return `Alcançada em ${dShort(s.doneOn!)}${you ? ' — parabéns!' : ''}`;
  const left = `Faltam <b>${amount(g.k, s.left)}</b>`;
  if (asOf) return `${left} nesta data`; // visão de uma avaliação passada: sem previsões
  if (!s.curDate || s.curDate <= g.fromDate) return `${left} · conta a partir da próxima avaliação`;
  if (s.pace === 'away') return `${left} · ${you ? 'afastou um pouco, bora retomar' : 'afastou-se na última avaliação'}`;
  // previsão que já passou (a última avaliação é antiga e o ritmo era bom): deve aparecer na próxima avaliação
  if (s.eta && s.eta <= today()) return `${left} · ${you ? 'quase lá!' : 'quase lá'}`;
  if (s.eta && s.pace === 'on') return `${left} · previsão ${monYY(s.eta)}${g.by ? ', no prazo' : ''}`;
  if (s.eta && s.pace === 'behind') return `${left} · previsão ${monYY(s.eta)}, após o prazo`;
  return `${left}`;
}

/** prazo comum das metas (quando todas têm o mesmo) e a data em que foram definidas */
function boardSub(list: GoalStatus[], now = today()) {
  const bys = [...new Set(list.map((s) => s.goal.by || ''))], since = list.map((s) => s.goal.fromDate).sort()[0]!;
  const open = list.some((s) => !s.done);
  if (bys.length === 1 && bys[0]) {
    const by = bys[0], d = Math.round((new Date(by + 'T12:00').getTime() - new Date(now + 'T12:00').getTime()) / 864e5);
    return { by, txt: `Prazo ${dYear(by)}${open ? (d > 0 ? ` · faltam ${plural(d, 'dia', 'dias')}` : d === 0 ? ' · é hoje' : ' · prazo encerrado') : ''}`, late: open && d < 0 };
  }
  return { by: null, txt: `Desde ${dYear(since)}${bys.some(Boolean) ? ' · prazos diferentes' : ' · sem prazo'}`, late: false };
}

/**
 * QUADRO DE METAS: todas as metas do paciente num cartão só — uma linha por medida
 * (celular: uma coluna, compacta; telas largas: duas colunas).
 */
export function goalsBoardHtml(list: GoalStatus[], o: { mode: 'nutri' | 'patient'; title?: string; pid?: string; edit?: boolean; cls?: string; history?: GoalHist[]; asOf?: string }) {
  if (!list.length) return '';
  const done = list.filter((s) => s.done).length, sub = boardSub(list, o.asOf);
  const avg = Math.round((list.reduce((t, s) => t + (s.done ? 1 : s.pct), 0) / list.length) * 100);
  const rows = list.map((s, i) => {
    const g = s.goal, K = GOAL_KINDS[g.k], p = s.done ? 1 : s.pct, pct = Math.round(p * 100);
    return `<div class="gl-row t-${K.tone}${s.done ? ' done' : ''}" style="--p:${p.toFixed(4)};--i:${i}" role="group" aria-label="Meta de ${esc(K.l)}: ${pct}%">
      <span class="gl-r-ico">${plIcon(s.done ? 'check' : g.k)}</span>
      <div class="gl-r-main">
        <div class="gl-r-top"><b>${esc(K.l)}</b>${s.done ? `<em class="gl-r-pct ok">${plIcon('check', 'sm')}</em>` : `<em class="gl-r-pct">${pct}%</em>`}<span class="gl-r-v"><span title="Valor de ${s.curDate ? dShort(s.curDate) : 'início'}">${fmt(s.cur)}</span><i aria-hidden="true">→</i><strong>${fmt(g.to)}</strong><small>${esc(K.u)}</small></span></div>
        <div class="gl-r-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i></i></div>
        <small class="gl-r-msg">${goalShort(s, o.mode, o.asOf)}</small>
      </div>
    </div>`;
  }).join('');
  const wins = (o.history ?? []).filter((h) => h.done).slice(-4).reverse();
  const title = o.title ?? (o.mode === 'patient' ? 'Suas metas' : 'Metas');
  return `<article class="card gl-board${o.cls ? ' ' + o.cls : ''}" data-key="gl-board-${list.map((s) => s.goal.id + (s.done ? 1 : 0)).join('')}">
    <div class="gl-b-head">
      <span class="gl-b-ring" style="--gp:${(avg / 100).toFixed(3)}" aria-hidden="true"><b>${done === list.length ? plIcon('check', 'sm') : `${avg}<small>%</small>`}</b></span>
      <span class="gl-b-tt"><b>${esc(title)}</b><small class="${sub.late ? 'late' : ''}">${esc(sub.txt)}</small></span>
      <span class="gl-b-sum">${done ? `${done} de ${list.length} ${done === 1 ? 'alcançada' : 'alcançadas'}` : plural(list.length, 'meta', 'metas')}</span>
      ${o.edit && o.pid ? `<button type="button" class="gl-b-edit" data-act="glEdit" data-id="${o.pid}" aria-label="Editar metas">${plIcon('edit', 'sm')}<span>Editar</span></button>` : ''}
    </div>
    <div class="gl-rows">${rows}</div>
    ${wins.length ? `<div class="gl-wins"><small>${o.mode === 'patient' ? 'Suas conquistas' : 'Conquistas anteriores'}</small>${wins.map((h) => `<span class="gl-win">${plIcon('check', 'sm')}${esc(GOAL_KINDS[h.k].l)} ${fmt(h.to)} ${esc(GOAL_KINDS[h.k].u)}<em>${monYY(h.endedAt)}</em></span>`).join('')}</div>` : ''}
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
