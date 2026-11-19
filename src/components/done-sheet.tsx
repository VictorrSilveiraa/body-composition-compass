import { useEffect, useRef, useState, type ReactNode } from 'react';
import parse from 'html-react-parser';

/*
 * Janela de conclusão: aparece depois de uma tarefa importante (avaliação salva, paciente cadastrado,
 * plano publicado…) com o resultado e os próximos passos. No computador fica no centro; no celular
 * sobe de baixo e fecha arrastando. A tela por trás já é a certa: fechar nunca perde nada.
 */
export type DoneStat = { label: string; value: string; unit?: string; delta?: string; cls?: 'good' | 'bad' | 'neu' | 'flat' };
export type DoneAction = { label: string; sub?: string; icon?: string | ReactNode; primary?: boolean; fn?: () => void | Promise<void> };
export type DoneSpec = {
  tone?: 'green' | 'blue' | 'yellow' | 'peach';
  icon?: string | ReactNode;
  kicker?: string;
  title: string;
  text?: string;
  stats?: DoneStat[];
  badge?: { icon?: string | ReactNode; text: string };
  code?: string;
  actions?: DoneAction[];
  dismiss?: string;
  confetti?: boolean;
  onError?: (e: unknown) => void;
};

const node = (x: string | ReactNode | undefined) => (typeof x === 'string' ? parse(x) : x ?? null);
const CHECK = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
const COLORS = ['var(--yellow-2)', 'var(--green-2)', 'var(--blue-2)', 'var(--peach)', 'var(--pink)'];

export function DoneSheet({ spec, onEnd }: { spec: DoneSpec; onEnd: () => void }) {
  const [out, setOut] = useState(false);
  const [drag, setDrag] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const start = useRef<number | null>(null);
  const closing = useRef(false);

  const close = (after?: () => void | Promise<void>) => {
    if (closing.current) return; closing.current = true;
    setOut(true);
    window.setTimeout(() => {
      onEnd();
      if (after) Promise.resolve().then(after).catch((e) => spec.onError?.(e));
    }, 230);
  };

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', key);
    const t = window.setTimeout(() => box.current?.querySelector<HTMLElement>('.dn-act')?.focus({ preventScroll: true }), 380);
    return () => { document.removeEventListener('keydown', key); clearTimeout(t); };
  }, []);

  // celular: arrastar para baixo fecha
  const down = (e: React.PointerEvent) => { if (e.pointerType !== 'mouse') start.current = e.clientY; };
  const move = (e: React.PointerEvent) => { if (start.current != null) setDrag(Math.max(0, e.clientY - start.current)); };
  const up = () => { if (start.current == null) return; start.current = null; if (drag > 90) close(); else setDrag(0); };

  const tone = spec.tone ?? 'green';
  return (
    <div className={'dn-scrim' + (out ? ' out' : '')} onClick={() => close()}>
      <div ref={box} className={'dn tone-' + tone} role="dialog" aria-modal="true" aria-label={spec.title}
        style={drag ? { transform: `translateY(${drag}px)`, transition: 'none' } : undefined}
        onClick={(e) => e.stopPropagation()} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <span className="dn-grab" aria-hidden="true" />
        <button type="button" className="dn-x" aria-label="Fechar" onClick={() => close()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        {spec.confetti && (
          <div className="dn-burst" aria-hidden="true">
            {Array.from({ length: 14 }, (_, i) => (
              <i key={i} style={{ '--a': `${(i / 14) * 360}deg`, '--r': `${70 + (i % 3) * 22}px`, background: COLORS[i % COLORS.length], animationDelay: `${(i % 4) * 25}ms` } as React.CSSProperties} />
            ))}
          </div>
        )}
        <div className="dn-head">
          <span className="dn-ok">{spec.icon ? node(spec.icon) : CHECK}</span>
          <div className="dn-tt">
            {spec.kicker && <small>{spec.kicker}</small>}
            <h3>{spec.title}</h3>
          </div>
        </div>
        {spec.text && <p className="dn-text">{spec.text}</p>}
        {spec.code && <div className="dn-code">{spec.code}</div>}
        {!!spec.stats?.length && (
          <div className={'dn-stats n' + spec.stats.length}>
            {spec.stats.map((s, i) => (
              <div key={i} className="dn-stat" style={{ '--i': i } as React.CSSProperties}>
                <small>{s.label}</small>
                <b>{s.value}{s.unit && <em>{s.unit}</em>}</b>
                {s.delta && <span className={'dn-d ' + (s.cls ?? 'flat')}>{s.delta}</span>}
              </div>
            ))}
          </div>
        )}
        {spec.badge && (
          <div className="dn-badge">{spec.badge.icon && <span className="dn-bi">{node(spec.badge.icon)}</span>}<span>{spec.badge.text}</span></div>
        )}
        {!!spec.actions?.length && (
          <div className="dn-acts">
            {spec.actions.map((a, i) => (
              <button type="button" key={i} className={'dn-act' + (a.primary ? ' pri' : '')} style={{ '--i': i } as React.CSSProperties} onClick={() => close(a.fn)}>
                {a.icon && <span className="dn-ai">{node(a.icon)}</span>}
                <span className="dn-al"><b>{a.label}</b>{a.sub && <small>{a.sub}</small>}</span>
                <svg className="dn-go" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
              </button>
            ))}
          </div>
        )}
        <button type="button" className="dn-skip" onClick={() => close()}>{spec.dismiss ?? 'Fechar'}</button>
      </div>
    </div>
  );
}
