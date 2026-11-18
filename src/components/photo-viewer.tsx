import { useEffect, useRef, useState } from 'react';
import { Camera, ChevronLeft, ChevronRight, Download, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/* Visualizador em tela cheia: desliza entre as fotos, amplia com toque duplo/clique, refaz, baixa e exclui. */
export type ViewerItem = { id: string; pose: string; title: string; sub: string; url: () => Promise<string> };
export type ViewerSpec = {
  items: ViewerItem[];
  index: number;
  onRetake?: (item: ViewerItem) => void;
  onDelete?: (item: ViewerItem) => Promise<void>;
  onDownload?: (item: ViewerItem) => Promise<void>;
  onClose: () => void;
};

export function PhotoViewer({ spec, onEnd }: { spec: ViewerSpec; onEnd: () => void }) {
  const [items, setItems] = useState(spec.items);
  const [i, setI] = useState(Math.min(spec.index, spec.items.length - 1));
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const [dx, setDx] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const lastTap = useRef(0);
  const it = items[i];

  useEffect(() => {
    let alive = true;
    // a atual primeiro, depois as outras (são poucas: até 4 poses)
    for (const x of [items[i], ...items.filter((_, k) => k !== i)]) if (x && !urls[x.id]) void x.url().then((u) => alive && u && setUrls((m) => ({ ...m, [x.id]: u })));
    return () => { alive = false; };
  }, [i, items]);

  const close = () => { if (closing) return; setClosing(true); window.setTimeout(() => { spec.onClose(); onEnd(); }, 200); };
  const go = (d: number) => { if (!items.length) return; setZoom(null); setConfirm(false); setI((k) => (k + d + items.length) % items.length); };

  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1); };
    window.addEventListener('keydown', on); return () => window.removeEventListener('keydown', on);
  });

  if (!it) return null;
  // só conta gesto que começou aqui dentro: o clique que abre o visualizador termina em cima da foto e não pode ampliá-la
  const onDown = (e: React.PointerEvent) => { start.current = { x: e.clientX, y: e.clientY, t: Date.now() }; };
  const onMove = (e: React.PointerEvent) => { if (start.current && !zoom) setDx(e.clientX - start.current.x); };
  const onUp = (e: React.PointerEvent) => {
    const s = start.current; start.current = null; setDx(0);
    if (!s) return;
    const now = Date.now(), moved = Math.abs(e.clientX - s.x);
    if (!zoom && moved > 60 && now - s.t < 700) { go(e.clientX < s.x ? 1 : -1); return; }
    if (moved > 8) return;
    // ampliada: qualquer clique/toque volta ao tamanho inteiro
    if (zoom) { setZoom(null); lastTap.current = 0; return; }
    // amplia só clicando na própria foto (computador) ou com toque duplo (celular)
    const img = (e.target as HTMLElement).closest('img');
    if (!img) return;
    if (e.pointerType === 'mouse' || now - lastTap.current < 320) {
      const r = img.getBoundingClientRect();
      setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
      lastTap.current = 0;
    } else lastTap.current = now;
  };
  const del = async () => {
    if (!spec.onDelete) return;
    if (!confirm) { setConfirm(true); return; }
    setBusy(true);
    try { await spec.onDelete(it); const rest = items.filter((x) => x.id !== it.id); if (!rest.length) { close(); return; } setItems(rest); setI((k) => Math.min(k, rest.length - 1)); setConfirm(false); }
    finally { setBusy(false); }
  };

  return (
    <div className={'pv' + (closing ? ' out' : '')} role="dialog" aria-modal="true" aria-label={`${it.title} · ${it.sub}`}>
      <header className="pv-top">
        <button type="button" className="cam-ib" onClick={close} aria-label="Fechar"><X size={22} /></button>
        <div className="cam-title"><b>{it.title}</b><small>{it.sub}</small></div>
        <span className="pv-n">{i + 1}/{items.length}</span>
      </header>
      <div className="pv-stage" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { start.current = null; setDx(0); }}>
        {urls[it.id]
          ? <img key={it.id} src={urls[it.id]} alt={`${it.title} · ${it.sub}`} draggable={false} className={zoom ? 'zoom' : ''}
              style={{ transform: zoom ? 'scale(2.2)' : `translateX(${dx}px)`, transformOrigin: zoom ? `${zoom.x}% ${zoom.y}%` : undefined }} />
          : <span className="cam-spin" />}
        {zoom && <span className="pv-zoomtag">Ampliada · toque para voltar</span>}
        {items.length > 1 && <>
          <button type="button" className="pv-nav l" onClick={(e) => { e.stopPropagation(); go(-1); }} onPointerUp={(e) => e.stopPropagation()} aria-label="Anterior"><ChevronLeft size={26} /></button>
          <button type="button" className="pv-nav r" onClick={(e) => { e.stopPropagation(); go(1); }} onPointerUp={(e) => e.stopPropagation()} aria-label="Próxima"><ChevronRight size={26} /></button>
        </>}
      </div>
      {items.length > 1 && (
        <div className="pv-strip">{items.map((x, k) => (
          <button type="button" key={x.id} className={k === i ? 'on' : ''} onClick={() => { setZoom(null); setConfirm(false); setI(k); }} aria-label={`${x.title} · ${x.sub}`}>
            {urls[x.id] ? <img src={urls[x.id]} alt="" /> : <span />}
          </button>
        ))}</div>
      )}
      <footer className="pv-bar">
        {spec.onRetake && <Button variant="original" type="button" className="btn ghost sm" onClick={() => { spec.onRetake!(it); close(); }}><Camera size={17} /> Refazer</Button>}
        {spec.onDownload && <Button variant="original" type="button" className="btn ghost sm" onClick={() => void spec.onDownload!(it)}><Download size={17} /> Baixar</Button>}
        {spec.onDelete && <Button variant="original" type="button" className={'btn sm ' + (confirm ? 'danger solid' : 'ghost')} onClick={() => void del()} disabled={busy}><Trash2 size={17} /> {confirm ? 'Toque para excluir' : 'Excluir'}</Button>}
      </footer>
    </div>
  );
}
