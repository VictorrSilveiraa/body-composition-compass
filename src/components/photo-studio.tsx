import { useEffect, useRef, useState } from 'react';
import { Download, Share2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { POSES, poseLabel, type Pose } from '@/lib/poses.js';
import { fmt } from '@/lib/calculos.js';
import {
  DEFAULT_DESIGN, FORMATS, FORMAT_KEYS, LAYOUTS, THEMES, THEME_KEYS, drawStudio, studioBlob, studioFonts,
  type Design, type FaceMode, type LayoutKey, type Scene, type SceneStat, type Shot, type StatKey,
} from '@/lib/photo-studio';

/*
 * Estúdio de imagens das fotos de acompanhamento (nutricionista e portal do paciente):
 * escolhe formato (Stories, Feed, Quadrado, Paisagem), arranjo, cores, textos, resultados e privacidade,
 * vê a prévia e baixa ou compartilha.
 */
export type StudioAssess = { id: string; date: string; weight: number | null; bf: number | null; lean: number | null; waist: number | null };
export type StudioPhoto = { aid: string; pose: Pose; load: () => Promise<Blob> };
export type StudioSpec = {
  who: 'nutri' | 'patient';
  patient: string;
  signature: string; // sugestão de assinatura (nome e CRN do nutricionista)
  assessments: StudioAssess[]; // da mais antiga para a mais recente
  photos: StudioPhoto[];
  pose?: string; a?: string; b?: string;
  onClose?: () => void;
};

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const dShort = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d} ${MONTHS[Number(m) - 1]} ${y}`; };
const days = (a: string, b: string) => Math.round((Date.parse(b + 'T12:00') - Date.parse(a + 'T12:00')) / 864e5);
const sign = (v: number, d = 1) => (v > 0.0001 ? '+' : v < -0.0001 ? '−' : '') + fmt(Math.abs(v), d);
const STATS: { k: StatKey; l: string; u: string; get: (a: StudioAssess) => number | null; now: string }[] = [
  { k: 'weight', l: 'de peso', u: 'kg', get: (a) => a.weight, now: 'peso' },
  { k: 'bf', l: 'de gordura', u: 'pp', get: (a) => a.bf, now: 'de gordura' },
  { k: 'lean', l: 'de massa magra', u: 'kg', get: (a) => a.lean, now: 'massa magra' },
  { k: 'waist', l: 'de cintura', u: 'cm', get: (a) => a.waist, now: 'cintura' },
];
type Tab = 'modelo' | 'fotos' | 'estilo' | 'textos' | 'privacidade';
const TABS: [Tab, string][] = [['modelo', 'Modelo'], ['fotos', 'Fotos'], ['estilo', 'Estilo'], ['textos', 'Textos'], ['privacidade', 'Privacidade']];
const PRESETS: { k: string; l: string; d: string; p: Partial<Design> }[] = [
  { k: 'story', l: 'Stories', d: 'Antes e depois em tela cheia', p: { format: 'story', layout: 'side', theme: 'dark', bleed: false, fit: 'cover', stats: ['weight', 'bf'], face: 'none' } },
  { k: 'feed', l: 'Post no feed', d: 'Lado a lado com resultados', p: { format: 'feed', layout: 'side', theme: 'light', bleed: false, fit: 'cover', stats: ['weight', 'bf', 'waist'], face: 'none' } },
  { k: 'split', l: 'Corte diagonal', d: 'Uma moldura, duas fotos', p: { format: 'square', layout: 'split', theme: 'white', bleed: false, fit: 'cover', stats: ['weight', 'bf'], face: 'none' } },
  { k: 'tl', l: 'Linha do tempo', d: 'A evolução em várias datas', p: { format: 'feed', layout: 'timeline', theme: 'sand', bleed: false, fit: 'cover', stats: ['weight', 'bf'], face: 'none' } },
  { k: 'poses', l: 'Todas as poses', d: 'Frente, costas e laterais', p: { format: 'story', layout: 'grid', theme: 'green', bleed: false, fit: 'cover', stats: ['weight', 'bf'], face: 'none' } },
  { k: 'disc', l: 'Discreto', d: 'Rosto desfocado, sem números', p: { format: 'feed', layout: 'side', theme: 'white', bleed: false, fit: 'cover', stats: [], face: 'blur', showName: false } },
];

const store = (who: string) => 'avf.studio.' + who;
function loadDesign(spec: StudioSpec): Design {
  const base: Design = { ...DEFAULT_DESIGN, title: spec.who === 'patient' ? 'Minha evolução' : 'Antes e depois', signature: spec.signature };
  try { const s = JSON.parse(localStorage.getItem(store(spec.who)) || 'null') as Partial<Design> | null; if (s) return { ...base, ...s, title: base.title, signature: s.signature ?? base.signature }; } catch { /* sem armazenamento */ }
  return base;
}

export function PhotoStudio({ spec, onEnd }: { spec: StudioSpec; onEnd: () => void }) {
  const [d, setD] = useState<Design>(() => loadDesign(spec));
  const set = (p: Partial<Design>) => setD((o) => ({ ...o, ...p }));
  const [tab, setTab] = useState<Tab>('modelo');
  const [mime, setMime] = useState<'image/jpeg' | 'image/png'>('image/jpeg');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [closing, setClosing] = useState(false);
  const [, setTick] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const bmps = useRef(new Map<string, ImageBitmap | 'err' | 'wait'>());

  const list = spec.assessments;
  const has = (aid: string, k: string) => spec.photos.some((p) => p.aid === aid && p.pose === k);
  const poses = POSES.filter((P) => spec.photos.some((p) => p.pose === P.k));
  const [pose, setPose] = useState<string>(() => (poses.some((P) => P.k === spec.pose) ? spec.pose! : poses[0]?.k ?? 'front'));
  const dated = list.filter((a) => has(a.id, pose));
  const [aId, setA] = useState(spec.a ?? '');
  const [bId, setB] = useState(spec.b ?? '');
  const A = dated.find((a) => a.id === aId) ?? dated[0], B = dated.find((a) => a.id === bId) ?? dated.at(-1);
  const two = !!A && !!B && A.id !== B.id;
  const spread = (n: number) => { if (dated.length <= n) return dated.map((a) => a.id); const out: string[] = []; for (let i = 0; i < n; i++) out.push(dated[Math.round((i * (dated.length - 1)) / (n - 1))]!.id); return [...new Set(out)]; };
  const [tl, setTl] = useState<string[]>([]);
  const tlIds = (tl.filter((id) => dated.some((a) => a.id === id)).length >= 2 ? tl.filter((id) => dated.some((a) => a.id === id)) : spread(4));
  const gridPoses = two ? POSES.filter((P) => has(A!.id, P.k) && has(B!.id, P.k)) : [];
  const [gp, setGp] = useState<string[]>([]);
  const gridSel = gp.filter((k) => gridPoses.some((P) => P.k === k)).length ? gridPoses.filter((P) => gp.includes(P.k)) : gridPoses;
  const layoutOk = (k: LayoutKey) => k === 'single' || (k === 'grid' ? gridPoses.length >= 1 && two : k === 'timeline' ? dated.length >= 2 : two);
  const layout: LayoutKey = layoutOk(d.layout) ? d.layout : two ? 'side' : 'single';

  useEffect(() => { try { const { title: _t, ...keep } = d; localStorage.setItem(store(spec.who), JSON.stringify(keep)); } catch { /* ok */ } }, [d, spec.who]);
  useEffect(() => { void studioFonts().then(() => setTick((t) => t + 1)); }, []);

  /* fotos: carrega sob demanda e guarda (cada uma só uma vez) */
  const bmp = (aid: string, k: string): ImageBitmap | null => {
    const key = aid + '|' + k, v = bmps.current.get(key);
    if (v && v !== 'wait' && v !== 'err') return v;
    if (!v) {
      const ph = spec.photos.find((p) => p.aid === aid && p.pose === k);
      if (ph) {
        bmps.current.set(key, 'wait');
        void ph.load().then((b) => createImageBitmap(b, { imageOrientation: 'from-image' } as ImageBitmapOptions))
          .then((im) => { bmps.current.set(key, im); setTick((t) => t + 1); })
          .catch(() => { bmps.current.set(key, 'err'); setMsg('Uma das fotos não carregou. Verifique a conexão.'); });
      }
    }
    return null;
  };
  useEffect(() => () => { for (const v of bmps.current.values()) if (v && typeof v !== 'string') v.close?.(); }, []);

  /* cena: as fotos de acordo com o arranjo + resultados entre a primeira e a última data */
  const scene: Scene = (() => {
    const shot = (a: StudioAssess, k: string, label: string): Shot => ({ img: bmp(a.id, k), label, date: dShort(a.date) });
    let shots: Shot[] = [], from = A, to = B;
    if (layout === 'single') shots = B ? [shot(B, pose, poseLabel(pose))] : [];
    else if (layout === 'timeline') { const sel = dated.filter((a) => tlIds.includes(a.id)); shots = sel.map((a, i) => shot(a, pose, i === 0 ? 'Início' : `+${days(sel[0]!.date, a.date)} dias`)); from = sel[0]; to = sel.at(-1); }
    else if (layout === 'grid' && two) shots = [...gridSel.map((P) => shot(A!, P.k, `Antes · ${P.s}`)), ...gridSel.map((P) => shot(B!, P.k, `Depois · ${P.s}`))];
    else if (two) shots = [shot(A!, pose, 'Antes'), shot(B!, pose, 'Depois')];
    const cmp = !!from && !!to && from.id !== to.id;
    const stats: SceneStat[] = STATS.flatMap((S) => {
      const b = to ? S.get(to) : null, a = from ? S.get(from) : null; if (b == null) return [];
      if (!cmp) return [{ k: S.k, v: `${fmt(b, 1)} ${S.k === 'bf' ? '%' : S.u}`, l: S.now }];
      if (a == null) return [];
      return [{ k: S.k, v: `${sign(b - a)} ${S.u}`, l: S.l }];
    });
    const range = cmp ? `${dShort(from!.date)} → ${dShort(to!.date)}  ·  ${days(from!.date, to!.date)} dias` : to ? dShort(to.date) : '';
    return { name: spec.patient, shots, range, stats, ...(layout === 'grid' && two ? { grid: gridSel.length } : {}) };
  })();

  useEffect(() => { if (canvas.current) drawStudio(canvas.current, { ...d, layout }, scene, 1); });

  const close = () => { if (closing) return; setClosing(true); window.setTimeout(() => { spec.onClose?.(); onEnd(); }, 200); };
  useEffect(() => { const on = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); }; window.addEventListener('keydown', on); return () => window.removeEventListener('keydown', on); });

  const loading = scene.shots.some((s) => !s.img);
  const fileName = () => `${spec.who === 'patient' ? 'minha-evolucao' : 'antes-e-depois'}-${spec.patient.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'paciente'}-${d.format}.${mime === 'image/png' ? 'png' : 'jpg'}`;
  const out = async (share: boolean) => {
    if (loading || busy) return;
    setBusy(true); setMsg('');
    try {
      const blob = await studioBlob({ ...d, layout }, scene, mime), name = fileName();
      const file = typeof File === 'function' ? new File([blob], name, { type: mime }) : null;
      if (share && file && navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: d.title || 'Antes e depois' }); return; } catch (e) { if ((e as { name?: string })?.name === 'AbortError') return; }
      }
      const u = URL.createObjectURL(blob), el = document.createElement('a'); el.href = u; el.download = name; document.body.appendChild(el); el.click(); el.remove();
      window.setTimeout(() => URL.revokeObjectURL(u), 1500);
      setMsg(share ? 'Este aparelho não compartilha arquivos: a imagem foi baixada.' : 'Imagem baixada ✓');
    } catch (e) { setMsg((e as Error)?.message || 'Não foi possível gerar a imagem'); }
    finally { setBusy(false); }
  };
  const canShare = typeof navigator !== 'undefined' && !!navigator.canShare && matchMediaSafe('(pointer: coarse)');
  const F = FORMATS[d.format], k = d.hd ? 2 : 1;

  const Seg = <T extends string>({ v, opts, on, label }: { v: T; opts: [T, string][]; on: (x: T) => void; label: string }) => (
    <div className="seg ps-seg" role="radiogroup" aria-label={label}>{opts.map(([k2, l]) => <button key={k2} type="button" role="radio" aria-checked={v === k2} className={v === k2 ? 'on' : ''} onClick={() => on(k2)}>{l}</button>)}</div>
  );
  const Toggle = ({ on, label, sub, flip }: { on: boolean; label: string; sub?: string | undefined; flip: () => void }) => (
    <button type="button" className="toggle ps-tg" aria-pressed={on} onClick={flip}><span><b>{label}</b>{sub && <small>{sub}</small>}</span><span className={'switch' + (on ? ' on' : '')} /></button>
  );
  const datePick = (label: string, v: string | undefined, onPick: (id: string) => void, cls: string) => (
    <label className={'ps-field ' + cls}><small>{label}</small>
      <select value={v} onChange={(e) => onPick(e.target.value)}>{dated.slice().reverse().map((a) => <option key={a.id} value={a.id}>{dShort(a.date)}{a.weight != null ? ` · ${fmt(a.weight, 1)} kg` : ''}</option>)}</select>
    </label>
  );

  return (
    <div className={'ps' + (closing ? ' out' : '')} role="dialog" aria-modal="true" aria-label="Criar imagem para redes sociais">
      <header className="ps-top">
        <button type="button" className="icon-btn" onClick={close} aria-label="Fechar"><X size={22} /></button>
        <div className="ps-title"><b>Criar imagem</b><small>{spec.patient}</small></div>
        <div className="ps-acts">
          {canShare && <Button variant="original" type="button" className="btn ghost sm" disabled={loading || busy} onClick={() => void out(true)}><Share2 size={17} /> Compartilhar</Button>}
          <Button variant="original" type="button" className="btn dark sm" disabled={loading || busy} onClick={() => void out(false)}><Download size={17} /> {busy ? 'Gerando…' : 'Baixar'}</Button>
        </div>
      </header>
      <div className="ps-body">
        <div className="ps-stage">
          <div className="ps-fit"><div className="ps-canvas" style={{ ['--r' as string]: String(F.w / F.h) }}>
            <canvas ref={canvas} aria-label="Prévia da imagem" />
            {loading && <span className="ps-load"><span className="cam-spin" /> Carregando fotos…</span>}
          </div></div>
          <p className="ps-dim">{F.l} · {F.r} · {F.w * k} × {F.h * k} px{msg ? <> · <b>{msg}</b></> : null}</p>
        </div>
        <div className="ps-panel">
          <nav className="ps-tabs" role="tablist" aria-label="Opções">{TABS.map(([k2, l]) => <button key={k2} type="button" role="tab" aria-selected={tab === k2} className={'chip' + (tab === k2 ? ' on' : '')} onClick={() => setTab(k2)}>{l}</button>)}</nav>

          {tab === 'modelo' && <div className="ps-sec">
            <h4>Modelos prontos</h4>
            <div className="ps-presets">{PRESETS.map((P) => {
              const ok = layoutOk(P.p.layout!);
              return <button key={P.k} type="button" disabled={!ok} className={'ps-preset' + (d.format === P.p.format && layout === P.p.layout && d.theme === P.p.theme ? ' on' : '')} onClick={() => set(P.p)}>
                <i className={'ps-ratio r-' + P.p.format} style={{ background: THEMES[P.p.theme!].bg }} /><span><b>{P.l}</b><small>{ok ? P.d : 'Precisa de 2 datas com foto'}</small></span></button>;
            })}</div>
            <h4>Formato</h4>
            <div className="ps-formats">{FORMAT_KEYS.map((f) => <button key={f} type="button" className={'ps-format' + (d.format === f ? ' on' : '')} onClick={() => set({ format: f })}>
              <i className={'ps-ratio r-' + f} /><b>{FORMATS[f].l}</b><small>{FORMATS[f].r} · {FORMATS[f].d}</small></button>)}</div>
            <h4>Organização</h4>
            <div className="ps-layouts">{LAYOUTS.map((L) => <button key={L.k} type="button" disabled={!layoutOk(L.k)} className={'ps-layout' + (layout === L.k ? ' on' : '')} onClick={() => set({ layout: L.k })}>
              <i className={'ps-lay l-' + L.k}><span /><span /></i><b>{L.l}</b><small>{layoutOk(L.k) ? L.d : L.k === 'grid' ? 'Precisa das mesmas poses nas 2 datas' : 'Precisa de 2 datas com foto'}</small></button>)}</div>
          </div>}

          {tab === 'fotos' && <div className="ps-sec">
            {layout !== 'grid' && <><h4>Pose</h4>
              <div className="ps-chips">{poses.map((P) => <button key={P.k} type="button" className={'chip' + (pose === P.k ? ' on' : '')} onClick={() => setPose(P.k)}>{P.l}<span className="n">{list.filter((a) => has(a.id, P.k)).length}</span></button>)}</div></>}
            {layout === 'timeline' ? <><h4>Datas <span>até 4</span></h4>
              <div className="ps-dates">{dated.map((a) => { const on = tlIds.includes(a.id); return <button key={a.id} type="button" className={'ps-date' + (on ? ' on' : '')} aria-pressed={on}
                onClick={() => { const cur = tlIds; const next = on ? cur.filter((x) => x !== a.id) : cur.length >= 4 ? cur : [...cur, a.id]; if (next.length >= 2) setTl(next); else setMsg('A linha do tempo precisa de pelo menos 2 datas'); }}>
                <b>{dShort(a.date)}</b><small>{a.weight != null ? `${fmt(a.weight, 1)} kg` : ''}</small></button>; })}</div></>
              : <div className="ps-ab">
                {layout !== 'single' && datePick('Antes', A?.id, setA, 'a')}
                {datePick(layout === 'single' ? 'Foto' : 'Depois', B?.id, setB, 'b')}
                {layout === 'single' && two && <p className="ps-hint">Os resultados comparam com {dShort(A!.date)}. Para mostrar só os valores atuais, escolha a mesma data no modo Lado a lado.</p>}
              </div>}
            {layout === 'grid' && two && <><h4>Poses</h4>
              <div className="ps-chips">{gridPoses.map((P) => { const on = gridSel.some((x) => x.k === P.k); return <button key={P.k} type="button" className={'chip' + (on ? ' on' : '')} aria-pressed={on}
                onClick={() => { const cur = gridSel.map((x) => x.k); const next = on ? cur.filter((x) => x !== P.k) : [...cur, P.k]; if (next.length) setGp(next); }}>{P.l}</button>; })}</div></>}
            <h4>Enquadramento</h4>
            <Seg label="Encaixe" v={d.fit} opts={[['cover', 'Preencher'], ['contain', 'Foto inteira']]} on={(fit) => set({ fit })} />
            <label className="ps-range"><span>Zoom <b>{Math.round(d.zoom * 100)}%</b></span><input type="range" min={100} max={160} step={2} value={Math.round(d.zoom * 100)} onChange={(e) => set({ zoom: Number(e.target.value) / 100 })} /></label>
            <label className="ps-range"><span>Posição vertical <b>{d.shiftY < -0.05 ? 'mais acima' : d.shiftY > 0.05 ? 'mais abaixo' : 'centro'}</b></span><input type="range" min={-100} max={100} step={5} value={Math.round(d.shiftY * 100)} onChange={(e) => set({ shiftY: Number(e.target.value) / 100 })} /></label>
            <p className="ps-hint">O zoom e a posição valem para todas as fotos da imagem, para manter a comparação justa.</p>
          </div>}

          {tab === 'estilo' && <div className="ps-sec">
            <h4>Cor de fundo</h4>
            <div className="ps-themes">{THEME_KEYS.map((t) => <button key={t} type="button" className={'ps-theme' + (d.theme === t ? ' on' : '')} onClick={() => set({ theme: t })} aria-label={THEMES[t].l} title={THEMES[t].l}>
              <i style={{ background: THEMES[t].bg, color: THEMES[t].fg }}>Aa</i><small>{THEMES[t].l}</small></button>)}</div>
            <h4>Moldura</h4>
            <Seg label="Moldura" v={d.bleed ? 'b' : 'm'} opts={[['m', 'Com margem'], ['b', 'Fotos até a borda']]} on={(v) => set({ bleed: v === 'b' })} />
            <h4>Qualidade</h4>
            <Seg label="Tamanho" v={d.hd ? 'hd' : 'n'} opts={[['n', `Redes sociais (${F.w} px)`], ['hd', `Alta (${F.w * 2} px)`]]} on={(v) => set({ hd: v === 'hd' })} />
            <Seg label="Arquivo" v={mime} opts={[['image/jpeg', 'JPG · menor'], ['image/png', 'PNG · sem perda']]} on={setMime} />
          </div>}

          {tab === 'textos' && <div className="ps-sec">
            <label className="ps-field"><small>Título</small><input value={d.title} maxLength={60} onChange={(e) => set({ title: e.target.value, showTitle: true })} placeholder="Ex.: 6 meses de foco" /></label>
            <div className="ps-chips ps-sugg">{(spec.who === 'patient' ? ['Minha evolução', 'Antes e depois', `${scene.range ? scene.range.split('·').pop()!.trim() : ''} de foco`, 'Constância > perfeição'] : ['Antes e depois', 'Resultado real', `${scene.range ? scene.range.split('·').pop()!.trim() : ''} de acompanhamento`, 'Evolução da paciente']).filter((t) => !t.startsWith(' ')).map((t) =>
              <button key={t} type="button" className="chip" onClick={() => set({ title: t, showTitle: true })}>{t}</button>)}</div>
            <Toggle on={d.showTitle} label="Mostrar título" flip={() => set({ showTitle: !d.showTitle })} />
            <Toggle on={d.showRange} label="Datas e tempo de acompanhamento" sub={scene.range || undefined} flip={() => set({ showRange: !d.showRange })} />
            <Toggle on={d.showLabels} label="Rótulos nas fotos" sub="Antes, Depois, Início, +90 dias…" flip={() => set({ showLabels: !d.showLabels })} />
            <Toggle on={d.showDates} label="Data em cada foto" flip={() => set({ showDates: !d.showDates })} />
            <Toggle on={d.showName} label="Nome do paciente" sub={spec.who === 'nutri' ? 'Só publique com autorização do paciente' : spec.patient} flip={() => set({ showName: !d.showName })} />
            <h4>Resultados</h4>
            <div className="ps-chips">{STATS.map((S) => { const avail = scene.stats.some((s) => s.k === S.k), on = d.stats.includes(S.k); return <button key={S.k} type="button" disabled={!avail} className={'chip' + (on && avail ? ' on' : '')} aria-pressed={on}
              onClick={() => set({ stats: on ? d.stats.filter((x) => x !== S.k) : [...d.stats, S.k] })}>{S.k === 'weight' ? 'Peso' : S.k === 'bf' ? '% de gordura' : S.k === 'lean' ? 'Massa magra' : 'Cintura'}</button>; })}</div>
            <h4>Assinatura</h4>
            <label className="ps-field"><small>{spec.who === 'nutri' ? 'Seu nome, CRN e @ do Instagram' : 'Texto no rodapé'}</small><input value={d.signature} maxLength={80} onChange={(e) => set({ signature: e.target.value, showSign: true })} placeholder={spec.who === 'nutri' ? 'Dra. Ana · CRN-3 12345 · @dra.ana' : 'Acompanhamento: …'} /></label>
            <Toggle on={d.showSign} label="Mostrar assinatura" flip={() => set({ showSign: !d.showSign })} />
          </div>}

          {tab === 'privacidade' && <div className="ps-sec">
            <h4>Rosto</h4>
            <Seg label="Rosto" v={d.face} opts={[['none', 'Mostrar'], ['blur', 'Desfocar'], ['crop', 'Cortar']] as [FaceMode, string][]} on={(face) => set({ face })} />
            {d.face !== 'none' && <label className="ps-range"><span>Altura escondida <b>{Math.round(d.faceH * 100)}% da foto</b></span><input type="range" min={8} max={40} step={1} value={Math.round(d.faceH * 100)} onChange={(e) => set({ faceH: Number(e.target.value) / 100 })} /></label>}
            <p className="ps-hint">{d.face === 'blur' ? 'Desfoca o alto de cada foto, onde fica o rosto. Ajuste a altura até cobrir o rosto por inteiro.' : d.face === 'crop' ? 'Corta o alto de cada foto: a imagem começa do pescoço para baixo.' : 'Para publicar sem identificar o paciente, desfoque ou corte o rosto.'}</p>
            <Toggle on={d.showName} label="Nome do paciente na imagem" flip={() => set({ showName: !d.showName })} />
            <p className="ps-note">{spec.who === 'nutri'
              ? 'Fotos de pacientes são dados sensíveis. Só publique com autorização por escrito do paciente e siga o código de ética do CFN sobre divulgação de imagens.'
              : 'A imagem é gerada aqui no seu aparelho. Você decide se e onde publicar.'}</p>
          </div>}
        </div>
      </div>
    </div>
  );
}
function matchMediaSafe(q: string) { try { return matchMedia(q).matches; } catch { return false; } }
