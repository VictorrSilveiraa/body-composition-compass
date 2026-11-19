import { esc, fmt, num, fmtDate, today, firstName, toDate } from './calculos.js';
import { GOAL_KINDS, GOAL_ORDER, goalSeries, goalStatus, energyOf, energyInputs, energyCfg, FORMULAS, ACTIVITY, ADJUSTS, adjustLabel, activityLabel, bmrBy } from './plano';
import { goalCardHtml, energyCardHtml, macroBarHtml, plIcon, kcal, factor, goalTitle, MACRO_COLOR, MACRO_LABEL } from './plano-view';
import { waSvg } from './wa-icon';
import { motivo } from './motivo';

/*
 * Acompanhamento no app do nutricionista:
 *  · METAS do paciente (na ficha e no painel), com progresso, prazo e ritmo
 *  · GASTO ENERGÉTICO: resumo na ficha + calculadora em /pacientes/:id/energia
 *  · RETORNOS da semana em /retornos: quem está atrasado ou com retorno em 7 dias, com WhatsApp e mensagem pronta
 * Recebe do app (original-runtime.js) o banco em memória, a navegação e os componentes visuais.
 */
export function careScreens(ctx){
const { options, state, ic, go, render, toast, sheet, listOf, pStatus, pAvatar, waLink, daysTo, ring } = ctx;
const db = () => ctx.db();
const P = id => db().profiles.find(p=>p.id===id);
const plural = (n, a, b) => `${n} ${n===1?a:b}`;
const dShort = iso => fmtDate(iso,{day:'numeric',month:'short'});
const isoOf = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const addMonths = (iso, m) => { const d = toDate(iso); d.setMonth(d.getMonth()+m); return isoOf(d); };
const addDays = (iso, n) => { const d = toDate(iso); d.setDate(d.getDate()+n); return isoOf(d); };

// salva o banco sem travar a tela (ajustes em sequência viram um salvamento só)
let saveTimer = 0;
function saveSoon(ms=450){ clearTimeout(saveTimer); saveTimer = setTimeout(()=>{ ctx.save().catch(e=>toast(motivo(e,'Não foi possível salvar. Tente novamente.'))); }, ms); }
const planOf = p => (p.plan ||= {});

/* =========================================================
   METAS
   ========================================================= */
const goalsOf = p => p.plan?.goals ?? [];
const statusOf = (p, g) => goalStatus(g, goalSeries(g.k, listOf(p.id), p));
// valor de hoje de cada medida (última avaliação que tem a medida)
function currentOf(p, k){ const s = goalSeries(k, listOf(p.id), p).at(-1); return s ? s : null; }

function goalEditor(p, ed){
  const used = goalsOf(p).filter(g=>g.id!==ed.id).map(g=>g.k);
  const cur = currentOf(p, ed.k), K = GOAL_KINDS[ed.k];
  const kinds = GOAL_ORDER.map(k=>{ const c = currentOf(p,k), off = !c || used.includes(k);
    return `<button type="button" class="gl-kind${k===ed.k?' on':''}" data-act="glKind" data-k="${k}" role="radio" aria-checked="${k===ed.k}"${off?' disabled':''}>${plIcon(k)}<span><b>${GOAL_KINDS[k].l}</b><small>${used.includes(k) ? 'já tem meta' : c ? `hoje ${fmt(c.v)} ${GOAL_KINDS[k].u}` : 'sem medida'}</small></span></button>`; }).join('');
  return `<div class="card white gl-edit" data-key="gl-edit-${ed.id||'new'}">
    <div class="gl-edit-h"><span class="chip-ico">${ic('target','sm')}</span><span class="grow"><b>${ed.id?'Editar meta':'Nova meta'}</b><small>${esc(firstName(p.name))} acompanha o progresso no portal</small></span></div>
    <div class="gl-kinds" role="radiogroup" aria-label="Medida da meta">${kinds}</div>
    <div class="fields two">
      <label class="field"><div class="f-top"><span class="f-label">Chegar a</span>${cur?`<span class="f-prev">hoje ${fmt(cur.v)} ${K.u}</span>`:''}</div>
        <div class="f-input"><input id="gl-to" data-gk="to" data-key="gl-to-${ed.k}" inputmode="decimal" value="${esc(ed.to)}" placeholder="${cur?fmt(cur.v):''}" autocomplete="off"><em>${K.u}</em></div></label>
      <div class="field"><div class="f-top"><span class="f-label">Prazo</span><span class="f-prev">opcional</span></div>
        <div class="f-input text"><input id="gl-by" data-gk="by" data-key="gl-by-${ed.by||'none'}" type="date" value="${esc(ed.by||'')}" min="${addDays(today(),1)}"></div>
        <div class="gl-quick" data-key="gl-q-${ed.by||'none'}">${[1,3,6,12].map(m=>{ const v = addMonths(today(),m); return `<button type="button" class="chip${ed.by===v?' on':''}" data-act="glBy" data-v="${v}">${m===12?'1 ano':`${m} ${m===1?'mês':'meses'}`}</button>`; }).join('')}${ed.by?'<button type="button" class="chip" data-act="glBy" data-v="">Sem prazo</button>':''}</div></div>
    </div>
    <p class="gl-preview" data-live="glPrev" data-key="gl-prev-${ed.k}-${esc(ed.to)}-${ed.by||''}">${previewText(p, ed)}</p>
    <div class="gl-edit-btns"><button type="button" class="btn ghost" data-act="glCancel">Cancelar</button><button type="button" class="btn dark" data-act="glSave" data-id="${p.id}">${ic('check')} Salvar meta</button></div>
  </div>`;
}
// prévia ao vivo: diferença, % e ritmo semanal (com alerta de ritmo acelerado)
function previewText(p, ed){
  const cur = currentOf(p, ed.k), to = num(ed.to), K = GOAL_KINDS[ed.k];
  if (!cur) return 'Registre uma avaliação com esta medida para definir a meta.';
  if (to==null) return `Hoje: <b>${fmt(cur.v)} ${K.u}</b>. Digite o valor que ${esc(firstName(p.name))} quer alcançar.`;
  const d = to - cur.v; if (Math.abs(d) < 0.05) return 'A meta é igual ao valor de hoje: escolha outro valor.';
  const unit = ed.k==='bf' ? ' pontos' : ' '+K.u;
  let t = `De <b>${fmt(cur.v)}</b> para <b>${fmt(to)} ${K.u}</b>: ${d>0?'+':'−'}${fmt(Math.abs(d))}${unit}${ed.k!=='bf'?` (${d>0?'+':'−'}${fmt(Math.abs(d)/cur.v*100,0)}%)`:''}`;
  const by = ed.by && ed.by > today() ? ed.by : null;
  if (by){ const wk = Math.max(1, daysTo(by))/7, rate = Math.abs(d)/wk;
    t += ` · ≈ ${fmt(rate, rate<1?2:1)}${unit} por semana`;
    if (ed.k==='weight' && d<0 && rate > cur.v*0.01) t += ' <span class="gl-warn">ritmo acelerado: mais de 1% do peso por semana</span>';
  }
  return t + '.';
}
function emptyGoals(p, has){
  return `<div class="card gl-empty">
    <span class="gl-empty-ico">${ic('target')}</span>
    <div class="grow"><b>Defina uma meta para ${esc(firstName(p.name))}</b><p>Peso, % de gordura, cintura ou massa magra, com prazo. O progresso aparece aqui e no portal, e motiva a cada avaliação.</p></div>
    ${has ? `<button type="button" class="btn dark sm" data-act="glNew" data-id="${p.id}">${ic('plus','sm')} Definir meta</button>` : '<span class="small muted">Disponível após a primeira avaliação</span>'}
  </div>`;
}
function goalsSection(p){
  const goals = goalsOf(p), ed = state.gl?.pid===p.id ? state.gl : null, has = !!listOf(p.id).length;
  const canAdd = has && goals.length < GOAL_ORDER.length && GOAL_ORDER.some(k=>currentOf(p,k) && !goals.some(g=>g.k===k));
  let body = goals.map(g => ed && ed.id===g.id ? goalEditor(p, ed) : goalCardHtml(statusOf(p,g), {mode:'nutri', pid:p.id, edit:true})).join('');
  if (ed && !ed.id) body += goalEditor(p, ed);
  if (!goals.length && !ed) body = emptyGoals(p, has);
  return `<h2 class="sec">Metas ${goals.length && canAdd && !ed ? `<button data-act="glNew" data-id="${p.id}">+ nova meta</button>` : ''}</h2><div class="gl-list">${body}</div>`;
}
// painel do paciente: as metas ativas como cartões largos
function homeGoals(p){ return goalsOf(p).map(g=>goalCardHtml(statusOf(p,g), {mode:'nutri', cls:'span2 span2-d'})).join(''); }
// etiqueta no cartão da lista de pacientes
function goalTag(p){
  const st = goalsOf(p).map(g=>statusOf(p,g)); if (!st.length) return '';
  const open = st.filter(s=>!s.done);
  if (!open.length) return `<span class="tag green">${ic('check','sm')}Meta alcançada</span>`;
  const s = open[0];
  return `<span class="tag gl-tag" style="--p:${s.pct.toFixed(3)}">${ic('target','sm')}Meta ${Math.round(s.pct*100)}%</span>`;
}
// janela de avaliação concluída: meta alcançada com esta avaliação?
function goalReached(p, a){
  for (const g of goalsOf(p)){ const s = statusOf(p,g); if (s.done && s.doneOn===a.date) return `Meta alcançada: ${goalTitle(g.k,g.to).replace(/^Chegar a /,'')}!`; }
  return null;
}

/* =========================================================
   GASTO ENERGÉTICO
   ========================================================= */
function energyOfP(p, a){ a = a || listOf(p.id).at(-1); if (!a) return null; return energyOf(p.plan?.energy, energyInputs(p, a)); }
function energySection(p){
  const last = listOf(p.id).at(-1); if (!last) return '';
  const e = energyOfP(p, last); if (!e) return '';
  return `<h2 class="sec">Gasto energético <button data-act="go" data-to="energy" data-id="${p.id}">${p.plan?.energy?'ajustar':'configurar'}</button></h2>
    ${energyCardHtml(e, {mode:'nutri', pid:p.id})}
    ${p.plan?.energy ? '' : `<p class="small muted en-hint">Cálculo padrão: atividade moderada e sem déficit. Toque para escolher a fórmula, o nível de atividade e os macros.</p>`}`;
}
const tdeeOf = (p, a) => energyOfP(p, a)?.tdee ?? null;

function viewEnergy(pid){
  const p = P(pid);
  if (!p) return `<header class="top"><button class="icon-btn" data-act="go" data-to="patients" aria-label="Pacientes">${ic('back')}</button><div class="title-block"><small>Pacientes</small><b>Gasto energético</b></div></header><div class="card empty"><h3>Paciente não encontrado</h3></div>`;
  const last = listOf(p.id).at(-1), fn = esc(firstName(p.name));
  const head = `<header class="top"><button class="icon-btn" data-act="go" data-to="patient" data-id="${p.id}" aria-label="Voltar para a ficha">${ic('back')}</button>
    <div class="title-block"><small>${esc(p.name)}</small><b>Gasto energético</b></div><div class="grow"></div>
    ${last ? `<button class="btn ghost sm en-copy" data-act="enCopy" data-id="${p.id}">${ic('clip','sm')}<span>Copiar resumo</span></button>` : ''}</header>`;
  if (!last) return `${head}<div class="card blue empty"><div class="e-ico">${ic('flame')}</div><h3>Falta a primeira avaliação</h3><p>O gasto energético usa peso, altura e composição corporal de ${fn}. Registre uma avaliação para calcular.</p>
    <button class="btn dark" style="margin:18px auto 0;display:inline-flex" data-act="newFor" data-id="${p.id}">${ic('plus','sm')} Nova avaliação</button></div>`;
  const cfg = energyCfg(p.plan?.energy), x = energyInputs(p, last), e = energyOf(cfg, x);
  if (!e) return `${head}<div class="card empty"><h3>Faltam dados</h3><p>Confira peso, altura e data de nascimento de ${fn}.</p></div>`;
  const autoK = x.lean ? 'katch' : 'mifflin';
  const opt = (on, act, attrs, title, sub, right, off=false) => `<button type="button" class="en-opt${on?' on':''}" data-act="${act}" ${attrs} role="radio" aria-checked="${on}"${off?' disabled':''}><span class="radio"></span><span class="grow"><b>${title}</b><small>${sub}</small></span>${right?`<em>${right}</em>`:''}</button>`;
  const formulas = FORMULAS.map(f=>{ const v = f.k==='auto' ? bmrBy(autoK, x) : bmrBy(f.k, x), off = v==null;
    return opt(cfg.formula===f.k, 'enF', `data-v="${f.k}"`, f.l + (f.k==='auto' ? ` <span class="tag">${FORMULAS.find(z=>z.k===autoK).l}</span>` : ''), off ? 'Precisa do % de gordura na avaliação' : esc(f.d), off ? '' : `${kcal(v)} <small>kcal</small>`, off); }).join('');
  const acts = ACTIVITY.map(a=>opt(Math.abs(cfg.activity-a.v)<1e-6, 'enA', `data-v="${a.v}"`, a.l, a.d, `×${factor(a.v)}`)).join('');
  const adj = ADJUSTS.map(v=>`<button type="button" class="en-adj-b${cfg.adjust===v?' on':''}${v<0?' cut':v>0?' gain':''}" data-act="enAdj" data-v="${v}" aria-pressed="${cfg.adjust===v}"><b>${v===0?'0':(v>0?'+':'−')+Math.abs(v)}</b><small>${v===0?'manter':'kcal'}</small></button>`).join('');
  const stepper = (k, label, sub, val, min, max) => { const m = e.macros[k];
    return `<div class="en-step"><span class="en-dot" style="background:${MACRO_COLOR[k]}"></span><span class="grow"><b>${label}</b><small>${sub}</small></span>
      <div class="en-num"><button type="button" data-act="enStep" data-k="${k}" data-d="-0.1" aria-label="Diminuir ${label.toLowerCase()}"${val<=min+1e-9?' disabled':''}>−</button><output>${fmt(val)}<small>g/kg</small></output><button type="button" data-act="enStep" data-k="${k}" data-d="0.1" aria-label="Aumentar ${label.toLowerCase()}"${val>=max-1e-9?' disabled':''}>+</button></div>
      <span class="en-g"><b>${Math.round(m.g)} g</b><small>${kcal(m.kcal)} kcal</small></span></div>`; };
  const r = e.macros, sexAge = `${p.sex==='F'?'Mulher':'Homem'}${x.age!=null?`, ${x.age} anos`:''}`;
  const base = `<div class="card en-base"><div class="card-head"><span class="chip-ico">${ic('clip','sm')}</span><span class="label"><b>Base do cálculo</b><br><span class="small muted">Avaliação de ${fmtDate(last.date,{day:'numeric',month:'long',year:'numeric'})}</span></span></div>
    <div class="en-facts"><span><small>Peso</small><b>${fmt(x.w)} kg</b></span><span><small>Altura</small><b>${x.h?fmt(x.h,0)+' cm':'—'}</b></span><span><small>Perfil</small><b>${sexAge}</b></span><span><small>Massa magra</small><b>${x.lean?fmt(x.lean)+' kg':'—'}</b></span></div></div>`;
  const result = `<div class="card en-hero">
      <span class="en-glow" aria-hidden="true"></span>
      <div class="en-hero-top"><div><small>Meta diária</small><b class="en-big" data-key="en-big-${Math.round(e.target)}">${kcal(e.target)}<span>kcal</span></b><span class="en-sub">${adjustLabel(e.adjust)}</span></div>
        <div class="ring-wrap en-ring">${ring(e.target, Math.max(e.tdee*1.25, e.target), 'var(--ink)')}<div class="center"><div class="inner"><b>${Math.round(e.target/e.tdee*100)}%</b><span>do gasto</span></div></div></div></div>
      <div class="en-flow">
        <div><small>Basal</small><b>${kcal(e.bmr)}</b><em>${esc(e.label)}</em></div><i aria-hidden="true">${ic('right','sm')}</i>
        <div><small>Gasto total</small><b>${kcal(e.tdee)}</b><em>×${factor(e.activity)} ${esc(activityLabel(e.activity).toLowerCase())}</em></div><i aria-hidden="true">${ic('right','sm')}</i>
        <div class="on"><small>Meta</small><b>${kcal(e.target)}</b><em>${e.adjust?`${e.adjust>0?'+':'−'}${Math.abs(e.adjust)} kcal`:'manutenção'}</em></div>
      </div>
      ${macroBarHtml(e, true)}
      <table class="en-table"><thead><tr><th></th><th>Gramas</th><th>g/kg</th><th>kcal</th></tr></thead><tbody>
        ${['p','f','c'].map(k=>`<tr><td><i style="background:${MACRO_COLOR[k]}"></i>${MACRO_LABEL[k]}</td><td>${Math.round(r[k].g)} g</td><td>${fmt(r[k].gkg)}</td><td>${kcal(r[k].kcal)}</td></tr>`).join('')}
      </tbody></table>
      ${e.warn.length ? `<ul class="en-warn">${e.warn.map(w=>`<li>${ic('target','sm')}<span>${esc(w)}</span></li>`).join('')}</ul>` : ''}
    </div>`;
  const live = `<div class="card yellow live en-live"><div class="lv"><small>Meta</small><b>${kcal(e.target)}<small>kcal</small></b></div><div class="lv"><small>Prot.</small><b>${Math.round(r.p.g)}<small>g</small></b></div><div class="lv"><small>Gord.</small><b>${Math.round(r.f.g)}<small>g</small></b></div><div class="lv"><small>Carb.</small><b>${Math.round(r.c.g)}<small>g</small></b></div></div>`;
  // celular: resultado em cima, depois a barrinha fixa (acompanha a rolagem) e os ajustes; computador: ajustes à esquerda, resultado fixo à direita
  return `${head}
  <div class="en-layout">
    <aside class="en-res">${result}</aside>
    ${live}
    <div class="en-ctl">
      ${base}
      <h2 class="sec">Metabolismo basal <span class="sec-note">fórmula</span></h2>
      <div class="en-opts" role="radiogroup" aria-label="Fórmula do metabolismo basal">${formulas}</div>
      <h2 class="sec">Nível de atividade</h2>
      <div class="en-opts" role="radiogroup" aria-label="Nível de atividade">${acts}</div>
      <h2 class="sec">Objetivo calórico <span class="sec-note">${adjustLabel(cfg.adjust)}</span></h2>
      <div class="en-adj" role="group" aria-label="Ajuste de calorias">${adj}</div>
      <h2 class="sec">Macronutrientes</h2>
      <div class="card en-macros">
        ${stepper('p','Proteínas','por kg de peso',cfg.protein,0.8,3.2)}
        ${stepper('f','Gorduras','por kg de peso',cfg.fat,0.4,1.6)}
        <div class="en-step rest"><span class="en-dot" style="background:${MACRO_COLOR.c}"></span><span class="grow"><b>Carboidratos</b><small>o que sobra da meta</small></span><output>${fmt(r.c.gkg)}<small>g/kg</small></output><span class="en-g"><b>${Math.round(r.c.g)} g</b><small>${kcal(r.c.kcal)} kcal</small></span></div>
      </div>
      <button class="toggle en-share" data-act="enShare" data-id="${p.id}"><span><b>Mostrar no portal de ${fn}</b><br><span class="small muted">A meta diária e os macros aparecem na tela inicial do portal</span></span><span class="switch ${cfg.share?'on':''}"></span></button>
      ${p.plan?.energy ? `<button type="button" class="btn ghost sm en-reset" data-act="enReset" data-id="${p.id}">Voltar ao cálculo padrão</button>` : ''}
    </div>
  </div>`;
}
function setEnergy(pid, patch){
  const p = P(pid); if (!p) return;
  const plan = planOf(p); plan.energy = { ...energyCfg(plan.energy), ...patch };
  render(); saveSoon();
}

/* =========================================================
   RETORNOS DA SEMANA
   ========================================================= */
const RET_KEY = 'avf.ret.' + options.userId;
const sentMap = () => { try { return JSON.parse(localStorage.getItem(RET_KEY)||'{}') || {}; } catch { return {}; } };
function markSent(pid, on=true){ const m = sentMap(); if (on) m[pid] = today(); else delete m[pid]; try { localStorage.setItem(RET_KEY, JSON.stringify(m)); } catch {} }
const DEF_MSG = {
  late: 'Olá, {nome}! Tudo bem? 😊\nJá faz {dias} desde a sua última avaliação. Que tal agendarmos o seu retorno para acompanhar a sua evolução?\n\n{nutri}',
  soon: 'Olá, {nome}! Tudo bem? 😊\nSeu retorno está chegando: {data}. Vamos combinar o melhor dia e horário para a sua avaliação?\n\n{nutri}',
};
function retRows(){
  return db().profiles.filter(p=>!p.archived).map(p=>({p, st:pStatus(p), last:listOf(p.id).at(-1)}))
    .filter(r=>r.st.k==='late'||r.st.k==='soon').sort((a,b)=>a.st.left-b.st.left || a.p.name.localeCompare(b.p.name,'pt-BR'));
}
// avisado neste ciclo: depois da última avaliação
const sentOf = r => { const s = sentMap()[r.p.id]; return s && r.last && s >= r.last.date ? s : null; };
function msgFor(r){
  const t = (ctx.nutri().returnMsg?.[r.st.k] || '').trim() || DEF_MSG[r.st.k];
  const since = r.last ? -daysTo(r.last.date) : 0;
  const when = r.st.left===0 ? 'hoje' : fmtDate(r.st.next,{weekday:'long',day:'numeric',month:'long'});
  return t.replaceAll('{nome}', firstName(r.p.name)).replaceAll('{dias}', plural(since,'dia','dias')).replaceAll('{data}', when).replaceAll('{nutri}', ctx.nutriName());
}
function pendingCount(){ return retRows().filter(r=>!sentOf(r)).length; }
function returnsBanner(){
  const rows = retRows(), pend = rows.filter(r=>!sentOf(r)); if (!pend.length) return '';
  const late = pend.filter(r=>r.st.k==='late').length, soon = pend.length - late;
  return `<button class="rt-banner" data-act="go" data-to="returns">
    <span class="rt-banner-ico">${waSvg('ico')}</span>
    <span class="grow"><b>${plural(pend.length,'retorno para avisar','retornos para avisar')}</b><small>${[late?plural(late,'atrasado','atrasados'):'', soon?`${soon} nos próximos 7 dias`:''].filter(Boolean).join(' · ')}</small></span>
    <span class="rt-banner-go">Avisar ${ic('right','sm')}</span></button>`;
}
function retRow(r){
  const sent = sentOf(r), phone = !!waLink(r.p.phone), late = r.st.k==='late';
  const when = late ? `Atrasado ${plural(-r.st.left,'dia','dias')}` : r.st.left===0 ? 'Retorno hoje' : `Em ${plural(r.st.left,'dia','dias')}`;
  const sub = `${r.last ? `Última avaliação ${fmtDate(r.last.date,{day:'numeric',month:'short'})}` : ''} · retorno ${fmtDate(r.st.next,{day:'numeric',month:'short'})}`;
  const btn = sent
    ? `<button type="button" class="rt-btn sent" data-act="rtSend" data-id="${r.p.id}" title="Enviar de novo">${ic('check','sm')}<span>${sent===today()?'Avisado hoje':'Avisado '+dShort(sent)}</span></button>`
    : phone ? `<button type="button" class="rt-btn wa" data-act="rtSend" data-id="${r.p.id}">${waSvg('ico sm')}<span>Avisar</span></button>`
    : `<button type="button" class="rt-btn" data-act="rtSend" data-id="${r.p.id}" title="Sem telefone: copia a mensagem">${ic('clip','sm')}<span>Copiar</span></button>`;
  return `<div class="rt-row ${late?'late':'soon'}${sent?' sent':''}" data-key="rt-${r.p.id}">
    <button type="button" class="rt-who" data-act="go" data-to="patient" data-id="${r.p.id}">${pAvatar(r.p)}<span class="rt-name"><b>${esc(r.p.name)}</b><small>${sub}</small></span></button>
    <span class="rt-when">${ic('clock','sm')}${when}</span>
    ${btn}
    ${!phone && !sent ? `<button type="button" class="rt-add" data-act="go" data-to="onboard" data-id="${r.p.id}">${ic('plus','sm')}Adicionar telefone</button>` : ''}
  </div>`;
}
function viewReturns(){
  const rows = retRows(), late = rows.filter(r=>r.st.k==='late'), soon = rows.filter(r=>r.st.k==='soon');
  // próximo da fila: primeiro quem tem WhatsApp (os sem telefone ficam por último: só dá para copiar a mensagem)
  const sent = rows.filter(r=>sentOf(r)).length, total = rows.length, next = rows.find(r=>!sentOf(r) && waLink(r.p.phone)) || rows.find(r=>!sentOf(r));
  const head = `<header class="top"><button class="icon-btn" data-act="go" data-to="patients" aria-label="Pacientes">${ic('back')}</button>
    <div class="title-block"><small>${esc(ctx.nutriName())}</small><b>Retornos</b></div></header>`;
  const msgs = ctx.nutri().returnMsg || {};
  const editor = `<details class="card rt-msgs"><summary><span class="chip-ico">${ic('chat','sm')}</span><span class="grow"><b>Mensagens prontas</b><small>Personalize o texto que vai no WhatsApp</small></span>${ic('chev','sm rt-chev')}</summary>
    <label class="field"><div class="f-top"><span class="f-label">Retorno atrasado</span></div><div class="f-input"><textarea data-rk="late" rows="5">${esc(msgs.late || DEF_MSG.late)}</textarea></div></label>
    <label class="field"><div class="f-top"><span class="f-label">Retorno nos próximos 7 dias</span></div><div class="f-input"><textarea data-rk="soon" rows="5">${esc(msgs.soon || DEF_MSG.soon)}</textarea></div></label>
    <p class="rt-vars"><span><code>{nome}</code> primeiro nome</span><span><code>{dias}</code> desde a última avaliação</span><span><code>{data}</code> do retorno</span><span><code>{nutri}</code> seu nome</span></p>
    ${msgs.late || msgs.soon ? `<button type="button" class="btn ghost sm" data-act="rtReset">Voltar aos textos originais</button>` : ''}
  </details>`;
  if (!total) return `${head}<div class="card green empty rt-empty"><div class="e-ico">${ic('check')}</div><h3>Nenhum retorno pendente</h3><p>Todos os pacientes ativos estão em dia. Quando um retorno atrasar ou estiver a 7 dias, ele aparece aqui com a mensagem pronta para o WhatsApp.</p>
    <button class="btn dark" style="margin:18px auto 0;display:inline-flex" data-act="go" data-to="patients">${ic('users','sm')} Ver pacientes</button></div>${editor}`;
  const pct = total ? sent/total : 0;
  const hero = `<div class="card rt-hero">
    <span class="dt-blob"></span><span class="dt-blob b2"></span>
    <div class="rt-hero-main">
      <span class="tag">${ic('cal','sm')}Retornos da semana</span>
      <h1>${next ? `${plural(total-sent,'paciente para avisar','pacientes para avisar')}` : 'Todos avisados!'}</h1>
      <p>${[late.length?plural(late.length,'retorno atrasado','retornos atrasados'):'', soon.length?`${soon.length} nos próximos 7 dias`:''].filter(Boolean).join(' · ')}. Um toque abre o WhatsApp com a mensagem pronta.</p>
      ${next ? `<button type="button" class="btn dark rt-next" data-act="rtSend" data-id="${next.p.id}">${waLink(next.p.phone)?waSvg('ico'):ic('clip')}<span>Avisar ${esc(firstName(next.p.name))}</span><small>${sent?'próximo da fila':'primeiro da fila'}</small></button>` : ''}
    </div>
    <div class="rt-hero-ring"><div class="ring-wrap">${ring(sent, Math.max(total,1), 'var(--green-ink)')}<div class="center"><div class="inner"><b>${sent}/${total}</b><span>avisados</span></div></div></div></div>
    <div class="rt-prog" aria-hidden="true"><i style="width:${(pct*100).toFixed(1)}%"></i></div>
  </div>`;
  return `${head}${hero}
    ${late.length ? `<h2 class="sec">Atrasados <span class="sec-note">${late.length}</span></h2><div class="rt-list">${late.map(retRow).join('')}</div>` : ''}
    ${soon.length ? `<h2 class="sec">Próximos 7 dias <span class="sec-note">${soon.length}</span></h2><div class="rt-list">${soon.map(retRow).join('')}</div>` : ''}
    <p class="small muted rt-note">${ic('lock','sm')}A marcação “avisado” fica neste aparelho e volta a zero depois da próxima avaliação do paciente.</p>
    ${editor}`;
}
async function sendReturn(pid){
  const r = retRows().find(x=>x.p.id===pid); if (!r) return;
  const msg = msgFor(r), wa = waLink(r.p.phone);
  markSent(pid); render();
  if (wa) { window.open(wa + '?text=' + encodeURIComponent(msg), '_blank', 'noopener'); return; }
  if (navigator.share && matchMedia('(pointer: coarse)').matches){ try { await navigator.share({text:msg}); return; } catch (e) { if (e?.name==='AbortError'){ markSent(pid,false); render(); return; } } }
  await ctx.paCopyText(msg, `Mensagem para ${firstName(r.p.name)} copiada ✓`);
}
// mensagens: salvas no perfil do nutricionista (sem tabela nova), com espera para não salvar a cada letra
let msgTimer = 0;
function onInput(el){
  if (el.dataset.rk){
    const n = ctx.nutri(), next = { ...n, returnMsg: { ...(n.returnMsg||{}), [el.dataset.rk]: el.value } };
    ctx.setNutri(next); clearTimeout(msgTimer);
    msgTimer = setTimeout(()=>{ Promise.resolve(options.saveNutri(next)).catch(e=>toast(motivo(e,'Não foi possível salvar a mensagem.'))); }, 800);
    return true;
  }
  if (el.dataset.gk && state.gl){
    state.gl[el.dataset.gk] = el.value;
    const pv = document.querySelector('[data-live="glPrev"]'); const p = P(state.gl.pid);
    if (pv && p) pv.innerHTML = previewText(p, state.gl);
    if (el.dataset.gk==='by') document.querySelectorAll('.gl-quick .chip').forEach(c=>c.classList.toggle('on', c.dataset.v===el.value));
    return true;
  }
  return false;
}

/* =========================================================
   AÇÕES
   ========================================================= */
const acts = {
  glNew: async b => { const p = P(b.dataset.id); if (!p) return; const used = goalsOf(p).map(g=>g.k);
    const k = GOAL_ORDER.find(k=>!used.includes(k) && currentOf(p,k)); if (!k) return toast('Todas as medidas já têm meta');
    state.gl = { pid:p.id, id:null, k, to:'', by:'' }; render();
    setTimeout(()=>document.getElementById('gl-to')?.focus({preventScroll:true}), 80);
    setTimeout(()=>document.querySelector('.gl-edit')?.scrollIntoView({behavior:'smooth', block:'center'}), 60); },
  glEdit: async b => { const p = P(b.dataset.id), g = p && goalsOf(p).find(x=>x.id===b.dataset.g); if (!g) return;
    state.gl = { pid:p.id, id:g.id, k:g.k, to:String(g.to).replace('.',','), by:g.by||'' }; render(); },
  glKind: async b => { if (!state.gl) return; state.gl.k = b.dataset.k; state.gl.to = ''; render(); setTimeout(()=>document.getElementById('gl-to')?.focus({preventScroll:true}), 60); },
  glBy: async b => { if (!state.gl) return; state.gl.by = b.dataset.v; render(); },
  glCancel: async () => { state.gl = null; render(); },
  glSave: async b => {
    const p = P(b.dataset.id), ed = state.gl; if (!p || !ed) return;
    ed.to = document.getElementById('gl-to')?.value ?? ed.to; ed.by = document.getElementById('gl-by')?.value ?? ed.by;
    const to = num(ed.to), cur = currentOf(p, ed.k);
    if (!cur) return toast('Sem medida registrada para esta meta');
    if (to==null || to<=0) return toast('Informe o valor da meta');
    if (ed.k==='bf' && (to<3 || to>60)) return toast('% de gordura entre 3 e 60');
    if (Math.abs(to-cur.v) < 0.05) return toast('A meta precisa ser diferente do valor de hoje');
    if (ed.by && ed.by <= today()) return toast('O prazo precisa ser uma data futura');
    const plan = planOf(p), goals = [...(plan.goals||[])], old = ed.id ? goals.find(g=>g.id===ed.id) : null;
    // editar só o valor/prazo mantém o ponto de partida; trocar a medida recomeça do valor de hoje
    const keep = old && old.k===ed.k;
    const g = { id: old?.id || crypto.randomUUID(), k: ed.k, to, from: keep ? old.from : cur.v, fromDate: keep ? old.fromDate : cur.date, by: ed.by || null };
    plan.goals = old ? goals.map(x=>x.id===old.id ? g : x) : [...goals, g];
    state.gl = null; await ctx.save(); render();
    const s = statusOf(p, g);
    toast(s.done ? 'Meta salva — e já alcançada ✓' : `Meta salva ✓ ${firstName(p.name)} vê o progresso no portal`);
  },
  glDel: async b => { const p = P(b.dataset.id), g = p && goalsOf(p).find(x=>x.id===b.dataset.g); if (!g) return;
    sheet('Remover meta?', `${goalTitle(g.k,g.to)}. O histórico de avaliações continua igual.`, [
      {label:'Remover meta', cls:'danger', icon:ic('trash','sm'), fn:async()=>{ planOf(p).goals = goalsOf(p).filter(x=>x.id!==g.id); await ctx.save(); render(); toast('Meta removida'); }},
      {label:'Cancelar'}]); },
  enF: async b => setEnergy(state.param, {formula:b.dataset.v}),
  enA: async b => setEnergy(state.param, {activity:Number(b.dataset.v)}),
  enAdj: async b => setEnergy(state.param, {adjust:Number(b.dataset.v)}),
  enStep: async b => { const p = P(state.param); if (!p) return; const c = energyCfg(p.plan?.energy), k = b.dataset.k==='p'?'protein':'fat';
    const lim = k==='protein' ? [0.8,3.2] : [0.4,1.6]; const v = Math.round(Math.min(lim[1], Math.max(lim[0], c[k] + Number(b.dataset.d)))*10)/10;
    setEnergy(p.id, {[k]:v}); },
  enShare: async b => { const p = P(b.dataset.id); if (!p) return; const on = !energyCfg(p.plan?.energy).share; setEnergy(p.id, {share:on});
    toast(on ? `${firstName(p.name)} passa a ver a meta diária e os macros no portal` : 'Energia oculta do portal'); },
  enReset: async b => { const p = P(b.dataset.id); if (!p) return; sheet('Voltar ao cálculo padrão?', 'Fórmula automática, atividade moderada, sem déficit e macros padrão. O portal deixa de mostrar a energia.', [
      {label:'Voltar ao padrão', cls:'dark', fn:async()=>{ planOf(p).energy = null; render(); saveSoon(0); toast('Cálculo padrão'); }}, {label:'Cancelar'}]); },
  enCopy: async b => { const p = P(b.dataset.id), a = p && listOf(p.id).at(-1); if (!a) return; const e = energyOfP(p, a); if (!e) return;
    const r = e.macros, f = v => fmt(v);
    const txt = [`Gasto energético · ${p.name} (avaliação de ${fmtDate(a.date,{day:'2-digit',month:'2-digit',year:'numeric'})})`,
      `Metabolismo basal (${e.label}): ${kcal(e.bmr)} kcal`,
      `Atividade: ${activityLabel(e.activity)} (×${factor(e.activity)}) → gasto total: ${kcal(e.tdee)} kcal`,
      `Meta: ${kcal(e.target)} kcal/dia (${adjustLabel(e.adjust).toLowerCase()})`,
      `Proteínas: ${Math.round(r.p.g)} g (${f(r.p.gkg)} g/kg) · Gorduras: ${Math.round(r.f.g)} g (${f(r.f.gkg)} g/kg) · Carboidratos: ${Math.round(r.c.g)} g (${f(r.c.gkg)} g/kg)`].join('\n');
    await ctx.paCopyText(txt, 'Resumo copiado ✓ Cole no WebDiet ou nas suas anotações'); },
  rtSend: async b => sendReturn(b.dataset.id),
  rtReset: async () => { const next = { ...ctx.nutri() }; delete next.returnMsg; ctx.setNutri(next); await options.saveNutri(next); render(); toast('Textos originais restaurados'); },
};

return { goalsSection, homeGoals, goalTag, goalReached, energySection, tdeeOf, viewEnergy, viewReturns, returnsBanner, pendingCount, onInput, acts };
}
