import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { Apple, Check, ChevronLeft, ChevronRight, ClipboardList, Clock, Droplet, Heart, Lock, MessageCircle, Moon, Pencil, Pill, RotateCcw, Scale, Send, Target, Trash2, TriangleAlert, Zap } from 'lucide-react';
import { answerText, cleanAnswers, fieldsOf, fmtSent, type Answers, type Field, type FormDef } from '@/lib/forms';
import type { SubmitResult } from '@/lib/portal-code';
import { PdfIcon } from '@/components/pdf-icon';

/*
 * Formulários do paciente no portal (pré-consulta e ficha de saúde):
 *  · resumo: o que já foi respondido, seção por seção, e o que falta (com atalho para responder)
 *  · preenchimento em etapas: uma seção por tela, barra de progresso e revisão antes de enviar
 * O rascunho fica neste aparelho enquanto ele preenche; nada é enviado até tocar em "Enviar".
 */
const MSG: Record<string, string> = {
  empty: 'Responda pelo menos uma pergunta antes de enviar.',
  limit: 'Você já enviou várias vezes hoje. Tente de novo amanhã ou fale com seu nutricionista.',
  invalid: 'Seu acesso foi pausado ou trocado. Peça um novo código ao seu nutricionista.',
  unavailable: 'Não foi possível enviar agora. Confira a internet e tente de novo.',
};
const ICONS: Record<string, ComponentType<{ className?: string }>> = { apple: Apple, moon: Moon, chat: MessageCircle, heart: Heart, pill: Pill, alert: TriangleAlert, clock: Clock, drop: Droplet, bolt: Zap, scale: Scale, clip: ClipboardList, target: Target };
const SIcon = ({ k }: { k: string }) => { const I = ICONS[k] ?? ClipboardList; return <I className="ico sm" />; };
const Ring = ({ pct, label }: { pct: number; label: string | number }) => <span className="an-ring" style={{ ['--p' as string]: Math.round(pct) }} aria-hidden="true"><b>{label}</b></span>;
const top = () => { try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { /* ok */ } };

