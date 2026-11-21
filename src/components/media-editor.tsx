import { useEffect, useRef, useState } from 'react';
import { Eraser, ImageUp, Minus, PenLine, Plus, Trash2, X } from 'lucide-react';
import { clampCrop, coverScale, hasWhiteBg, inkAmount, loadImg, logoBlob, photoBlob, signBlob, type Crop } from '@/lib/image-tools';

/*
 * Editor das imagens do perfil do nutricionista (aberto pelo app via bridge.media):
 *  · foto: recorte redondo com zoom e arrastar;
 *  · logo: tira o fundo branco (opcional) e mostra como fica no papel e na cor da marca;
 *  · assinatura: desenhar com o dedo/mouse ou enviar a foto da assinatura no papel.
 */
export type MediaSpec = {
  kind: 'photo' | 'logo' | 'sign';
  current?: string;
  /** cor da marca (fundo claro e tom forte) para a prévia do logo */
  color?: { bg: string; ink: string };
  name?: string;
  onSave: (blob: Blob) => Promise<void>;
  onRemove?: () => Promise<void>;
};
const TITLE = { photo: 'Foto de perfil', logo: 'Logo da sua marca', sign: 'Sua assinatura' };
const SUB = {
  photo: 'Aparece no portal do paciente, no seu perfil e no menu. Arraste para ajustar e use o zoom.',
  logo: 'Vai no topo dos PDFs e no portal do paciente. PNG com fundo transparente fica perfeito; se tiver fundo branco, o sistema tira.',
  sign: 'Entra no rodapé dos PDFs, acima do seu nome e CRN.',
};

