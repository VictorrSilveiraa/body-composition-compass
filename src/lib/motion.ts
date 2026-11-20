/*
 * Motor de animações das telas importadas.
 * - Revela blocos quando entram na tela (IntersectionObserver): no celular só anima o que você rola até ver.
 * - Números contam do zero, anel/barras/pílulas crescem, gráficos se desenham.
 * - Só usa transform/opacity no que é contínuo; nada roda fora da tela. Respeita "reduzir movimento".
 * - Estado fica em data-attributes (React não gerencia), então re-renderizações não repetem animações.
 */
const REVEAL = [
  '.top', 'h1.headline', 'h2.sec', '.card', '.aitem', '.cta', '.draft-banner', '.field', '.proto',
  '.act-row', '.prof-row', '.kv-row', '.cmp-row', '.notes', '.check-row', '.step-intro', '.onb-hero',
  '.empty', '.chips', '.cmp-pick', '.toggle', '.seg.full', '.steps', '.progress', '.auth-mark', '.auth-links',
  '.pt-cell', '.kpi', '.pt-bar', '.pt-actions', '.rt-banner', '.rt-row', '.en-opt', '.en-adj',
  '.dt-meal', '.dt-stats', '.dt-shop-g', '.dt-drop', '.dt-saved', '.dt-how', '.dt-read', '.dt-stepper',
].join(',');
const COUNT = '.big,.mid,.stat b,.ring-wrap .inner b,.pill .val,.kv-row .v,.cmp-row .vals b,.kpi b';
const RIPPLE = '.cta,.btn,.aitem,.act-row,.prof-row,.proto,.chip,.step-chip,.nav button,.icon-btn,.seg button,.toggle,.draft-banner,.kv-row[data-act],.card[data-act],.tag[data-act],.vs,.pt-card,.kpi,.pa,.pc,.dt-opts button,.dt-swap,.dt-check';

const STAGGER = 55;
const MAX_STAGGER = 9;

let io: IntersectionObserver | null = null;
let batch: HTMLElement[] = [];
let batchQueued = false;
let navShown = false;

export const reducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function observer() {
  if (io) return io;
  io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io!.unobserve(e.target);
        batch.push(e.target as HTMLElement);
      }
      if (batch.length && !batchQueued) {
        batchQueued = true;
        requestAnimationFrame(flush);
      }
    },
    { rootMargin: '0px 0px -6% 0px', threshold: 0.08 },
  );
  return io;
}

function flush() {
  batchQueued = false;
  const items = batch.filter((el) => el.isConnected);
  batch = [];
  const pos = new Map(items.map((el) => [el, el.getBoundingClientRect()]));
  items.sort((a, b) => pos.get(a)!.top - pos.get(b)!.top || pos.get(a)!.left - pos.get(b)!.left);
  items.forEach((el, i) => reveal(el, Math.min(i, MAX_STAGGER) * STAGGER));
}

function reveal(el: HTMLElement, delay: number) {
  el.style.setProperty('--d', `${delay}ms`);
  el.dataset['rv'] = 'in';
  el.querySelectorAll<HTMLElement>(COUNT).forEach((n) =>
    countUp(n, delay + 120, n.closest('.kv-row,.cmp-row') ? 650 : 1000),
  );
  el.querySelectorAll<SVGCircleElement>('.ring-wrap svg circle:nth-of-type(2)').forEach((c) => ringIn(c, delay + 200));
  el.querySelectorAll<HTMLElement>('.combar span').forEach((s, i) => grow(s, 'width', delay + 250 + i * 120, '1.1s cubic-bezier(.22,1,.36,1)'));
  el.querySelectorAll<HTMLElement>('.pill').forEach((p, i) => {
    const t = delay + 200 + i * 80;
    const fill = p.querySelector<HTMLElement>('.fill'), val = p.querySelector<HTMLElement>('.val');
    if (fill) grow(fill, 'height', t, '1s cubic-bezier(.34,1.4,.64,1)');
    if (val) grow(val, 'bottom', t, '1s cubic-bezier(.34,1.4,.64,1)');
  });
}

