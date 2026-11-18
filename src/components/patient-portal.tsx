import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import {
  Activity, ArrowDown, ArrowLeftRight, ArrowRight, ArrowUp, BookOpen, CalendarClock, Camera, ChevronLeft, ChevronRight, ClipboardList,
  Droplet, Equal, Flame, Heart, House, KeyRound, LogOut, MapPin, MessageCircle, RefreshCw, Ruler, Scale, ShieldCheck, Target, TrendingUp, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PhotoViewer, type ViewerSpec } from '@/components/photo-viewer';
import { calc, bmiClass, bfClass, whrRisk, fmt, fmtDate, toDate, today, ageAt, foldVal, CIRC_TRUNK, CIRC_LIMBS, FOLDS, PROTOCOLS, METRICS, GROUPS, firstName, initials } from '@/lib/calculos.js';
import { poseLabel, POSES } from '@/lib/poses.js';
import { fmtCode, isCode, normCode, type PortalData, type PortalPhoto } from '@/lib/portal-code';
import { getPatientPortal } from '@/lib/portal.functions';
import { pageReady, ripple, scan, withPageTransition } from '@/lib/motion';

/*
 * Portal do paciente: entrada com o código que o nutricionista compartilhou e um app SOMENTE de leitura,
 * com os mesmos menus, componentes e animações do sistema do nutricionista.
 */
