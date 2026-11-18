import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import parse from 'html-react-parser';
import { Check, Grid3x3, History, ImagePlus, PersonStanding, RotateCcw, SwitchCamera, Timer, TimerOff, X, Zap, ZapOff, EyeOff, Crosshair } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { poseHint, poseLabel, poseShort, poseSvg, type Pose } from '@/lib/poses.js';
import { toJpeg } from '@/lib/photos';

/*
 * Câmera guiada: quadro 3:4 com a silhueta da pose (ou a foto da consulta anterior em transparência),
 * linhas de cabeça/pés, nível do celular, temporizador, grade e lanterna. Tira as poses em sequência.
 * Sem câmera (ou para usar a galeria): a foto escolhida pode ser arrastada/ampliada por baixo da silhueta
 * para ficar no mesmo enquadramento das outras.
 */
export type CameraSpec = {
  title: string;
  subtitle?: string;
  poses: Pose[];
  start?: Pose;
  existing: Partial<Record<Pose, string>>;
  ghosts: Partial<Record<Pose, string>>;
  ghostLabel?: string;
  pickFile?: boolean;
  onPhoto: (pose: Pose, blob: Blob, w: number, h: number) => Promise<void>;
  onClose: () => void;
};

type Shot = { url: string; blob: Blob; w: number; h: number };
type Adj = { url: string; img: HTMLImageElement; x: number; y: number; z: number };
type Phase = 'live' | 'review' | 'adjust' | 'saving' | 'done';
type Guide = 'body' | 'ghost' | 'none';