/** Anima uma propriedade de estilo inline (width/height/bottom) de 0 até o valor que o React escreveu. */
function grow(el: HTMLElement, prop: 'width' | 'height' | 'bottom', delay: number, curve: string) {
  const final = el.style[prop];
  if (!final) return;
  const prevTransition = el.style.transition;
  el.style.transition = 'none';
  el.style[prop] = '0%';
  setTimeout(() => {
    if (!el.isConnected || el.style[prop] !== '0%') return;
    void el.offsetWidth;
    el.style.transition = `${prop} ${curve}`;
    el.style[prop] = final;
    setTimeout(() => { if (el.isConnected) el.style.transition = prevTransition; }, 1300);
  }, delay);
}

function ringIn(c: SVGCircleElement, delay: number) {
  const final = c.getAttribute('stroke-dasharray');
  if (!final) return;
  const total = final.trim().split(/[\s,]+/)[1];
  const zero = `0 ${total}`;
  c.style.transition = 'none';
  c.setAttribute('stroke-dasharray', zero);
  setTimeout(() => {
    if (!c.isConnected || c.getAttribute('stroke-dasharray') !== zero) return;
    c.getBoundingClientRect();
    c.style.transition = 'stroke-dasharray 1.5s cubic-bezier(.22,1,.36,1)';
    c.setAttribute('stroke-dasharray', final);
  }, delay);
}

const NUM = /^([+-]?)(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?$/;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);

/** Faz o primeiro texto do elemento contar de 0 até o valor (formato pt-BR). */
function countUp(el: HTMLElement, delay: number, dur: number) {
  const node = Array.from(el.childNodes).find(
    (n): n is Text => n.nodeType === Node.TEXT_NODE && !!n.nodeValue?.trim(),
  );
  if (!node) return;
  const raw = node.nodeValue!;
  const m = raw.trim().match(NUM);
  if (!m) return;
  const lead = raw.match(/^\s*/)![0], trail = raw.match(/\s*$/)![0];
  const sign = m[1] ?? '', int = m[2] ?? '0', frac = m[3], dec = frac?.length ?? 0, grouped = int.includes('.');
  const target = parseFloat(int.replace(/\./g, '') + (frac ? '.' + frac : ''));
  if (!isFinite(target) || target === 0) return;
  const show = (v: number) =>
    lead + sign + v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: grouped }) + trail;
  let last = show(0);
  node.nodeValue = last;
  let start = 0;
  const tick = (now: number) => {
    if (node.nodeValue !== last) return; // o React escreveu um valor novo: para aqui
    if (!start) start = now;
    const t = Math.min(1, (now - start) / dur);
    last = t >= 1 ? raw : show(target * easeOut(t));
    node.nodeValue = last;
    if (t < 1) requestAnimationFrame(tick);
  };
  setTimeout(() => requestAnimationFrame(tick), delay);
}

/**
 * Prepara as animações dos elementos novos dentro de `root`.
 * `fresh` = tela nova (troca de página): reinicia o observador.
 */
export function scan(root: HTMLElement | null, { fresh = false } = {}) {
  if (!root || typeof window === 'undefined') return;
  if (reducedMotion() || !('IntersectionObserver' in window)) return;
  if (fresh && io) { io.disconnect(); io = null; batch = []; }
  const obs = observer();
  const found = Array.from(root.querySelectorAll<HTMLElement>(REVEAL)).filter((el) => !el.dataset['rv']);
  const now: HTMLElement[] = [];
  const vh = window.innerHeight;
  for (const el of found) {
    let p = el.parentElement, nested = false;
    while (p && p !== root) { if (p.matches(REVEAL)) { nested = true; break; } p = p.parentElement; }
    if (nested) { el.dataset['rv'] = 'child'; continue; }
    el.dataset['rv'] = 'pre';
    // o que já está na tela começa a animar já (sem esperar o observador = sem "tela vazia")
    const r = el.getBoundingClientRect();
    if (r.bottom > 0 && r.top < vh * 0.96 && r.height > 0) now.push(el);
    else obs.observe(el);
  }
  now.forEach((el, i) => reveal(el, Math.min(i, MAX_STAGGER) * (fresh ? 38 : STAGGER)));
  const nav = root.querySelector<HTMLElement>('.nav');
  if (nav && !nav.dataset['rv']) { nav.dataset['rv'] = navShown ? 'still' : 'nav'; navShown = true; }

  // assistente: centraliza a etapa ativa na barra de etapas
  const on = root.querySelector<HTMLElement>('.steps .step-chip.on');
  const bar = on?.parentElement;
  if (on && bar && bar.scrollWidth > bar.clientWidth) {
    const br = bar.getBoundingClientRect(), or = on.getBoundingClientRect();
    const left = bar.scrollLeft + (or.left - br.left) - (bar.clientWidth - or.width) / 2;
    bar.scrollTo({ left, behavior: fresh ? 'auto' : 'smooth' });
  }
}