export function PortalForm({ def, draftKey, initial, sentAt, reviewed, current, nutri, onSubmit, onBack, onSent, onPdf, onDelete }: {
  def: FormDef; draftKey: string;
  /** respostas atuais (ficha de saúde: a ficha completa; pré-consulta: a última enviada) */
  initial: Answers | null; sentAt: string | null;
  /** a ficha foi revisada pelo nutricionista depois do último envio */
  reviewed: boolean;
  /** as respostas valem para agora (pré-consulta deste retorno; ficha sempre) — senão abre direto no preenchimento */
  current: boolean;
  nutri: string;
  onSubmit: (a: Answers) => Promise<SubmitResult>; onBack: () => void; onSent: (at: string, a: Answers) => void;
  /** salva em PDF (respostas que estão na tela) */
  onPdf: (a: Answers) => void;
  /** apaga as respostas enviadas (só a pré-consulta); devolve se deu certo */
  onDelete?: () => Promise<boolean>;
}) {
  const isAnam = def.k === 'anamnese', S = def.sections, N = S.length;
  // rascunho só conta se tiver alguma resposta
  const [draft, setDraft] = useState<Answers | null>(() => { try { const d = JSON.parse(localStorage.getItem(draftKey) || 'null') as Answers | null; return d && Object.keys(d).length ? d : null; } catch { return null; } });
  const hasData = !!initial && Object.keys(initial).length > 0, startSum = current && hasData;
  const base = () => (isAnam ? { ...(initial ?? {}) } : {});
  const [a, setA] = useState<Answers>(() => (!startSum && draft ? draft : base()));
  const filledIn = (x: Answers, i: number) => S[i]!.fields.filter((f) => answerText(f, cleanAnswers(def, x))).length;
  const firstGap = (x: Answers) => { const i = S.findIndex((_, k) => !filledIn(x, k)); return i < 0 ? 0 : i; };
  const [mode, setMode] = useState<'sum' | 'edit'>(() => (startSum ? 'sum' : 'edit'));
  const [step, setStep] = useState(() => (isAnam ? firstGap((!startSum && draft) || initial || {}) : 0));
  /** confirmação aberta: refazer do zero, apagar respostas ou descartar o rascunho */
  const [ask, setAsk] = useState<'' | 'redo' | 'del' | 'discard'>('');
  const [onDraft, setOnDraft] = useState(() => !startSum && !!draft);
  const [fromSum, setFromSum] = useState(false);
  const [dir, setDir] = useState(1);
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  // grava o rascunho só depois que a pessoa mexe em algo
  const touched = useRef(false);
  useEffect(() => { if (!touched.current) return; try { localStorage.setItem(draftKey, JSON.stringify(a)); } catch { /* ok */ } }, [a, draftKey]);
  const clean = useMemo(() => cleanAnswers(def, a), [a]);
  const all = fieldsOf(def), done = all.filter((f) => answerText(f, clean)).length;
  const set = (k: string, v: Answers[string] | '') => { touched.current = true; setErr(''); setA((s) => { const n = { ...s }; if (v === '' || (Array.isArray(v) && !v.length)) delete n[k]; else n[k] = v; return n; }); };
  const goStep = (i: number) => { setDir(i >= step ? 1 : -1); setStep(i); top(); };
  const edit = (i: number, from: Answers = base()) => { setFromSum(true); setMode('edit'); setDir(1); setStep(i); setA(from); setAsk(''); top(); };
  const dropDraft = () => { try { localStorage.removeItem(draftKey); } catch { /* ok */ } touched.current = false; setDraft(null); setOnDraft(false); };
  const discard = () => { dropDraft(); setAsk(''); if (fromSum || hasData && current) { setMode('sum'); top(); } else { setA(base()); setStep(0); } };

  const send = async () => {
    if (!Object.keys(clean).length) { setErr(MSG['empty']!); return; }
    setBusy(true); setErr('');
    try {
      const r = await onSubmit(clean);
      if (r.ok) { dropDraft(); onSent(r.at, clean); }
      else setErr(MSG[r.reason] ?? MSG['unavailable']!);
    } catch { setErr(MSG['unavailable']!); }
    finally { setBusy(false); }
  };

  const control = (f: Field) => {
    const v = a[f.k];
    if (f.t === 'scale') return (<>
      <div className="fm-scale" role="radiogroup" aria-label={f.l}>{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={Number(v) === n} className={Number(v) === n ? 'on' : ''} onClick={() => set(f.k, Number(v) === n ? '' : n)}>{n}</button>)}</div>
      {f.ends && <div className="fm-ends"><small>{f.ends[0]}</small><small>{f.ends[1]}</small></div>}
    </>);
    if (f.t === 'choice') return <div className="fm-chips" role="radiogroup" aria-label={f.l}>{f.opts!.map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={v === k} className={'chip' + (v === k ? ' on' : '')} onClick={() => set(f.k, v === k ? '' : k)}>{l}</button>)}</div>;
    if (f.t === 'chips') { const arr = Array.isArray(v) ? v : [];
      const tog = (k: string) => set(f.k, arr.includes(k) ? arr.filter((x) => x !== k) : k === 'nenhuma' ? ['nenhuma'] : [...arr.filter((x) => x !== 'nenhuma'), k]);
      return (<>
        <div className="fm-chips">{f.opts!.map(([k, l]) => <button key={k} type="button" aria-pressed={arr.includes(k)} className={'chip' + (arr.includes(k) ? ' on' : '')} onClick={() => tog(k)}>{arr.includes(k) && <Check className="ico" />}{l}</button>)}</div>
        {f.other && <span className="f-input text fm-in fm-other"><input value={String(a[f.k + '_o'] ?? '')} onChange={(e) => set(f.k + '_o', e.target.value)} placeholder="Outras (escreva)" aria-label={`${f.l}: outras`} /></span>}
      </>); }
    if (f.t === 'long') return <span className="f-input fm-in"><textarea rows={3} value={String(v ?? '')} onChange={(e) => set(f.k, e.target.value)} placeholder={f.ph} maxLength={1500} aria-label={f.l} /></span>;
    if (f.t === 'num') return <span className="f-input fm-in"><input inputMode="decimal" value={String(v ?? '').replace('.', ',')} onChange={(e) => set(f.k, e.target.value.replace(/[^\d,.]/g, ''))} placeholder={f.ph ?? '—'} aria-label={f.l} /><em>{f.u === 'x' ? 'por semana' : f.u}</em></span>;
    return <span className="f-input text fm-in"><input type={f.t === 'time' ? 'time' : 'text'} value={String(v ?? '')} onChange={(e) => set(f.k, e.target.value)} placeholder={f.ph} maxLength={300} aria-label={f.l} /></span>;
  };
  /** respostas de uma seção, em lista (resumo e revisão) */
  const rows = (x: Answers, i: number) => S[i]!.fields.map((f) => { const t = answerText(f, x); return t ? <div className="fa-row" key={f.k}><dt>{f.l}</dt><dd>{t}</dd></div> : null; }).filter(Boolean);
  const nfn = nutri.split(' ')[0] === 'seu' ? 'seu nutricionista' : nutri;

  /* ---------- resumo ---------- */
  if (mode === 'sum') {
    const x = cleanAnswers(def, initial ?? {}), n = all.filter((f) => answerText(f, x)).length, firstEmpty = S.findIndex((_, i) => !rows(x, i).length);
    const dn = draft ? all.filter((f) => answerText(f, cleanAnswers(def, draft))).length : 0;
    return (<>
      <header className="top">
        <button className="icon-btn" onClick={onBack} aria-label="Voltar"><ChevronLeft className="ico" /></button>
        <div className="title-block"><small>{isAnam ? 'Anamnese' : 'Antes do retorno'}</small><b>{isAnam ? 'Sua ficha de saúde' : 'Sua pré-consulta'}</b></div>
        <div className="grow" />
        <button className="icon-btn" onClick={() => onPdf(x)} aria-label="Salvar em PDF" title="Salvar em PDF"><PdfIcon /></button>
      </header>
      {draft && (
        <div className="card pf-draft">
          <span className="pf-draft-ico"><Pencil className="ico sm" /></span>
          <div className="grow"><b>Você parou no meio</b><small>{dn} {dn === 1 ? 'resposta' : 'respostas'} ainda não {dn === 1 ? 'enviada' : 'enviadas'}, salvas neste aparelho</small></div>
          <div className="pf-draft-btns"><button className="btn ghost sm" onClick={dropDraft}>Descartar</button><button className="btn dark sm" onClick={() => { setOnDraft(true); edit(isAnam ? firstGap(draft) : 0, draft); }}>Continuar</button></div>
        </div>
      )}
      <div className="card pf-sum">
        <Ring pct={(n / all.length) * 100} label={n} />
        <div className="grow"><b>{n} de {all.length} {isAnam ? 'itens preenchidos' : 'perguntas respondidas'}</b>
          <small>{sentAt ? `Enviada em ${fmtSent(sentAt)}` : 'Preenchida com seu nutricionista'}{isAnam && sentAt ? (reviewed ? ` · revisada por ${nfn}` : ` · ${nfn} ainda vai revisar`) : ''}</small></div>
        <button className="btn dark sm" onClick={() => edit(isAnam && firstEmpty >= 0 ? firstEmpty : 0)}>{isAnam ? <><Pencil className="ico sm" /> {firstEmpty >= 0 ? 'Completar' : 'Atualizar'}</> : 'Responder de novo'}</button>
        <div className="pf-more">
          <button onClick={() => onPdf(x)}><PdfIcon className="ico sm" /> Salvar em PDF</button>
          {isAnam && <button onClick={() => setAsk(ask === 'redo' ? '' : 'redo')}><RotateCcw className="ico sm" /> Refazer do zero</button>}
          {!isAnam && onDelete && <button className="del" onClick={() => setAsk(ask === 'del' ? '' : 'del')}><Trash2 className="ico sm" /> Apagar respostas</button>}
        </div>
        {ask === 'redo' && <div className="pf-confirm" role="alert"><p>Começar uma ficha nova em branco? A atual continua valendo até você enviar a nova.</p><div><button className="btn ghost sm" onClick={() => setAsk('')}>Cancelar</button><button className="btn dark sm" onClick={() => edit(0, {})}>Começar do zero</button></div></div>}
        {ask === 'del' && <div className="pf-confirm" role="alert"><p>Apagar a pré-consulta que você enviou{sentAt ? ` em ${fmtSent(sentAt)}` : ''}? {nfn === 'seu nutricionista' ? 'Seu nutricionista' : nfn} deixa de ver estas respostas.</p><div><button className="btn ghost sm" onClick={() => setAsk('')}>Cancelar</button><button className="btn danger sm" disabled={busy} onClick={async () => { setBusy(true); const ok = await onDelete!().catch(() => false); setBusy(false); if (!ok) setErr(MSG['unavailable']!); }}>{busy ? 'Apagando…' : 'Apagar'}</button></div>{err && <p className="pf-err">{err}</p>}</div>}
      </div>
      <div className="fm-grid pf-sumgrid">
        {S.map((s, i) => { const r = rows(x, i); return (
          <section className={'card pf-ss' + (r.length ? '' : ' blank')} key={s.k}>
            <div className="fm-sh"><span className="chip-ico"><SIcon k={s.icon} /></span><span className="grow"><b>{s.l}</b>{!r.length && <small className="fm-sd">{s.d}</small>}</span>
              {isAnam && <button className="pf-edit" onClick={() => edit(i)} aria-label={`Editar ${s.l}`}>{r.length ? <Pencil className="ico sm" /> : <>Responder <ChevronRight className="ico sm" /></>}</button>}</div>
            {r.length > 0 && <dl className="pf-dl">{r}</dl>}
          </section>); })}
      </div>
      <p className="pf-lock pf-lock-sum"><Lock className="ico sm" /> Só {nfn} vê estas respostas.</p>
    </>);
  }

  /* ---------- preenchimento em etapas ---------- */
  const review = step >= N, s = S[Math.min(step, N - 1)]!;
  const back = () => { if (step > 0) goStep(step - 1); else if (fromSum) { setMode('sum'); top(); } else onBack(); };
  return (<>
    <header className="top">
      <button className="icon-btn" onClick={back} aria-label="Voltar"><ChevronLeft className="ico" /></button>
      <div className="title-block"><small>{def.title} · {review ? 'revisão' : `etapa ${step + 1} de ${N}`}</small><b>{review ? 'Confira e envie' : s.l}</b></div>
      <div className="grow" />
      {(onDraft || touched.current) && <button className="pf-discard" onClick={() => setAsk(ask === 'discard' ? '' : 'discard')}>Descartar</button>}
    </header>
    {ask === 'discard' && <div className="card pf-confirm" role="alert"><p>Descartar o que você preencheu agora? O que já foi enviado continua igual.</p><div><button className="btn ghost sm" onClick={() => setAsk('')}>Continuar preenchendo</button><button className="btn danger sm" onClick={discard}>Descartar</button></div></div>}
    {onDraft && !ask && step === firstGap(a) && <p className="pf-resume"><Pencil className="ico sm" /> Continuando de onde você parou.</p>}
    <div className="pf-steps" role="tablist" aria-label="Etapas">
      {S.map((x, i) => <button key={x.k} role="tab" aria-selected={i === step} aria-label={x.l} className={(i === step ? 'on ' : '') + (filledIn(a, i) ? 'done' : '')} onClick={() => goStep(i)} />)}
      <button role="tab" aria-selected={review} aria-label="Revisão" className={'rev' + (review ? ' on' : '')} onClick={() => goStep(N)} />
    </div>
    <div className="pf-body">
      <nav className="pf-side" aria-label="Seções">
        <div className="pf-side-h"><Ring pct={(done / all.length) * 100} label={done} /><span><b>{done} de {all.length}</b><small>respondidas</small></span></div>
        {S.map((x, i) => { const k = filledIn(a, i); return (
          <button key={x.k} className={(i === step ? 'on ' : '') + (k ? 'done' : '')} onClick={() => goStep(i)}><span className="pf-si">{k ? <Check className="ico sm" /> : <SIcon k={x.icon} />}</span><span className="grow">{x.l}</span>{k > 0 && <small>{k}/{x.fields.length}</small>}</button>); })}
        <button className={'rev' + (review ? ' on' : '')} onClick={() => goStep(N)}><span className="pf-si"><Send className="ico sm" /></span><span className="grow">Revisar e enviar</span></button>
      </nav>
      <div className="pf-main" key={step} data-dir={dir}>
        {!review ? (<>
          <section className="card fm-sec pf-sec">
            <div className="fm-sh"><span className="chip-ico"><SIcon k={s.icon} /></span><span className="grow"><b>{s.l}</b>{s.d && <small className="fm-sd">{s.d}</small>}</span></div>
            <div className="fm-fields">{s.fields.map((f) => (
              <div key={f.k} className={'fm-f' + (f.t === 'num' || f.t === 'time' ? '' : ' wide')}>
                <span className="fm-l">{f.l}</span>{f.hint && <small className="pf-hint">{f.hint}</small>}
                {control(f)}
              </div>))}</div>
          </section>
          <p className="pf-lock"><Lock className="ico sm" /> Nada é obrigatório. O rascunho fica salvo neste aparelho e só {nfn} vê as respostas.</p>
        </>) : (
          <section className="card pf-review">
            <div className="pf-sum in"><Ring pct={(done / all.length) * 100} label={done} /><div className="grow"><b>{done} de {all.length} respondidas</b><small>{done < all.length ? 'Pode enviar assim ou completar o que faltou.' : 'Tudo respondido. Obrigado!'}</small></div></div>
            {S.map((x, i) => { const r = rows(clean, i); return (
              <div className="pf-rv" key={x.k}>
                <div className="pf-rv-h"><SIcon k={x.icon} /><b>{x.l}</b><button onClick={() => goStep(i)}>{r.length ? 'editar' : 'responder'}</button></div>
                {r.length ? <dl className="pf-dl">{r}</dl> : <p className="pf-none">Sem resposta</p>}
              </div>); })}
            {err && <p className="pf-err" role="alert">{err}</p>}
          </section>
        )}
      </div>
    </div>
    <div className="wiz-bar form-bar"><div className="in">
      <button className="btn ghost" onClick={back}>{step === 0 && !fromSum ? 'Depois' : 'Voltar'}</button>
      {review
        ? <button className="btn dark" onClick={() => void send()} disabled={busy}><Send className="ico" /> {busy ? 'Enviando…' : 'Enviar respostas'}</button>
        : <button className="btn dark" onClick={() => goStep(step + 1)}>{step === N - 1 ? 'Revisar' : filledIn(a, step) ? 'Próximo' : 'Pular'} <ChevronRight className="ico" /></button>}
    </div></div>
  </>);
}
