import { esc, fmt, num, fmtDate, today, firstName, toDate } from './calculos.js';
import { GOAL_KINDS, GOAL_ORDER, GOAL_METRIC, goalSeries, goalStatus, goalsStatus, energyOf, energyInputs, energyCfg, FORMULAS, ACTIVITY, ADJUSTS, adjustLabel, activityLabel, bmrBy } from './plano';
import { goalsBoardHtml, energyCardHtml, macroBarHtml, plIcon, kcal, factor, goalTitle, MACRO_COLOR, MACRO_LABEL } from './plano-view';
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
   Um conjunto de metas por paciente (até uma por medida), com o ponto de partida na
   avaliação em que foram definidas. São revistas a cada consulta; as que saem ou mudam
   vão para o histórico (conquistas). Editor único: as 4 medidas de uma vez.
   ========================================================= */
const goalsOf = p => p.plan?.goals ?? [];
const statusOf = (p, g) => goalStatus(g, goalSeries(g.k, listOf(p.id), p));
const statusAll = (p, upTo) => goalsStatus(goalsOf(p), listOf(p.id), p, upTo);
// valor mais recente de cada medida (última avaliação que tem a medida)
function currentOf(p, k){ const s = goalSeries(k, listOf(p.id), p).at(-1); return s ? s : null; }
// abre o editor já preenchido com as metas atuais
function openEditor(p){
  const vals = {}; for (const g of goalsOf(p)) vals[g.k] = String(g.to).replace('.',',');
  const bys = [...new Set(goalsOf(p).map(g=>g.by||''))];
  state.gl = { pid:p.id, vals, by: bys.length===1 ? bys[0] : (bys.find(Boolean)||'') };
}

