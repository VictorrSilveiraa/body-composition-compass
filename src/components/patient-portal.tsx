import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ArrowDown, ArrowRight, ArrowUp, CalendarClock, Camera, ChevronDown, Equal, KeyRound, LogOut, MapPin, MessageCircle, RefreshCw, ShieldCheck, Sparkles, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PhotoViewer, type ViewerSpec } from '@/components/photo-viewer';
import { calc, bmiClass, bfClass, whrRisk, fmt, fmtDate, toDate, today, ageAt, CIRC_TRUNK, CIRC_LIMBS, PROTOCOLS, firstName, initials } from '@/lib/calculos.js';
import { poseLabel, POSES } from '@/lib/poses.js';
import { fmtCode, isCode, normCode, type PortalData, type PortalPhoto } from '@/lib/portal-code';
import { getPatientPortal } from '@/lib/portal.functions';

/*
 * Portal do paciente: entrada com o código que o nutricionista compartilhou e um painel SOMENTE de leitura,
 * didático, com a evolução, as medidas, as fotos e o significado de cada número.
 */
const KEY = 'avf.portal.code';
const read = () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } };
const write = (c: string | null) => { try { if (c) localStorage.setItem(KEY, c); else localStorage.removeItem(KEY); } catch { /* sem armazenamento */ } };
type A = PortalData['assessments'][number];
type R = Record<string, number | null | undefined | string>;
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const daysTo = (iso: string) => Math.round((toDate(iso).getTime() - toDate(today()).getTime()) / 864e5);
const addDays = (iso: string, d: number) => { const x = toDate(iso); x.setDate(x.getDate() + d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const dShort = (iso: string) => fmtDate(iso, { day: '2-digit', month: 'short' }).replace('.', '').replace(' de ', ' ');
const dLong = (iso: string) => fmtDate(iso, { day: 'numeric', month: 'long', year: 'numeric' });

function Delta({ cur, prev, dir, unit = '', d = 1 }: { cur: unknown; prev: unknown; dir: number; unit?: string; d?: number }) {
  const a = num(cur), b = num(prev);
  if (a == null || b == null) return null;
  const diff = a - b;
  if (Math.abs(diff) < Math.pow(10, -d) / 2) return <span className="delta flat"><Equal size={15} /> igual</span>;
  const cls = dir === 0 ? 'neu' : diff * dir > 0 ? 'good' : 'bad';
  return <span className={'delta ' + cls}>{diff > 0 ? <ArrowUp size={15} /> : <ArrowDown size={15} />}{fmt(Math.abs(diff), d)}{unit ? ' ' + unit : ''}</span>;
}

/* ---------- gráfico de linha simples (SVG) ---------- */
function LineChart({ pts, d = 1, unit = '' }: { pts: { date: string; y: number }[]; d?: number; unit?: string }) {
  if (!pts.length) return <p className="small muted">Sem dados para esta medida.</p>;
  const W = 460, H = 220, pl = 24, pr = 24, pt = 40, pb = 34;
  let mn = Math.min(...pts.map((p) => p.y)), mx = Math.max(...pts.map((p) => p.y));
  if (mn === mx) { mn -= 1; mx += 1; } const pad = (mx - mn) * 0.2; mn -= pad; mx += pad;
  const X = (i: number) => (pts.length === 1 ? W / 2 : pl + (i * (W - pl - pr)) / (pts.length - 1));
  const Y = (v: number) => pt + (1 - (v - mn) / (mx - mn)) * (H - pt - pb);
  const P = pts.map((p, i) => [X(i), Y(p.y)] as const);
  const line = P.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = P.length > 1 ? `${line} L${P.at(-1)![0]},${H - pb} L${P[0]![0]},${H - pb} Z` : '';
  const step = Math.ceil(pts.length / 6);
  return (
    <svg className="pp-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Gráfico: de ${fmt(pts[0]!.y, d)} para ${fmt(pts.at(-1)!.y, d)} ${unit}`}>
      <defs><linearGradient id="ppg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--blue)" stopOpacity=".9" /><stop offset="1" stopColor="var(--blue)" stopOpacity="0" /></linearGradient></defs>
      {[0, 0.5, 1].map((t) => <line key={t} x1={pl} x2={W - pr} y1={pt + t * (H - pt - pb)} y2={pt + t * (H - pt - pb)} stroke="var(--line)" strokeDasharray="3 6" />)}
      {area && <path d={area} fill="url(#ppg)" />}
      {P.length > 1 && <path d={line} fill="none" stroke="var(--ink)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
      {P.map((p, i) => (
        <g key={i}>
          <circle cx={p[0]} cy={p[1]} r={i === P.length - 1 ? 7 : 5} fill={i === P.length - 1 ? 'var(--yellow-2)' : 'var(--surface)'} stroke="var(--ink)" strokeWidth="2.5" />
          {(pts.length <= 7 || i === 0 || i === P.length - 1) && <text x={p[0]} y={p[1] - 15} textAnchor="middle" fontSize="19" fontWeight="600" fill="var(--ink)">{fmt(pts[i]!.y, d)}</text>}
          {(i % step === 0 || i === P.length - 1) && <text x={p[0]} y={H - 8} textAnchor={P.length > 1 && i === 0 ? 'start' : P.length > 1 && i === P.length - 1 ? 'end' : 'middle'} fontSize="15" fill="var(--muted)">{dShort(pts[i]!.date)}</text>}
        </g>
      ))}
    </svg>
  );
}

/* ---------- entrada com código ---------- */
function Entry({ onEnter, error, busy }: { onEnter: (c: string) => void; error: string; busy: boolean }) {
  const [v, setV] = useState('');
  const ok = isCode(normCode(v));
  return (
    <main className="app"><div className="auth-wrap pp-entry">
      <div className="auth-mark"><span className="avatar"><Activity /></span>Avaliação Física</div>
      <div className="onb-hero">
        <span className="tag">Portal do paciente</span>
        <h1 className="auth-title">Acompanhe sua evolução.</h1>
        <p>Use o código que seu nutricionista enviou para ver suas avaliações, medidas e fotos.</p>
      </div>
      <h2 className="sec">Entrar com código</h2>
      <form className="auth-form" onSubmit={(e) => { e.preventDefault(); if (ok && !busy) onEnter(normCode(v)); }}>
        <label className="field"><span className="f-label">Código de acesso</span>
          <div className="f-input text pp-code-in"><KeyRound size={18} />
            <input value={v} onChange={(e) => setV(fmtCode(e.target.value))} placeholder="XXXX-XXXX" autoComplete="one-time-code" autoCapitalize="characters" spellCheck={false} inputMode="text" maxLength={9} aria-describedby="pp-help" autoFocus />
          </div>
        </label>
        <p id="pp-help" className="small muted">São 8 letras e números, como <b>K7QM-3HXA</b>. Maiúsculas ou minúsculas, tanto faz.</p>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <Button variant="original" type="submit" className="cta" disabled={!ok || busy}><span className="c-ico"><KeyRound size={20} /></span><span>{busy ? 'Entrando…' : 'Ver minha evolução'} ›››</span><span className="c-ico"><ArrowRight size={20} /></span></Button>
      </form>
      <p className="pp-safe"><ShieldCheck size={16} /> Acesso somente para visualizar. Ninguém consegue alterar seus dados por aqui.</p>
      <div className="auth-links"><a href="/login">Sou nutricionista · entrar com e-mail</a></div>
    </div></main>
  );
}

/* ---------- painel ---------- */
const EVO = [
  { k: 'weight', l: 'Peso', u: 'kg', d: 1, get: (a: A) => num(a.weight) },
  { k: 'bf', l: '% Gordura', u: '%', d: 1, get: (_a: A, r: R) => num(r['bf']) },
  { k: 'leanMass', l: 'Massa magra', u: 'kg', d: 1, get: (_a: A, r: R) => num(r['leanMass']) },
  { k: 'fatMass', l: 'Massa gorda', u: 'kg', d: 1, get: (_a: A, r: R) => num(r['fatMass']) },
  { k: 'waist', l: 'Cintura', u: 'cm', d: 1, get: (a: A) => num(a.circ['waist']) },
  { k: 'bmi', l: 'IMC', u: '', d: 1, get: (_a: A, r: R) => num(r['bmi']) },
];

function Dashboard({ data, onExit, onRefresh }: { data: PortalData; onExit: () => void; onRefresh: () => void }) {
  const p = { sex: data.patient.sex, birth: data.patient.birth, height: data.patient.height };
  const list = useMemo(() => [...data.assessments].sort((x, y) => x.date.localeCompare(y.date)), [data]);
  const rs = useMemo(() => list.map((a) => calc(a, p) as R), [list]);
  const last = list.at(-1), first = list[0], prev = list.at(-2);
  const rL = rs.at(-1) ?? {}, rF = rs[0] ?? {}, rP = rs.at(-2) ?? {};
  const fn = firstName(data.patient.name), nutriName = data.nutri.name || 'seu nutricionista';
  const [evo, setEvo] = useState('weight');
  const [pose, setPose] = useState<PortalPhoto['pose']>('front');
  const [viewer, setViewer] = useState<ViewerSpec | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const evoAvail = EVO.filter((m) => list.some((a, i) => m.get(a, rs[i]!) != null));
  const m = evoAvail.find((x) => x.k === evo) ?? evoAvail[0];
  const pts = m ? list.map((a, i) => ({ date: a.date, y: m.get(a, rs[i]!) })).filter((x): x is { date: string; y: number } => x.y != null) : [];

  // próximo retorno
  const every = data.patient.returnDays ?? data.nutri.returnDays ?? 30;
  const next = last ? addDays(last.date, every) : null, left = next ? daysTo(next) : null;

  // frase de resumo (o que mudou desde o começo)
  const summary = (() => {
    if (!last || !first || list.length < 2) return last ? `Sua primeira avaliação foi em ${dLong(last.date)}. A partir da próxima, a sua evolução aparece aqui.` : 'Sua primeira avaliação aparece aqui assim que for registrada.';
    const parts: string[] = [];
    const dw = num(last.weight)! - num(first.weight)!;
    const df = num(rL['fatMass']) != null && num(rF['fatMass']) != null ? num(rL['fatMass'])! - num(rF['fatMass'])! : null;
    const dl = num(rL['leanMass']) != null && num(rF['leanMass']) != null ? num(rL['leanMass'])! - num(rF['leanMass'])! : null;
    if (Math.abs(dw) >= 0.1) parts.push(`${dw < 0 ? 'perdeu' : 'ganhou'} ${fmt(Math.abs(dw))} kg`);
    if (df != null && Math.abs(df) >= 0.1) parts.push(`${df < 0 ? 'eliminou' : 'ganhou'} ${fmt(Math.abs(df))} kg de gordura`);
    if (dl != null && Math.abs(dl) >= 0.1) parts.push(`${dl > 0 ? 'ganhou' : 'perdeu'} ${fmt(Math.abs(dl))} kg de massa magra`);
    if (!parts.length) return `Desde ${dLong(first.date)}, seu peso e sua composição se mantiveram estáveis.`;
    const txt = parts.length > 1 ? parts.slice(0, -1).join(', ') + ' e ' + parts.at(-1) : parts[0];
    return `Desde ${dLong(first.date)}, você ${txt}.`;
  })();

  // fotos
  const photosBy = (a: string, k: string) => data.photos.find((x) => x.assessmentId === a && x.pose === k);
  const poses = POSES.filter((P) => data.photos.some((x) => x.pose === P.k));
  const poseK = poses.some((P) => P.k === pose) ? pose : poses[0]?.k;
  const dated = poseK ? list.filter((a) => photosBy(a.id, poseK)) : [];
  const phA = dated[0], phB = dated.at(-1);
  const openViewer = (k: string, aid: string) => {
    const items = list.filter((a) => photosBy(a.id, k)).map((a) => { const ph = photosBy(a.id, k)!; return { id: a.id + k, pose: k, title: poseLabel(k), sub: dLong(a.date), url: () => Promise.resolve(ph.url) }; });
    setViewer({ items, index: Math.max(0, items.findIndex((x) => x.id === aid + k)), onClose: () => {},
      onDownload: async (it) => { const ph = data.photos.find((x) => x.assessmentId + x.pose === it.id); if (!ph) return; const b = await (await fetch(ph.url)).blob(); const u = URL.createObjectURL(b); const el = document.createElement('a'); el.href = u; el.download = `minha-foto-${it.pose}-${it.id.slice(0, 8)}.jpg`; el.click(); setTimeout(() => URL.revokeObjectURL(u), 1000); } });
  };

  // medidas (circunferências): atual × primeira
  const circRows = last ? [...CIRC_TRUNK.map((c: { k: string; l: string; dir: number }) => ({ l: c.l, k: c.k, dir: c.dir })), ...CIRC_LIMBS.flatMap((c: { k: string; l: string }) => [{ l: `${c.l} (D)`, k: c.k + '_r', dir: 0 }, { l: `${c.l} (E)`, k: c.k + '_l', dir: 0 }])]
    .map((c) => ({ ...c, v: num(last.circ[c.k]), f: first && first !== last ? num(first.circ[c.k]) : null })).filter((c) => c.v != null) : [];

  const wa = data.nutri.phone ? 'https://wa.me/' + (() => { const d = data.nutri.phone.replace(/\D/g, ''); return d.length <= 11 ? '55' + d : d; })() : '';
  const age = ageAt(data.patient.birth);
  const bfNow = num(rL['bf']), bmiNow = num(rL['bmi']), whrNow = num(rL['whr']);
  const sex = data.patient.sex;
  const bfRanges = sex === 'F' ? [['Gordura essencial', 'até 13%'], ['Atlético', '14–20%'], ['Boa forma', '21–24%'], ['Média', '25–31%'], ['Acima do ideal', '32% ou mais']] : [['Gordura essencial', 'até 5%'], ['Atlético', '6–13%'], ['Boa forma', '14–17%'], ['Média', '18–24%'], ['Acima do ideal', '25% ou mais']];
  const bmiRanges = [['Abaixo do peso', 'menor que 18,5'], ['Peso normal', '18,5 a 24,9'], ['Sobrepeso', '25 a 29,9'], ['Obesidade grau I', '30 a 34,9'], ['Obesidade grau II', '35 a 39,9'], ['Obesidade grau III', '40 ou mais']];
  const whrRanges = sex === 'F' ? [['Risco baixo', 'menor que 0,80'], ['Risco moderado', '0,80 a 0,84'], ['Risco alto', '0,85 ou mais']] : [['Risco baixo', 'menor que 0,95'], ['Risco moderado', '0,95 a 0,99'], ['Risco alto', '1,00 ou mais']];
  const Ranges = ({ rows, now }: { rows: string[][]; now: string }) => (
    <div className="pp-ranges">{rows.map(([l, v]) => <div key={l} className={'pp-range' + (l === now ? ' on' : '')}><span>{l}{l === now && <em>você</em>}</span><b>{v}</b></div>)}</div>
  );

  const Main = (
    <>
      {/* números de hoje */}
      {last && (
        <section className="pp-sec">
          <h2 className="sec">Seus números hoje <span className="sec-note">{dLong(last.date)}</span></h2>
          <div className="dash pp-nums">
            <div className="card blue span2 pp-bf">
              <div className="card-head"><span className="label">Gordura corporal</span></div>
              <div className="big">{bfNow != null ? fmt(bfNow) : '—'}<small>%</small></div>
              <div className="sub">{bfNow != null && <span className="tag">{bfClass(bfNow, sex)}</span>} {prev && <Delta cur={bfNow} prev={rP['bf']} dir={-1} unit="pp" />}</div>
              {num(rL['fatMass']) != null && num(rL['leanMass']) != null && <>
                <div className="combar"><span style={{ width: `${100 - (bfNow ?? 0)}%`, background: 'var(--green-2)' }} /><span style={{ width: `${bfNow ?? 0}%`, background: 'var(--peach)' }} /></div>
                <div className="legend"><span><i style={{ background: 'var(--green-2)' }} />Magra <b>{fmt(num(rL['leanMass']))} kg</b></span><span><i style={{ background: 'var(--peach)' }} />Gorda <b>{fmt(num(rL['fatMass']))} kg</b></span></div>
              </>}
            </div>
            <div className="card"><div className="card-head"><span className="label">Peso</span></div><div className="mid">{fmt(num(last.weight))}<small>kg</small></div><div className="sub">{prev && <Delta cur={last.weight} prev={prev.weight} dir={0} unit="kg" />}</div></div>
            <div className="card green"><div className="card-head"><span className="label">Massa magra</span></div><div className="mid">{fmt(num(rL['leanMass']))}<small>kg</small></div><div className="sub">{prev && <Delta cur={rL['leanMass']} prev={rP['leanMass']} dir={1} unit="kg" />}</div></div>
            <div className="card"><div className="card-head"><span className="label">IMC</span></div><div className="mid">{fmt(bmiNow)}</div><div className="sub small">{bmiClass(bmiNow)}</div></div>
            <div className="card yellow"><div className="card-head"><span className="label">Cintura/quadril</span></div><div className="mid">{fmt(whrNow, 2)}</div><div className="sub small">{whrRisk(whrNow, sex)}</div></div>
          </div>
          {prev && <p className="small muted pp-note">Setas comparam com a avaliação anterior ({dLong(prev.date)}). <span className="delta good"><ArrowDown size={13} /></span> verde = mudança favorável.</p>}
        </section>
      )}

      {/* evolução */}
      {list.length > 0 && m && (
        <section className="pp-sec">
          <h2 className="sec">Sua evolução</h2>
          <div className="chips" role="tablist" aria-label="Medida do gráfico">{evoAvail.map((x) => <button key={x.k} role="tab" aria-selected={x.k === m.k} className={'chip' + (x.k === m.k ? ' on' : '')} onClick={() => setEvo(x.k)}>{x.l}</button>)}</div>
          <div className="card white pp-evo">
            <LineChart pts={pts} d={m.d} unit={m.u} />
            {pts.length > 0 && <div className="stat-row">
              <div className="stat" style={{ background: 'var(--card)' }}><small>Primeira</small><b>{fmt(pts[0]!.y, m.d)}{m.u && <small> {m.u}</small>}</b></div>
              <div className="stat" style={{ background: 'var(--card)' }}><small>Atual</small><b>{fmt(pts.at(-1)!.y, m.d)}{m.u && <small> {m.u}</small>}</b></div>
              <div className="stat" style={{ background: 'var(--card)' }}><small>Variação</small><b>{pts.length > 1 ? `${pts.at(-1)!.y - pts[0]!.y > 0 ? '+' : ''}${fmt(pts.at(-1)!.y - pts[0]!.y, m.d)}` : '—'}</b></div>
            </div>}
          </div>
        </section>
      )}

      {/* fotos */}
      {data.share.photos && poses.length > 0 && poseK && (
        <section className="pp-sec">
          <h2 className="sec">Suas fotos <span className="sec-note">toque para ampliar</span></h2>
          <div className="chips">{poses.map((P) => <button key={P.k} className={'chip' + (P.k === poseK ? ' on' : '')} onClick={() => setPose(P.k)}>{P.l}</button>)}</div>
          {phA && phB && phA !== phB ? (
            <div className="phc phc-side pp-photos">
              {[phA, phB].map((a, i) => (
                <figure key={a.id} className="phc-fig" onClick={() => openViewer(poseK, a.id)}><img src={photosBy(a.id, poseK)!.url} alt={`${poseLabel(poseK)} · ${dLong(a.date)}`} /><span className="phc-cap"><b>{i ? 'Agora' : 'Início'}</b><span>{dLong(a.date)}</span><small>{fmt(num(a.weight))} kg</small></span></figure>
              ))}
            </div>
          ) : phB && (
            <div className="phc-one"><figure className="phc-fig" onClick={() => openViewer(poseK, phB.id)}><img src={photosBy(phB.id, poseK)!.url} alt={poseLabel(poseK)} /><span className="phc-cap"><b>Foto</b><span>{dLong(phB.date)}</span></span></figure>
              <div className="phc-one-txt"><p>Na próxima avaliação com foto, você verá o antes e depois lado a lado.</p></div></div>
          )}
        </section>
      )}

      {/* histórico */}
      {list.length > 0 && (
        <section className="pp-sec">
          <h2 className="sec">Suas avaliações <span className="sec-note">{list.length} {list.length > 1 ? 'registros' : 'registro'}</span></h2>
          <div className="pp-hist">
            {[...list].reverse().map((a) => {
              const r = rs[list.indexOf(a)]!, pv = list[list.indexOf(a) - 1], rp = pv ? rs[list.indexOf(pv)]! : null, isOpen = open === a.id;
              const kv = (l: string, v: unknown, u: string, dd = 1, pvv?: unknown, dir = 0) => num(v) == null ? null : <div className="kv-row" key={l}><span className="k">{l}</span><span>{pvv !== undefined && <Delta cur={v} prev={pvv} dir={dir} d={dd} />}</span><span className="v">{fmt(num(v), dd)}<small>{u}</small></span></div>;
              return (
                <div key={a.id} className={'pp-ai' + (isOpen ? ' open' : '')}>
                  <button className="pp-ai-h" onClick={() => setOpen(isOpen ? null : a.id)} aria-expanded={isOpen}>
                    <span className="dpill"><small>{fmtDate(a.date, { month: 'short' }).replace('.', '')}</small><b>{a.date.slice(8, 10)}</b><small>{a.date.slice(2, 4)}</small></span>
                    <span className="grow"><b>{fmtDate(a.date, { weekday: 'long', day: 'numeric', month: 'long' })}</b><span className="stats"><span><em>{fmt(num(a.weight))}</em> kg</span>{num(r['bf']) != null && <span><em>{fmt(num(r['bf']))}</em>% gordura</span>}</span></span>
                    <ChevronDown size={18} className="pp-chev" />
                  </button>
                  {isOpen && (
                    <div className="pp-ai-b">
                      <div className="kv">
                        {kv('Peso', a.weight, 'kg', 1, rp ? pv!.weight : undefined, 0)}
                        {kv('% Gordura', r['bf'], '%', 1, rp ? rp['bf'] : undefined, -1)}
                        {kv('Massa magra', r['leanMass'], 'kg', 1, rp ? rp['leanMass'] : undefined, 1)}
                        {kv('Massa gorda', r['fatMass'], 'kg', 1, rp ? rp['fatMass'] : undefined, -1)}
                        {kv('IMC', r['bmi'], '', 1)}
                        {kv('Relação cintura/quadril', r['whr'], '', 2)}
                        {kv('Metabolismo basal', r['bmr'], 'kcal', 0)}
                        {kv('Soma das dobras', r['sumAll'], 'mm', 1)}
                        {kv('Massa muscular (bio)', a.extra.muscle, 'kg', 1)}
                        {kv('Água corporal (bio)', a.extra.water, '%', 1)}
                      </div>
                      <p className="small muted pp-meta">Protocolo: {(PROTOCOLS as Record<string, { name: string }>)[a.protocol]?.name ?? a.protocol}{a.extra.evaluator ? ` · Avaliador(a): ${a.extra.evaluator}` : ''}</p>
                      {a.extra.notes && <div className="notes pp-notes"><b>Observações do nutricionista</b><p>{a.extra.notes}</p></div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </>
  );

  const Side = (
    <>
      {/* nutricionista e retorno */}
      <section className="pp-sec pp-side-card">
        <div className="card pp-nutri">
          <span className="avatar">{initials(nutriName)}</span>
          <div className="grow"><small>Seu nutricionista</small><b>{nutriName}</b><span>{[data.nutri.crn && 'CRN ' + data.nutri.crn.replace(/^crn[\s:-]*/i, ''), data.nutri.specialty].filter(Boolean).join(' · ') || 'Acompanhamento nutricional'}</span></div>
        </div>
        {(wa || data.nutri.place) && <div className="pp-contact">
          {wa && <a className="pc wa" href={wa} target="_blank" rel="noopener"><MessageCircle size={16} />Falar no WhatsApp</a>}
          {data.nutri.place && <span className="pc"><MapPin size={16} />{data.nutri.place}</span>}
        </div>}
        {next && left != null && (
          <div className={'card pp-next ' + (left < 0 ? 'late' : left <= 7 ? 'soon' : '')}>
            <CalendarClock size={22} />
            <div><small>Próxima avaliação</small><b>{dLong(next)}</b><span>{left < 0 ? 'Data prevista já passou — combine o retorno' : left === 0 ? 'É hoje!' : `em ${left} ${left === 1 ? 'dia' : 'dias'} · retorno a cada ${every} dias`}</span></div>
          </div>
        )}
      </section>

      {/* medidas */}
      {circRows.length > 0 && (
        <section className="pp-sec">
          <h2 className="sec">Suas medidas <span className="sec-note">cm</span></h2>
          <div className="kv">{circRows.map((c) => <div className="kv-row" key={c.k}><span className="k">{c.l}</span><span>{c.f != null && <Delta cur={c.v} prev={c.f} dir={c.dir} />}</span><span className="v">{fmt(c.v)}<small>cm</small></span></div>)}</div>
          {first && first !== last && <p className="small muted pp-note">Comparado à primeira avaliação ({dLong(first.date)}).</p>}
        </section>
      )}

      {/* entenda */}
      <section className="pp-sec">
        <h2 className="sec">Entenda seus números</h2>
        <div className="pp-learn">
          <details open><summary><span>% de gordura</span><ChevronDown size={18} /></summary>
            <p>Quanto do seu peso é gordura. É o número mais importante para acompanhar o resultado, porque o peso sozinho não mostra se você perdeu gordura ou músculo.</p>
            <Ranges rows={bfRanges} now={bfClass(bfNow, sex)} />
            <p className="small muted">Referência para {sex === 'F' ? 'mulheres' : 'homens'}{age ? ` · você tem ${age} anos` : ''}.</p></details>
          <details><summary><span>Massa magra e massa gorda</span><ChevronDown size={18} /></summary>
            <p><b>Massa magra</b> é tudo que não é gordura: músculos, ossos, órgãos e água. O ideal é manter ou aumentar enquanto a <b>massa gorda</b> diminui.</p></details>
          <details><summary><span>IMC</span><ChevronDown size={18} /></summary>
            <p>Peso dividido pela altura ao quadrado. É uma referência geral: não separa músculo de gordura, por isso é avaliado junto com o % de gordura.</p>
            <Ranges rows={bmiRanges} now={bmiClass(bmiNow)} /></details>
          <details><summary><span>Relação cintura/quadril</span><ChevronDown size={18} /></summary>
            <p>Mostra onde a gordura se concentra. Gordura na região da barriga está ligada a maior risco para a saúde do coração.</p>
            <Ranges rows={whrRanges} now={whrRisk(whrNow, sex)} /></details>
          <details><summary><span>Metabolismo basal</span><ChevronDown size={18} /></summary>
            <p>Energia (em kcal) que seu corpo gasta por dia em repouso, só para se manter funcionando. Mais massa magra costuma aumentar esse gasto.</p></details>
          <details><summary><span>Circunferências e dobras</span><ChevronDown size={18} /></summary>
            <p>As <b>circunferências</b> são medidas com fita (cintura, quadril, braço…). As <b>dobras cutâneas</b> medem a gordura logo abaixo da pele com o adipômetro e entram no cálculo do % de gordura.</p></details>
        </div>
      </section>
    </>
  );

  return (
    <main className="app pp">
      <header className="top pp-top">
        <span className="avatar" style={{ background: 'var(--yellow-2)' }}>{initials(data.patient.name)}</span>
        <div className="title-block"><small>Portal do paciente</small><b>Olá, {fn}</b></div>
        <div className="grow" />
        <button className="icon-btn" onClick={onRefresh} aria-label="Atualizar"><RefreshCw size={20} /></button>
        <button className="icon-btn" onClick={onExit} aria-label="Sair deste aparelho"><LogOut size={20} /></button>
      </header>
      <section className="card blue pp-hero">
        <span className="tag"><Sparkles size={14} /> {list.length ? `${list.length} ${list.length > 1 ? 'avaliações' : 'avaliação'}` : 'Bem-vindo(a)'}{data.patient.goal ? ` · ${{ emagrecimento: 'Emagrecimento', hipertrofia: 'Hipertrofia', saude: 'Saúde e bem-estar', performance: 'Performance esportiva', reeducacao: 'Reeducação alimentar', clinico: 'Acompanhamento clínico' }[data.patient.goal] ?? data.patient.goal}` : ''}</span>
        <h1>{summary}</h1>
      </section>
      {list.length === 0 && <div className="card empty"><h3>Nenhuma avaliação ainda</h3><p>Assim que {nutriName} registrar sua primeira avaliação, tudo aparece aqui.</p></div>}
      <div className="pp-grid"><div className="pp-main">{Main}</div><aside className="pp-side">{Side}</aside></div>
      <footer className="pp-foot">
        <p><ShieldCheck size={16} /> Somente visualização. Os dados são registrados por {nutriName}{data.updatedAt ? ` · atualizado em ${dLong(data.updatedAt.slice(0, 10))}` : ''}.</p>
        <p className="small muted"><Stethoscope size={14} /> Dúvidas sobre seus resultados? Fale com seu nutricionista. <Camera size={14} /> As fotos são privadas.</p>
        <button className="btn ghost sm" onClick={onExit}><LogOut size={16} /> Sair deste aparelho</button>
      </footer>
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
      if (window.location.hash) history.replaceState(null, '', window.location.pathname);
      return isCode(c) ? c : '';
    };
    const c = fromHash() || read();
    if (isCode(c)) void enter(c); else setPhase('entry');
    const onHash = () => { const h = fromHash(); if (h) void enter(h); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const exit = () => { write(null); setData(null); code.current = ''; setPhase('entry'); };

  if (phase === 'boot' || phase === 'loading') return <main className="app"><div className="pp-loading"><span className="pp-spin" /><p>Carregando sua evolução…</p></div></main>;
  if (phase === 'down') return (
    <main className="app"><div className="auth-wrap"><div className="card empty"><h3>Não foi possível carregar agora</h3><p>Verifique sua internet e tente de novo em instantes.</p>
      <Button variant="original" className="btn dark" style={{ margin: '16px auto 0', display: 'inline-flex' }} onClick={() => void enter(code.current || read())}><RefreshCw size={16} /> Tentar de novo</Button>
      <button className="btn ghost sm" style={{ margin: '10px auto 0', display: 'flex' }} onClick={exit}>Usar outro código</button></div></div></main>
  );
  if (phase === 'ready' && data) return <Dashboard data={data} onExit={exit} onRefresh={() => void enter(code.current)} />;
  return <Entry onEnter={(c) => void enter(c)} error={error} busy={false} />;
}
