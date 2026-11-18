import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import parse from 'html-react-parser';
import { Check, ClipboardList, Pointer, TrendingUp, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/*
 * Tour de apresentação: escurece a tela, destaca o elemento real de cada passo (o destaque desliza
 * de um para o outro) e mostra uma "mão" animada tocando nele. Funciona no celular e no computador
 * porque procura o primeiro elemento visível de cada lista de seletores.
 */
export type TourStep = { sel?: string[]; icon?: string; art?: 'hello' | 'done'; title: string; text: string; cta?: string; alt?: string; action?: string };
export type TourSpec = { steps: TourStep[]; onClose: (action?: string) => void };

type Box = { top: number; left: number; width: number; height: number };
type Pos = { top: number; left: number; place: string };

const PAD = 8;
const isVisible = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
function findTarget(sel?: string[]) {
  for (const s of sel ?? []) for (const el of Array.from(document.querySelectorAll<HTMLElement>(s))) if (isVisible(el)) return el;
  return null;
}
const boxOf = (el: HTMLElement): Box => { const r = el.getBoundingClientRect(); return { top: r.top, left: r.left, width: r.width, height: r.height }; };
const same = (a: Box | null, b: Box) => !!a && Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5;
const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function Art({ kind }: { kind: 'hello' | 'done' }) {
  if (kind === 'hello') return (
    <div className="tour-art hello" aria-hidden="true">
      <span className="ta blue"><Users size={26} /></span>
      <span className="ta yellow"><ClipboardList size={26} /></span>
      <span className="ta green"><TrendingUp size={26} /></span>
    </div>
  );
  return (
    <div className="tour-art done" aria-hidden="true">
      {Array.from({ length: 12 }, (_, i) => <i key={i} className="cf" style={{ ['--a' as string]: `${i * 30}deg`, background: ['var(--yellow-2)', 'var(--blue-2)', 'var(--green-2)', 'var(--peach)'][i % 4] }} />)}
      <span className="ok"><Check size={34} strokeWidth={2.6} /></span>
    </div>
  );
}

export function AppTour({ spec, onEnd }: { spec: TourSpec; onEnd: () => void }) {
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [pos, setPos] = useState<Pos | null>(null);
  const [leaving, setLeaving] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const nextBtn = useRef<HTMLButtonElement>(null);
  const target = useRef<HTMLElement | null>(null);
  const n = spec.steps.length, step: TourStep = spec.steps[i] ?? spec.steps[0] ?? { title: '', text: '' }, last = i >= n - 1;

  // passo novo: acha o elemento, rola até ele se estiver fora da tela
  useLayoutEffect(() => {
    const el = findTarget(step.sel);
    target.current = el;
    setPos(null);
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.top < 70 || r.bottom > window.innerHeight - 70) el.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' });
      setBox(boxOf(el));
    } else setBox(null);
  }, [i]);

  // acompanha o elemento (rolagem, giro da tela, animação de entrada da página)
  useEffect(() => {
    let raf = 0;
    const measure = () => { const el = target.current; if (el) { const b = boxOf(el); setBox((prev) => (same(prev, b) ? prev : b)); } };
    const tick = () => { measure(); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    const timers = [150, 400, 800, 1300].map((t) => window.setTimeout(measure, t));
    window.addEventListener('resize', measure); window.addEventListener('scroll', measure, true);
    return () => { cancelAnimationFrame(raf); timers.forEach(clearTimeout); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [i]);

  // posiciona o cartão ao lado do destaque, sem sair da tela
  useLayoutEffect(() => {
    const c = card.current;
    if (!c || !box) return;
    const vw = window.innerWidth, vh = window.innerHeight, cw = c.offsetWidth, ch = c.offsetHeight, m = 14, gap = 20;
    const r = { top: box.top - PAD, left: box.left - PAD, right: box.left + box.width + PAD, bottom: box.top + box.height + PAD };
    const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
    const clampX = (x: number) => Math.max(m, Math.min(vw - cw - m, x)), clampY = (y: number) => Math.max(m, Math.min(vh - ch - m, y));
    let p: Pos;
    if (vw < 640) p = cy > vh / 2 ? { top: Math.max(m, r.top - gap - ch), left: m, place: 'above' } : { top: Math.min(vh - ch - m, r.bottom + gap), left: m, place: 'below' };
    else if (r.right + gap + cw < vw - m) p = { top: clampY(cy - ch / 2), left: r.right + gap, place: 'right' };
    else if (r.bottom + gap + ch < vh - m) p = { top: r.bottom + gap, left: clampX(cx - cw / 2), place: 'below' };
    else if (r.top - gap - ch > m) p = { top: r.top - gap - ch, left: clampX(cx - cw / 2), place: 'above' };
    else p = { top: clampY(cy - ch / 2), left: clampX(r.left - gap - cw), place: 'left' };
    setPos((prev) => (prev && prev.top === p.top && prev.left === p.left && prev.place === p.place ? prev : p));
  }, [box, i]);

  const close = (action?: string) => {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(() => { spec.onClose(action); onEnd(); }, reduced() ? 0 : 260);
  };
  const next = () => (last ? close(step.action) : setI(i + 1));
  const prev = () => { if (i > 0) setI(i - 1); };

  // teclado: Esc fecha, setas navegam; foco sempre no botão principal
  useEffect(() => {
    nextBtn.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const hole = box
    ? { top: box.top - PAD, left: box.left - PAD, width: box.width + PAD * 2, height: box.height + PAD * 2 }
    : { top: window.innerHeight / 2, left: window.innerWidth / 2, width: 0, height: 0 };
  const secondary = i === 0 ? { label: 'Pular tour', fn: () => close() } : step.alt ? { label: step.alt, fn: () => close() } : !last ? { label: 'Voltar', fn: prev } : null;

  return (
    <div className={'tour' + (leaving ? ' out' : '') + (box ? '' : ' no-target')} role="dialog" aria-modal="true" aria-label="Tour de apresentação">
      <div className="tour-hole" style={hole} onClick={box ? next : undefined} />
      {box && (
        <span className="tour-tap" key={'tap' + i} style={{ top: box.top + box.height / 2, left: box.left + box.width / 2 }} aria-hidden="true">
          <i /><Pointer size={34} strokeWidth={1.6} />
        </span>
      )}
      <div
        ref={card}
        key={'card' + i}
        className={'tour-card' + (box ? (pos ? ' ' + pos.place : ' measuring') : ' center')}
        style={box && pos ? { top: pos.top, left: pos.left } : undefined}
      >
        <button type="button" className="tour-x" aria-label="Fechar tour" onClick={() => close()}><X size={16} /></button>
        {step.art ? <Art kind={step.art} /> : step.icon ? <span className="tour-ico">{parse(step.icon)}</span> : null}
        <div className="tour-prog" aria-label={`Passo ${i + 1} de ${n}`}>
          {spec.steps.map((_, k) => <i key={k} className={k === i ? 'on' : k < i ? 'done' : ''} />)}
        </div>
        <h3>{step.title}</h3>
        <p>{step.text}</p>
        {box && i === 1 && <p className="tour-hint"><Pointer size={14} /> Toque no destaque ou em Próximo</p>}
        <div className="tour-btns">
          {secondary && <Button variant="original" type="button" className="btn ghost sm" onClick={secondary.fn}>{secondary.label}</Button>}
          <Button variant="original" type="button" ref={nextBtn} className="btn dark sm" onClick={next}>{step.cta ?? (last ? 'Concluir' : 'Próximo')}</Button>
        </div>
      </div>
    </div>
  );
}