// prévia de uma linha do editor: diferença, % e ritmo semanal (com alerta de ritmo acelerado)
function rowPreview(p, k, val, by){
  const cur = currentOf(p, k), to = num(val), K = GOAL_KINDS[k];
  if (!cur) return 'Sem esta medida nas avaliações';
  if (to==null) return `Hoje ${fmt(cur.v)} ${K.u} · deixe em branco para não ter meta`;
  const d = to - cur.v; if (Math.abs(d) < 0.05) return '<span class="gl-warn">Igual ao valor de hoje</span>';
  if (k==='bf' && (to<3 || to>60)) return '<span class="gl-warn">Use um valor entre 3% e 60%</span>';
  const unit = k==='bf' ? ' pontos' : ' '+K.u;
  let t = `<b>${d>0?'+':'−'}${fmt(Math.abs(d))}${unit}</b>${k!=='bf'?(pc=>` (${d>0?'+':'−'}${fmt(pc, pc<1?1:0)}%)`)(Math.abs(d)/cur.v*100):''}`;
  const b = by && by > today() ? by : null;
  if (b){ const wk = Math.max(1, daysTo(b))/7, rate = Math.abs(d)/wk;
    t += ` · ≈ ${fmt(rate, rate<1?2:1)}${unit}/semana`;
    if (k==='weight' && d<0 && rate > cur.v*0.01) t += ' <span class="gl-warn">ritmo acelerado (mais de 1% do peso por semana)</span>';
  }
  return t;
}
function goalEditor(p, ed){
  const fn = esc(firstName(p.name)), had = goalsOf(p).length;
  const rows = GOAL_ORDER.map(k=>{ const c = currentOf(p,k), K = GOAL_KINDS[k], v = ed.vals[k] ?? '';
    return `<label class="gl-erow t-${K.tone}${c?'':' off'}">
      <span class="gl-r-ico">${plIcon(k)}</span>
      <span class="gl-e-lbl"><b>${K.l}</b><small>${c ? `hoje ${fmt(c.v)} ${K.u}` : 'sem medida'}</small></span>
      <span class="f-input gl-e-in"><input data-gk="v.${k}" data-key="gl-in-${k}-${esc(v)}" inputmode="decimal" value="${esc(v)}" placeholder="${c?'meta':'—'}" autocomplete="off" aria-label="Meta de ${K.l.toLowerCase()} em ${K.u}"${c?'':' disabled'}><em>${K.u}</em></span>
      <span class="gl-e-diff" data-live="glDiff-${k}" data-key="gl-d-${k}-${esc(v)}-${ed.by||''}">${rowPreview(p, k, v, ed.by)}</span>
    </label>`; }).join('');
  return `<div class="card white gl-edit" data-key="gl-edit-${p.id}">
    <div class="gl-edit-h"><span class="chip-ico">${ic('target','sm')}</span><span class="grow"><b>${had?'Editar metas':'Definir metas'} de ${fn}</b><small>Preencha só as medidas que fazem sentido. Em branco = sem meta.</small></span></div>
    <div class="gl-erows">${rows}</div>
    <div class="field gl-by"><div class="f-top"><span class="f-label">Prazo</span><span class="f-prev">opcional · vale para todas</span></div>
      <div class="gl-by-row"><div class="f-input text"><input data-gk="by" data-key="gl-by-${ed.by||'none'}" type="date" value="${esc(ed.by||'')}" min="${addDays(today(),1)}" aria-label="Prazo das metas"></div>
      <div class="gl-quick" data-key="gl-q-${ed.by||'none'}">${[1,3,6,12].map(m=>{ const v = addMonths(today(),m); return `<button type="button" class="chip${ed.by===v?' on':''}" data-act="glBy" data-v="${v}">${m===12?'1 ano':`${m} ${m===1?'mês':'meses'}`}</button>`; }).join('')}${ed.by?'<button type="button" class="chip" data-act="glBy" data-v="">Sem prazo</button>':''}</div></div></div>
    <p class="gl-note">${ic('lock','sm')}<span>O ponto de partida é a avaliação mais recente. Mudar o valor de uma meta recomeça a contagem a partir de hoje; a anterior fica no histórico.</span></p>
    <div class="gl-edit-btns">${had?`<button type="button" class="btn ghost gl-clear" data-act="glClear" data-id="${p.id}">${ic('trash','sm')}<span>Encerrar todas</span></button>`:''}<span class="grow"></span><button type="button" class="btn ghost" data-act="glCancel">Cancelar</button><button type="button" class="btn dark" data-act="glSave" data-id="${p.id}">${ic('check')} Salvar metas</button></div>
  </div>`;
}
function emptyGoals(p, has){
  return `<div class="card gl-empty">
    <span class="gl-empty-ico">${ic('target')}</span>
    <div class="grow"><b>Defina as metas de ${esc(firstName(p.name))}</b><p>Peso, % de gordura, cintura e massa magra, com prazo. O progresso aparece aqui, em cada avaliação, nos gráficos e no portal.</p></div>
    ${has ? `<button type="button" class="btn dark sm" data-act="glNew" data-id="${p.id}">${ic('plus','sm')} Definir metas</button>` : '<span class="small muted">Disponível após a primeira avaliação</span>'}
  </div>`;
}
// histórico completo (só o nutricionista vê os detalhes; o paciente vê as conquistas no quadro)
function historyHtml(p){
  const h = (p.plan?.history ?? []).slice().reverse(); if (!h.length) return '';
  return `<details class="gl-hist"><summary>${ic('clock','sm')}<span>Metas anteriores</span><em>${h.length}</em>${ic('chev','sm gl-chev')}</summary>
    <ul>${h.map(x=>{ const K = GOAL_KINDS[x.k]; return `<li class="${x.done?'ok':''}"><span class="gl-hi">${x.done?ic('check','sm'):plIcon(x.k,'sm')}</span><span class="grow"><b>${K.l}: ${fmt(x.from)} → ${fmt(x.to)} ${K.u}</b><small>${fmtDate(x.fromDate,{day:'numeric',month:'short',year:'2-digit'})} – ${fmtDate(x.endedAt,{day:'numeric',month:'short',year:'2-digit'})} · ${x.done?'alcançada':x.last!=null?`chegou a ${fmt(x.last)} ${K.u}`:'encerrada'}</small></span></li>`; }).join('')}</ul></details>`;
}
function goalsSection(p){
  const goals = goalsOf(p), ed = state.gl?.pid===p.id ? state.gl : null, has = !!listOf(p.id).length;
  // sem avaliação e sem histórico: a seção não aparece (o convite só faz sentido quando dá para definir metas)
  if (!has && !goals.length && !p.plan?.history?.length) return '';
  const body = ed ? goalEditor(p, ed)
    : goals.length ? goalsBoardHtml(statusAll(p), {mode:'nutri', title:'Progresso das metas', pid:p.id, edit:true, history:p.plan?.history})
    : emptyGoals(p, has);
  return `<h2 class="sec">Metas</h2>${body}${ed ? '' : historyHtml(p)}`;
}
// painel do paciente: o quadro de metas na largura toda
function homeGoals(p){ return goalsOf(p).length ? goalsBoardHtml(statusAll(p), {mode:'nutri', title:`Metas de ${firstName(p.name)}`, pid:p.id, edit:true, history:p.plan?.history, cls:'span2 span4-d'}) : ''; }
// detalhe da avaliação: como as metas estavam naquela data
function detailGoals(p, a){
  const st = statusAll(p, a.date); if (!st.length) return '';
  return `<h2 class="sec">Metas nesta avaliação <span class="sec-note">${fmtDate(a.date,{day:'numeric',month:'short',year:'numeric'})}</span></h2>${goalsBoardHtml(st, {mode:'nutri', title:'Progresso até esta data', asOf:a.date})}`;
}
// etiqueta no cartão da lista de pacientes: progresso médio das metas
function goalTag(p){
  const st = statusAll(p); if (!st.length) return '';
  const open = st.filter(s=>!s.done);
  if (!open.length) return `<span class="tag green">${ic('check','sm')}${st.length>1?'Metas alcançadas':'Meta alcançada'}</span>`;
  const avg = st.reduce((t,s)=>t+(s.done?1:s.pct),0)/st.length;
  return `<span class="tag gl-tag" style="--p:${avg.toFixed(3)}">${ic('target','sm')}${st.length>1?'Metas':'Meta'} ${Math.round(avg*100)}%</span>`;
}
// janela de avaliação concluída: metas alcançadas com esta avaliação
function goalReached(p, a){
  const hit = statusAll(p).filter(s=>s.done && s.doneOn===a.date);
  if (!hit.length) return null;
  const g = hit[0].goal, K = GOAL_KINDS[g.k];
  return hit.length===1 ? `Meta de ${K.short} alcançada: ${fmt(g.to)} ${K.u}!` : `${hit.length} metas alcançadas nesta avaliação!`;
}
// frase de progresso das metas para a janela de avaliação concluída
function goalsLine(p, a){
  const now = statusAll(p), before = goalsStatus(goalsOf(p), listOf(p.id).filter(x=>x.id!==a.id), p);
  if (!now.length) return '';
  return 'Metas: ' + now.map(s=>{ const b = before.find(x=>x.goal.id===s.goal.id), pc = Math.round((s.done?1:s.pct)*100), pb = b ? Math.round((b.done?1:b.pct)*100) : null;
    return `${GOAL_KINDS[s.goal.k].short} ${s.done?'✓':pc+'%'}${pb!=null && pb!==pc && !s.done ? ` (${pc>pb?'+':'−'}${Math.abs(pc-pb)})` : ''}`; }).join(' · ') + '.';
}
// linha da meta no gráfico de evolução (medida do gráfico → meta correspondente)
function goalFor(p, metric){ const k = GOAL_METRIC[metric]; const g = k && goalsOf(p).find(x=>x.k===k); return g ? g.to : null; }
// abre o editor na ficha do paciente (de qualquer lugar: painel, janela de avaliação concluída…)
function openGoals(pid){
  const p = P(pid); if (!p) return;
  if (!listOf(p.id).length) return toast('Registre a primeira avaliação para definir metas');
  const here = state.route==='patient' && state.param===p.id;
  if (!here) go('patient', p.id);
  openEditor(p); render();
  setTimeout(()=>{ const e = document.querySelector('.gl-edit'); e?.scrollIntoView({behavior:'smooth', block:'start'}); e?.querySelector('input:not(:disabled)')?.focus({preventScroll:true}); }, here ? 80 : 450);
}
// lê os campos do editor (a digitação já vai para o estado; isto garante o valor final)
function syncEditor(){
  if (!state.gl) return;
  document.querySelectorAll('.gl-edit input[data-gk]').forEach(el=>{ if (el.dataset.gk==='by') state.gl.by = el.value; else state.gl.vals[el.dataset.gk.slice(2)] = el.value; });
}
// encerra metas: vão para o histórico com o resultado
function retire(p, goals){
  const plan = planOf(p); plan.history ||= [];
  for (const g of goals){ const s = statusOf(p, g); plan.history.push({ ...g, endedAt: today(), done: s.done, last: s.curDate ? s.cur : null }); }
  plan.history = plan.history.slice(-30);
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
  // link da pré-consulta: no lugar de {link}, ou numa linha antes da assinatura (só se o paciente tem acesso ao portal e ainda não respondeu)
  const link = ctx.preLink?.(r.p.id) && !ctx.answeredPre?.(r.p.id) ? ctx.preLink(r.p.id) : '';
  let m = t.replaceAll('{nome}', firstName(r.p.name)).replaceAll('{dias}', plural(since,'dia','dias')).replaceAll('{data}', when);
  if (m.includes('{link}')) m = m.replaceAll('{link}', link);
  else if (link) m = m.includes('{nutri}') ? m.replace('{nutri}', `Antes da consulta, responda a pré-consulta (2 minutos):\n${link}\n\n{nutri}`) : `${m}\n\nAntes da consulta, responda a pré-consulta (2 minutos):\n${link}`;
  return m.replaceAll('{nutri}', ctx.nutriName());
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
    <span class="rt-when">${ic('clock','sm')}${when}${ctx.answeredPre?.(r.p.id) ? ' · respondeu a pré-consulta' : ''}</span>
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
    <p class="rt-vars"><span><code>{nome}</code> primeiro nome</span><span><code>{dias}</code> desde a última avaliação</span><span><code>{data}</code> do retorno</span><span><code>{nutri}</code> seu nome</span><span><code>{link}</code> link da pré-consulta (entra sozinho se você não usar)</span></p>
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
    const p = P(state.gl.pid); if (!p) return true;
    // digitação: guarda no estado e atualiza só as prévias (sem redesenhar a tela, para não perder o foco)
    if (el.dataset.gk==='by') state.gl.by = el.value; else state.gl.vals[el.dataset.gk.slice(2)] = el.value;
    for (const k of GOAL_ORDER){ const d = document.querySelector(`[data-live="glDiff-${k}"]`); if (d) d.innerHTML = rowPreview(p, k, state.gl.vals[k] ?? '', state.gl.by); }
    if (el.dataset.gk==='by') document.querySelectorAll('.gl-quick .chip').forEach(c=>c.classList.toggle('on', c.dataset.v===el.value));
    return true;
  }
  return false;
}

