import { esc, fmtDate } from './calculos.js';
import {
  CAT_LABEL, currentMeal, dietStats, fmtAmount, foodCat, mealKind, minutesOf, normTxt, qtyParts, shoppingList,
  type Diet, type DietFood, type DietMeal, type DietSub, type FoodCat, type MealKind,
} from './diet-parse';

/*
 * Tela do plano alimentar — a MESMA para o nutricionista (dentro do app) e para o paciente (portal).
 * Devolve HTML (o app desenha com html-react-parser); os cliques vêm como data-act="dt…"
 * e cada lado guarda o estado da tela (aba, opção escolhida, trocas abertas, itens comprados).
 */
export type DietUi = { tab: 'meals' | 'shop' | 'recipes' | 'info'; opt: Record<string, number>; open: Record<string, boolean>; checked: Record<string, boolean>; help?: boolean };
export const newDietUi = (): DietUi => ({ tab: 'meals', opt: {}, open: {}, checked: {} });
export type DietViewOpts = { mode: 'nutri' | 'patient'; nowMin?: number; sub?: string; chips?: string; foot?: string };

const P: Record<string, string> = {
  cafe: '<path d="M4 9h13v4.5A5.5 5.5 0 0 1 11.5 19h-2A5.5 5.5 0 0 1 4 13.5z"/><path d="M17 10.5h1.2a2.6 2.6 0 0 1 0 5.2H16.6"/><path d="M8.5 2.8c-.8.9.8 1.7 0 3M12.5 2.8c-.8.9.8 1.7 0 3"/>',
  almoco: '<circle cx="13" cy="12.5" r="6.5"/><circle cx="13" cy="12.5" r="3"/><path d="M3.5 3.5v5.2a1.8 1.8 0 0 0 1.8 1.8v10M5.3 3.5v4.4M7 3.5v5.2a1.8 1.8 0 0 1-1.7 1.8"/>',
  lanche: '<path d="M12 7.5c-1.6-1.3-4.8-1.8-6.3.9-1.6 2.9-.6 7.6 2.2 10.4 1.4 1.3 2.8 1 4.1.4 1.3.6 2.7.9 4.1-.4 2.8-2.8 3.8-7.5 2.2-10.4-1.5-2.7-4.7-2.2-6.3-.9z"/><path d="M12 7.5c0-2 .9-3.5 2.9-4.2"/>',
  jantar: '<path d="M20 14.6A8.2 8.2 0 1 1 9.4 4a6.6 6.6 0 0 0 10.6 10.6z"/>',
  ceia: '<path d="M18 15.6A7.4 7.4 0 1 1 8.4 6a6 6 0 0 0 9.6 9.6z"/><path d="M17 3.2l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z"/>',
  treino: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  outra: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  swap: '<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
  chev: '<path d="m6.5 9.5 5.5 5.5 5.5-5.5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  leaf: '<path d="M12 6.528V3a1 1 0 0 1 1-1h0"/><path d="M18.237 21A15 15 0 0 0 22 11a6 6 0 0 0-10-4.472A6 6 0 0 0 2 11a15.1 15.1 0 0 0 3.763 10 3 3 0 0 0 3.648.648 5.5 5.5 0 0 1 5.178 0A3 3 0 0 0 18.237 21"/>',
  chat: '<path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z"/><path d="M9 10h6M9 13.5h4"/>',
  cart: '<path d="M3 4h2.4l2.2 10.6a1.6 1.6 0 0 0 1.6 1.3h7.6a1.6 1.6 0 0 0 1.6-1.2L20.5 8H6.4"/><circle cx="9.5" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M8 7.5h8M8 11h5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.6" r=".9" fill="currentColor"/>',
  pot: '<path d="M4 10h16v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M2.5 10h19M9 6.5c0-1 .7-1.8 1.4-2.3M13.5 6.5c0-1 .7-1.8 1.4-2.3"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
};
export const dtIcon = (n: string, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[n] ?? ''}</svg>`;

export const KIND_COLOR: Record<MealKind, string> = { cafe: 'var(--yellow-2)', almoco: 'var(--green-2)', lanche: 'var(--peach)', jantar: 'var(--blue-2)', ceia: 'oklch(0.82 0.06 285)', treino: 'var(--pink)', outra: 'var(--card-2)' };
export const CAT_COLOR: Record<FoodCat, string> = {
  carbo: 'oklch(0.86 0.12 85)', prot: 'oklch(0.76 0.11 40)', leite: 'oklch(0.84 0.06 230)', fruta: 'oklch(0.78 0.12 15)', veg: 'oklch(0.8 0.13 135)',
  gord: 'oklch(0.83 0.1 110)', legum: 'oklch(0.7 0.08 60)', doce: 'oklch(0.8 0.09 350)', bebida: 'oklch(0.85 0.05 200)', supl: 'oklch(0.78 0.07 290)', outro: 'oklch(0.85 0.01 106)',
};
const plural = (n: number, a: string, b: string) => `${n} ${n === 1 ? a : b}`;
const dLong = (iso: string) => fmtDate(iso, { day: 'numeric', month: 'long', year: 'numeric' });

export function variantOf(m: DietMeal, ui: DietUi) { const i = Math.min(ui.opt[m.id] ?? 0, m.variants.length - 1); return { v: m.variants[i]!, i }; }
function gramsOf(foods: DietFood[]) { let g = 0, ml = 0; for (const f of foods) { const q = qtyParts(f.qty); if (q.unit === 'g') g += q.amount ?? 0; if (q.unit === 'ml') ml += q.amount ?? 0; } return [g ? `${Math.round(g)} g` : '', ml ? `${Math.round(ml)} ml` : ''].filter(Boolean).join(' + '); }
function qtyHtml(qty: string) {
  const q = qtyParts(qty), amt = fmtAmount(q);
  if (!q.measure && !amt) return '';
  return q.measure ? `<b>${esc(q.measure)}</b>${amt ? `<small>${esc(amt)}</small>` : ''}` : `<b>${esc(amt)}</b>`;
}
const subLine = (s: DietSub) => { const q = qtyParts(s.qty), amt = fmtAmount(q); return `<span class="dt-alt" style="--cc:${CAT_COLOR[foodCat(s.name)]}"><i></i><b>${esc(s.name)}</b>${s.detail ? `<em>${esc(s.detail)}</em>` : ''}${q.measure || amt ? `<span>${esc([q.measure, amt].filter(Boolean).join(' · '))}</span>` : ''}</span>`; };

/* ---------- relógio do dia: cada refeição no seu horário ---------- */
/* a faixa branca "se desenha" do primeiro ao último horário; as bolinhas aparecem quando a faixa chega nelas.
   CK_DRAW precisa bater com a animação .dt-ck-span (dtCkDraw) do styles.css */
const CK_DRAW = { delay: 0.3, dur: 1.4, ease: [0.45, 0.05, 0.25, 1] as const };
/** em que fração do tempo a curva de animação chega na fração `f` do caminho */
function easeTime(f: number, [x1, y1, x2, y2]: readonly [number, number, number, number]) {
  const b = (p1: number, p2: number, s: number) => 3 * p1 * s * (1 - s) ** 2 + 3 * p2 * s * s * (1 - s) + s ** 3;
  let lo = 0, hi = 1;
  for (let k = 0; k < 22; k++) { const s = (lo + hi) / 2; if (b(y1, y2, s) < f) lo = s; else hi = s; }
  return b(x1, x2, (lo + hi) / 2);
}
export function dayClock(d: Diet, nowMin: number | undefined, size = 220) {
  const c = size / 2, r = size / 2 - 18, f1 = (n: number) => n.toFixed(1);
  const pos = (min: number, rr = r) => { const a = (min / 1440) * 2 * Math.PI - Math.PI / 2; return [c + rr * Math.cos(a), c + rr * Math.sin(a)] as const; };
  const arc = (a0: number, a1: number, rr: number) => { const [x0, y0] = pos(a0, rr), [x1, y1] = pos(a1, rr); return `M${f1(x0)},${f1(y0)} A${rr},${rr} 0 ${a1 - a0 > 720 ? 1 : 0} 1 ${f1(x1)},${f1(y1)}`; };
  // refeições com horário, em ordem (o plano pode vir fora de ordem)
  const timed = d.meals.map((m) => ({ m, t: minutesOf(m.time) })).filter((x): x is { m: DietMeal; t: number } => x.t != null).sort((a, b) => a.t - b.t);
  // trecho do dia = o círculo inteiro menos a maior pausa entre duas refeições (a noite) — assim uma ceia depois da meia-noite não quebra a faixa
  let start = timed[0]?.t ?? 0, len = 0;
  if (timed.length > 1) {
    let gap = timed[0]!.t + 1440 - timed.at(-1)!.t, after = 0;
    for (let i = 1; i < timed.length; i++) { const g = timed[i]!.t - timed[i - 1]!.t; if (g > gap) { gap = g; after = i; } }
    start = timed[after]!.t; len = 1440 - gap;
  }
  const spanPx = (len / 1440) * 2 * Math.PI * r;
  const span = len > 0 ? `<path d="${arc(start, start + len, r)}" class="dt-ck-span" style="--len:${f1(spanPx)};--off:${f1(spanPx + 24)}"/>` : '';
  const ticks = Array.from({ length: 24 }, (_, h) => { const [x0, y0] = pos(h * 60, r - 13), [x1, y1] = pos(h * 60, r - (h % 6 ? 9 : 5)); return `<line x1="${f1(x0)}" y1="${f1(y0)}" x2="${f1(x1)}" y2="${f1(y1)}" class="${h % 6 ? '' : 'big'}"/>`; }).join('');
  const labels = [0, 6, 12, 18].map((h) => { const [x, y] = pos(h * 60, r - 25); return `<text x="${f1(x)}" y="${f1(y + 3.5)}" text-anchor="middle">${String(h).padStart(2, '0')}h</text>`; }).join('');
  // lua no meio da noite (22h–6h), para a faixa escura não parecer uma barra de carregamento
  const [mx, my] = pos(2 * 60);
  const moon = `<g class="dt-ck-moon" transform="translate(${f1(mx - 5.5)},${f1(my - 5.5)}) scale(.46)">${P['jantar']}</g>`;
  const cur = nowMin != null ? currentMeal(d, nowMin) : null;
  const dots = timed
    .map(({ m, t }) => {
      const [x, y] = pos(t), k = mealKind(m.name, m.time), on = cur?.meal.id === m.id;
      const frac = len > 0 ? ((t - start + 1440) % 1440) / len : 0;
      const dl = Math.max(0.2, CK_DRAW.delay + CK_DRAW.dur * easeTime(Math.min(1, frac), CK_DRAW.ease) - 0.1);
      const at = `cx="${f1(x)}" cy="${f1(y)}"`;
      return { on, html: `<g class="dt-ck-dot${on ? ' on' : ''}" style="--dl:${dl.toFixed(2)}s"><title>${esc(`${m.time} · ${m.name}`)}</title>${on ? `<circle ${at} r="11" fill="${KIND_COLOR[k]}" class="dt-ck-ping"/>` : ''}<circle ${at} r="${on ? 11 : 8}" fill="${KIND_COLOR[k]}" class="dt-ck-face"/><circle ${at} r="${on ? 4 : 3}" fill="var(--ink)"/></g>` };
    })
    .sort((a, b) => Number(a.on) - Number(b.on)) // a refeição em destaque fica por cima das vizinhas
    .map((x) => x.html).join('');
  // "agora": marcador sobre o anel (o ponteiro antigo ficava escondido atrás do centro); gira desde 00h até a hora atual
  const now = nowMin != null ? `<g class="dt-ck-now" style="--rot:${f1((nowMin / 1440) * 360)}deg;transform-origin:${c}px ${c}px"><title>Agora</title><line x1="${c}" y1="${c - r - 12}" x2="${c}" y2="${c - r + 12}" class="halo"/><line x1="${c}" y1="${c - r - 12}" x2="${c}" y2="${c - r + 12}"/><circle cx="${c}" cy="${c - r - 14}" r="3.4"/></g>` : '';
  const label = timed.length ? `Horários das refeições: ${timed.map(({ m }) => `${m.time} ${m.name}`).join(', ')}` : 'Horários das refeições ao longo do dia';
  return `<svg class="dt-ck-svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(label)}"><circle cx="${c}" cy="${c}" r="${r}" class="dt-ck-track"/><circle cx="${c}" cy="${c}" r="${r}" class="dt-ck-ring"/><path d="${arc(22 * 60, 30 * 60, r)}" class="dt-ck-night"/>${moon}${span}<g class="dt-ck-ticks">${ticks}</g><g class="dt-ck-lbl">${labels}</g>${now}${dots}</svg>`;
}

/* ---------- uma refeição ---------- */
function mealHtml(m: DietMeal, ui: DietUi, idx: number, state: 'now' | 'next' | '', opts: DietViewOpts) {
  const k = mealKind(m.name, m.time), { v, i: vi } = variantOf(m, ui);
  const g = gramsOf(v.foods);
  const opt = m.variants.length > 1 ? `<div class="dt-opts" role="tablist" aria-label="Opções de ${esc(m.name)}">${m.variants.map((x, i) => `<button type="button" role="tab" aria-selected="${i === vi}" class="${i === vi ? 'on' : ''}" data-act="dtOpt" data-m="${m.id}" data-i="${i}">${esc(x.label || `Opção ${i + 1}`)}</button>`).join('')}</div>` : '';
  const foods = v.foods.map((f) => {
    const cat = foodCat(f.name), open = !!ui.open[f.id];
    return `<li class="dt-food" style="--cc:${CAT_COLOR[cat]}">
      <span class="dt-dot" title="${esc(CAT_LABEL[cat])}"></span>
      <div class="dt-fname"><b>${esc(f.name)}</b>${f.detail ? `<small>${esc(f.detail)}</small>` : ''}</div>
      <div class="dt-q">${qtyHtml(f.qty)}</div>
      ${f.subs.length ? `<button type="button" class="dt-swap${open ? ' on' : ''}" data-act="dtSubs" data-f="${f.id}" aria-expanded="${open}">${dtIcon('swap', 'sm')}<span>${f.subs.length === 1 ? '1 troca' : `${f.subs.length} trocas`}</span>${dtIcon('chev', 'sm dt-chev')}</button>
      ${open ? `<div class="dt-subs" data-key="subs-${f.id}"><span class="dt-subs-h">Pode trocar ${esc(f.name.toLowerCase())} por</span>${f.subs.map(subLine).join('<span class="dt-or">ou</span>')}</div>` : ''}` : ''}
    </li>`;
  }).join('');
  const badge = state === 'now' ? `<span class="dt-badge now">${opts.mode === 'patient' ? 'Hora de comer' : 'Agora'}</span>` : state === 'next' ? '<span class="dt-badge">Próxima</span>' : '';
  return `<li class="dt-meal ${state}" style="--mc:${KIND_COLOR[k]};--i:${idx}" id="ref-${m.id}">
    <div class="dt-when"><b>${esc(m.time ?? '—')}</b>${badge}</div>
    <div class="dt-mcard">
      <div class="dt-when-in"><b>${dtIcon('outra', 'sm')}${esc(m.time ?? 'Sem horário')}</b>${badge}</div>
      <div class="dt-mhead"><span class="dt-mico">${dtIcon(k)}</span><div class="grow"><h3>${esc(m.name)}</h3><small>${plural(v.foods.length, 'alimento', 'alimentos')}${g ? ` · ${g}` : ''}${m.variants.length > 1 ? ` · ${m.variants.length} opções` : ''}</small></div></div>
      ${opt}
      <ul class="dt-foods" data-key="v-${v.id}">${foods || '<li class="dt-empty small muted">Sem alimentos nesta opção.</li>'}</ul>
      ${v.notes ? `<div class="dt-note">${dtIcon('chat', 'sm')}<p>${esc(v.notes).replace(/\n/g, '<br>')}</p></div>` : ''}
    </div>
  </li>`;
}

/* ---------- abas ---------- */
function shopHtml(d: Diet, ui: DietUi) {
  const items = shoppingList(d);
  if (!items.length) return '<div class="card empty"><h3>Sem lista de compras</h3><p>Este plano não tem itens para a lista.</p></div>';
  const groups = new Map<FoodCat, string[]>();
  for (const it of items) { const c = foodCat(it); groups.set(c, [...(groups.get(c) ?? []), it]); }
  const done = items.filter((x) => ui.checked[normTxt(x)]).length, pct = Math.round((done / items.length) * 100);
  const order = Object.keys(CAT_LABEL) as FoodCat[];
  return `<div class="card dt-shop-head"><div class="grow"><b>${done === items.length ? 'Tudo comprado!' : `${done} de ${items.length} itens`}</b><small>${d.shopping.length ? 'Lista do seu plano' : 'Montada com os alimentos e as trocas do plano'} · toque para marcar</small></div>
    ${done ? '<button type="button" class="tag" data-act="dtClear">Desmarcar</button>' : ''}
    <div class="dt-prog"><span style="width:${pct}%"></span></div></div>
  <div class="dt-shop">${order.filter((c) => groups.has(c)).map((c) => `<section class="dt-shop-g" style="--cc:${CAT_COLOR[c]}"><h4><i></i>${CAT_LABEL[c]}<span>${groups.get(c)!.length}</span></h4>
    ${groups.get(c)!.map((it) => { const on = !!ui.checked[normTxt(it)]; return `<button type="button" class="dt-check${on ? ' on' : ''}" data-act="dtCheck" data-k="${esc(normTxt(it))}" aria-pressed="${on}"><span class="dt-box">${dtIcon('check', 'sm')}</span><span class="grow">${esc(it)}</span></button>`; }).join('')}</section>`).join('')}</div>`;
}
function recipesHtml(d: Diet) {
  if (!d.recipes.length) return '<div class="card empty"><h3>Sem receitas</h3><p>Este plano não traz receitas.</p></div>';
  return `<div class="dt-recipes">${d.recipes.map((r) => `<article class="card dt-recipe">
    <div class="card-head"><span class="chip-ico">${dtIcon('pot', 'sm')}</span><span class="label"><b>${esc(r.name)}</b>${r.yield ? `<br><span class="small muted">Rende ${esc(r.yield)}</span>` : ''}</span></div>
    ${r.ingredients.length ? `<h4>Ingredientes</h4><ul class="dt-ing">${r.ingredients.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    ${r.steps.length ? `<h4>Modo de preparo</h4><ol class="dt-steps">${r.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
  </article>`).join('')}</div>`;
}
function infoHtml(d: Diet) {
  const parts = [];
  if (d.notes.trim()) parts.push(`<article class="card yellow dt-info"><div class="card-head"><span class="chip-ico">${dtIcon('chat', 'sm')}</span><span class="label"><b>Orientações do nutricionista</b></span></div><p>${esc(d.notes).replace(/\n/g, '<br>')}</p></article>`);
  for (const s of d.sections) parts.push(`<article class="card dt-info"><div class="card-head"><span class="chip-ico">${dtIcon('info', 'sm')}</span><span class="label"><b>${esc(s.title)}</b></span></div>${s.lines.map((l) => `<p>${esc(l)}</p>`).join('')}</article>`);
  return parts.join('') || '<div class="card empty"><h3>Sem orientações extras</h3></div>';
}
export const hasInfo = (d: Diet) => !!(d.notes.trim() || d.sections.length);

/* ---------- tela completa ---------- */
export function dietHtml(d: Diet, ui: DietUi, opts: DietViewOpts) {
  const s = dietStats(d), nowMin = opts.nowMin, cur = nowMin != null ? currentMeal(d, nowMin) : null;
  const totalCats = Object.values(s.cats).reduce((a, b) => a + (b ?? 0), 0);
  const cats = (Object.entries(s.cats) as [FoodCat, number][]).sort((a, b) => b[1] - a[1]);
  const tabs: [DietUi['tab'], string, string, number | null][] = [
    ['meals', 'Refeições', 'almoco', s.meals],
    ...(d.hideShopping ? [] : [['shop', 'Compras', 'cart', shoppingList(d).length || null] as [DietUi['tab'], string, string, number | null]]),
    ...(d.recipes.length ? [['recipes', 'Receitas', 'pot', d.recipes.length] as [DietUi['tab'], string, string, number]] : []),
    ...(hasInfo(d) ? [['info', 'Orientações', 'info', null] as [DietUi['tab'], string, string, null]] : []),
  ];
  const tab = tabs.some((t) => t[0] === ui.tab) ? ui.tab : 'meals';
  const center = cur ? `<small>${cur.state === 'now' ? 'Agora' : 'Próxima'}</small><b>${esc(cur.meal.time ?? '')}</b><span>${esc(cur.meal.name)}</span>` : `<small>Refeições</small><b>${s.meals}</b><span>no dia</span>`;
  const help = opts.mode === 'patient' ? `<details class="card dt-help"${ui.help ? ' open' : ''}><summary><span class="chip-ico">${dtIcon('spark', 'sm')}</span><span class="grow"><b>Como usar seu plano</b><small>Cores, trocas e opções em 20 segundos</small></span>${dtIcon('chev', 'sm dt-chev')}</summary>
    <ul class="dt-help-list">
      <li><span class="dt-help-ic"><i class="dt-legend-dot" style="--cc:${CAT_COLOR.prot}"></i></span><span>A <b>bolinha colorida</b> mostra o grupo do alimento (proteína, carboidrato, fruta…).</span></li>
      <li><span class="dt-help-ic blue">${dtIcon('swap', 'sm')}</span><span>Em <b>trocas</b> estão alimentos equivalentes: escolha um deles, na quantidade indicada.</span></li>
      <li><span class="dt-help-ic yellow"><b>1</b></span><span>Quando a refeição tem <b>opções</b>, escolha uma delas para o dia — não some as duas.</span></li>
      <li><span class="dt-help-ic green">${dtIcon('cart', 'sm')}</span><span>A aba <b>Compras</b> vira sua lista do mercado: toque para marcar.</span></li>
    </ul></details>` : '';
  const body = tab === 'meals'
    ? `${help}<ol class="dt-tl">${d.meals.map((m, i) => mealHtml(m, ui, i, cur?.meal.id === m.id ? cur.state : '', opts)).join('')}</ol>${!d.meals.length ? '<div class="card empty"><h3>Nenhuma refeição</h3><p>Edite o plano para adicionar as refeições.</p></div>' : ''}`
    : tab === 'shop' ? shopHtml(d, ui) : tab === 'recipes' ? recipesHtml(d) : infoHtml(d);
  return `<div class="dt" data-mode="${opts.mode}">
  <div class="dt-layout">
  <aside class="dt-side">
    <div class="card dt-hero">
      <span class="dt-blob"></span><span class="dt-blob b2"></span>
      <div class="dt-hero-txt">
        <span class="tag">${dtIcon('leaf', 'sm')}Plano alimentar</span>
        <h1>${esc(d.title || 'Plano alimentar')}</h1>
        <p class="small">${[d.prescribedAt ? `Prescrito em ${dLong(d.prescribedAt)}` : '', d.prescriber ? `por ${esc(d.prescriber)}` : ''].filter(Boolean).join(' · ') || esc(opts.sub ?? '')}</p>
        ${opts.chips ? `<div class="dt-chips">${opts.chips}</div>` : ''}
      </div>
      <div class="dt-clock">${dayClock(d, nowMin)}<div class="dt-ck-center">${center}</div></div>
    </div>
    <div class="dt-stats">
      <div class="stat"><small>Refeições</small><b>${s.meals}</b></div>
      <div class="stat"><small>Alimentos</small><b>${s.foods}</b></div>
      <div class="stat"><small>Trocas</small><b>${s.subs}</b></div>
      <div class="stat"><small>Opções</small><b>${s.options}</b></div>
    </div>
    ${totalCats ? `<div class="card dt-bal"><div class="card-head"><span class="label"><b>Grupos no seu dia</b><br><span class="small muted">Alimentos da opção principal de cada refeição</span></span></div>
      <div class="combar dt-combar">${cats.map(([c, n]) => `<span style="width:${((n / totalCats) * 100).toFixed(1)}%;background:${CAT_COLOR[c]}" title="${CAT_LABEL[c]}: ${n}"></span>`).join('')}</div>
      <div class="dt-legend">${cats.map(([c, n]) => `<span><i style="background:${CAT_COLOR[c]}"></i>${CAT_LABEL[c]}<b>${n}</b></span>`).join('')}</div></div>` : ''}
    ${opts.foot ? `<div class="dt-foot-a">${opts.foot}</div>` : ''}
  </aside>
  <div class="dt-main">
    <div class="seg dt-tabs" role="tablist">${tabs.map(([k, l, ico, n]) => `<button type="button" role="tab" aria-selected="${k === tab}" class="${k === tab ? 'on' : ''}" data-act="dtTab" data-v="${k}">${dtIcon(ico, 'sm')}<span>${l}</span>${n != null ? `<em>${n}</em>` : ''}</button>`).join('')}</div>
    <div class="dt-body" data-key="tab-${tab}">${body}</div>
    ${opts.foot ? `<div class="dt-foot-b">${opts.foot}</div>` : ''}
  </div>
  </div></div>`;
}

/** cartão compacto (ficha do paciente, detalhe da avaliação, início do portal) */
export function dietMini(d: Diet, nowMin?: number) {
  const s = dietStats(d), cur = nowMin != null ? currentMeal(d, nowMin) : null;
  const strip = d.meals.filter((m) => m.time).map((m) => `<span class="dt-strip-i${cur?.meal.id === m.id ? ' on' : ''}" style="--mc:${KIND_COLOR[mealKind(m.name, m.time)]}"><i>${dtIcon(mealKind(m.name, m.time), 'sm')}</i><b>${esc(m.time!)}</b><small>${esc(m.name)}</small></span>`).join('');
  return { stats: s, cur, strip };
}

/** aplica um clique (data-act="dt…") no estado da tela; devolve true se algo mudou */
export function dietAct(ui: DietUi, el: { dataset: DOMStringMap }): boolean {
  const a = el.dataset['act'];
  if (a === 'dtTab') { ui.tab = (el.dataset['v'] as DietUi['tab']) ?? 'meals'; return true; }
  if (a === 'dtOpt') { ui.opt[el.dataset['m']!] = Number(el.dataset['i']); return true; }
  if (a === 'dtSubs') { const f = el.dataset['f']!; ui.open[f] = !ui.open[f]; return true; }
  if (a === 'dtCheck') { const k = el.dataset['k']!; ui.checked[k] = !ui.checked[k]; return true; }
  if (a === 'dtClear') { ui.checked = {}; return true; }
  return false;
}
export const isDietAct = (a: string | undefined) => !!a && ['dtTab', 'dtOpt', 'dtSubs', 'dtCheck', 'dtClear'].includes(a);
export const nowMinutes = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