const KEY = 'avf.portal.code';
const read = () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } };
const write = (c: string | null) => { try { if (c) localStorage.setItem(KEY, c); else localStorage.removeItem(KEY); } catch { /* sem armazenamento */ } };
type A = PortalData['assessments'][number];
type R = Record<string, unknown>;
type Metric = { k: string; l: string; u: string; dir: number; d?: number; get: (a: A, r: R) => number | null };
type Group = { g: string; items: Metric[] };
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const daysTo = (iso: string) => Math.round((toDate(iso).getTime() - toDate(today()).getTime()) / 864e5);
const addDays = (iso: string, d: number) => { const x = toDate(iso); x.setDate(x.getDate() + d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const dLong = (iso: string) => fmtDate(iso, { day: 'numeric', month: 'long', year: 'numeric' });
const dShort = (iso: string) => fmtDate(iso, { day: '2-digit', month: '2-digit', year: '2-digit' });
const GOAL: Record<string, string> = { emagrecimento: 'Emagrecimento', hipertrofia: 'Hipertrofia', saude: 'Saúde e bem-estar', performance: 'Performance esportiva', reeducacao: 'Reeducação alimentar', clinico: 'Acompanhamento clínico' };

/* ---------- peças visuais (iguais às do sistema do nutricionista) ---------- */
function Delta({ cur, prev, dir, unit = '', d = 1 }: { cur: unknown; prev: unknown; dir: number; unit?: string; d?: number }) {
  const a = num(cur), b = num(prev);
  if (a == null || b == null) return null;
  const diff = a - b;
  if (Math.abs(diff) < Math.pow(10, -d) / 2) return <span className="delta flat"><Equal /> igual</span>;
  const cls = dir === 0 ? 'neu' : diff * dir > 0 ? 'good' : 'bad';
  return <span className={'delta ' + cls}>{diff > 0 ? <ArrowUp /> : <ArrowDown />}{fmt(Math.abs(diff), d)}{unit ? ' ' + unit : ''}</span>;
}
function smoothPath(P: (readonly [number, number])[]) {
  if (P.length < 2) return '';
  const f = (p: readonly number[]) => p.map((n) => n.toFixed(1)).join(',');
  let d = `M${f(P[0]!)}`;
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[i - 1] ?? P[i]!, p1 = P[i]!, p2 = P[i + 1]!, p3 = P[i + 2] ?? p2;
    d += ` C${f([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6])} ${f([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6])} ${f(p2)}`;
  }
  return d;
}
function Spark({ vals, color = 'var(--blue-ink)' }: { vals: (number | null)[]; color?: string }) {
  const v = vals.filter((x): x is number => x != null);
  if (v.length < 2) return null;
  const W = 140, H = 44; let mn = Math.min(...v), mx = Math.max(...v); if (mn === mx) { mn -= 1; mx += 1; }
  const P = v.map((y, i) => [4 + (i * (W - 8)) / (v.length - 1), 6 + (1 - (y - mn) / (mx - mn)) * (H - 12)] as const);
  const L = P.at(-1)!;
  return (<>
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 44, marginTop: 8 }} preserveAspectRatio="none"><path d={smoothPath(P)} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" /></svg>
    <div style={{ position: 'relative', height: 0 }}><span className="spark-dot" style={{ position: 'absolute', right: `${((W - L[0]) / W) * 100}%`, bottom: `${((H - L[1]) / H) * 44 - 6}px`, transform: 'translateX(50%)', width: 12, height: 12, borderRadius: '50%', background: 'var(--green-2)', boxShadow: '0 0 0 3px var(--surface)' }} /></div>
  </>);
}
function Ring({ val, max = 40, color = 'var(--peach)' }: { val: number | null; max?: number; color?: string }) {
  const size = 150, sw = 14, r = (size - sw) / 2, C = 2 * Math.PI * r, arc = 0.75, v = Math.max(0, Math.min(1, (val ?? 0) / max));
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ transform: 'rotate(135deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ring-track)" strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${C * arc} ${C}`} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${C * arc * v} ${C}`} style={{ transition: 'stroke-dasharray .8s ease' }} />
    </svg>
  );
}
function LineChart({ pts, d = 1, color = 'var(--ink)', fill = 'var(--blue)' }: { pts: { date: string; y: number }[]; d?: number; color?: string; fill?: string }) {
  if (!pts.length) return <div className="empty"><p>Sem dados para esta medida ainda.</p></div>;
  const W = 400, H = 220, pl = 22, pr = 22, pt = 34, pb = 34, ys = pts.map((p) => p.y);
  let mn = Math.min(...ys), mx = Math.max(...ys); if (mn === mx) { mn -= 1; mx += 1; } const pad = (mx - mn) * 0.18; mn -= pad; mx += pad;
  const X = (i: number) => (pts.length === 1 ? W / 2 : pl + (i * (W - pl - pr)) / (pts.length - 1));
  const Y = (v: number) => pt + (1 - (v - mn) / (mx - mn)) * (H - pt - pb);
  const P = pts.map((p, i) => [X(i), Y(p.y)] as const), line = smoothPath(P);
  const area = line ? `${line} L${P.at(-1)![0]},${H - pb} L${P[0]![0]},${H - pb} Z` : '';
  const many = pts.length > 8, iMin = ys.indexOf(Math.min(...ys)), iMax = ys.indexOf(Math.max(...ys)), step = Math.ceil(pts.length / 6);
  const gid = useMemo(() => 'g' + Math.random().toString(36).slice(2, 7), []);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`De ${fmt(pts[0]!.y, d)} para ${fmt(pts.at(-1)!.y, d)}`}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={fill} stopOpacity=".95" /><stop offset="1" stopColor={fill} stopOpacity="0" /></linearGradient></defs>
      {[0, 0.5, 1].map((t) => <line key={t} x1={pl} x2={W - pr} y1={pt + t * (H - pt - pb)} y2={pt + t * (H - pt - pb)} stroke="var(--line)" strokeDasharray="3 6" />)}
      {area && <path d={area} fill={`url(#${gid})`} />}
      {line && <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />}
      {P.map((p, i) => (
        <g key={i}>
          <circle style={{ ['--i' as string]: i }} cx={p[0]} cy={p[1]} r={i === P.length - 1 ? 7 : 5} fill={i === P.length - 1 ? 'var(--yellow-2)' : 'var(--surface)'} stroke={color} strokeWidth="2.5" />
          {(!many || i === 0 || i === P.length - 1 || i === iMin || i === iMax) && <text className="pt-label" style={{ ['--i' as string]: i }} x={p[0]} y={p[1] - 14} textAnchor="middle" fontSize="17" fontWeight="600" fill="var(--ink)">{fmt(pts[i]!.y, d)}</text>}
          {(i % step === 0 || i === P.length - 1) && <text x={p[0]} y={H - 8} textAnchor={i === 0 && P.length > 1 ? 'start' : i === P.length - 1 && P.length > 1 ? 'end' : 'middle'} fontSize="14" fill="var(--muted)">{fmtDate(pts[i]!.date, { day: '2-digit', month: 'short' }).replace(' de ', ' ')}</text>}
        </g>
      ))}
    </svg>
  );
}
function Dpill({ iso, on }: { iso: string; on?: boolean }) {
  const d = toDate(iso);
  return <div className={'dpill' + (on ? ' on' : '')}><small>{d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</small><b>{String(d.getDate()).padStart(2, '0')}</b><small>{String(d.getFullYear()).slice(2)}</small></div>;
}
const Head = ({ title, sub, back, right }: { title: string; sub: string; back?: () => void; right?: ReactNode }) => (
  <header className="top">
    {back && <button className="icon-btn" onClick={back} aria-label="Voltar"><ChevronLeft className="ico" /></button>}
    <div className="title-block"><small>{sub}</small><b>{title}</b></div><div className="grow" />{right}
  </header>
);

function Ranges({ rows, now }: { rows: string[][]; now: string }) {
  return <div className="pp-ranges">{rows.map(([l, v]) => <div key={l} className={'pp-range' + (l === now ? ' on' : '')}><span>{l}{l === now && <em>você</em>}</span><b>{v}</b></div>)}</div>;
}
function Item({ t, icon, val, children, open }: { t: string; icon: ReactNode; val?: string | undefined; children: ReactNode; open?: boolean | undefined }) {
  return (<details className="card pp-gi" open={open}><summary><span className="chip-ico">{icon}</span><span className="grow"><b>{t}</b>{val && <small>Você: {val}</small>}</span><ChevronRight className="ico sm pp-gchev" /></summary><div className="pp-gb">{children}</div></details>);
}

/* ---------- entrada com código ---------- */
function Entry({ onEnter, error }: { onEnter: (c: string) => void; error: string }) {
  const [v, setV] = useState('');
  const ok = isCode(normCode(v));
  return (
    <main className="app"><div className="auth-wrap pp-entry">
      <div className="auth-mark"><span className="avatar"><Activity /></span>Avaliação Física</div>
      <div className="onb-hero"><span className="tag">Portal do paciente</span><h1 className="auth-title">Acompanhe sua evolução.</h1><p>Use o código que seu nutricionista enviou para ver suas avaliações, medidas e fotos.</p></div>
      <h2 className="sec">Entrar com código</h2>
      <form className="auth-form" onSubmit={(e) => { e.preventDefault(); if (ok) onEnter(normCode(v)); }}>
        <label className="field"><span className="f-label">Código de acesso</span>
          <div className="f-input text pp-code-in"><KeyRound size={18} />
            <input value={v} onChange={(e) => setV(fmtCode(e.target.value))} placeholder="XXXX-XXXX" autoComplete="one-time-code" autoCapitalize="characters" spellCheck={false} maxLength={9} aria-describedby="pp-help" autoFocus />
          </div>
        </label>
        <p id="pp-help" className="small muted">São 8 letras e números, como <b>K7QM-3HXA</b>. Maiúsculas ou minúsculas, tanto faz.</p>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <Button variant="original" type="submit" className="cta" disabled={!ok}><span className="c-ico"><KeyRound size={20} /></span><span>Ver minha evolução ›››</span><span className="c-ico"><ArrowRight size={20} /></span></Button>
      </form>
      <p className="pp-safe"><ShieldCheck size={16} /> Acesso somente para visualizar. Ninguém consegue alterar seus dados por aqui.</p>
      <div className="auth-links"><a href="/login">Sou nutricionista · entrar com e-mail</a></div>
    </div></main>
  );
}

/* ---------- app do paciente ---------- */
type Tab = 'inicio' | 'evolucao' | 'medidas' | 'fotos' | 'avaliacoes' | 'guia' | 'avaliacao';
const ORDER: Record<Tab, number> = { inicio: 0, evolucao: 1, medidas: 2, fotos: 3, avaliacoes: 4, avaliacao: 5, guia: 6 };
const readView = (): { tab: Tab; id: string | null } => {
  const q = new URLSearchParams(window.location.search), v = q.get('v') as Tab | null;
  return { tab: v && v in ORDER ? v : 'inicio', id: q.get('id') };
};

function PortalApp({ data, onExit, onRefresh }: { data: PortalData; onExit: () => void; onRefresh: () => void }) {
  const p = { sex: data.patient.sex, birth: data.patient.birth, height: data.patient.height };
  const sex = data.patient.sex;
  const list = useMemo(() => [...data.assessments].sort((x, y) => x.date.localeCompare(y.date)), [data]);
  const rs = useMemo(() => list.map((a) => calc(a, p) as R), [list]);
  const rOf = (a: A) => rs[list.indexOf(a)] ?? {};
  const last = list.at(-1), first = list[0], prev = list.at(-2);
  const rL = last ? rOf(last) : {}, rF = first ? rOf(first) : {}, rP = prev ? rOf(prev) : {};
  const fn = firstName(data.patient.name), nutriName = data.nutri.name || 'seu nutricionista';
  const crn = data.nutri.crn ? 'CRN ' + data.nutri.crn.replace(/^crn[\s:-]*/i, '') : '';
  const wa = data.nutri.phone ? 'https://wa.me/' + (() => { const d = data.nutri.phone.replace(/\D/g, ''); return d.length <= 11 ? '55' + d : d; })() : '';
  const hasPhotos = data.share.photos && data.photos.length > 0;
  const photoOf = (aid: string, k: string) => data.photos.find((x) => x.assessmentId === aid && x.pose === k);

  /* navegação entre telas (com transição e histórico do navegador) */
  const [view, setView] = useState(readView);
  const [dir, setDir] = useState('fwd');
  const host = useRef<HTMLElement>(null);
  const first0 = useRef(true);
  const go = (tab: Tab, id: string | null = null) => {
    if (tab === view.tab && id === view.id) return;
    const url = tab === 'inicio' ? window.location.pathname : `?v=${tab}${id ? `&id=${id}` : ''}`;
    withPageTransition(() => {
      flushSync(() => { setDir(ORDER[tab] >= ORDER[view.tab] ? 'fwd' : 'back'); setView({ tab, id }); });
      history.pushState(null, '', url);
    });
  };
  useEffect(() => {
    const on = () => withPageTransition(() => { flushSync(() => { const v = readView(); setDir('back'); setView(v); }); });
    window.addEventListener('popstate', on); return () => window.removeEventListener('popstate', on);
  }, []);
  useLayoutEffect(() => {
    if (!first0.current) window.scrollTo(0, 0);
    first0.current = false;
    scan(host.current, { fresh: true }); pageReady();
  }, [view]);
  useEffect(() => { document.addEventListener('pointerdown', ripple, { passive: true }); return () => document.removeEventListener('pointerdown', ripple); }, []);

  /* estados de cada tela */
  const [evo, setEvo] = useState('weight');
  const [evoTab, setEvoTab] = useState<'evo' | 'ab'>('evo');
  const [cmpA, setCmpA] = useState<string | null>(null), [cmpB, setCmpB] = useState<string | null>(null);
  const [base, setBase] = useState<'first' | 'prev'>('first');
  const [pose, setPose] = useState<string>('front');
  const [phA, setPhA] = useState<string | null>(null), [phB, setPhB] = useState<string | null>(null);
  const [mode, setMode] = useState<'side' | 'wipe' | 'fade'>('side');
  const [sx, setSx] = useState(50), [so, setSo] = useState(50);
  const [viewer, setViewer] = useState<ViewerSpec | null>(null);
  const drag = useRef(false);

  const openViewer = (k: string, aid: string) => {
    const items = list.filter((a) => photoOf(a.id, k)).map((a) => { const ph = photoOf(a.id, k)!; return { id: a.id + '|' + k, pose: k, title: poseLabel(k), sub: dLong(a.date), url: () => Promise.resolve(ph.url) }; });
    setViewer({ items, index: Math.max(0, items.findIndex((x) => x.id === aid + '|' + k)), onClose: () => {},
      onDownload: async (it) => { const [a, k2] = it.id.split('|'); const ph = photoOf(a!, k2!); if (!ph) return; const b = await (await fetch(ph.url)).blob(); const u = URL.createObjectURL(b); const el = document.createElement('a'); el.href = u; el.download = `minha-foto-${k2}-${list.find((x) => x.id === a)?.date ?? ''}.jpg`; el.click(); setTimeout(() => URL.revokeObjectURL(u), 1000); } });
  };
  const openAssessmentPhotos = (aid: string, k: string) => {
    const a = list.find((x) => x.id === aid)!;
    const items = POSES.filter((P) => photoOf(aid, P.k)).map((P) => ({ id: aid + '|' + P.k, pose: P.k, title: P.l, sub: dLong(a.date), url: () => Promise.resolve(photoOf(aid, P.k)!.url) }));
    setViewer({ items, index: Math.max(0, items.findIndex((x) => x.pose === k)), onClose: () => {} });
  };

  /* próximo retorno e frase de resumo */
  const every = data.patient.returnDays ?? data.nutri.returnDays ?? 30;
  const next = last ? addDays(last.date, every) : null, left = next ? daysTo(next) : null;
  const summary = (() => {
    if (!last || !first || list.length < 2) return last ? `${fn}, sua primeira avaliação está registrada!` : `${fn}, seu acompanhamento começa aqui.`;
    const parts: string[] = [];
    const dw = num(last.weight)! - num(first.weight)!;
    const df = num(rL['fatMass']) != null && num(rF['fatMass']) != null ? num(rL['fatMass'])! - num(rF['fatMass'])! : null;
    const dl = num(rL['leanMass']) != null && num(rF['leanMass']) != null ? num(rL['leanMass'])! - num(rF['leanMass'])! : null;
    if (df != null && Math.abs(df) >= 0.1) parts.push(`${df < 0 ? 'eliminou' : 'ganhou'} ${fmt(Math.abs(df))} kg de gordura`);
    else if (Math.abs(dw) >= 0.1) parts.push(`${dw < 0 ? 'perdeu' : 'ganhou'} ${fmt(Math.abs(dw))} kg`);
    if (dl != null && dl >= 0.1) parts.push(`ganhou ${fmt(dl)} kg de massa magra`);
    if (!parts.length) return `${fn}, seus números estão estáveis desde ${fmtDate(first.date, { day: 'numeric', month: 'long' })}.`;
    return `${fn}, desde ${fmtDate(first.date, { day: 'numeric', month: 'long' })} você ${parts.join(' e ')}.`;
  })();
  const lastNote = [...list].reverse().find((a) => a.extra.notes);

  const tabs: { k: Tab; l: string; I: typeof House }[] = [
    { k: 'inicio', l: 'Início', I: House }, { k: 'evolucao', l: 'Evolução', I: TrendingUp }, { k: 'medidas', l: 'Medidas', I: Ruler },
    ...(hasPhotos ? [{ k: 'fotos' as Tab, l: 'Fotos', I: Camera }] : []), { k: 'avaliacoes', l: 'Avaliações', I: ClipboardList },
  ];
  const cur: Tab = view.tab === 'avaliacao' ? 'avaliacoes' : view.tab === 'guia' ? 'medidas' : view.tab;

  /* ===================== telas ===================== */
  const empty = (txt: string) => <div className="card blue empty"><div className="e-ico"><ClipboardList className="ico" /></div><h3>Nenhuma avaliação ainda</h3><p>{txt}</p></div>;

  const Home = () => (<>
    <header className="top top-home">
      <span className="avatar" style={{ background: 'var(--yellow-2)' }}>{initials(data.patient.name)}</span>
      <div className="hello"><small>Olá,</small><b>{fn}</b></div>
      <div className="grow" />
      <span className="top-date">{fmtDate(today(), { weekday: 'long', day: 'numeric', month: 'long' })}</span>
      <button className="icon-btn" onClick={onRefresh} aria-label="Atualizar"><RefreshCw className="ico" /></button>
      <button className="icon-btn" onClick={onExit} aria-label="Sair deste aparelho"><LogOut className="ico" /></button>
    </header>
    <h1 className="headline">{summary}</h1>
    {!last ? empty(`Assim que ${nutriName} registrar sua primeira avaliação, tudo aparece aqui.`) : (<>
      <div className="dash">
        <div className="card blue span2 span2-d hero" onClick={() => go('medidas')} style={{ cursor: 'pointer' }}>
          <div className="left">
            <div className="card-head"><span className="chip-ico"><Flame className="ico" /></span><span className="label">{num(rL['bf']) != null ? 'Gordura corporal' : 'Peso atual'}</span></div>
            <div><div className="big xl">{num(rL['bf']) != null ? fmt(num(rL['bf'])) : fmt(num(last.weight))}<small>{num(rL['bf']) != null ? '%' : 'kg'}</small></div>
              <div className="sub">{num(rL['bf']) != null ? <>{bfClass(num(rL['bf']), sex)} {prev && <Delta cur={rL['bf']} prev={rP['bf']} dir={-1} unit="pp" />}</> : bmiClass(num(rL['bmi']))}</div></div>
            <div className="sub small"><CalendarClock className="ico sm" /> {dLong(last.date)}</div>
          </div>
          <div className="ring-wrap"><Ring val={num(rL['bf']) ?? num(rL['bmi'])} /><div className="center"><div className="inner"><b>{num(rL['leanMass']) != null ? fmt(num(rL['leanMass'])) : fmt(num(rL['bmi']))}</b><span>{num(rL['leanMass']) != null ? 'kg magra' : 'IMC'}</span></div></div></div>
        </div>
        <div className="card" onClick={() => { setEvo('weight'); setEvoTab('evo'); go('evolucao'); }} style={{ cursor: 'pointer' }}>
          <div className="card-head"><span className="label">Peso<br />atual</span><span className="chip-ico right"><Scale className="ico sm" /></span></div>
          <div className="mid">{fmt(num(last.weight))}<small>kg</small></div>{prev && <div className="sub"><Delta cur={last.weight} prev={prev.weight} dir={0} unit="kg" /></div>}
          <Spark vals={list.map((a) => num(a.weight))} />
        </div>
        <div className="card green" onClick={() => { setEvo('leanMass'); setEvoTab('evo'); go('evolucao'); }} style={{ cursor: 'pointer' }}>
          <div className="card-head"><span className="label">Massa<br />magra</span><span className="chip-ico right"><Zap className="ico sm" /></span></div>
          <div className="mid">{fmt(num(rL['leanMass']))}<small>kg</small></div>{prev && <div className="sub"><Delta cur={rL['leanMass']} prev={rP['leanMass']} dir={1} unit="kg" /></div>}
          <Spark vals={rs.map((r) => num(r['leanMass']))} color="var(--green-ink)" />
        </div>
        <div className="card yellow span2 span2-d">
          <div className="card-head"><span className="label">Composição corporal</span><span className="tag right" style={{ marginLeft: 'auto' }}>{String(rL['bfSource'] ?? '—')}</span></div>
          {num(rL['fatMass']) != null && num(rL['bf']) != null ? (<>
            <div className="combar"><span style={{ width: `${100 - num(rL['bf'])!}%`, background: 'var(--green-2)' }} /><span style={{ width: `${num(rL['bf'])}%`, background: 'var(--peach)' }} /></div>
            <div className="legend"><span><i style={{ background: 'var(--green-2)' }} />Magra <b>{fmt(num(rL['leanMass']))} kg</b></span><span><i style={{ background: 'var(--peach)' }} />Gorda <b>{fmt(num(rL['fatMass']))} kg</b></span></div>
          </>) : <p className="small" style={{ marginTop: 6 }}>A composição aparece quando a avaliação tem as dobras do protocolo.</p>}
          <div className="dash" style={{ marginTop: 14, gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            <div className="stat"><small>IMC</small><b>{fmt(num(rL['bmi']))}</b></div>
            <div className="stat"><small>RCQ</small><b>{fmt(num(rL['whr']), 2)}</b></div>
            <div className="stat"><small>TMB</small><b>{fmt(num(rL['bmr']), 0)}</b></div>
          </div>
        </div>
      {(() => {
        const c = last.circ, lr = (k: string) => { const v = [num(c[k + '_r']), num(c[k + '_l'])].filter((x): x is number => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
        const pills = ([['Braço', lr('biceps') ?? lr('arm')], ['Cintura', num(c['waist'])], ['Abdôm.', num(c['abdomen'])], ['Quadril', num(c['hip'])], ['Coxa', lr('thighm') ?? lr('thighp')], ['Pantur.', lr('calf')]] as [string, number | null][]).filter((x): x is [string, number] => x[1] != null);
        if (!pills.length) return null;
        const pmax = Math.max(...pills.map((x) => x[1]), 1);
        return (
          <div className="card span2 span2-d pp-pills-card">
            <div className="card-head"><span className="label">Medidas (cm)</span><button className="tag right" style={{ marginLeft: 'auto' }} onClick={() => go('medidas')}>Ver todas</button></div>
            <div className="pills" style={{ gridTemplateColumns: `repeat(${pills.length},1fr)` }}>{pills.map(([l, v]) => { const pc = 26 + 48 * (v / pmax); return <div className="pill" key={l}><div className="tube"><div className="fill" style={{ height: `${pc}%` }} /><div className="val" style={{ bottom: `${pc}%` }}>{fmt(v, v >= 100 ? 0 : 1)}</div></div><small>{l}</small></div>; })}</div>
          </div>
        );
      })()}
      </div>
      {lastNote && <div className="card pp-msg"><div className="card-head"><span className="chip-ico"><MessageCircle className="ico sm" /></span><span className="label">Recado de {firstName(nutriName)}<br /><span className="small muted">{dLong(lastNote.date)}</span></span></div><p>{lastNote.extra.notes}</p></div>}
    </>)}

    <h2 className="sec">Seu acompanhamento</h2>
    <div className="pp-follow">
      <div className="card pp-nutri">
        <span className="avatar">{initials(nutriName)}</span>
        <div className="grow"><small>Seu nutricionista</small><b>{nutriName}</b><span>{[crn, data.nutri.specialty].filter(Boolean).join(' · ') || 'Acompanhamento nutricional'}</span></div>
        {(wa || data.nutri.place) && <div className="pp-contact">
          {wa && <a className="pc wa" href={wa} target="_blank" rel="noopener"><MessageCircle size={16} />Falar no WhatsApp</a>}
          {data.nutri.place && <span className="pc"><MapPin size={16} />{data.nutri.place}</span>}
        </div>}
      </div>
      {next && left != null && (
        <div className={'card pp-next ' + (left < 0 ? 'late' : left <= 7 ? 'soon' : '')}>
          <span className="chip-ico"><CalendarClock className="ico" /></span>
          <div><small>Próxima avaliação</small><b>{dLong(next)}</b><span>{left < 0 ? 'A data prevista já passou — combine o retorno' : left === 0 ? 'É hoje!' : `em ${left} ${left === 1 ? 'dia' : 'dias'} · retorno a cada ${every} dias`}</span></div>
        </div>
      )}
    </div>

    <h2 className="sec">Explore</h2>
    <div className="actions pp-explore">
      <button className="act-row" onClick={() => go('evolucao')}><span className="chip-ico"><TrendingUp className="ico sm" /></span><span className="grow"><b>Evolução</b><span>Gráfico de cada medida e comparação entre avaliações</span></span><ChevronRight className="ico sm" /></button>
      <button className="act-row" onClick={() => go('medidas')}><span className="chip-ico"><Ruler className="ico sm" /></span><span className="grow"><b>Medidas</b><span>Composição, índices, circunferências e dobras</span></span><ChevronRight className="ico sm" /></button>
      {hasPhotos && <button className="act-row" onClick={() => go('fotos')}><span className="chip-ico"><Camera className="ico sm" /></span><span className="grow"><b>Fotos</b><span>Antes e depois, lado a lado</span></span><ChevronRight className="ico sm" /></button>}
      <button className="act-row" onClick={() => go('avaliacoes')}><span className="chip-ico"><ClipboardList className="ico sm" /></span><span className="grow"><b>Avaliações</b><span>{list.length} {list.length === 1 ? 'registro' : 'registros'} com todos os detalhes</span></span><ChevronRight className="ico sm" /></button>
      <button className="act-row" onClick={() => go('guia')}><span className="chip-ico"><BookOpen className="ico sm" /></span><span className="grow"><b>Entenda seus números</b><span>O que cada medida significa e as faixas de referência</span></span><ChevronRight className="ico sm" /></button>
    </div>
    <p className="pp-ro"><ShieldCheck size={15} /> Somente visualização · dados registrados por {nutriName}{data.updatedAt ? ` · atualizado em ${dLong(data.updatedAt.slice(0, 10))}` : ''}</p>
  </>);

  const Evolution = () => {
    // dobras uma a uma ficam de fora: para o paciente, a soma e o % de gordura contam a história
    const metrics = (METRICS as Metric[]).filter((m) => !m.k.startsWith('f_') && list.some((a) => m.get(a, rOf(a)) != null));
    const m = metrics.find((x) => x.k === evo) ?? metrics[0];
    const pts = m ? list.map((a) => ({ date: a.date, y: m.get(a, rOf(a)), id: a.id })).filter((x): x is { date: string; y: number; id: string } => x.y != null) : [];
    const d = m?.d ?? 1, f0 = pts[0]?.y, fl = pts.at(-1)?.y;
    const color = m?.dir === 1 ? 'var(--green-ink)' : m?.dir === -1 ? 'var(--ink)' : 'var(--blue-ink)';
    const fill = m?.dir === 1 ? 'var(--green)' : m?.dir === -1 ? 'var(--yellow)' : 'var(--blue)';
    const A = list.find((x) => x.id === cmpA) ?? list.at(-2) ?? list[0], B = list.find((x) => x.id === cmpB) ?? list.at(-1);
    return (<>
      <Head title="Evolução" sub={data.patient.name} back={() => go('inicio')} />
      <div className="seg full" style={{ marginBottom: 16 }}>
        <button className={evoTab === 'evo' ? 'on' : ''} onClick={() => setEvoTab('evo')}>Linha do tempo</button>
        <button className={evoTab === 'ab' ? 'on' : ''} onClick={() => setEvoTab('ab')}>Comparar</button>
      </div>
      {!list.length ? empty('Os gráficos aparecem depois da primeira avaliação.') : evoTab === 'evo' && m ? (<>
        <div className="chips">{metrics.map((x) => <button key={x.k} className={'chip' + (x.k === m.k ? ' on' : '')} onClick={() => setEvo(x.k)}>{x.l}</button>)}</div>
        <div className="evo-grid"><div className="evo-main">
          <div className="card white" key={'evo-' + m.k}>
            <div className="card-head"><span className="label"><b style={{ fontSize: 18 }}>{m.l}</b><br /><span className="small muted">{pts.length} {pts.length > 1 ? 'registros' : 'registro'}{m.u ? ' · ' + m.u : ''}</span></span>
              <span style={{ marginLeft: 'auto' }}>{pts.length > 1 && <Delta cur={fl} prev={f0} dir={m.dir} unit={m.u} d={d} />}</span></div>
            <LineChart pts={pts} d={d} color={color} fill={fill} />
            <div className="stat-row">
              <div className="stat" style={{ background: 'var(--card)' }}><small>Inicial</small><b>{fmt(f0, d)}</b></div>
              <div className="stat" style={{ background: 'var(--card)' }}><small>Atual</small><b>{fmt(fl, d)}</b></div>
              <div className="stat" style={{ background: 'var(--card)' }}><small>Variação</small><b>{pts.length > 1 ? `${fl! - f0! > 0 ? '+' : ''}${fmt(fl! - f0!, d)}` : '—'}</b></div>
            </div>
          </div>
        </div><div className="evo-side">
          <h2 className="sec">Histórico</h2>
          <div className="kv" key={'hist-' + m.k}>{pts.slice().reverse().map((x, i, arr) => (
            <div className="kv-row" key={x.id} onClick={() => go('avaliacao', x.id)} style={{ cursor: 'pointer' }}><span className="k">{dLong(x.date)}</span><span>{arr[i + 1] && <Delta cur={x.y} prev={arr[i + 1]!.y} dir={m.dir} d={d} />}</span><span className="v">{fmt(x.y, d)}<small>{m.u}</small></span></div>
          ))}</div>
        </div></div>
      </>) : list.length < 2 || !A || !B ? <div className="card blue empty"><div className="e-ico"><ArrowLeftRight className="ico" /></div><h3>Falta só mais uma</h3><p>Com duas avaliações você vê a comparação lado a lado de cada medida.</p></div> : (<>
        <div className="cmp-pick">
          <label className="sel a"><small>Antes (A)</small><select value={A.id} onChange={(e) => setCmpA(e.target.value)}>{list.slice().reverse().map((a) => <option key={a.id} value={a.id}>{dShort(a.date)}</option>)}</select></label>
          <button className="vs" onClick={() => { setCmpA(B.id); setCmpB(A.id); }} aria-label="Inverter"><ArrowLeftRight className="ico sm" /></button>
          <label className="sel b"><small>Depois (B)</small><select value={B.id} onChange={(e) => setCmpB(e.target.value)}>{list.slice().reverse().map((a) => <option key={a.id} value={a.id}>{dShort(a.date)}</option>)}</select></label>
        </div>
        <div className="cmp-meta"><p className="small muted">{Math.abs(Math.round((toDate(B.date).getTime() - toDate(A.date).getTime()) / 864e5))} dias entre as avaliações</p>
          <div className="cmp-legend"><span><span className="delta good"><ArrowDown /></span>Favorável</span><span><span className="delta bad"><ArrowUp /></span>Desfavorável</span><span><span className="delta neu"><ArrowUp /></span>Neutro</span></div></div>
        <div className="dash" key={`ab-${A.id}-${B.id}`}>
          {([['Peso', num(B.weight), num(A.weight), 0, 'kg', '', 'kg'], ['Gordura', num(rOf(B)['bf']), num(rOf(A)['bf']), -1, 'pp', 'blue', '%'], ['Massa magra', num(rOf(B)['leanMass']), num(rOf(A)['leanMass']), 1, 'kg', 'green', 'kg'], ['Massa gorda', num(rOf(B)['fatMass']), num(rOf(A)['fatMass']), -1, 'kg', 'yellow', 'kg']] as const).map(([l, b, a, dd, u, col, uu]) => (
            <div key={l} className={'card ' + col}><div className="card-head"><span className="label">{l}</span></div><div className="mid">{fmt(b)}<small>{uu}</small></div>
              <div className="sub">{a != null && b != null ? <Delta cur={b} prev={a} dir={dd} unit={u} /> : <span className="small muted">sem dados</span>}</div><div className="small muted" style={{ marginTop: 6 }}>antes: {fmt(a)}</div></div>
          ))}
        </div>
        <div className="two-col">{[0, 1].map((col) => <div key={col}>{(GROUPS as Group[]).filter((_, gi) => (gi < 2 ? 0 : 1) === col).map((g) => {
          const rows = g.items.map((mm) => { const va = mm.get(A, rOf(A)), vb = mm.get(B, rOf(B)); if (va == null || vb == null) return null; const dd = mm.d ?? 1, pct = va ? ((vb - va) / Math.abs(va)) * 100 : null;
            return <div className="cmp-row" key={mm.k}><span className="k">{mm.l}</span><span><Delta cur={vb} prev={va} dir={mm.dir} d={dd} /></span><span className="vals">{fmt(va, dd)} → <b>{fmt(vb, dd)}</b> {mm.u}</span><span className="vals">{pct != null ? `${pct > 0 ? '+' : ''}${fmt(pct, 1)}%` : ''}</span></div>; }).filter(Boolean);
          return rows.length ? <div key={g.g}><h2 className="sec">{g.g}</h2><div className="kv">{rows}</div></div> : null;
        })}</div>)}</div>
      </>)}
    </>);
  };

  const Measures = () => {
    if (!last) return <><Head title="Medidas" sub={data.patient.name} back={() => go('inicio')} />{empty('Suas medidas aparecem depois da primeira avaliação.')}</>;
    const ref = base === 'first' ? (first !== last ? first : null) : prev ?? null, rR = ref ? rOf(ref) : {};
    const row = (l: string, v: number | null, u: string, d = 1, pv: number | null = null, dirn = 0, note?: string) => v == null ? null : (
      <div className="kv-row" key={l}><span className="k">{l}{note && <small className="pp-cls">{note}</small>}</span><span>{ref && <Delta cur={v} prev={pv} dir={dirn} d={d} />}</span><span className="v">{fmt(v, d)}<small>{u}</small></span></div>);
    const trunk = CIRC_TRUNK.map((c: { k: string; l: string; dir: number }) => row(c.l, num(last.circ[c.k]), 'cm', 1, ref ? num(ref.circ[c.k]) : null, c.dir)).filter(Boolean);
    const limbs = CIRC_LIMBS.flatMap((c: { k: string; l: string }) => [row(`${c.l} (D)`, num(last.circ[c.k + '_r']), 'cm', 1, ref ? num(ref.circ[c.k + '_r']) : null, 0), row(`${c.l} (E)`, num(last.circ[c.k + '_l']), 'cm', 1, ref ? num(ref.circ[c.k + '_l']) : null, 0)]).filter(Boolean);
    const folds = FOLDS.map((f: { k: string; l: string }) => row(f.l, foldVal(last, f.k), 'mm', 1, ref ? foldVal(ref, f.k) : null, -1)).filter(Boolean);
    const bio = [row('% Gordura (bio)', num(last.extra.bf), '%', 1, ref ? num(ref.extra.bf) : null, -1), row('Massa muscular', num(last.extra.muscle), 'kg', 1, ref ? num(ref.extra.muscle) : null, 1), row('Gordura visceral', num(last.extra.visceral), '', 1, ref ? num(ref.extra.visceral) : null, -1), row('Água corporal', num(last.extra.water), '%', 1, ref ? num(ref.extra.water) : null, 0)].filter(Boolean);
    return (<>
      <Head title="Medidas" sub={`Avaliação de ${dLong(last.date)}`} back={() => go('inicio')} right={<button className="tag pp-guide-btn" onClick={() => go('guia')}><BookOpen size={14} /> Entenda</button>} />
      {list.length > 1 && <div className="seg full" style={{ marginBottom: 16 }}>
        <button className={base === 'first' ? 'on' : ''} onClick={() => setBase('first')}>Desde a primeira</button>
        <button className={base === 'prev' ? 'on' : ''} onClick={() => setBase('prev')}>Desde a anterior</button>
      </div>}
      <div className="dash detail-dash">
        <div className="card blue span2 span2-d hero">
          <div className="left"><div className="card-head"><span className="chip-ico"><Flame className="ico" /></span><span className="label">Gordura corporal<br /><span className="small">{String(rL['bfSource'] ?? 'sem dados suficientes')}</span></span></div>
            <div><div className="big xl">{fmt(num(rL['bf']))}<small>%</small></div><div className="sub">{bfClass(num(rL['bf']), sex)} {ref && <Delta cur={rL['bf']} prev={rR['bf']} dir={-1} unit="pp" />}</div></div></div>
          <div className="ring-wrap"><Ring val={num(rL['bf'])} /><div className="center"><div className="inner"><b>{fmt(num(last.weight))}</b><span>kg</span></div></div></div>
        </div>
        <div className="card green"><div className="card-head"><span className="label">Massa magra</span><span className="chip-ico right"><Zap className="ico sm" /></span></div><div className="mid">{fmt(num(rL['leanMass']))}<small>kg</small></div><div className="sub">{ref && <Delta cur={rL['leanMass']} prev={rR['leanMass']} dir={1} unit="kg" />}</div></div>
        <div className="card yellow"><div className="card-head"><span className="label">Massa gorda</span><span className="chip-ico right"><Droplet className="ico sm" /></span></div><div className="mid">{fmt(num(rL['fatMass']))}<small>kg</small></div><div className="sub">{ref && <Delta cur={rL['fatMass']} prev={rR['fatMass']} dir={-1} unit="kg" />}</div></div>
        <div className="card"><div className="card-head"><span className="label">Peso</span><span className="chip-ico right"><Scale className="ico sm" /></span></div><div className="mid">{fmt(num(last.weight))}<small>kg</small></div><div className="sub">{ref && <Delta cur={last.weight} prev={ref.weight} dir={0} unit="kg" />}</div></div>
        <div className="card"><div className="card-head"><span className="label">IMC</span><span className="chip-ico right"><Target className="ico sm" /></span></div><div className="mid">{fmt(num(rL['bmi']))}</div><div className="sub small">{bmiClass(num(rL['bmi']))}</div></div>
      </div>
      <div className="two-col">
        <div>
          <h2 className="sec">Índices</h2>
          <div className="kv">
            {row('Relação cintura/quadril', num(rL['whr']), '', 2, num(rR['whr']), -1, whrRisk(num(rL['whr']), sex))}
            {row('Relação cintura/altura', num(rL['whtr']), '', 2, num(rR['whtr']), -1)}
            {row('Soma das dobras', num(rL['sumAll']), 'mm', 1, num(rR['sumAll']), -1)}
            {row('Metabolismo basal', num(rL['bmr']), 'kcal', 0, num(rR['bmr']), 0)}
            {row('Altura', num(last.height), 'cm', 0)}
          </div>
          {trunk.length > 0 && <><h2 className="sec">Circunferências — tronco</h2><div className="kv">{trunk}</div></>}
          {limbs.length > 0 && <><h2 className="sec">Circunferências — membros</h2><div className="kv">{limbs}</div></>}
        </div>
        <div>
          {folds.length > 0 && <><h2 className="sec">Dobras cutâneas <span className="tag">{(PROTOCOLS as Record<string, { name: string }>)[last.protocol]?.name ?? ''}</span></h2><div className="kv">{folds}</div></>}
          {bio.length > 0 && <><h2 className="sec">Bioimpedância</h2><div className="kv">{bio}</div></>}
          <button className="act-row pp-guide-row" onClick={() => go('guia')}><span className="chip-ico"><BookOpen className="ico sm" /></span><span className="grow"><b>Entenda seus números</b><span>O que significa cada medida e em que faixa você está</span></span><ChevronRight className="ico sm" /></button>
        </div>
      </div>
      {ref && <p className="small muted pp-note">Setas comparam com a avaliação de {dLong(ref.date)}. <span className="delta good"><ArrowDown /></span> verde = mudança favorável.</p>}
    </>);
  };

  const Photos = () => {
    const poses = POSES.filter((P) => data.photos.some((x) => x.pose === P.k));
    const k = poses.some((P) => P.k === pose) ? pose : poses[0]?.k ?? 'front';
    const dated = list.filter((a) => photoOf(a.id, k));
    const A = dated.find((a) => a.id === phA) ?? dated[0], B = dated.find((a) => a.id === phB && a.id !== A?.id) ?? dated.at(-1);
    const setFrom = (e: React.PointerEvent<HTMLDivElement>) => { const r = e.currentTarget.getBoundingClientRect(); const v = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)); if (mode === 'fade') setSo(v); else setSx(v); };
    const cap = (a: A, tag: string) => { const r = rOf(a); return <span className="phc-cap"><b>{tag}</b><span>{fmtDate(a.date, { day: '2-digit', month: 'short', year: 'numeric' })}</span><small>{fmt(num(a.weight))} kg{num(r['bf']) != null ? ` · ${fmt(num(r['bf']))}% gordura` : ''}</small></span>; };
    const chips = <div className="chips ph-poses">{poses.map((P) => <button key={P.k} className={'chip' + (P.k === k ? ' on' : '')} onClick={() => setPose(P.k)}>{P.l}<span className="n">{list.filter((a) => photoOf(a.id, P.k)).length}</span></button>)}</div>;
    return (<>
      <Head title="Fotos" sub={data.patient.name} back={() => go('inicio')} />
      {!A || !B ? <div className="card blue empty"><div className="e-ico"><Camera className="ico" /></div><h3>Sem fotos ainda</h3><p>Suas fotos aparecem aqui quando forem registradas.</p></div>
        : dated.length < 2 ? (<>{chips}<div className="phc-one">
          <figure className="phc-fig" onClick={() => openViewer(k, A.id)}><img src={photoOf(A.id, k)!.url} alt={poseLabel(k)} />{cap(A, 'Única foto')}</figure>
          <div className="phc-one-txt"><h3>Falta só mais uma</h3><p>Na próxima avaliação com foto na pose <b>{poseLabel(k).toLowerCase()}</b>, você compara o antes e depois lado a lado.</p></div></div></>)
        : (<>{chips}
          <div className="ph-layout"><div className="ph-main">
            <div className="ph-bar"><div className="seg ph-modes">{([['side', 'Lado a lado'], ['wipe', 'Deslizar'], ['fade', 'Sobrepor']] as const).map(([v, l]) => <button key={v} className={mode === v ? 'on' : ''} onClick={() => setMode(v)}>{l}</button>)}</div></div>
            <div className={'phc phc-' + mode} style={{ ['--x' as string]: `${sx}%`, ['--o' as string]: String(so / 100) }}>
              {mode === 'side' ? (<>
                <figure className="phc-fig" onClick={() => openViewer(k, A.id)}><img src={photoOf(A.id, k)!.url} alt="Antes" />{cap(A, 'Antes')}</figure>
                <figure className="phc-fig" onClick={() => openViewer(k, B.id)}><img src={photoOf(B.id, k)!.url} alt="Depois" />{cap(B, 'Depois')}</figure>
              </>) : (
                <div className="phc-stage" role="slider" tabIndex={0} aria-valuenow={Math.round(mode === 'fade' ? so : sx)} aria-valuemin={0} aria-valuemax={100} aria-label={mode === 'wipe' ? 'Deslize para comparar' : 'Arraste para sobrepor'}
                  onPointerDown={(e) => { drag.current = true; e.currentTarget.setPointerCapture(e.pointerId); setFrom(e); }} onPointerMove={(e) => { if (drag.current) setFrom(e); }} onPointerUp={() => { drag.current = false; }}
                  onKeyDown={(e) => { const s = e.key === 'ArrowRight' ? 5 : e.key === 'ArrowLeft' ? -5 : 0; if (s) { e.preventDefault(); if (mode === 'fade') setSo((v) => Math.max(0, Math.min(100, v + s))); else setSx((v) => Math.max(0, Math.min(100, v + s))); } }}>
                  <div className="phc-a"><img src={photoOf(A.id, k)!.url} alt="Antes" /></div><div className="phc-b"><img src={photoOf(B.id, k)!.url} alt="Depois" /></div>
                  {mode === 'wipe' ? <span className="phc-handle"><i><ArrowLeftRight className="ico sm" /></i></span> : <span className="phc-fader"><i /></span>}
                  <span className="phc-tag l">Antes · {dShort(A.date)}</span><span className="phc-tag r">Depois · {dShort(B.date)}</span>
                </div>
              )}
            </div>
            <p className="small muted ph-days">{Math.abs(Math.round((toDate(B.date).getTime() - toDate(A.date).getTime()) / 864e5))} dias entre as fotos{mode !== 'side' ? ` · ${mode === 'wipe' ? 'arraste sobre a foto para deslizar' : 'arraste para a direita para mostrar a mais recente'}` : ''}</p>
          </div>
          <aside className="ph-aside">
            <div className="cmp-pick">
              <label className="sel a"><small>Antes (A)</small><select value={A.id} onChange={(e) => setPhA(e.target.value)}>{dated.slice().reverse().map((a) => <option key={a.id} value={a.id}>{dShort(a.date)}</option>)}</select></label>
              <button className="vs" onClick={() => { setPhA(B.id); setPhB(A.id); }} aria-label="Inverter"><ArrowLeftRight className="ico sm" /></button>
              <label className="sel b"><small>Depois (B)</small><select value={B.id} onChange={(e) => setPhB(e.target.value)}>{dated.slice().reverse().map((a) => <option key={a.id} value={a.id}>{dShort(a.date)}</option>)}</select></label>
            </div>
            <div className="ph-stats">{([['Peso', num(B.weight), num(A.weight), 0, 'kg'], ['Gordura', num(rOf(B)['bf']), num(rOf(A)['bf']), -1, 'pp'], ['Massa magra', num(rOf(B)['leanMass']), num(rOf(A)['leanMass']), 1, 'kg'], ['Cintura', num(B.circ['waist']), num(A.circ['waist']), -1, 'cm']] as const).filter((s) => s[1] != null && s[2] != null).map(([l, b, a, dd, u]) => <div className="stat" key={l}><small>{l}</small><Delta cur={b} prev={a} dir={dd} unit={u} /></div>)}</div>
            <div className="ph-all"><h3 className="ph-all-h">Todas as fotos · {poseLabel(k)}<span>{dated.length} fotos</span></h3>
              <div className="ph-strip">{dated.slice().reverse().map((a) => <button key={a.id} className={'ph-th' + (a.id === A.id ? ' is-a' : '') + (a.id === B.id ? ' is-b' : '')} onClick={() => openViewer(k, a.id)}><span className="ph-th-img"><img src={photoOf(a.id, k)!.url} alt={dShort(a.date)} />{a.id === A.id ? <em>A</em> : a.id === B.id ? <em className="b">B</em> : null}</span><span className="ph-th-d">{dShort(a.date)}</span></button>)}</div>
            </div>
          </aside></div>
        </>)}
    </>);
  };

  const Assessments = () => (<>
    <Head title="Avaliações" sub={data.patient.name} back={() => go('inicio')} />
    {!list.length ? empty(`Assim que ${nutriName} registrar sua primeira avaliação, ela aparece aqui.`) : (<>
      <p className="muted small" style={{ margin: '-8px 2px 14px' }}>{list.length} {list.length > 1 ? 'avaliações registradas' : 'avaliação registrada'}</p>
      <div className="alist">{list.slice().reverse().map((a, i) => { const r = rOf(a), pv = list[list.indexOf(a) - 1]; return (
        <button key={a.id} className="aitem" onClick={() => go('avaliacao', a.id)}>
          <Dpill iso={a.date} on={i === 0} />
          <div className="info"><b>{fmtDate(a.date, { weekday: 'long', day: 'numeric', month: 'long' })}</b>
            <div className="stats"><span><em>{fmt(num(a.weight))}</em> kg</span>{num(r['bf']) != null && <span><em>{fmt(num(r['bf']))}</em>% gordura</span>}{pv && <Delta cur={a.weight} prev={pv.weight} dir={0} unit="kg" />}{hasPhotos && data.photos.some((x) => x.assessmentId === a.id) && <span className="pp-hasph"><Camera size={14} /></span>}</div></div>
          <ChevronRight className="ico sm" />
        </button>); })}</div>
    </>)}
  </>);

  const Detail = () => {
    const a = list.find((x) => x.id === view.id);
    if (!a) return Assessments();
    const r = rOf(a), i = list.indexOf(a), pv = list[i - 1], nx = list[i + 1], rp = pv ? rOf(pv) : null;
    const row = (l: string, v: number | null, u: string, d = 1, pvv: number | null = null, dirn = 0) => v == null ? null : <div className="kv-row" key={l}><span className="k">{l}</span><span>{pvv != null && <Delta cur={v} prev={pvv} dir={dirn} d={d} />}</span><span className="v">{fmt(v, d)}<small>{u}</small></span></div>;
    const trunk = CIRC_TRUNK.map((c: { k: string; l: string; dir: number }) => row(c.l, num(a.circ[c.k]), 'cm', 1, pv ? num(pv.circ[c.k]) : null, c.dir)).filter(Boolean);
    const limbs = CIRC_LIMBS.map((c: { k: string; l: string }) => { const R = num(a.circ[c.k + '_r']), L = num(a.circ[c.k + '_l']); if (R == null && L == null) return null;
      return <div className="kv-row" key={c.k} style={{ gridTemplateColumns: '1fr 70px 70px' }}><span className="k">{c.l}</span><span className="v">{fmt(R)}<small>D</small></span><span className="v">{fmt(L)}<small>E</small></span></div>; }).filter(Boolean);
    const need: string[] = (PROTOCOLS as Record<string, { folds: (s: string) => string[]; short: string; name: string }>)[a.protocol]?.folds(sex) ?? [];
    const folds = FOLDS.map((f: { k: string; l: string }) => { const v = foldVal(a, f.k); if (v == null) return null;
      return <div className="kv-row" key={f.k}><span className="k">{f.l} {need.includes(f.k) && <span className="tag blue" style={{ padding: '2px 7px', fontSize: 10 }}>{(PROTOCOLS as Record<string, { short: string }>)[a.protocol]?.short}</span>}</span><span>{pv && <Delta cur={v} prev={foldVal(pv, f.k)} dir={-1} />}</span><span className="v">{fmt(v)}<small>mm</small></span></div>; }).filter(Boolean);
    const bio = [row('% Gordura', num(a.extra.bf), '%'), row('Massa muscular', num(a.extra.muscle), 'kg'), row('Gordura visceral', num(a.extra.visceral), ''), row('Água corporal', num(a.extra.water), '%')].filter(Boolean);
    const phs = data.share.photos ? POSES.filter((P) => photoOf(a.id, P.k)) : [];
    return (<>
      <Head title={dLong(a.date)} sub="Avaliação" back={() => go('avaliacoes')} />
      <div className="dash detail-dash">
        <div className="card blue span2 span2-d hero">
          <div className="left"><div className="card-head"><span className="chip-ico"><Flame className="ico" /></span><span className="label">Gordura corporal<br /><span className="small">{String(r['bfSource'] ?? 'sem dados suficientes')}</span></span></div>
            <div><div className="big xl">{fmt(num(r['bf']))}<small>%</small></div><div className="sub">{bfClass(num(r['bf']), sex)} {rp && <Delta cur={r['bf']} prev={rp['bf']} dir={-1} unit="pp" />}</div></div></div>
          <div className="ring-wrap"><Ring val={num(r['bf'])} /><div className="center"><div className="inner"><b>{String(r['age'] ?? '—')}</b><span>anos</span></div></div></div>
        </div>
        <div className="card"><div className="card-head"><span className="label">Peso</span><span className="chip-ico right"><Scale className="ico sm" /></span></div><div className="mid">{fmt(num(a.weight))}<small>kg</small></div><div className="sub">{pv ? <Delta cur={a.weight} prev={pv.weight} dir={0} unit="kg" /> : <span className="small">Altura {fmt(num(a.height), 0)} cm</span>}</div></div>
        <div className="card green"><div className="card-head"><span className="label">Massa magra</span><span className="chip-ico right"><Zap className="ico sm" /></span></div><div className="mid">{fmt(num(r['leanMass']))}<small>kg</small></div><div className="sub">{rp && <Delta cur={r['leanMass']} prev={rp['leanMass']} dir={1} unit="kg" />}</div></div>
        <div className="card yellow"><div className="card-head"><span className="label">Massa gorda</span><span className="chip-ico right"><Droplet className="ico sm" /></span></div><div className="mid">{fmt(num(r['fatMass']))}<small>kg</small></div><div className="sub">{rp && <Delta cur={r['fatMass']} prev={rp['fatMass']} dir={-1} unit="kg" />}</div></div>
        <div className="card"><div className="card-head"><span className="label">IMC</span><span className="chip-ico right"><Target className="ico sm" /></span></div><div className="mid">{fmt(num(r['bmi']))}</div><div className="sub small">{bmiClass(num(r['bmi']))}</div></div>
      </div>
      {phs.length > 0 && <section className="ph-sec"><h2 className="sec">Fotos <span className="sec-note">{phs.length} de 4</span></h2>
        <div className="ph-slots">{phs.map((P) => <button key={P.k} className="ph-slot has" onClick={() => openAssessmentPhotos(a.id, P.k)} aria-label={`Ver foto: ${P.l}`}><img src={photoOf(a.id, P.k)!.url} alt={P.l} /><span className="ph-lbl">{P.l}</span></button>)}</div></section>}
      <div className="two-col">
        <div>
          <h2 className="sec">Índices</h2>
          <div className="kv">
            {row('Relação cintura/quadril', num(r['whr']), '', 2, rp ? num(rp['whr']) : null, -1)}
            {num(r['whr']) != null && <div className="kv-row"><span className="k muted small">Classificação RCQ</span><span /><span className="v small">{whrRisk(num(r['whr']), sex)}</span></div>}
            {row('Relação cintura/altura', num(r['whtr']), '', 2, rp ? num(rp['whtr']) : null, -1)}
            {row('Soma de todas as dobras', num(r['sumAll']), 'mm', 1, rp ? num(rp['sumAll']) : null, -1)}
            {row('Metabolismo basal', num(r['bmr']), 'kcal', 0)}
            {row('Altura', num(a.height), 'cm', 0)}
          </div>
          {trunk.length > 0 && <><h2 className="sec">Circunferências — tronco</h2><div className="kv">{trunk}</div></>}
          {limbs.length > 0 && <><h2 className="sec">Circunferências — membros</h2><div className="kv">{limbs}</div></>}
        </div>
        <div>
          {folds.length > 0 && <><h2 className="sec">Dobras cutâneas <span className="tag">{(PROTOCOLS as Record<string, { name: string }>)[a.protocol]?.name}</span></h2><div className="kv">{folds}</div></>}
          {bio.length > 0 && <><h2 className="sec">Bioimpedância</h2><div className="kv">{bio}</div></>}
          {a.extra.evaluator && <><h2 className="sec">Avaliador(a)</h2><div className="notes">{a.extra.evaluator}</div></>}
          {a.extra.notes && <><h2 className="sec">Observações do nutricionista</h2><div className="notes">{a.extra.notes}</div></>}
        </div>
      </div>
      {(pv || nx) && <div className="pp-pager">
        {pv ? <button className="act-row" onClick={() => go('avaliacao', pv.id)}><ChevronLeft className="ico sm" /><span className="grow"><b>Anterior</b><span>{dLong(pv.date)}</span></span></button> : <span />}
        {nx ? <button className="act-row next" onClick={() => go('avaliacao', nx.id)}><span className="grow"><b>Próxima</b><span>{dLong(nx.date)}</span></span><ChevronRight className="ico sm" /></button> : <span />}
      </div>}
    </>);
  };

  const Guide = () => {
    const bfNow = num(rL['bf']), bmiNow = num(rL['bmi']), whrNow = num(rL['whr']), age = ageAt(data.patient.birth);
    const bfR = sex === 'F' ? [['Gordura essencial', 'até 13%'], ['Atlético', '14–20%'], ['Boa forma', '21–24%'], ['Média', '25–31%'], ['Acima do ideal', '32% ou mais']] : [['Gordura essencial', 'até 5%'], ['Atlético', '6–13%'], ['Boa forma', '14–17%'], ['Média', '18–24%'], ['Acima do ideal', '25% ou mais']];
    const bmiR = [['Abaixo do peso', 'menor que 18,5'], ['Peso normal', '18,5 a 24,9'], ['Sobrepeso', '25 a 29,9'], ['Obesidade grau I', '30 a 34,9'], ['Obesidade grau II', '35 a 39,9'], ['Obesidade grau III', '40 ou mais']];
    const whrR = sex === 'F' ? [['Risco baixo', 'menor que 0,80'], ['Risco moderado', '0,80 a 0,84'], ['Risco alto', '0,85 ou mais']] : [['Risco baixo', 'menor que 0,95'], ['Risco moderado', '0,95 a 0,99'], ['Risco alto', '1,00 ou mais']];
    return (<>
      <Head title="Entenda seus números" sub="Guia" back={() => go('medidas')} />
      <p className="pp-gintro">Um guia rápido para ler sua avaliação. As faixas de referência são para {sex === 'F' ? 'mulheres' : 'homens'}{age ? ` (você tem ${age} anos)` : ''}; seu nutricionista interpreta tudo junto com seus objetivos.</p>
      <div className="pp-guide">
        <Item t="% de gordura" icon={<Flame className="ico sm" />} val={bfNow != null ? `${fmt(bfNow)}% · ${bfClass(bfNow, sex)}` : undefined} open>
          <p>Quanto do seu peso é gordura. É o principal indicador do resultado, porque o peso sozinho não mostra se você perdeu gordura ou músculo.</p><Ranges rows={bfR} now={bfClass(bfNow, sex)} /></Item>
        <Item t="Massa magra e massa gorda" icon={<Zap className="ico sm" />} val={num(rL['leanMass']) != null ? `${fmt(num(rL['leanMass']))} kg magra` : undefined}>
          <p><b>Massa magra</b> é tudo que não é gordura: músculos, ossos, órgãos e água. O ideal é manter ou aumentar enquanto a <b>massa gorda</b> diminui.</p></Item>
        <Item t="IMC" icon={<Target className="ico sm" />} val={bmiNow != null ? `${fmt(bmiNow)} · ${bmiClass(bmiNow)}` : undefined}>
          <p>Peso dividido pela altura ao quadrado. É uma referência geral: não separa músculo de gordura, por isso é lido junto com o % de gordura.</p><Ranges rows={bmiR} now={bmiClass(bmiNow)} /></Item>
        <Item t="Relação cintura/quadril" icon={<Ruler className="ico sm" />} val={whrNow != null ? `${fmt(whrNow, 2)} · ${whrRisk(whrNow, sex)}` : undefined}>
          <p>Mostra onde a gordura se concentra. Gordura na região da barriga está ligada a maior risco para a saúde do coração.</p><Ranges rows={whrR} now={whrRisk(whrNow, sex)} /></Item>
        <Item t="Metabolismo basal" icon={<Heart className="ico sm" />} val={num(rL['bmr']) != null ? `${fmt(num(rL['bmr']), 0)} kcal` : undefined}>
          <p>Energia que seu corpo gasta por dia em repouso, só para se manter funcionando. Mais massa magra costuma aumentar esse gasto.</p></Item>
        <Item t="Circunferências e dobras" icon={<Activity className="ico sm" />}>
          <p>As <b>circunferências</b> são medidas com fita (cintura, quadril, braço…) e mostram a redução de medidas mesmo quando o peso muda pouco. As <b>dobras cutâneas</b> medem a gordura logo abaixo da pele com o adipômetro e entram no cálculo do % de gordura.</p></Item>
      </div>
    </>);
  };

  const screens: Record<Tab, () => ReactNode> = { inicio: Home, evolucao: Evolution, medidas: Measures, fotos: hasPhotos ? Photos : Home, avaliacoes: Assessments, avaliacao: Detail, guia: Guide };
  return (
    <main className="app has-nav pp" ref={host}>
      <div className="view" key={view.tab + (view.id ?? '')} data-dir={dir}>{screens[view.tab]()}</div>
      <nav className="nav">
        <div className="side-brand"><span className="mark"><Heart className="ico sm" /></span><span>Portal do<br />paciente</span></div>
        <div className="side-links">{tabs.map(({ k, l, I }) => <button key={k} className={cur === k ? 'on' : ''} onClick={() => go(k)} aria-label={l} aria-current={cur === k ? 'page' : undefined}><I className="ico" /><span>{l}</span></button>)}</div>
        <button className="side-pt" onClick={() => go('inicio')}><small>Seu nutricionista</small><span className="row"><span className="avatar" style={{ background: 'var(--peach)' }}>{initials(nutriName)}</span><span className="grow"><b>{nutriName}</b><small>{crn || data.nutri.specialty || 'Acompanhamento'}</small></span></span></button>
        {wa && <a className="side-cta pp-side-wa" href={wa} target="_blank" rel="noopener"><MessageCircle className="ico" /><span>Falar no WhatsApp</span></a>}
        <button className="side-prof" onClick={onExit} title="Sair deste aparelho"><span className="avatar" style={{ background: 'var(--yellow-2)' }}>{initials(data.patient.name)}</span><span className="grow"><b>{data.patient.name}</b><small>Sair deste aparelho</small></span><LogOut className="ico sm" /></button>
      </nav>
      {viewer && <PhotoViewer spec={viewer} onEnd={() => setViewer(null)} />}
    </main>
  );
}

/* ---------- tela principal ---------- */
export function PatientPortal({ load = (code: string) => getPatientPortal({ data: { code } }) }: { load?: (code: string) => ReturnType<typeof getPatientPortal> }) {
  const [phase, setPhase] = useState<'boot' | 'entry' | 'loading' | 'ready' | 'down'>('boot');
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState('');
  const code = useRef('');

  const enter = async (c: string) => {
    code.current = c; setError(''); setPhase((ph) => (ph === 'ready' ? 'ready' : 'loading'));
    try {
      const res = await load(c);
      if (res.ok) { write(c); setData(res.data); setPhase('ready'); return; }
      if (res.reason === 'invalid') { write(null); setData(null); setError('Código inválido ou desativado. Confira com seu nutricionista.'); setPhase('entry'); return; }
      setPhase('down');
    } catch { setPhase('down'); }
  };

  useEffect(() => {
    // link compartilhado: /paciente#K7QM3HXA (o código fica só no navegador, não vai para o servidor no endereço)
    const fromHash = () => {
      const c = normCode(decodeURIComponent(window.location.hash.slice(1)));
      if (window.location.hash) history.replaceState(null, '', window.location.pathname + window.location.search);
      return isCode(c) ? c : '';
    };
    const c = fromHash() || read();
    if (isCode(c)) void enter(c); else setPhase('entry');
    const onHash = () => { const h = fromHash(); if (h) void enter(h); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const exit = () => { write(null); setData(null); code.current = ''; history.replaceState(null, '', window.location.pathname); setPhase('entry'); };

  if (phase === 'boot' || phase === 'loading') return <main className="app"><div className="pp-loading"><span className="pp-spin" /><p>Carregando sua evolução…</p></div></main>;
  if (phase === 'down') return (
    <main className="app"><div className="auth-wrap"><div className="card empty"><h3>Não foi possível carregar agora</h3><p>Verifique sua internet e tente de novo em instantes.</p>
      <Button variant="original" className="btn dark" style={{ margin: '16px auto 0', display: 'inline-flex' }} onClick={() => void enter(code.current || read())}><RefreshCw size={16} /> Tentar de novo</Button>
      <button className="btn ghost sm" style={{ margin: '10px auto 0', display: 'flex' }} onClick={exit}>Usar outro código</button></div></div></main>
  );
  if (phase === 'ready' && data) return <PortalApp data={data} onExit={exit} onRefresh={() => void enter(code.current)} />;
  return <Entry onEnter={(c) => void enter(c)} error={error} />;
}