const TIMERS = [0, 3, 10] as const;
const isTouch = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
const loadImg = (url: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Imagem inválida')); i.src = url; });

export function PoseCamera({ spec, onEnd }: { spec: CameraSpec; onEnd: () => void }) {
  const poses = spec.poses;
  const [idx, setIdx] = useState(() => Math.max(0, poses.indexOf(spec.start ?? poses[0]!)));
  const pose = poses[idx] ?? poses[0]!;
  const [taken, setTaken] = useState<Partial<Record<Pose, string>>>(() => ({ ...spec.existing }));
  const [phase, setPhase] = useState<Phase>('live');
  const [cam, setCam] = useState<'starting' | 'on' | 'denied' | 'none'>('starting');
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [mirror, setMirror] = useState(false);
  const [multi, setMulti] = useState(false);
  const [timer, setTimer] = useState<(typeof TIMERS)[number]>(0);
  const [count, setCount] = useState<number | null>(null);
  const [guide, setGuide] = useState<Guide>(() => (spec.ghosts[spec.start ?? poses[0]!] ? 'ghost' : 'body'));
  const [grid, setGrid] = useState(false);
  const [torchOk, setTorchOk] = useState(false);
  const [torch, setTorch] = useState(false);
  const [shot, setShot] = useState<Shot | null>(null);
  const [adj, setAdj] = useState<Adj | null>(null);
  const [frame, setFrame] = useState({ w: 300, h: 400 });
  const [level, setLevel] = useState<{ g: number; b: number } | null>(null);
  const [levelAsk, setLevelAsk] = useState(false);
  const [flash, setFlash] = useState(0);
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState('');
  const [closing, setClosing] = useState(false);

  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const temp = useRef<string[]>([]);
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const countTimer = useRef<number>(0);
  const ghost = spec.ghosts[pose];
  const guideNow: Guide = guide === 'ghost' && !ghost ? 'body' : guide;

  const stop = () => { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; };

  // liga a câmera (e religa ao trocar frente/trás)
  useEffect(() => {
    let alive = true;
    (async () => {
      stop();
      if (!navigator.mediaDevices?.getUserMedia) { setCam('none'); return; }
      setCam('starting');
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: facing }, width: { ideal: 2560 }, height: { ideal: 1920 } } });
        if (!alive) { s.getTracks().forEach((t) => t.stop()); return; }
        stream.current = s;
        const v = video.current; if (v) { v.srcObject = s; await v.play().catch(() => {}); }
        const track = s.getVideoTracks()[0];
        const caps = (track?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
        setTorchOk(!!caps.torch); setTorch(false);
        const fm = track?.getSettings().facingMode;
        setMirror(fm ? fm === 'user' : !isTouch() || facing === 'user');
        setCam('on');
        navigator.mediaDevices.enumerateDevices().then((d) => alive && setMulti(d.filter((x) => x.kind === 'videoinput').length > 1)).catch(() => {});
      } catch (e) {
        if (!alive) return;
        const n = (e as { name?: string })?.name;
        setCam(n === 'NotAllowedError' || n === 'SecurityError' ? 'denied' : 'none');
      }
    })();
    return () => { alive = false; stop(); };
  }, [facing]);

  // abre direto na galeria quando pedido
  useEffect(() => { if (spec.pickFile) window.setTimeout(() => file.current?.click(), 250); }, []);

  // tamanho do quadro (para o ajuste de fotos da galeria)
  useLayoutEffect(() => {
    const el = stage.current; if (!el) return;
    const ro = new ResizeObserver(() => { const r = el.getBoundingClientRect(); setFrame({ w: r.width, h: r.height }); });
    ro.observe(el); return () => ro.disconnect();
  }, [phase]);

  // nível: avisa quando o celular está torto (ângulo muda a proporção do corpo na foto)
  useEffect(() => {
    if (!isTouch() || typeof DeviceOrientationEvent === 'undefined') return;
    const D = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    if (typeof D.requestPermission === 'function') setLevelAsk(true);
    let raf = 0;
    const on = (e: DeviceOrientationEvent) => { if (e.beta == null || e.gamma == null) return; cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setLevel({ g: e.gamma!, b: e.beta! })); };
    window.addEventListener('deviceorientation', on);
    return () => { window.removeEventListener('deviceorientation', on); cancelAnimationFrame(raf); };
  }, []);
  const askLevel = async () => {
    const D = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    try { await D.requestPermission?.(); } catch { /* recusado */ } setLevelAsk(false);
  };

  // limpa ao sair
  useEffect(() => () => { stop(); clearInterval(countTimer.current); temp.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

  const close = useCallback(() => {
    if (closing) return; setClosing(true); stop();
    window.setTimeout(() => { spec.onClose(); onEnd(); }, 220);
  }, [closing, spec, onEnd]);

  const nextMissing = (from: number, have: Partial<Record<Pose, string>>) => {
    for (let k = 1; k <= poses.length; k++) { const j = (from + k) % poses.length; if (!have[poses[j]!]) return j; }
    return -1;
  };

  const goPose = (j: number) => {
    if (phase === 'saving') return;
    setIdx(j); setShot(null); setAdj(null); setErr('');
    setPhase('live'); setGuide((g) => (g === 'none' ? 'none' : spec.ghosts[poses[j]!] ? 'ghost' : 'body'));
  };

  /* ---------- capturar ---------- */
  const grab = async () => {
    const v = video.current; if (!v || !v.videoWidth) return;
    const vw = v.videoWidth, vh = v.videoHeight, t = 3 / 4;
    let sw = vw, sh = vh; if (vw / vh > t) sw = vh * t; else sh = vw / t;
    const s = Math.min(1, 1600 / sh);
    const c = document.createElement('canvas'); c.width = Math.round(sw * s); c.height = Math.round(sh * s);
    c.getContext('2d')!.drawImage(v, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, c.width, c.height);
    const { blob, w, h } = await toJpeg(c);
    const url = URL.createObjectURL(blob); temp.current.push(url);
    setFlash((n) => n + 1); navigator.vibrate?.(25);
    setShot({ url, blob, w, h }); setPhase('review');
  };
  const shoot = () => {
    if (phase !== 'live' || cam !== 'on' || count !== null) return;
    if (!timer) { void grab(); return; }
    let n: number = timer; setCount(n);
    countTimer.current = window.setInterval(() => {
      n -= 1;
      if (n <= 0) { clearInterval(countTimer.current); setCount(null); void grab(); } else { setCount(n); navigator.vibrate?.(10); }
    }, 1000);
  };
  const cancelCount = () => { clearInterval(countTimer.current); setCount(null); };

  /* ---------- salvar a foto da pose atual ---------- */
  const save = async (s: Shot) => {
    setPhase('saving'); setErr('');
    try {
      await spec.onPhoto(pose, s.blob, s.w, s.h);
      const have = { ...taken, [pose]: s.url }; setTaken(have);
      setShot(null); setAdj(null);
      const j = nextMissing(idx, have);
      if (j < 0) setPhase('done');
      else { setIdx(j); setPhase('live'); setGuide((g) => (g === 'none' ? 'none' : spec.ghosts[poses[j]!] ? 'ghost' : 'body')); }
    } catch (e) {
      setErr((e as Error)?.message || 'Não foi possível salvar a foto'); setPhase(adj ? 'adjust' : 'review');
    }
  };

  /* ---------- galeria + ajuste do enquadramento ---------- */
  const openFile = async (f?: File | null) => {
    if (!f || !f.type.startsWith('image/')) { if (f) setErr('Escolha um arquivo de imagem'); return; }
    try {
      setErr('');
      const { blob } = await toJpeg(f, 2400, 0.92);
      const url = URL.createObjectURL(blob); temp.current.push(url);
      const img = await loadImg(url);
      cancelCount(); setShot(null); setAdj({ url, img, x: 0, y: 0, z: 1 }); setPhase('adjust');
    } catch { setErr('Não foi possível abrir essa imagem'); }
  };
  const base = adj ? Math.max(frame.w / adj.img.naturalWidth, frame.h / adj.img.naturalHeight) : 1;
  const setZoom = (z: number) => setAdj((a) => (a ? { ...a, z: Math.min(4, Math.max(0.5, z)) } : a));
  const onPtrDown = (e: React.PointerEvent) => { if (phase !== 'adjust') return; (e.target as Element).setPointerCapture?.(e.pointerId); ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); };
  const onPtrMove = (e: React.PointerEvent) => {
    if (phase !== 'adjust' || !ptrs.current.has(e.pointerId)) return;
    const prev = ptrs.current.get(e.pointerId)!, others = [...ptrs.current.entries()].filter(([k]) => k !== e.pointerId);
    if (others.length === 1) {
      const o = others[0]![1], d0 = Math.hypot(prev.x - o.x, prev.y - o.y), d1 = Math.hypot(e.clientX - o.x, e.clientY - o.y);
      if (d0 > 0) setAdj((a) => (a ? { ...a, z: Math.min(4, Math.max(0.5, a.z * (d1 / d0))), x: a.x + (e.clientX - prev.x) / 2, y: a.y + (e.clientY - prev.y) / 2 } : a));
    } else setAdj((a) => (a ? { ...a, x: a.x + e.clientX - prev.x, y: a.y + e.clientY - prev.y } : a));
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const onPtrUp = (e: React.PointerEvent) => { ptrs.current.delete(e.pointerId); };
  const onWheel = (e: React.WheelEvent) => { if (phase === 'adjust' && adj) setZoom(adj.z * (e.deltaY < 0 ? 1.08 : 0.93)); };
  const useAdjusted = async () => {
    if (!adj) return;
    const W = 1200, H = 1600, K = W / frame.w, dw = adj.img.naturalWidth * base * adj.z * K, dh = adj.img.naturalHeight * base * adj.z * K;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d')!; x.fillStyle = '#ecebe6'; x.fillRect(0, 0, W, H);
    x.drawImage(adj.img, (frame.w / 2 + adj.x) * K - dw / 2, (frame.h / 2 + adj.y) * K - dh / 2, dw, dh);
    const { blob, w, h } = await toJpeg(c);
    const url = URL.createObjectURL(blob); temp.current.push(url);
    await save({ url, blob, w, h });
  };

  /* ---------- lanterna ---------- */
  const toggleTorch = async () => {
    const t = stream.current?.getVideoTracks()[0]; if (!t) return;
    try { await t.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] }); setTorch(!torch); } catch { setTorchOk(false); }
  };

  // teclado (computador): espaço/enter tira a foto, setas trocam a pose, esc fecha
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'Escape') { e.preventDefault(); if (count !== null) cancelCount(); else close(); }
      else if ((e.key === ' ' || e.key === 'Enter') && phase === 'live') { e.preventDefault(); shoot(); }
      else if (e.key === 'Enter' && phase === 'review' && shot) { e.preventDefault(); void save(shot); }
      else if (e.key === 'ArrowRight' && phase !== 'saving') goPose((idx + 1) % poses.length);
      else if (e.key === 'ArrowLeft' && phase !== 'saving') goPose((idx - 1 + poses.length) % poses.length);
    };
    window.addEventListener('keydown', on); return () => window.removeEventListener('keydown', on);
  });

  const levelOk = level ? Math.abs(level.g) < 2.5 && Math.abs(level.b - 90) < 12 : false;
  const allDone = poses.every((p) => taken[p]);
  const doneCount = poses.filter((p) => taken[p]).length;
  const isLast = nextMissing(idx, { ...taken, [pose]: 'x' }) < 0;
  const cycleGuide = () => setGuide((g) => (g === 'body' ? (ghost ? 'ghost' : 'none') : g === 'ghost' ? 'none' : 'body'));
  const guideLabel = guideNow === 'body' ? 'Silhueta' : guideNow === 'ghost' ? 'Foto anterior' : 'Sem guia';

  return (
    <div className={'cam' + (closing ? ' out' : '')} role="dialog" aria-modal="true" aria-label={`Câmera guiada · ${poseLabel(pose)}`}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); void openFile(e.dataTransfer.files?.[0]); }}>
      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { void openFile(e.target.files?.[0]); e.target.value = ''; }} />

      <header className="cam-top">
        <button type="button" className="cam-ib" onClick={close} aria-label="Fechar câmera"><X size={22} /></button>
        <div className="cam-title">
          <b>{phase === 'done' ? 'Fotos prontas' : poseLabel(pose)}</b>
          <small>{spec.title}{spec.subtitle ? ' · ' + spec.subtitle : ''}</small>
        </div>
        {phase !== 'done' ? (
          <button type="button" className={'cam-chip' + (guideNow !== 'none' ? ' on' : '')} onClick={cycleGuide} aria-label={`Guia: ${guideLabel}. Toque para trocar`}>
            {guideNow === 'body' ? <PersonStanding size={16} /> : guideNow === 'ghost' ? <History size={16} /> : <EyeOff size={16} />}<span>{guideLabel}</span>
          </button>
        ) : <span className="cam-ib-space" />}
      </header>

      <nav className="cam-poses" aria-label="Poses">
        {poses.map((p, j) => (
          <button type="button" key={p} className={'cam-pose' + (j === idx && phase !== 'done' ? ' on' : '') + (taken[p] ? ' has' : '')} onClick={() => goPose(j)} aria-current={j === idx}>
            <span className="cp-thumb">{taken[p] ? <img src={taken[p]} alt="" /> : parse(poseSvg(p))}{taken[p] && <i><Check size={11} strokeWidth={3} /></i>}</span>
            <span className="cp-l">{poseShort(p)}</span>
          </button>
        ))}
      </nav>

      <div className="cam-mid">
        {phase === 'done' ? (
          <div className="cam-done">
            <span className="cd-ok"><Check size={30} strokeWidth={2.6} /></span>
            <h3>{doneCount === poses.length ? 'Todas as poses registradas' : `${doneCount} de ${poses.length} poses registradas`}</h3>
            <p>As fotos já estão salvas nesta avaliação. Toque numa pose acima para refazer.</p>
            <div className="cd-grid">{poses.map((p, j) => (
              <button type="button" key={p} onClick={() => goPose(j)} className={taken[p] ? '' : 'empty'}>
                {taken[p] ? <img src={taken[p]} alt={poseLabel(p)} /> : parse(poseSvg(p))}<span>{poseShort(p)}</span>
              </button>
            ))}</div>
          </div>
        ) : (
          <div ref={stage} className={'cam-stage' + (drag ? ' drag' : '') + (phase === 'adjust' ? ' adjusting' : '')}
            onPointerDown={onPtrDown} onPointerMove={onPtrMove} onPointerUp={onPtrUp} onPointerCancel={onPtrUp} onWheel={onWheel}>
            {/* vídeo ao vivo */}
            <video ref={video} className={'cam-video' + (mirror ? ' mirror' : '') + (phase === 'live' && cam === 'on' ? '' : ' hidden')} playsInline muted autoPlay />
            {/* revisão */}
            {phase !== 'adjust' && shot && <img className="cam-shot" src={shot.url} alt={`Foto ${poseLabel(pose)}`} />}
            {/* ajuste (galeria) */}
            {adj && phase !== 'review' && (
              <img className="cam-adj" src={adj.url} alt="" draggable={false}
                style={{ width: adj.img.naturalWidth * base * adj.z, height: adj.img.naturalHeight * base * adj.z, transform: `translate(calc(-50% + ${adj.x}px), calc(-50% + ${adj.y}px))` }} />
            )}
            {/* câmera indisponível */}
            {phase === 'live' && cam !== 'on' && (
              <div className="cam-msg">
                {cam === 'starting' ? <><span className="cam-spin" /><p>Abrindo a câmera…</p></> : (
                  <>
                    <p><b>{cam === 'denied' ? 'Sem permissão para a câmera' : 'Câmera indisponível'}</b></p>
                    <p>{cam === 'denied' ? 'Libere o acesso nas configurações do navegador ou escolha uma foto da galeria.' : 'Escolha uma foto da galeria' + (isTouch() ? '.' : ' ou arraste uma imagem para cá.')}</p>
                    <Button variant="original" type="button" className="btn primary sm" onClick={() => file.current?.click()}><ImagePlus size={18} /> Escolher foto</Button>
                  </>
                )}
              </div>
            )}
            {/* guias */}
            {grid && phase !== 'review' && <div className="cam-grid" aria-hidden="true" />}
            {guideNow === 'ghost' && ghost && phase !== 'review' && <img className="cam-ghost" src={ghost} alt="" />}
            {guideNow !== 'none' && phase !== 'review' && <div className={'cam-guide ' + guideNow}>{parse(poseSvg(pose, { guides: true }))}</div>}
            {guideNow === 'ghost' && ghost && phase !== 'review' && spec.ghostLabel && <span className="cam-tag">{spec.ghostLabel}</span>}
            {/* nível */}
            {level && phase === 'live' && cam === 'on' && (
              <div className={'cam-level' + (levelOk ? ' ok' : '')} aria-live="polite">
                <i style={{ transform: `rotate(${Math.max(-30, Math.min(30, -level.g))}deg)` }} />
                <span>{levelOk ? 'Nivelado' : Math.abs(level.b - 90) >= 12 ? (level.b < 90 ? 'Incline para trás' : 'Incline para frente') : 'Endireite o celular'}</span>
              </div>
            )}
            {count !== null && <div className="cam-count" key={count} onClick={cancelCount}>{count}</div>}
            {flash > 0 && <div className="cam-flash" key={'f' + flash} />}
            {drag && <div className="cam-drop"><ImagePlus size={30} /><b>Solte a foto aqui</b></div>}
            {phase === 'saving' && <div className="cam-saving"><span className="cam-spin" /></div>}
          </div>
        )}
      </div>

      {phase !== 'done' && (
        <p className="cam-hint">{err ? <span className="err">{err}</span> : phase === 'adjust' ? 'Arraste e amplie a foto até o corpo encaixar na silhueta.' : phase === 'review' ? 'Confira o enquadramento: cabeça e pés entre as linhas.' : poseHint(pose)}</p>
      )}

      {phase === 'live' && (
        <div className="cam-tools">
          <button type="button" className={'cam-chip' + (timer ? ' on' : '')} onClick={() => setTimer(TIMERS[(TIMERS.indexOf(timer) + 1) % TIMERS.length]!)} aria-label={`Temporizador: ${timer ? timer + ' segundos' : 'desligado'}`}>
            {timer ? <Timer size={16} /> : <TimerOff size={16} />}<span>{timer ? `${timer}s` : 'Timer'}</span>
          </button>
          <button type="button" className={'cam-chip' + (grid ? ' on' : '')} onClick={() => setGrid(!grid)} aria-pressed={grid}><Grid3x3 size={16} /><span>Grade</span></button>
          {torchOk && <button type="button" className={'cam-chip' + (torch ? ' on' : '')} onClick={() => void toggleTorch()} aria-pressed={torch}>{torch ? <Zap size={16} /> : <ZapOff size={16} />}<span>Luz</span></button>}
          {levelAsk && <button type="button" className="cam-chip" onClick={() => void askLevel()}><Crosshair size={16} /><span>Ativar nível</span></button>}
        </div>
      )}

      <footer className="cam-bar">
        {phase === 'live' && (
          <>
            <button type="button" className="cam-side" onClick={() => file.current?.click()} aria-label="Escolher da galeria"><ImagePlus size={22} /><span>Galeria</span></button>
            <button type="button" className={'cam-shutter' + (count !== null ? ' counting' : '')} onClick={count !== null ? cancelCount : shoot} disabled={cam !== 'on'} aria-label={count !== null ? 'Cancelar temporizador' : `Tirar foto: ${poseLabel(pose)}`}><i /></button>
            {multi ? <button type="button" className="cam-side" onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))} aria-label="Trocar câmera"><SwitchCamera size={22} /><span>Virar</span></button> : <span className="cam-side ghost" />}
          </>
        )}
        {(phase === 'review' || (phase === 'saving' && shot)) && shot && (
          <>
            <Button variant="original" type="button" className="btn ghost cam-btn" onClick={() => { setShot(null); setPhase('live'); }} disabled={phase === 'saving'}><RotateCcw size={18} /> Refazer</Button>
            <Button variant="original" type="button" className="btn primary cam-btn main" onClick={() => void save(shot)} disabled={phase === 'saving'}><Check size={18} /> {isLast ? 'Usar foto' : 'Usar e próxima'}</Button>
          </>
        )}
        {(phase === 'adjust' || (phase === 'saving' && adj)) && adj && (
          <div className="cam-adjbar">
            <label className="cam-zoom"><span>Zoom</span><input type="range" min={0.5} max={4} step={0.01} value={adj.z} onChange={(e) => setZoom(Number(e.target.value))} aria-label="Zoom da foto" /></label>
            <div className="cam-adjbtns">
              <Button variant="original" type="button" className="btn ghost cam-btn" onClick={() => { setAdj(null); setPhase('live'); }} disabled={phase === 'saving'}>Cancelar</Button>
              <Button variant="original" type="button" className="btn primary cam-btn main" onClick={() => void useAdjusted()} disabled={phase === 'saving'}><Check size={18} /> {isLast ? 'Usar foto' : 'Usar e próxima'}</Button>
            </div>
          </div>
        )}
        {phase === 'done' && (
          <Button variant="original" type="button" className="btn primary cam-btn main wide" onClick={close}><Check size={18} /> Concluir</Button>
        )}
      </footer>
      {!allDone && phase === 'live' && doneCount > 0 && <span className="cam-progress" aria-hidden="true">{doneCount}/{poses.length}</span>}
    </div>
  );
}