/* =========================================================
   AÇÕES
   ========================================================= */
const acts = {
  glNew: async b => { const p = P(b.dataset.id); if (!p) return; openGoals(p.id); },
  glEdit: async b => { const p = P(b.dataset.id); if (!p) return; openGoals(p.id); },
  glBy: async b => { if (!state.gl) return; syncEditor(); state.gl.by = b.dataset.v; render(); },
  glCancel: async () => { state.gl = null; render(); },
  // salva as 4 medidas de uma vez: preenchida = meta; em branco = sem meta (a que existia vai para o histórico)
  glSave: async b => {
    const p = P(b.dataset.id), ed = state.gl; if (!p || !ed) return;
    syncEditor();
    const plan = planOf(p), old = goalsOf(p), oldBy = [...new Set(old.map(g=>g.by||''))];
    const by = ed.by || null;
    if (by && by <= today() && !(oldBy.length===1 && oldBy[0]===by)) return toast('O prazo precisa ser uma data futura');
    const next = [], gone = [];
    for (const k of GOAL_ORDER){
      const raw = (ed.vals[k] ?? '').trim(), prev = old.find(g=>g.k===k), K = GOAL_KINDS[k];
      if (!raw){ if (prev) gone.push(prev); continue; }
      const to = num(raw), cur = currentOf(p, k);
      if (to==null || to<=0) return toast(`${K.l}: valor inválido`);
      if (!cur) return toast(`${K.l}: sem medida registrada nas avaliações`);
      if (k==='bf' && (to<3 || to>60)) return toast('% de gordura: use um valor entre 3 e 60');
      if (prev && Math.abs(prev.to - to) < 1e-6){ next.push({ ...prev, by }); continue; }
      if (Math.abs(to - cur.v) < 0.05) return toast(`${K.l}: a meta precisa ser diferente do valor de hoje (${fmt(cur.v)} ${K.u})`);
      // valor novo (ou meta nova): começa no valor da avaliação mais recente; a anterior vai para o histórico
      if (prev) gone.push(prev);
      next.push({ id: crypto.randomUUID(), k, to, from: cur.v, fromDate: cur.date, by });
    }
    if (!next.length && !old.length) return toast('Preencha pelo menos uma meta');
    retire(p, gone); plan.goals = next;
    state.gl = null; await ctx.save(); render();
    const st = statusAll(p), hit = st.filter(s=>s.done).length;
    toast(!next.length ? 'Metas encerradas · ficam no histórico' : `${next.length===1?'Meta salva':`${next.length} metas salvas`} ✓${hit?` ${hit===1?'Uma já foi alcançada':`${hit} já alcançadas`}`:` ${firstName(p.name)} acompanha no portal`}`);
    setTimeout(()=>document.querySelector('.gl-board')?.scrollIntoView({behavior:'smooth', block:'center'}), 120);
  },
  glClear: async b => { const p = P(b.dataset.id); if (!p) return;
    sheet('Encerrar todas as metas?', 'Elas saem do quadro e do portal e ficam em “Metas anteriores”, com o resultado alcançado. As avaliações não mudam.', [
      {label:'Encerrar metas', cls:'danger', icon:ic('trash','sm'), fn:async()=>{ retire(p, goalsOf(p)); planOf(p).goals = []; state.gl = null; await ctx.save(); render(); toast('Metas encerradas · ficam no histórico'); }},
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

// etiqueta da meta calórica (topo do plano alimentar): leva à calculadora
function energyChip(pid){
  const p = P(pid); if (!p || !p.plan?.energy) return '';
  const e = energyOfP(p); if (!e) return '';
  return `<button class="tag" data-act="go" data-to="energy" data-id="${p.id}">${ic('flame','sm')}Meta ${kcal(e.target)} kcal · P ${Math.round(e.macros.p.g)} g</button>`;
}

return { energyFor: energyOfP, goalsSection, homeGoals, detailGoals, goalTag, goalReached, goalsLine, goalFor, openGoals, energyChip, energySection, tdeeOf, viewEnergy, viewReturns, returnsBanner, pendingCount, onInput, acts };
}
