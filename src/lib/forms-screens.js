import { esc, fmt, fmtDate, firstName } from './calculos.js';
import { ANAMNESE_FORM, PRE_FORM, answerText, changedKeys, cleanAnswers, currentAnamnese, fieldsOf, filledCount, plural, preAlerts, sectionsProgress } from './forms';
import { exportPdf } from './report.js';
import { waSvg } from './wa-icon';
import { motivo } from './motivo';

/*
 * PRÉ-CONSULTA e ANAMNESE no app do nutricionista:
 *  · ficha: cartão da pré-consulta (antes dos resultados) e cartão da anamnese (coluna lateral)
 *  · /pacientes/:id/anamnese: editor completo + histórico das pré-consultas
 *  · a anamnese é UMA só: o que o paciente envia pelo portal entra por cima da versão revisada,
 *    aparece destacado e vira oficial quando o nutricionista salva (revisa)
 *  · envio do link do formulário pelo WhatsApp; avisos de resposta nova (menu, lista, ficha)
 */
export function formScreens(ctx){
const { options, state, ic, go, render, toast, sheet, listOf } = ctx;
const R = options.responses || null; // loja de respostas (src/lib/respostas.ts)
const db = () => ctx.db();
const P = id => db().profiles.find(p=>p.id===id);
const dShort = iso => fmtDate(iso.slice(0,10),{day:'numeric',month:'short'});
const dLong = iso => fmtDate(iso.slice(0,10),{day:'numeric',month:'long'});
const daysAgo = iso => Math.round((Date.now() - new Date(iso).getTime()) / 864e5);
const agoTxt = iso => { const d = daysAgo(iso); return d<=0 ? 'hoje' : d===1 ? 'ontem' : `há ${d} dias`; };
const numOf = v => { const n = Number(String(v ?? '').replace(',','.')); return Number.isFinite(n) && n>0 ? n : null; };
const planOf = p => (p.plan ||= {});
const X = { // ícones que o app ainda não tinha
  pill:'<rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="m9.5 9.5 5 5"/>',
  alert:'<path d="M12 3 2.5 20h19z"/><path d="M12 10v4.5"/><circle cx="12" cy="17.3" r=".8" fill="currentColor"/>',
  moon:'<path d="M20 14.6A8.2 8.2 0 1 1 9.4 4a6.6 6.6 0 0 0 10.6 10.6z"/>',
  apple:'<path d="M12 6.528V3a1 1 0 0 1 1-1h0"/><path d="M18.237 21A15 15 0 0 0 22 11a6 6 0 0 0-10-4.472A6 6 0 0 0 2 11a15.1 15.1 0 0 0 3.763 10 3 3 0 0 0 3.648.648 5.5 5.5 0 0 1 5.178 0A3 3 0 0 0 18.237 21"/>',
  form:'<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  ban:'<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
  dots:'<circle cx="5.5" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.7" fill="currentColor" stroke="none"/>',
};
const icon = (n, cls='') => X[n] ? `<svg class="ico ${cls}" viewBox="0 0 24 24">${X[n]}</svg>` : ic(n, cls);
const FIELD = Object.fromEntries(fieldsOf(ANAMNESE_FORM).map(f=>[f.k,f]));
const ANAM_N = fieldsOf(ANAMNESE_FORM).length;
const SEC_SHORT = { remedios:'Remédios', alergias:'Alergias', sono:'Sono e água', treino:'Treino', peso:'Peso', objetivo:'Expectativas' };
/** anel de progresso (0–100) */
const ring = (pct, label) => `<span class="an-ring" style="--p:${Math.round(pct)}" aria-hidden="true"><b>${label}</b></span>`;

/* ---------- seções recolhíveis da ficha (lembradas neste aparelho, valem para todos os pacientes) ---------- */
const FOLD_KEY = 'avf.fold';
const folds = () => { try { return JSON.parse(localStorage.getItem(FOLD_KEY) || '{}'); } catch { return {}; } };
const isClosed = k => !!folds()[k];
/** título (h2) + cartão-resumo (fechada) + conteúdo (aberta). Abrir/fechar anima sem redesenhar a tela. */
function fold(k, title, mini, body, o={}){
  const closed = !o.force && isClosed(k);
  return `<div class="fold${closed?' closed':''}" data-fold="${k}">
    <h2 class="sec fold-h">${title}<button class="fold-btn" data-act="fold" data-k="${k}" aria-expanded="${!closed}" aria-label="Mostrar ou recolher">${ic('chev','sm')}</button></h2>
    <div class="fold-mini-w"><div class="fold-in"><div class="card fold-mini" data-act="fold" data-k="${k}" role="button" tabindex="0" aria-label="Mostrar">${mini}<span class="fold-more">${ic('chev','sm')}</span></div></div></div>
    <div class="fold-body"><div class="fold-in">${body}</div></div>
  </div>`;
}
function toggleFold(b){
  const el = b.closest('.fold'), k = el?.dataset.fold; if (!el || !k) return;
  const closed = !el.classList.contains('closed'), all = folds();
  if (closed) all[k] = 1; else delete all[k];
  try { localStorage.setItem(FOLD_KEY, JSON.stringify(all)); } catch { /* ok */ }
  el.classList.add('anim'); el.classList.toggle('closed', closed);
  el.querySelector('.fold-btn')?.setAttribute('aria-expanded', String(!closed));
  clearTimeout(el._t); el._t = setTimeout(()=>el.classList.remove('anim'), 520);
  if (!closed && k==='pre'){ const p = P(state.param); const r = p && currentPre(p); if (r && !r.read) setTimeout(()=>markSeen([r]), 1200); }
}
/** linha do cartão-resumo */
const miniRow = (ico, b, small, extra='') => `<span class="chip-ico">${ico}</span><span class="grow"><b>${b}</b><small>${small}</small></span>${extra}`;

/* ---------- respostas ---------- */
const pres = pid => R ? R.ofPatient(pid, 'pre_consulta') : [];
const anams = pid => R ? R.ofPatient(pid, 'anamnese') : [];
// pré-consulta "da vez": respondida depois da última avaliação (é para a próxima consulta)
function currentPre(p){ const last = listOf(p.id).at(-1), r = pres(p.id)[0]; return r && (!last || r.createdAt.slice(0,10) >= last.date) ? r : null; }
// pré-consulta que antecedeu uma avaliação (entre a anterior e ela)
function preFor(p, a){ const list = listOf(p.id), i = list.findIndex(x=>x.id===a.id), prev = i>0 ? list[i-1].date : ''; return pres(p.id).find(r=>{ const d = r.createdAt.slice(0,10); return d <= a.date && d > prev; }) || null; }
const unreadOf = pid => R ? R.unread(pid) : [];
function markSeen(list){ if (!R || !list.length) return; R.markRead(list.map(r=>r.id)).catch(()=>{}); }

/** anamnese atual = a revisada + o que o paciente enviou depois (ainda não revisado) */
function anamOf(p){
  const base = p.plan?.anamnese || null;
  const cur = currentAnamnese(base, anams(p.id).map(r=>({ data:r.data, at:r.createdAt, r })));
  const newer = cur.newer.map(x=>x.r), data = cur.data;
  return { base, data, newer, pending: newer.at(-1) || null, changed: newer.length ? changedKeys(ANAMNESE_FORM, base?.data, data) : [], n: filledCount(ANAMNESE_FORM, data) };
}

/* ---------- pré-consulta ---------- */
const SHORT = { adesao:'Adesão ao plano', fome:'Fome', peso:'Peso em casa', sono_h:'Sono', sono_q:'Qualidade do sono', intestino:'Intestino', agua:'Água por dia', treino_x:'Treinos' };
const dots = v => `<span class="fa-dots" aria-hidden="true">${[1,2,3,4,5].map(n=>`<i class="${n<=Number(v)?'on':''}"></i>`).join('')}</span>`;
/** cartão da pré-consulta: pontos de atenção, números em blocos e os textos (dificuldades, dúvidas) em destaque */
function preCard(p, r, o={}){
  const d = r.data, older = pres(p.id).find(x=>x.createdAt < r.createdAt);
  const ref = listOf(p.id).filter(a=>a.date <= r.createdAt.slice(0,10)).at(-1); // avaliação anterior às respostas
  const tiles = [], quotes = [], alerts = preAlerts(d);
  for (const f of fieldsOf(PRE_FORM)){ const t = answerText(f, d); if (!t || f.k==='treino_d' && d.treino_x!=null) continue;
    if (f.t==='long' || f.t==='text'){ quotes.push(`<div class="fm-q"><small>${esc(f.l)}</small><p>${esc(t).replace(/\n/g,'<br>')}</p></div>`); continue; }
    let sub = '';
    if (f.k==='adesao' && older?.data.adesao!=null){ const df = Number(d.adesao) - Number(older.data.adesao); sub = df ? `<em class="${df>0?'up':'down'}">${df>0?'▲':'▼'} ${Math.abs(df)} desde a anterior</em>` : '<em>igual à anterior</em>'; }
    if (f.k==='peso' && ref && numOf(ref.weight)){ const df = Number(d.peso) - numOf(ref.weight); sub = `<em>${fmt(numOf(ref.weight))} kg na avaliação${Math.abs(df)>=0.1?` (${df>0?'+':'−'}${fmt(Math.abs(df))})`:''}</em>`; }
    if (f.k==='treino_x' && d.treino_d) sub = `<em>${esc(String(d.treino_d))}</em>`;
    tiles.push(`<div class="fm-k${f.t==='scale'&&Number(d[f.k])<=2?' warn':''}"><small>${esc(SHORT[f.k] || f.l)}</small>${f.t==='scale'?dots(d[f.k]):''}<b>${esc(f.t==='scale'?answerText(f,d).replace(/^(\d)\/5 · /,'$1/5 · '):t)}</b>${sub}</div>`); }
  return `<div class="card fm-pre${o.compact?' compact':''}">
    <div class="fm-pre-h"><span class="chip-ico">${icon('form','sm')}</span><span class="grow"><b>${o.title||'Respostas do paciente'}</b><small>Enviada pelo portal ${agoTxt(r.createdAt)} · ${dLong(r.createdAt)}</small></span>${!r.read?'<span class="tag dark">Nova</span>':''}</div>
    ${alerts.length?`<div class="fm-alerts" aria-label="Pontos de atenção">${alerts.map(a=>`<span>${icon('alert','sm')}${esc(a)}</span>`).join('')}</div>`:''}
    ${tiles.length?`<div class="fm-kpis">${tiles.join('')}</div>`:''}
    ${quotes.join('')}
    ${o.acts===false ? '' : `<div class="fm-acts"><button class="btn ghost sm" data-act="fmPdf" data-id="${p.id}" data-r="${r.id}">${ic('pdf','sm')} PDF</button>${o.again?`<button class="btn ghost sm" data-act="fmSend" data-id="${p.id}" data-k="pre_consulta">${p.phone?waSvg('ico sm'):ic('link','sm')} Pedir de novo</button>`:''}<button class="btn ghost sm fm-del" data-act="fmDel" data-id="${p.id}" data-r="${r.id}">${ic('trash','sm')} Excluir</button></div>`}
  </div>`;
}
/** ficha: pré-consulta da próxima consulta (no topo, antes dos resultados) */
function preSection(p){
  const r = currentPre(p); if (!r) return '';
  if (!r.read && !isClosed('pre')) setTimeout(()=>markSeen([r]), 1200); // aberta na ficha = vista (o aviso some)
  const n = pres(p.id).length, al = preAlerts(r.data), ad = r.data.adesao;
  const mini = miniRow(icon('form','sm'), [ad!=null?`Adesão ${ad}/5`:'Respondida', al.length?plural(al.length,'ponto de atenção','pontos de atenção'):'sem pontos de atenção'].join(' · '),
    `Enviada ${agoTxt(r.createdAt)} · ${plural(filledCount(PRE_FORM, r.data),'resposta','respostas')}`, !r.read?'<span class="tag dark">Nova</span>':al.length?`<span class="fold-warn">${icon('alert','sm')}${al.length}</span>`:'');
  return fold('pre', `Pré-consulta <span class="sec-note">para a próxima consulta</span>${n>1?`<button data-act="fmHist" data-id="${p.id}">anteriores (${n-1})</button>`:''}`, mini, preCard(p, r, {again:true}));
}
/** detalhe da avaliação e assistente: a pré-consulta respondida antes daquela consulta */
function preForAssessment(p, a){ const r = preFor(p, a); return r ? `<h2 class="sec">Pré-consulta desta consulta</h2>${preCard(p, r,{compact:true})}` : ''; }
function preForWizard(p){ const r = currentPre(p); return r ? `<div class="fm-wiz">${preCard(p, r,{compact:true, acts:false, title:`Pré-consulta de ${esc(firstName(p.name))}`})}</div>` : ''; }

/* ---------- anamnese: cartão na ficha ---------- */
const KEYS = [['doencas','heart','Doenças'],['medicamentos','pill','Medicamentos'],['suplementos','pill','Suplementos'],['alergias','alert','Alergias'],['aversoes','ban','Não come']];
const askBtn = (p, label) => R?.available() ? `<button class="btn ghost sm" data-act="fmSend" data-id="${p.id}" data-k="anamnese">${p.phone?waSvg('ico sm'):ic('link','sm')} ${label}</button>` : '';
function anamneseSection(p){
  const A = anamOf(p), fn = esc(firstName(p.name)), open = `data-act="go" data-to="anamnese" data-id="${p.id}"`;
  if (!A.n) return `<h2 class="sec">Anamnese</h2>
    <div class="card an-card an-empty">
      <div class="an-head">${ring(0,'0')}<span class="grow"><b>Anamnese em branco</b><small>Saúde, remédios, alergias, rotina, sono, intestino, treino, peso e exames</small></span></div>
      <div class="an-btns"><button class="btn dark sm" ${open}>${ic('edit','sm')} Preencher</button>${askBtn(p, `Pedir para ${fn}`)}</div>
      ${R?.available()?`<p class="an-tip">${fn} pode responder pelo portal. As respostas chegam aqui para você revisar.</p>`:''}
    </div>`;
  const pend = A.pending ? `<button class="an-pend" ${open}><span class="fm-new-dot"></span><span class="grow"><b>${fn} ${A.base?'atualizou':'preencheu'} ${plural(A.changed.length || filledCount(ANAMNESE_FORM, A.pending.data),'campo','campos')}</b><small>Pelo portal ${agoTxt(A.pending.createdAt)} · revise e salve</small></span><span class="an-pend-go">Revisar</span></button>` : '';
  const status = A.pending ? 'Aguardando sua revisão' : `Revisada em ${dShort(A.base.at)}${A.base.by==='paciente'?' · com respostas do paciente':''}`;
  const keys = KEYS.map(([k,ico,l])=>{ const t = answerText(FIELD[k], A.data);
    return `<div class="an-k${t?'':' none'}${A.changed.includes(k)?' chg':''}"><span class="an-k-ico">${icon(ico,'sm')}</span><span class="grow"><small>${l}</small><b>${t?esc(t):'não informado'}</b></span></div>`; }).join('');
  const secs = sectionsProgress(ANAMNESE_FORM, A.data).map(s=>`<span class="an-s${s.n?' on':''}" title="${esc(s.l)}: ${s.n} de ${s.total}">${s.n?ic('check','sm'):''}${esc(SEC_SHORT[s.k]||s.l)}</span>`).join('');
  const mini = miniRow(ring(A.n/ANAM_N*100, A.n), `${A.n} de ${ANAM_N} campos`, status, A.pending?'<span class="tag dark">Revisar</span>':'');
  return fold('anam', `Anamnese <button ${open}>abrir</button>`, mini, `
    <div class="card an-card${A.pending?' pending':''}">${pend}
      <div class="an-head" ${open} role="button">${ring(A.n/ANAM_N*100, A.n)}<span class="grow"><b>${A.n} de ${ANAM_N} campos</b><small>${status}</small></span>${ic('right','sm')}</div>
      <div class="an-keys">${keys}</div>
      <div class="an-secs">${secs}</div>
      ${A.n < ANAM_N*0.6 && !A.pending && R?.available() ? `<div class="an-btns">${askBtn(p, `Pedir para ${fn} completar`)}</div>` : ''}
    </div>`);
}

/* ---------- anamnese: editor completo (/pacientes/:id/anamnese) ---------- */
function startDraft(p){
  if (state.ak?.pid!==p.id){ const A = anamOf(p); state.ak = { pid:p.id, data: JSON.parse(JSON.stringify(A.data)), changed: A.changed, pending: !!A.pending, v:0 }; }
  return state.ak;
}
// versão do formulário: muda quando as respostas são trocadas de uma vez (campos são recriados com os valores novos)
const V = () => state.ak?.v || 0;
function fieldHtml(f, a, by){
  const v = a[f.k], val = v==null ? '' : String(v).replace('.',','), chg = state.ak?.changed?.includes(f.k);
  const lbl = `<span class="fm-l">${esc(f.l)}${chg?`<em class="fm-by">${esc(by)}</em>`:''}</span>`, cls = `fm-f${chg?' chg':''}`;
  if (f.t==='num') return `<label class="${cls}">${lbl}<span class="f-input fm-in"><input data-ak="${f.k}" data-key="ak-${f.k}-${V()}" inputmode="decimal" value="${esc(val)}" placeholder="${esc(f.ph||'')}" autocomplete="off"><em>${esc(f.u==='x'?'por semana':f.u||'')}</em></span></label>`;
  if (f.t==='time') return `<label class="${cls}">${lbl}<span class="f-input text fm-in"><input data-ak="${f.k}" data-key="ak-${f.k}-${V()}" type="time" value="${esc(val)}"></span></label>`;
  if (f.t==='text') return `<label class="${cls} wide">${lbl}<span class="f-input text fm-in"><input data-ak="${f.k}" data-key="ak-${f.k}-${V()}" value="${esc(val)}" placeholder="${esc(f.ph||'')}" autocomplete="off"></span></label>`;
  if (f.t==='long') return `<label class="${cls} wide">${lbl}<span class="f-input fm-in"><textarea data-ak="${f.k}" data-key="ak-${f.k}-${V()}" rows="3" placeholder="${esc(f.ph||'')}">${esc(val)}</textarea></span></label>`;
  if (f.t==='scale') return `<div class="${cls} wide">${lbl}<div class="fm-scale" role="radiogroup" data-key="sc-${f.k}-${val}">${[1,2,3,4,5].map(n=>`<button type="button" class="${Number(v)===n?'on':''}" data-act="akSet" data-k="${f.k}" data-v="${n}" role="radio" aria-checked="${Number(v)===n}">${n}</button>`).join('')}</div>${f.ends?`<div class="fm-ends"><small>${esc(f.ends[0])}</small><small>${esc(f.ends[1])}</small></div>`:''}</div>`;
  if (f.t==='choice') return `<div class="${cls} wide">${lbl}<div class="fm-chips" data-key="ch-${f.k}-${val}">${f.opts.map(([k,l])=>`<button type="button" class="chip${v===k?' on':''}" data-act="akSet" data-k="${f.k}" data-v="${k}" aria-pressed="${v===k}">${esc(l)}</button>`).join('')}</div></div>`;
  const arr = Array.isArray(v) ? v : [];
  return `<div class="${cls} wide">${lbl}<div class="fm-chips" data-key="cp-${f.k}-${arr.join('.')}">${f.opts.map(([k,l])=>`<button type="button" class="chip${arr.includes(k)?' on':''}" data-act="akTog" data-k="${f.k}" data-v="${k}" aria-pressed="${arr.includes(k)}">${arr.includes(k)?ic('check','sm'):''}${esc(l)}</button>`).join('')}</div>
    ${f.other?`<span class="f-input text fm-in fm-other"><input data-ak="${f.k}_o" data-key="ak-${f.k}_o-${V()}" value="${esc(String(a[f.k+'_o']||''))}" placeholder="Outras (escreva)" autocomplete="off"></span>`:''}</div>`;
}
function viewAnamnese(pid){
  const p = P(pid);
  if (!p) return `<header class="top"><button class="icon-btn" data-act="go" data-to="patients" aria-label="Pacientes">${ic('back')}</button><div class="title-block"><small>Pacientes</small><b>Anamnese</b></div></header><div class="card empty"><h3>Paciente não encontrado</h3></div>`;
  const d = startDraft(p), fn = firstName(p.name), A = anamOf(p), all = pres(p.id), tab = state.akTab==='pre' && all.length ? 'pre' : 'anam';
  const head = `<header class="top"><button class="icon-btn" data-act="akBack" data-id="${p.id}" aria-label="Voltar para a ficha">${ic('back')}</button>
    <div class="title-block"><small>${esc(p.name)}</small><b>${tab==='pre'?'Pré-consultas':'Anamnese'}</b></div><div class="grow"></div>
    ${R?.available() ? `<button class="btn ghost sm fm-ask" data-act="fmSend" data-id="${p.id}" data-k="${tab==='pre'?'pre_consulta':'anamnese'}">${p.phone?waSvg('ico sm'):ic('link','sm')}<span>${tab==='pre'?'Enviar pré-consulta':`Pedir para ${esc(fn)} preencher`}</span></button>` : ''}
    ${tab==='anam' ? `<button class="btn ghost sm fm-hd" data-act="akPdf" data-id="${p.id}">${ic('pdf','sm')}<span>PDF</span></button>${A.base||A.newer.length?`<button class="btn ghost sm fm-hd fm-del" data-act="akWipe" data-id="${p.id}">${ic('trash','sm')}<span>Apagar</span></button>`:''}<button class="icon-btn fm-more" data-act="akMore" data-id="${p.id}" aria-label="Mais opções" aria-haspopup="dialog">${icon('dots')}</button>` : ''}</header>
    ${all.length ? `<div class="seg fm-tabs"><button class="${tab==='anam'?'on':''}" data-act="akTab" data-t="anam">Anamnese</button><button class="${tab==='pre'?'on':''}" data-act="akTab" data-t="pre">Pré-consultas <small>${all.length}</small></button></div>` : ''}`;
  if (tab==='pre') return `${head}<div class="fm-hist">${all.map((r,i)=>{ const a = listOf(p.id).find(x=>x.date >= r.createdAt.slice(0,10));
      return `<div class="fm-hist-i"><span class="fm-hist-d">${i===0&&currentPre(p)===r?'Para a próxima consulta':a?`Antes da avaliação de ${fmtDate(a.date,{day:'numeric',month:'short'})}`:'Sem avaliação depois'}</span>${preCard(p, r, {compact:true, title:`Pré-consulta de ${dLong(r.createdAt)}`})}</div>`; }).join('')}</div>`;
  const n = filledCount(ANAMNESE_FORM, d.data);
  const secs = ANAMNESE_FORM.sections.map(s=>{ const k = s.fields.filter(f=>answerText(f, d.data)).length, chg = s.fields.some(f=>d.changed?.includes(f.k));
    return `<section class="card fm-sec${chg?' chg':''}" id="ak-${s.k}"><div class="fm-sh"><span class="chip-ico">${icon(s.icon,'sm')}</span><span class="grow"><b>${esc(s.l)}</b>${s.d?`<small class="fm-sd">${esc(s.d)}</small>`:''}</span><small class="fm-cnt ${k?'ok':''}">${k?`${k}/${s.fields.length}`:'em branco'}</small></div>
      <div class="fm-fields">${s.fields.map(f=>fieldHtml(f, d.data, fn)).join('')}</div></section>`; }).join('');
  const pend = d.pending && d.changed?.length ? `<div class="card fm-got new"><span class="chip-ico">${icon('form','sm')}</span>
      <span class="grow"><b>${esc(fn)} ${A.base?'atualizou':'preencheu'} ${plural(d.changed.length,'campo','campos')} pelo portal</b><small>${A.pending?dLong(A.pending.createdAt)+' · ':''}Os campos destacados vieram dele. Ajuste o que precisar e salve para revisar.</small></span>
      <div class="fm-got-btns"><button class="btn ghost sm" data-act="akReset" data-id="${p.id}">Desfazer mudanças</button><button class="btn ghost sm fm-del" data-act="akDiscard" data-id="${p.id}">${ic('trash','sm')} Excluir envio</button></div></div>` : '';
  return `${head}
  <div class="card fm-sum">${ring(n/ANAM_N*100, n)}<span class="grow"><b>${n} de ${ANAM_N} campos preenchidos</b><small>${A.base?.at?`Última revisão em ${dLong(A.base.at)}`:'Ainda não revisada'}${A.newer.length?` · ${plural(A.newer.length,'envio','envios')} do paciente desde então`:''}</small></span></div>
  ${pend}
  <nav class="fm-toc" aria-label="Seções">${ANAMNESE_FORM.sections.map(s=>{ const k = s.fields.filter(f=>answerText(f, d.data)).length; return `<a href="#ak-${s.k}" data-act="akJump" data-s="${s.k}" class="${k?'ok':''}${s.fields.some(f=>d.changed?.includes(f.k))?' chg':''}">${k?ic('check','sm'):''}${esc(SEC_SHORT[s.k]||s.l)}</a>`; }).join('')}</nav>
  <div class="fm-grid">${secs}</div>
  ${ctx.formBar(`data-act="akBack" data-id="${p.id}"`, `data-act="akSave" data-id="${p.id}"`, d.pending ? 'Salvar e marcar revisada' : 'Salvar anamnese', 'Cancelar', 'akBack')}`;
}

/* ---------- PDF (mesmo relatório do app) ---------- */
function pdf(p, def, answers, sentAt, status=''){
  exportPdf('form', { p, def, answers, sentAt, status, list: [], ctx: { nutri: { name: ctx.nutriName() } } });
}

/* ---------- envio do link do formulário ---------- */
const formLink = (code, k) => `${location.origin}/paciente?v=form&id=${k==='anamnese'?'anamnese':'pre'}#${code}`;
async function sendForm(pid, k){
  const p = P(pid); if (!p) return;
  const acc = ctx.access(pid);
  if (acc===undefined) return toast('Carregando o acesso ao portal… tente de novo em instantes');
  if (!acc || !acc.active) return sheet(`${firstName(p.name)} ainda não tem acesso ao portal`, acc ? 'O acesso está pausado. Reative na ficha para enviar o formulário.' : 'O formulário é respondido pelo portal. Crie o código de acesso na ficha e envie de novo.', [
    {label:'Abrir ficha do paciente', cls:'dark', fn:async()=>go('patient', p.id)}, {label:'Cancelar'}]);
  const link = formLink(acc.code, k), fn = firstName(p.name), filled = anamOf(p).n;
  const msg = k==='anamnese'
    ? (filled ? `Olá, ${fn}! Pode completar sua ficha de saúde pelo portal? Já está com ${filled} de ${ANAM_N} itens, leva poucos minutos:\n${link}` : `Olá, ${fn}! Para eu conhecer melhor sua saúde e rotina, preencha sua ficha de saúde pelo portal (uns 5 minutos):\n${link}`) + `\n\nSeu código: ${ctx.fmtCode(acc.code)}\n\n${ctx.nutriName()}`
    : `Olá, ${fn}! Antes da nossa consulta, responda a pré-consulta pelo portal (2 minutos). Assim aproveitamos melhor o tempo juntos:\n${link}\n\nSeu código: ${ctx.fmtCode(acc.code)}\n\n${ctx.nutriName()}`;
  const wa = ctx.waLink(p.phone);
  if (wa) { window.open(wa + '?text=' + encodeURIComponent(msg), '_blank', 'noopener'); return; }
  if (navigator.share && matchMedia('(pointer: coarse)').matches){ try { await navigator.share({text:msg}); return; } catch (e) { if (e?.name==='AbortError') return; } }
  await ctx.paCopyText(msg, 'Mensagem copiada ✓ Cole no WhatsApp do paciente');
}
/** linha para a mensagem de retorno: link da pré-consulta (quando o paciente tem acesso ativo) */
function preLinkLine(pid){ if (!R?.available()) return ''; const acc = ctx.access(pid); return acc && acc.active ? formLink(acc.code, 'pre') : ''; }

/* ---------- avisos ---------- */
const unreadPatients = () => R ? new Set(R.unread().filter(r=>P(r.patientId)).map(r=>r.patientId)).size : 0;
function ptTag(p){
  const u = unreadOf(p.id); if (!u.length) return currentPre(p) ? `<span class="tag">${icon('form','sm')}Pré-consulta respondida</span>` : '';
  const kinds = new Set(u.map(r=>r.kind));
  return `<span class="tag fm-tag">${icon('form','sm')}${kinds.has('pre_consulta') && kinds.has('anamnese') ? 'Respostas novas' : kinds.has('anamnese') ? 'Anamnese para revisar' : 'Pré-consulta nova'}</span>`;
}
const answeredPre = pid => { const p = P(pid); return !!(p && currentPre(p)); };

/* ---------- ações ---------- */
function onInput(el){
  if (!el.dataset.ak || !state.ak) return false;
  state.ak.data[el.dataset.ak] = el.value; return true;
}
const acts = {
  akSet: async b => { if (!state.ak) return; const k = b.dataset.k, v = b.dataset.v; const f = FIELD[k];
    const cur = state.ak.data[k]; state.ak.data[k] = f?.t==='scale' ? (Number(cur)===Number(v) ? '' : Number(v)) : (cur===v ? '' : v); render(); },
  akTog: async b => { if (!state.ak) return; const k = b.dataset.k, v = b.dataset.v; let arr = Array.isArray(state.ak.data[k]) ? [...state.ak.data[k]] : [];
    arr = arr.includes(v) ? arr.filter(x=>x!==v) : v==='nenhuma' ? ['nenhuma'] : [...arr.filter(x=>x!=='nenhuma'), v];
    state.ak.data[k] = arr; render(); },
  akJump: async b => { document.getElementById('ak-'+b.dataset.s)?.scrollIntoView({behavior:'smooth', block:'start'}); },
  akTab: async b => { state.akTab = b.dataset.t; render(); window.scrollTo({top:0}); },
  fmHist: async b => { state.akTab = 'pre'; go('anamnese', b.dataset.id); },
  akBack: async b => { state.ak = null; state.akTab = null; go('patient', b.dataset.id); },
  // volta à versão revisada (as mudanças do paciente saem do formulário; só valem se salvar)
  akReset: async b => { const p = P(b.dataset.id); if (!p || !state.ak) return;
    state.ak.data = JSON.parse(JSON.stringify(p.plan?.anamnese?.data || {})); state.ak.changed = []; state.ak.v = V() + 1; render();
    toast('Mudanças do paciente fora do formulário · salve para confirmar'); },
  akSave: async b => {
    const p = P(b.dataset.id); if (!p || !state.ak) return;
    const data = cleanAnswers(ANAMNESE_FORM, state.ak.data), fromPt = !!state.ak.changed?.length;
    planOf(p).anamnese = { data, at: new Date().toISOString(), by: fromPt ? 'paciente' : 'nutri' };
    const seen = anams(p.id).filter(r=>!r.read);
    state.ak = null; state.akTab = null; await ctx.save(); markSeen(seen);
    go('patient', p.id); toast(`Anamnese ${fromPt?'revisada':'salva'} ✓ ${filledCount(ANAMNESE_FORM, data)} de ${ANAM_N} campos`);
  },
  fmSend: async b => sendForm(b.dataset.id, b.dataset.k || 'pre_consulta'),
  fold: async b => toggleFold(b),
  // celular: as ações da anamnese num painel (no computador ficam no topo, ao lado do título)
  akMore: async b => { const p = P(b.dataset.id); if (!p) return; const A = anamOf(p), fn = firstName(p.name);
    sheet(`Anamnese de ${fn}`, `${A.n} de ${ANAM_N} campos preenchidos`, [
      {label:'Salvar em PDF', sub:'Ficha completa para imprimir ou enviar', icon:ic('pdf'), cls:'opt', fn:async()=>acts.akPdf(b)},
      R?.available() && {label:`Pedir para ${fn} preencher`, sub:p.phone?'Mensagem pronta no WhatsApp':'Copia a mensagem com o link', icon:p.phone?waSvg('ico'):ic('link'), cls:'opt', fn:async()=>sendForm(p.id,'anamnese')},
      (A.base || A.newer.length) && {label:'Apagar anamnese', sub:'Deixa todos os campos em branco', icon:ic('trash'), cls:'danger', fn:async()=>acts.akWipe(b)},
      {label:'Cancelar'}].filter(Boolean)); },
  fmPdf: async b => { const p = P(b.dataset.id), r = p && pres(p.id).find(x=>x.id===b.dataset.r); if (r) pdf(p, PRE_FORM, r.data, r.createdAt); },
  akPdf: async b => { const p = P(b.dataset.id); if (!p) return; const A = anamOf(p), d = state.ak?.pid===p.id ? cleanAnswers(ANAMNESE_FORM, state.ak.data) : A.data;
    pdf(p, ANAMNESE_FORM, d, null, A.pending ? 'Com respostas do paciente ainda não revisadas' : A.base?.at ? `Revisada em ${dLong(A.base.at)}` : ''); },
  fmDel: async b => { const p = P(b.dataset.id), r = p && pres(p.id).find(x=>x.id===b.dataset.r); if (!r) return;
    sheet('Excluir esta pré-consulta?', `As respostas que ${firstName(p.name)} enviou em ${dLong(r.createdAt)} serão apagadas. Não dá para desfazer.`, [
      {label:'Excluir pré-consulta', cls:'danger', fn:async()=>{ await R.remove([r.id]); render(); toast('Pré-consulta excluída'); }}, {label:'Cancelar'}]); },
  akDiscard: async b => { const p = P(b.dataset.id); if (!p) return; const A = anamOf(p); if (!A.newer.length) return;
    sheet(`Excluir o envio de ${firstName(p.name)}?`, 'A ficha volta para a última versão revisada por você. As respostas enviadas pelo portal serão apagadas.', [
      {label:'Excluir envio', cls:'danger', fn:async()=>{ await R.remove(A.newer.map(r=>r.id)); state.ak = null; render(); toast('Envio excluído'); }}, {label:'Cancelar'}]); },
  akWipe: async b => { const p = P(b.dataset.id); if (!p) return;
    sheet('Apagar a anamnese?', `Todos os campos de ${firstName(p.name)} ficam em branco, inclusive as fichas enviadas pelo portal. Não dá para desfazer.`, [
      {label:'Apagar anamnese', cls:'danger', fn:async()=>{ const ids = anams(p.id).map(r=>r.id); if (ids.length) await R.remove(ids); delete planOf(p).anamnese; state.ak = null; await ctx.save(); go('patient', p.id); toast('Anamnese apagada'); }}, {label:'Cancelar'}]); },
};

return { fold, isClosed, miniRow, preSection, preForAssessment, preForWizard, anamneseSection, viewAnamnese, preLinkLine, unreadPatients, ptTag, answeredPre, onInput, acts,
  has: () => !!R?.available(), forgetPatient: pid => R?.forgetPatient(pid),
  refresh: async () => { if (!R) return; try { if (await R.refresh()) render(); } catch (e) { console.warn('[respostas]', motivo(e,'')); } } };
}
