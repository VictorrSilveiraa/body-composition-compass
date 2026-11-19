import { esc, fmtDate, firstName } from './calculos.js';
import { ANAMNESE_FORM, PRE_FORM, answerText, answersHtml, cleanAnswers, fieldsOf, filledCount } from './forms';
import { waSvg } from './wa-icon';
import { motivo } from './motivo';

/*
 * PRÉ-CONSULTA e ANAMNESE no app do nutricionista:
 *  · ficha: cartão da pré-consulta (antes dos resultados) e resumo da anamnese (coluna lateral)
 *  · /pacientes/:id/anamnese: editor completo, com as respostas que o paciente enviou pelo portal
 *  · envio do link do formulário pelo WhatsApp; avisos de resposta nova (menu, lista, ficha)
 */
export function formScreens(ctx){
const { options, state, ic, go, render, toast, sheet, listOf } = ctx;
const R = options.responses || null; // loja de respostas (src/lib/respostas.ts)
const db = () => ctx.db();
const P = id => db().profiles.find(p=>p.id===id);
const dShort = iso => fmtDate(iso.slice(0,10),{day:'numeric',month:'short'});
const planOf = p => (p.plan ||= {});
const X = { // ícones que o app ainda não tinha
  pill:'<rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="m9.5 9.5 5 5"/>',
  alert:'<path d="M12 3 2.5 20h19z"/><path d="M12 10v4.5"/><circle cx="12" cy="17.3" r=".8" fill="currentColor"/>',
  moon:'<path d="M20 14.6A8.2 8.2 0 1 1 9.4 4a6.6 6.6 0 0 0 10.6 10.6z"/>',
  apple:'<path d="M12 6.528V3a1 1 0 0 1 1-1h0"/><path d="M18.237 21A15 15 0 0 0 22 11a6 6 0 0 0-10-4.472A6 6 0 0 0 2 11a15.1 15.1 0 0 0 3.763 10 3 3 0 0 0 3.648.648 5.5 5.5 0 0 1 5.178 0A3 3 0 0 0 18.237 21"/>',
  form:'<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 8h6M9 12h6M9 16h3"/>',
};
const icon = (n, cls='') => X[n] ? `<svg class="ico ${cls}" viewBox="0 0 24 24">${X[n]}</svg>` : ic(n, cls);

/* ---------- respostas ---------- */
const pres = pid => R ? R.ofPatient(pid, 'pre_consulta') : [];
const anams = pid => R ? R.ofPatient(pid, 'anamnese') : [];
// pré-consulta "da vez": respondida depois da última avaliação (é para a próxima consulta)
function currentPre(p){ const last = listOf(p.id).at(-1), r = pres(p.id)[0]; return r && (!last || r.createdAt.slice(0,10) >= last.date) ? r : null; }
// pré-consulta que antecedeu uma avaliação (entre a anterior e ela)
function preFor(p, a){ const list = listOf(p.id), i = list.findIndex(x=>x.id===a.id), prev = i>0 ? list[i-1].date : ''; return pres(p.id).find(r=>{ const d = r.createdAt.slice(0,10); return d <= a.date && d > prev; }) || null; }
const unreadOf = pid => R ? R.unread(pid) : [];
const newAnam = p => anams(p.id).find(r=>!r.read && (!p.plan?.anamnese?.at || r.createdAt > p.plan.anamnese.at)) || null;
function markSeen(list){ if (!R || !list.length) return; R.markRead(list.map(r=>r.id)).catch(()=>{}); }

const SHORT = { adesao:'Adesão ao plano', fome:'Fome', peso:'Peso em casa', sono_h:'Sono', sono_q:'Qualidade do sono', intestino:'Intestino', agua:'Água por dia', treino_x:'Treinos' };
/** cartão da pré-consulta: números em blocos e os textos (dificuldades, dúvidas) em destaque */
function preCard(r, o={}){
  const tiles = [], quotes = [];
  for (const f of fieldsOf(PRE_FORM)){ const t = answerText(f, r.data); if (!t) continue;
    if (f.t==='long' || f.t==='text') quotes.push(`<div class="fm-q"><small>${esc(f.l)}</small><p>${esc(t).replace(/\n/g,'<br>')}</p></div>`);
    else tiles.push(`<div class="fm-k"><small>${esc(SHORT[f.k] || f.l)}</small>${f.t==='scale'?`<span class="fa-dots" aria-hidden="true">${[1,2,3,4,5].map(n=>`<i class="${n<=Number(r.data[f.k])?'on':''}"></i>`).join('')}</span>`:''}<b>${esc(f.t==='scale'?`${r.data[f.k]}/5`:t)}</b></div>`); }
  return `<div class="card fm-pre${o.compact?' compact':''}">
    <div class="fm-pre-h"><span class="chip-ico">${icon('form','sm')}</span><span class="grow"><b>${o.title||'Pré-consulta respondida'}</b><small>Enviada pelo portal em ${fmtDate(r.createdAt.slice(0,10),{day:'numeric',month:'long'})}</small></span>${!r.read?'<span class="tag dark">Nova</span>':''}</div>
    ${tiles.length?`<div class="fm-kpis">${tiles.join('')}</div>`:''}
    ${quotes.join('')}
  </div>`;
}
/** ficha: pré-consulta da próxima consulta (no topo, antes dos resultados) */
function preSection(p){
  const r = currentPre(p); if (!r) return '';
  if (!r.read) setTimeout(()=>markSeen([r]), 1200); // aberta na ficha = vista (o aviso some)
  return `<h2 class="sec">Pré-consulta <span class="sec-note">para a próxima consulta</span></h2>${preCard(r)}`;
}
/** detalhe da avaliação e assistente: a pré-consulta respondida antes daquela consulta */
function preForAssessment(p, a){ const r = preFor(p, a); return r ? `<h2 class="sec">Pré-consulta desta consulta</h2>${preCard(r,{compact:true, title:'Respostas do paciente'})}` : ''; }
function preForWizard(p){ const r = currentPre(p); return r ? `<div class="fm-wiz">${preCard(r,{compact:true, title:`Pré-consulta de ${esc(firstName(p.name))}`})}</div>` : ''; }

/* ---------- anamnese: resumo na ficha ---------- */
const ANAM_N = fieldsOf(ANAMNESE_FORM).length;
function anamneseSection(p){
  const a = p.plan?.anamnese, fresh = newAnam(p), n = a ? filledCount(ANAMNESE_FORM, a.data) : 0, fn = esc(firstName(p.name));
  const banner = fresh ? `<button class="fm-new" data-act="go" data-to="anamnese" data-id="${p.id}"><span class="fm-new-dot"></span><span class="grow"><b>${fn} enviou a ficha de saúde</b><small>${dShort(fresh.createdAt)} · ${filledCount(ANAMNESE_FORM, fresh.data)} respostas · toque para revisar</small></span>${ic('right','sm')}</button>` : '';
  if (!a || !n) return `<h2 class="sec">Anamnese</h2>${banner}
    <div class="card fm-anam-empty"><p>Doenças, medicamentos, suplementos, alergias, rotina, sono, intestino, treino, histórico de peso e exames, em seções.</p>
      <div class="fm-anam-btns"><button class="btn dark sm" data-act="go" data-to="anamnese" data-id="${p.id}">${ic('edit','sm')} Preencher</button>
      ${R?.available() ? `<button class="btn ghost sm" data-act="fmSend" data-id="${p.id}" data-k="anamnese">${p.phone?waSvg('ico sm'):ic('link','sm')} Pedir para ${fn}</button>` : ''}</div></div>`;
  return `<h2 class="sec">Anamnese <button data-act="go" data-to="anamnese" data-id="${p.id}">ver tudo</button></h2>${banner}
    <div class="card fm-anam" data-act="go" data-to="anamnese" data-id="${p.id}">
      <div class="fa">${answersHtml(ANAMNESE_FORM, a.data, {only:['saude','remedios','alergias'], empty:'Saúde, medicamentos e alergias ainda em branco.'})}</div>
      <div class="fm-anam-foot"><span>${n} de ${ANAM_N} campos · atualizada em ${dShort(a.at)}${a.by==='paciente'?' (respostas do paciente)':''}</span>${ic('right','sm')}</div>
    </div>`;
}

/* ---------- anamnese: editor completo (/pacientes/:id/anamnese) ---------- */
function startDraft(p){ if (state.ak?.pid!==p.id) state.ak = { pid:p.id, data: JSON.parse(JSON.stringify(p.plan?.anamnese?.data || {})) }; return state.ak; }
// versão do formulário: muda quando as respostas são trocadas de uma vez (campos são recriados com os valores novos)
const V = () => state.ak?.v || 0;
function fieldHtml(f, a){
  const v = a[f.k], val = v==null ? '' : String(v).replace('.',','), lbl = `<span class="fm-l">${esc(f.l)}</span>`;
  if (f.t==='num') return `<label class="fm-f">${lbl}<span class="f-input fm-in"><input data-ak="${f.k}" data-key="ak-${f.k}-${V()}" inputmode="decimal" value="${esc(val)}" placeholder="${esc(f.ph||'')}" autocomplete="off"><em>${esc(f.u==='x'?'por semana':f.u||'')}</em></span></label>`;
  if (f.t==='time') return `<label class="fm-f">${lbl}<span class="f-input text fm-in"><input data-ak="${f.k}" data-key="ak-${f.k}-${V()}" type="time" value="${esc(val)}"></span></label>`;
  if (f.t==='text') return `<label class="fm-f wide">${lbl}<span class="f-input text fm-in"><input data-ak="${f.k}" data-key="ak-${f.k}-${V()}" value="${esc(val)}" placeholder="${esc(f.ph||'')}" autocomplete="off"></span></label>`;
  if (f.t==='long') return `<label class="fm-f wide">${lbl}<span class="f-input fm-in"><textarea data-ak="${f.k}" data-key="ak-${f.k}-${V()}" rows="3" placeholder="${esc(f.ph||'')}">${esc(val)}</textarea></span></label>`;
  if (f.t==='scale') return `<div class="fm-f wide">${lbl}<div class="fm-scale" role="radiogroup" data-key="sc-${f.k}-${val}">${[1,2,3,4,5].map(n=>`<button type="button" class="${Number(v)===n?'on':''}" data-act="akSet" data-k="${f.k}" data-v="${n}" role="radio" aria-checked="${Number(v)===n}">${n}</button>`).join('')}</div>${f.ends?`<div class="fm-ends"><small>${esc(f.ends[0])}</small><small>${esc(f.ends[1])}</small></div>`:''}</div>`;
  if (f.t==='choice') return `<div class="fm-f wide">${lbl}<div class="fm-chips" data-key="ch-${f.k}-${val}">${f.opts.map(([k,l])=>`<button type="button" class="chip${v===k?' on':''}" data-act="akSet" data-k="${f.k}" data-v="${k}" aria-pressed="${v===k}">${esc(l)}</button>`).join('')}</div></div>`;
  const arr = Array.isArray(v) ? v : [];
  return `<div class="fm-f wide">${lbl}<div class="fm-chips" data-key="cp-${f.k}-${arr.join('.')}">${f.opts.map(([k,l])=>`<button type="button" class="chip${arr.includes(k)?' on':''}" data-act="akTog" data-k="${f.k}" data-v="${k}" aria-pressed="${arr.includes(k)}">${arr.includes(k)?ic('check','sm'):''}${esc(l)}</button>`).join('')}</div>
    ${f.other?`<span class="f-input text fm-in fm-other"><input data-ak="${f.k}_o" data-key="ak-${f.k}_o-${V()}" value="${esc(String(a[f.k+'_o']||''))}" placeholder="Outras (escreva)" autocomplete="off"></span>`:''}</div>`;
}
function viewAnamnese(pid){
  const p = P(pid);
  if (!p) return `<header class="top"><button class="icon-btn" data-act="go" data-to="patients" aria-label="Pacientes">${ic('back')}</button><div class="title-block"><small>Pacientes</small><b>Anamnese</b></div></header><div class="card empty"><h3>Paciente não encontrado</h3></div>`;
  const d = startDraft(p), fn = esc(firstName(p.name)), fresh = newAnam(p), last = anams(p.id)[0];
  const secs = ANAMNESE_FORM.sections.map(s=>{ const n = s.fields.filter(f=>answerText(f, d.data)).length;
    return `<section class="card fm-sec" id="ak-${s.k}"><div class="fm-sh"><span class="chip-ico">${icon(s.icon,'sm')}</span><b>${esc(s.l)}</b><small class="${n?'ok':''}">${n?`${n}/${s.fields.length}`:'em branco'}</small></div>
      <div class="fm-fields">${s.fields.map(f=>fieldHtml(f, d.data)).join('')}</div></section>`; }).join('');
  const got = last ? `<div class="card fm-got${fresh?' new':''}">
      <span class="chip-ico">${icon('form','sm')}</span>
      <span class="grow"><b>${fresh?`${fn} enviou a ficha de saúde`:`Última ficha enviada por ${fn}`}</b><small>${fmtDate(last.createdAt.slice(0,10),{day:'numeric',month:'long',year:'numeric'})} · ${filledCount(ANAMNESE_FORM, last.data)} respostas${fresh?' · ainda não revisada':''}</small></span>
      <div class="fm-got-btns"><button class="btn ghost sm" data-act="akSeeResp" data-id="${p.id}">Ver respostas</button><button class="btn dark sm" data-act="akUse" data-id="${p.id}">${ic('check','sm')} Usar no formulário</button></div>
    </div>` : '';
  return `<header class="top"><button class="icon-btn" data-act="akBack" data-id="${p.id}" aria-label="Voltar para a ficha">${ic('back')}</button>
    <div class="title-block"><small>${esc(p.name)}</small><b>Anamnese</b></div><div class="grow"></div>
    ${R?.available() ? `<button class="btn ghost sm fm-ask" data-act="fmSend" data-id="${p.id}" data-k="anamnese">${p.phone?waSvg('ico sm'):ic('link','sm')}<span>Pedir para ${fn} preencher</span></button>` : ''}</header>
  ${got}
  <nav class="fm-toc" aria-label="Seções">${ANAMNESE_FORM.sections.map(s=>`<a href="#ak-${s.k}" data-act="akJump" data-s="${s.k}">${esc(s.l)}</a>`).join('')}</nav>
  <div class="fm-grid">${secs}</div>
  ${ctx.formBar(`data-act="akBack" data-id="${p.id}"`, `data-act="akSave" data-id="${p.id}"`, 'Salvar anamnese', 'Cancelar', 'akBack')}`;
}

/* ---------- envio do link do formulário ---------- */
const formLink = (code, k) => `${location.origin}/paciente?v=form&id=${k==='anamnese'?'anamnese':'pre'}#${code}`;
async function sendForm(pid, k){
  const p = P(pid); if (!p) return;
  const acc = ctx.access(pid);
  if (acc===undefined) return toast('Carregando o acesso ao portal… tente de novo em instantes');
  if (!acc || !acc.active) return sheet(`${firstName(p.name)} ainda não tem acesso ao portal`, acc ? 'O acesso está pausado. Reative na ficha para enviar o formulário.' : 'O formulário é respondido pelo portal. Crie o código de acesso na ficha e envie de novo.', [
    {label:'Abrir ficha do paciente', cls:'dark', fn:async()=>go('patient', p.id)}, {label:'Cancelar'}]);
  const link = formLink(acc.code, k), fn = firstName(p.name);
  const msg = k==='anamnese'
    ? `Olá, ${fn}! Para eu conhecer melhor sua saúde e rotina, preencha sua ficha de saúde pelo portal (uns 5 minutos):\n${link}\n\nSeu código: ${ctx.fmtCode(acc.code)}\n\n${ctx.nutriName()}`
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
  return `<span class="tag fm-tag">${icon('form','sm')}${kinds.has('pre_consulta') && kinds.has('anamnese') ? 'Respostas novas' : kinds.has('anamnese') ? 'Ficha de saúde nova' : 'Pré-consulta nova'}</span>`;
}
const answeredPre = pid => { const p = P(pid); return !!(p && currentPre(p)); };

/* ---------- ações ---------- */
function onInput(el){
  if (!el.dataset.ak || !state.ak) return false;
  state.ak.data[el.dataset.ak] = el.value; return true;
}
const acts = {
  akSet: async b => { if (!state.ak) return; const k = b.dataset.k, v = b.dataset.v; const f = fieldsOf(ANAMNESE_FORM).find(x=>x.k===k);
    const cur = state.ak.data[k]; state.ak.data[k] = f?.t==='scale' ? (Number(cur)===Number(v) ? '' : Number(v)) : (cur===v ? '' : v); render(); },
  akTog: async b => { if (!state.ak) return; const k = b.dataset.k, v = b.dataset.v; let arr = Array.isArray(state.ak.data[k]) ? [...state.ak.data[k]] : [];
    arr = arr.includes(v) ? arr.filter(x=>x!==v) : v==='nenhuma' ? ['nenhuma'] : [...arr.filter(x=>x!=='nenhuma'), v];
    state.ak.data[k] = arr; render(); },
  akJump: async b => { document.getElementById('ak-'+b.dataset.s)?.scrollIntoView({behavior:'smooth', block:'start'}); },
  akBack: async b => { state.ak = null; go('patient', b.dataset.id); },
  akSave: async b => {
    const p = P(b.dataset.id); if (!p || !state.ak) return;
    const data = cleanAnswers(ANAMNESE_FORM, state.ak.data);
    planOf(p).anamnese = { data, at: new Date().toISOString(), by: state.ak.by || 'nutri' };
    const seen = anams(p.id).filter(r=>!r.read);
    state.ak = null; await ctx.save(); markSeen(seen);
    go('patient', p.id); toast(`Anamnese salva ✓ ${filledCount(ANAMNESE_FORM, data)} de ${ANAM_N} campos`);
  },
  // traz as respostas do paciente para o formulário (sem apagar o que ele deixou em branco); o nutricionista revisa e salva
  akUse: async b => { const p = P(b.dataset.id), r = anams(b.dataset.id)[0]; if (!p || !r || !state.ak) return;
    const n = Object.keys(r.data).length; state.ak.data = { ...state.ak.data, ...r.data }; state.ak.by = 'paciente'; state.ak.v = (state.ak.v||0) + 1; render();
    toast(`${n} respostas de ${firstName(p.name)} no formulário · revise e salve`); },
  akSeeResp: async b => { const p = P(b.dataset.id), r = anams(b.dataset.id)[0]; if (!p || !r) return;
    const txt = ANAMNESE_FORM.sections.map(s=>{ const rows = s.fields.map(f=>{ const t = answerText(f, r.data); return t ? `${f.l}: ${t}` : ''; }).filter(Boolean); return rows.length ? `${s.l.toUpperCase()}\n${rows.join('\n')}` : ''; }).filter(Boolean).join('\n\n');
    sheet(`Ficha enviada por ${firstName(p.name)}`, txt || 'Nenhuma resposta.', [{label:'Usar no formulário', cls:'dark', fn:async()=>acts.akUse(b)}, {label:'Fechar'}]); },
  fmSend: async b => sendForm(b.dataset.id, b.dataset.k || 'pre_consulta'),
};

return { preSection, preForAssessment, preForWizard, anamneseSection, viewAnamnese, preLinkLine, unreadPatients, ptTag, answeredPre, onInput, acts,
  has: () => !!R?.available(), forgetPatient: pid => R?.forgetPatient(pid),
  refresh: async () => { if (!R) return; try { if (await R.refresh()) render(); } catch (e) { console.warn('[respostas]', motivo(e,'')); } } };
}
