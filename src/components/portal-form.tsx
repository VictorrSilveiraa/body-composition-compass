import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, Lock, Send } from 'lucide-react';
import { answerText, cleanAnswers, fieldsOf, type Answers, type Field, type FormDef } from '@/lib/forms';
import type { SubmitResult } from '@/lib/portal-code';

/*
 * Formulário que o paciente responde no portal (pré-consulta ou ficha de saúde).
 * O rascunho fica neste aparelho enquanto ele preenche; nada é enviado até tocar em "Enviar".
 */
const MSG: Record<string, string> = {
  empty: 'Responda pelo menos uma pergunta antes de enviar.',
  limit: 'Você já enviou várias vezes hoje. Tente de novo amanhã ou fale com seu nutricionista.',
  invalid: 'Seu acesso foi pausado ou trocado. Peça um novo código ao seu nutricionista.',
  unavailable: 'Não foi possível enviar agora. Confira a internet e tente de novo.',
};

export function PortalForm({ def, draftKey, initial, nutri, onSubmit, onBack, onSent }: {
  def: FormDef; draftKey: string; initial: Answers | null; nutri: string;
  onSubmit: (a: Answers) => Promise<SubmitResult>; onBack: () => void; onSent: (at: string, n: number) => void;
}) {
  const [a, setA] = useState<Answers>(() => { try { const d = JSON.parse(localStorage.getItem(draftKey) || 'null') as Answers | null; if (d) return d; } catch { /* sem armazenamento */ } return initial ?? {}; });
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } try { localStorage.setItem(draftKey, JSON.stringify(a)); } catch { /* ok */ } }, [a]);
  const all = fieldsOf(def), done = useMemo(() => all.filter((f) => answerText(f, cleanAnswers(def, a))).length, [a]);
  const set = (k: string, v: Answers[string] | '') => { setErr(''); setA((s) => { const n = { ...s }; if (v === '' || (Array.isArray(v) && !v.length)) delete n[k]; else n[k] = v; return n; }); };

  const send = async () => {
    const clean = cleanAnswers(def, a);
    if (!Object.keys(clean).length) { setErr(MSG['empty']!); return; }
    setBusy(true); setErr('');
    try {
      const r = await onSubmit(clean);
      if (r.ok) { try { localStorage.removeItem(draftKey); } catch { /* ok */ } onSent(r.at, Object.keys(clean).length); }
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
    if (f.t === 'long') return <span className="f-input fm-in"><textarea rows={3} value={String(v ?? '')} onChange={(e) => set(f.k, e.target.value)} placeholder={f.ph} maxLength={1500} /></span>;
    if (f.t === 'num') return <span className="f-input fm-in"><input inputMode="decimal" value={String(v ?? '')} onChange={(e) => set(f.k, e.target.value.replace(/[^\d,.]/g, ''))} placeholder={f.ph ?? '—'} /><em>{f.u === 'x' ? 'por semana' : f.u}</em></span>;
    return <span className="f-input text fm-in"><input type={f.t === 'time' ? 'time' : 'text'} value={String(v ?? '')} onChange={(e) => set(f.k, e.target.value)} placeholder={f.ph} maxLength={300} /></span>;
  };

  return (<>
    <header className="top">
      <button className="icon-btn" onClick={onBack} aria-label="Voltar"><ChevronLeft className="ico" /></button>
      <div className="title-block"><small>{def.sub}</small><b>{def.title}</b></div>
    </header>
    <div className="card pf-intro">
      <div className="pf-prog" role="progressbar" aria-valuemin={0} aria-valuemax={all.length} aria-valuenow={done}><i style={{ width: `${(done / all.length) * 100}%` }} /></div>
      <p><b>{done} de {all.length}</b> respondidas · responda o que quiser, nada é obrigatório.</p>
      <p className="pf-lock"><Lock className="ico sm" /> Só {nutri} vê suas respostas. O rascunho fica salvo neste aparelho até você enviar.</p>
    </div>
    <div className="fm-grid pf-grid">
      {def.sections.map((s) => (
        <section className="card fm-sec" key={s.k}>
          <div className="fm-sh"><b>{s.l}</b><small className={s.fields.some((f) => answerText(f, cleanAnswers(def, a))) ? 'ok' : ''}>{s.fields.filter((f) => answerText(f, cleanAnswers(def, a))).length}/{s.fields.length}</small></div>
          <div className="fm-fields">{s.fields.map((f) => (
            <div key={f.k} className={'fm-f' + (f.t === 'num' || f.t === 'time' ? '' : ' wide')}>
              <span className="fm-l">{f.l}</span>{f.hint && <small className="pf-hint">{f.hint}</small>}
              {control(f)}
            </div>))}</div>
        </section>))}
    </div>
    {err && <p className="pf-err" role="alert">{err}</p>}
    <div className="wiz-bar form-bar"><div className="in">
      <button className="btn ghost" onClick={onBack}>Depois</button>
      <button className="btn dark" onClick={() => void send()} disabled={busy}><Send className="ico" /> {busy ? 'Enviando…' : 'Enviar respostas'}</button>
    </div></div>
  </>);
}