export function MediaEditor({ spec, onEnd }: { spec: MediaSpec; onEnd: () => void }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Crop>({ zoom: 1, x: 0, y: 0 });
  const [white, setWhite] = useState(false);
  const [preview, setPreview] = useState('');
  const [mode, setMode] = useState<'draw' | 'upload'>('draw');
  const [inked, setInked] = useState(false);
  const [busy, setBusy] = useState(''), [err, setErr] = useState('');
  const [out, setOut] = useState(false);
  const file = useRef<HTMLInputElement>(null), stage = useRef<HTMLDivElement>(null), pad = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; c: Crop } | null>(null), pen = useRef<{ x: number; y: number } | null>(null);
  const k = spec.kind;
  const srcUrl = useRef("");
  useEffect(() => () => { if (srcUrl.current) URL.revokeObjectURL(srcUrl.current); }, []);

  const close = () => { if (busy) return; setOut(true); setTimeout(onEnd, 200); };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey); document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  });

  async function pick(f: File | undefined) {
    if (!f) return; setErr('');
    if (!/^image\//.test(f.type)) { setErr('Escolha uma imagem (JPG, PNG ou WEBP).'); return; }
    if (f.size > 15e6) { setErr('Imagem muito grande (máximo 15 MB).'); return; }
    try {
      // o endereço da imagem fica vivo enquanto ela está na tela (o recorte mostra a própria imagem)
      const url = URL.createObjectURL(f), im = await loadImg(url);
      if (srcUrl.current) URL.revokeObjectURL(srcUrl.current); srcUrl.current = url;
      setImg(im); setCrop({ zoom: 1, x: 0, y: 0 });
      if (k === 'logo') setWhite(hasWhiteBg(im));
      if (k === 'sign') setMode('upload');
    } catch (e) { setErr((e as Error).message); }
  }

  // prévia do logo / assinatura enviada: exatamente o arquivo que será salvo
  useEffect(() => {
    if (!img || k === 'photo' || (k === 'sign' && mode !== 'upload')) { setPreview(''); return; }
    let url = '', live = true;
    (k === 'logo' ? logoBlob(img, white) : signBlob(img, true)).then((b) => { if (!live) return; url = URL.createObjectURL(b); setPreview(url); }).catch(() => {});
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
  }, [img, white, mode, k]);

  /* ---------- foto: arrastar e zoom ---------- */
  const [sz, setSz] = useState(280);
  useEffect(() => {
    const el = stage.current; if (!el) return;
    const ro = new ResizeObserver(() => setSz(el.getBoundingClientRect().width || 280)); ro.observe(el); return () => ro.disconnect();
  }, [img, k]);
  const S = () => sz;
  const setZoom = (z: number) => img && setCrop((c) => clampCrop(img, { ...c, zoom: Math.max(1, Math.min(4, z)) }));
  const down = (e: React.PointerEvent) => { if (!img) return; (e.target as Element).setPointerCapture?.(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, c: crop }; };
  const move = (e: React.PointerEvent) => { const d = drag.current; if (!d || !img) return; const s = S(); setCrop(clampCrop(img, { ...d.c, x: d.c.x + (e.clientX - d.x) / s, y: d.c.y + (e.clientY - d.y) / s })); };
  const up = () => { drag.current = null; };

  /* ---------- assinatura: desenho ---------- */
  useEffect(() => {
    if (k !== 'sign' || mode !== 'draw' || !pad.current) return;
    const c = pad.current, r = c.getBoundingClientRect(), dpr = Math.min(3, window.devicePixelRatio || 1);
    c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
    const x = c.getContext('2d')!; x.scale(dpr, dpr); x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = '#1d2433'; x.lineWidth = 2.6;
    setInked(false);
  }, [k, mode]);
  const pos = (e: React.PointerEvent) => { const r = pad.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const pDown = (e: React.PointerEvent) => { e.preventDefault(); pad.current!.setPointerCapture?.(e.pointerId); pen.current = pos(e); const x = pad.current!.getContext('2d')!; x.beginPath(); x.arc(pen.current.x, pen.current.y, 1.2, 0, Math.PI * 2); x.fillStyle = '#1d2433'; x.fill(); };
  const pMove = (e: React.PointerEvent) => {
    const p0 = pen.current; if (!p0) return; const p = pos(e), x = pad.current!.getContext('2d')!;
    // traço mais fino quando a mão vai rápido (parece caneta)
    const v = Math.hypot(p.x - p0.x, p.y - p0.y); x.lineWidth = Math.max(1.6, 3.2 - v / 14);
    x.beginPath(); x.moveTo(p0.x, p0.y); x.quadraticCurveTo(p0.x, p0.y, (p0.x + p.x) / 2, (p0.y + p.y) / 2); x.lineTo(p.x, p.y); x.stroke();
    pen.current = p;
  };
  const pUp = () => { if (pen.current) setInked(inkAmount(pad.current!) > 0.004); pen.current = null; };
  const clearPad = () => { const c = pad.current; if (!c) return; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); setInked(false); };

  const ready = k === 'photo' ? !!img : k === 'logo' ? !!img : mode === 'draw' ? inked : !!img;
  async function save() {
    if (!ready) return; setBusy('save'); setErr('');
    try {
      const blob = k === 'photo' ? await photoBlob(img!, crop) : k === 'logo' ? await logoBlob(img!, white) : mode === 'draw' ? await signBlob(pad.current!, false) : await signBlob(img!, true);
      await spec.onSave(blob); setBusy(''); close();
    } catch (e) { setBusy(''); setErr((e as Error).message || 'Não foi possível salvar. Tente de novo.'); }
  }
  async function remove() {
    if (!spec.onRemove) return; setBusy('remove'); setErr('');
    try { await spec.onRemove(); setBusy(''); close(); } catch (e) { setBusy(''); setErr((e as Error).message || 'Não foi possível remover.'); }
  }

  const chooser = (label: string) => (
    <button type="button" className="me-drop" onClick={() => file.current?.click()}
      onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void pick(e.dataTransfer.files[0]); }}>
      <span className="me-drop-ico"><ImageUp size={22} /></span><b>{label}</b><span>ou arraste o arquivo para cá · JPG, PNG ou WEBP</span>
    </button>
  );
  const s = S(), sc = img ? coverScale(img, s, crop.zoom) : 1;

  return (
    <div className={'scrim me-scrim' + (out ? ' out' : '')} onClick={close}>
      <div className={'sheet me me-' + k} role="dialog" aria-modal="true" aria-label={TITLE[k]} onClick={(e) => e.stopPropagation()}>
        <header className="me-head"><div><h3>{TITLE[k]}</h3><p>{SUB[k]}</p></div>
          <button type="button" className="icon-btn" onClick={close} aria-label="Fechar"><X size={20} /></button></header>
        <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />

        {k === 'photo' && (img ? (<>
          <div className="me-stage" ref={stage} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
            onWheel={(e) => setZoom(crop.zoom * (e.deltaY < 0 ? 1.08 : 0.93))}>
            <img src={img.src} alt="" draggable={false} style={{ width: img.naturalWidth * sc, height: img.naturalHeight * sc, transform: `translate(calc(-50% + ${crop.x * s}px), calc(-50% + ${crop.y * s}px))` }} />
            <span className="me-ring" aria-hidden="true" />
          </div>
          <div className="me-zoom"><button type="button" className="icon-btn" onClick={() => setZoom(crop.zoom - 0.25)} aria-label="Diminuir zoom"><Minus size={18} /></button>
            <input type="range" min={1} max={4} step={0.01} value={crop.zoom} onChange={(e) => setZoom(+e.target.value)} aria-label="Zoom" />
            <button type="button" className="icon-btn" onClick={() => setZoom(crop.zoom + 0.25)} aria-label="Aumentar zoom"><Plus size={18} /></button></div>
          <button type="button" className="me-link" onClick={() => file.current?.click()}>Trocar imagem</button>
        </>) : (<>{spec.current && <div className="me-current"><img src={spec.current} alt="Foto atual" /><span>Foto atual</span></div>}{chooser('Escolher foto')}</>))}

        {k === 'logo' && (img ? (<>
          <div className="me-logo-prev">
            <figure><div className="me-paper">{preview ? <img src={preview} alt="Prévia do logo" /> : <span className="me-spin" />}</div><figcaption>No PDF</figcaption></figure>
            <figure><div className="me-paper tint" style={spec.color ? { background: spec.color.bg } : undefined}>{preview ? <img src={preview} alt="" /> : <span className="me-spin" />}</div><figcaption>Na cor da marca</figcaption></figure>
          </div>
          <button type="button" className={'toggle me-toggle'} onClick={() => setWhite((w) => !w)} aria-pressed={white}>
            <span><b>Tirar o fundo branco</b><br /><span className="small muted">Deixa só o desenho do logo, sem o retângulo branco</span></span><span className={'switch' + (white ? ' on' : '')} /></button>
          <button type="button" className="me-link" onClick={() => file.current?.click()}>Trocar imagem</button>
        </>) : (<>{spec.current && <div className="me-current logo"><img src={spec.current} alt="Logo atual" /><span>Logo atual</span></div>}{chooser('Escolher logo')}</>))}

        {k === 'sign' && (<>
          <div className="seg full me-seg" role="tablist">
            <button type="button" role="tab" aria-selected={mode === 'draw'} className={mode === 'draw' ? 'on' : ''} onClick={() => { setMode('draw'); setImg(null); }}><PenLine size={16} />Desenhar</button>
            <button type="button" role="tab" aria-selected={mode === 'upload'} className={mode === 'upload' ? 'on' : ''} onClick={() => setMode('upload')}><ImageUp size={16} />Foto do papel</button>
          </div>
          {mode === 'draw' ? (<>
            <div className="me-pad"><canvas ref={pad} onPointerDown={pDown} onPointerMove={pMove} onPointerUp={pUp} onPointerCancel={pUp} onPointerLeave={pUp} aria-label="Área para assinar" />
              <span className="me-pad-line" aria-hidden="true" />{!inked && <span className="me-pad-hint">Assine aqui com o dedo ou o mouse</span>}</div>
            <button type="button" className="me-link" onClick={clearPad} disabled={!inked}><Eraser size={15} /> Limpar</button>
          </>) : img ? (<>
            <div className="me-paper sign">{preview ? <img src={preview} alt="Prévia da assinatura" /> : <span className="me-spin" />}</div>
            <button type="button" className="me-link" onClick={() => file.current?.click()}>Trocar imagem</button>
          </>) : chooser('Escolher foto da assinatura')}
          {spec.current && mode === 'draw' && !inked && <div className="me-current sign"><img src={spec.current} alt="Assinatura atual" /><span>Assinatura atual</span></div>}
        </>)}

        {err && <p className="me-err" role="alert">{err}</p>}
        <div className="me-foot">
          {spec.current && spec.onRemove && <button type="button" className="btn ghost me-del" onClick={remove} disabled={!!busy}><Trash2 size={16} />{busy === 'remove' ? 'Removendo…' : 'Remover'}</button>}
          <span className="grow" />
          <button type="button" className="btn ghost" onClick={close} disabled={!!busy}>Cancelar</button>
          <button type="button" className="btn dark" onClick={save} disabled={!ready || !!busy}>{busy === 'save' ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  );
}