const rippleTimers = new WeakMap<HTMLElement, number>();
/** Onda de toque a partir do ponto clicado. */
export function ripple(e: PointerEvent) {
  if (reducedMotion() || e.button > 0) return;
  const el = (e.target as Element | null)?.closest?.(RIPPLE) as HTMLElement | null;
  if (!el || el.hasAttribute('disabled')) return;
  const r = el.getBoundingClientRect();
  el.style.setProperty('--rx', `${e.clientX - r.left}px`);
  el.style.setProperty('--ry', `${e.clientY - r.top}px`);
  el.style.setProperty('--rs', `${Math.max(r.width, r.height) * 2.2}px`);
  el.removeAttribute('data-rip');
  void el.offsetWidth;
  el.setAttribute('data-rip', '');
  clearTimeout(rippleTimers.get(el));
  rippleTimers.set(el, window.setTimeout(() => el.removeAttribute('data-rip'), 700));
}

/*
 * Transição entre páginas: o navegador congela a tela atual e faz um "crossfade" para a nova
 * enquanto os blocos novos sobem — nunca aparece tela vazia. Sem suporte, troca direto.
 */
let vtDone: (() => void) | null = null;
/** top: a página nova começa no topo (a tela antiga já está congelada, então a rolagem não aparece) */
export function withPageTransition(change: () => void, o: { top?: boolean } = {}) {
  type VT = { ready: Promise<void>; finished: Promise<void>; updateCallbackDone: Promise<void> };
  const doc = document as Document & { startViewTransition?: (cb: () => Promise<void>) => VT };
  if (!doc.startViewTransition || reducedMotion()) { change(); return; }
  vtDone?.();
  let changed = false;
  try {
    const vt = doc.startViewTransition(() => new Promise<void>((resolve) => {
      const t = window.setTimeout(() => { vtDone = null; resolve(); }, 700);
      vtDone = () => { clearTimeout(t); vtDone = null; resolve(); };
      changed = true;
      if (o.top) scrollTopNow();
      change();
    }));
    // transição cancelada (ex.: girou o celular) não é erro: a página já trocou
    const quiet = () => {};
    vt.ready.catch(quiet); vt.finished.catch(quiet); vt.updateCallbackDone.catch(quiet);
  } catch {
    if (!changed) change();
  }
}
/** Chamado quando a tela nova já está no DOM. */
export function pageReady() { vtDone?.(); }

/** Reinicia uma animação curta de "valor mudou" (usado nos números ao vivo do assistente). */
export function tick(el: Element) {
  if (reducedMotion()) return;
  el.removeAttribute('data-tick');
  void (el as HTMLElement).offsetWidth;
  el.setAttribute('data-tick', '');
}

/**
 * Volta ao topo NA HORA ao trocar de página. O site usa rolagem suave (html{scroll-behavior:smooth});
 * sem desligá-la aqui, a página nova aparecia na transição ainda rolada para baixo e subia depois.
 */
export function scrollTopNow() {
  const html = document.documentElement, prev = html.style.scrollBehavior;
  html.style.scrollBehavior = 'auto';
  window.scrollTo(0, 0);
  html.style.scrollBehavior = prev;
}
