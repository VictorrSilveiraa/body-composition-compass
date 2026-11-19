import { esc, fmt, num, fmtDate, today, firstName, clone } from './calculos.js';
import { parseDiet, dietProblems, dietStats, emptyDiet, did, normTxt, normTime, splitName, mealKind, shoppingList } from './diet-parse';
import { dietHtml, dietMini, dietAct, newDietUi, nowMinutes, dtIcon, KIND_COLOR } from './diet-view';
import { exportDietPdf, dietImage, dietFileName, shareOrDownload } from './diet-export';
import { waSvg } from './wa-icon';

/*
 * Plano alimentar no app do nutricionista:
 *  /dietas            planos do paciente atual (atual + histórico)
 *  /dietas/nova       importar: 1) enviar PDF  2) leitura animada  3) revisar e publicar
 *  /dietas/:id        o plano, igual ao que o paciente vê no portal
 *  /dietas/:id/editar revisar/editar
 * Recebe do app (original-runtime.js) o banco em memória, a navegação e os componentes visuais.
 */
export function dietScreens(ctx){
const { options, state, ic, go, render, toast, sheet, dropdown } = ctx;
const S = options.diets || null; // loja de planos (src/lib/diets.ts)
const UI = {};                    // estado de cada tela de plano (aba, opção, trocas, compras)
const uiOf = id => (UI[id] ||= (() => { const u = newDietUi(); try { u.checked = JSON.parse(localStorage.getItem('avf.dtshop.'+id)||'{}'); } catch {} return u; })());
let imp = null;                   // importação/edição em andamento
let justSaved = null;
const db = () => ctx.db();
const P = id => db().profiles.find(p=>p.id===id);
const dietsOf = pid => S ? S.ofPatient(pid) : [];
const consultLabel = aid => { const a = aid && ctx.findA(aid); return a ? 'Consulta de '+fmtDate(a.date,{day:'2-digit',month:'short',year:'numeric'}) : ''; };
const metaOf = rec => { const p = P(rec.profileId); return { patient: p?.name || rec.data.patientName || '', nutri: ctx.nutriName(), crn: ctx.crnLabel(), consult: consultLabel(rec.assessmentId) }; };
const dShort = iso => fmtDate(iso,{day:'2-digit',month:'short',year:'numeric'});

/* ---------- peças ---------- */
function stepper(n){
  const L = ['Enviar PDF','Leitura','Revisão'];
  return `<ol class="setup-steps dt-stepper" aria-label="Etapas">${L.map((l,i)=>`<li class="${i+1===n?'on':i+1<n?'done':''}"${i+1===n?' aria-current="step"':''}><span class="n">${i+1<n?ic('check','sm'):i+1}</span>${l}</li>`).join('')}</ol>`;
}
function emptyHero(p){
  return `<div class="card dt-intro">
    <span class="dt-blob"></span><span class="dt-blob b2"></span>
    <div class="dt-intro-art" aria-hidden="true">${docArt()}</div>
    <div class="dt-intro-txt">
      <span class="tag">${dtIcon('spark','sm')}Novo</span>
      <h2>A dieta do WebDiet, viva no app.</h2>
      <p>Envie o PDF exportado do WebDiet: o sistema lê cada refeição, opção e substituição e monta um plano interativo para ${p?esc(firstName(p.name)):'o paciente'} — no portal, com lista de compras, PDF e imagem.</p>
    </div>
    <ol class="dt-how">
      <li><b>1</b><span><strong>Exporte</strong> o plano em PDF no WebDiet</span></li>
      <li><b>2</b><span><strong>Envie</strong> aqui — a leitura é automática</span></li>
      <li><b>3</b><span><strong>Revise</strong> e publique no portal</span></li>
    </ol>
  </div>`;
}
function docArt(){
  return `<svg viewBox="0 0 160 150" class="dt-doc"><rect x="34" y="14" width="92" height="118" rx="14" class="d-pg"/><rect x="48" y="32" width="46" height="8" rx="4" class="d-l1"/><rect x="48" y="50" width="64" height="6" rx="3" class="d-l"/><rect x="48" y="62" width="56" height="6" rx="3" class="d-l"/><rect x="48" y="74" width="60" height="6" rx="3" class="d-l"/><rect x="48" y="92" width="38" height="6" rx="3" class="d-l"/><rect x="48" y="104" width="52" height="6" rx="3" class="d-l"/><rect x="26" y="70" width="108" height="3" rx="1.5" class="d-scan"/><circle cx="122" cy="118" r="20" class="d-badge"/><path d="M113 118l6 6 11-12" class="d-ok"/></svg>`;
}
function dietRow(rec, on){
  const s = dietStats(rec.data), d = rec.prescribedAt || new Date(rec.createdAt).toISOString().slice(0,10);
  return `<button class="aitem dt-row" data-act="go" data-to="diet" data-id="${rec.id}">
    ${ctx.dpill(d, on)}
    <div class="info"><b>${esc(rec.title)}</b>
      <div class="stats"><span><em>${s.meals}</em> refeições</span><span><em>${s.foods}</em> alimentos</span>${rec.assessmentId?`<span class="tag">${ic('clip','sm')}${esc(consultLabel(rec.assessmentId).replace('Consulta de ',''))}</span>`:''}${rec.visible?'':`<span class="tag">${ic('lock','sm')}Oculto</span>`}</div></div>
    ${ic('right','sm')}</button>`;
}
/** cartão compacto do plano atual (ficha, detalhe da avaliação, painel) */
function miniCard(rec, {title='Plano alimentar', act=true}={}){
  const m = dietMini(rec.data, nowMinutes()), s = m.stats;
  return `<div class="card dt-mini" ${act?`data-act="go" data-to="diet" data-id="${rec.id}" style="cursor:pointer"`:''}>
    <div class="card-head"><span class="chip-ico">${dtIcon('leaf','sm')}</span><span class="label"><b>${esc(title)}</b><br><span class="small muted">${esc(rec.title)}${rec.prescribedAt?' · '+dShort(rec.prescribedAt):''}</span></span><span class="right" style="margin-left:auto">${ic('right')}</span></div>
    ${m.strip?`<div class="dt-strip">${m.strip}</div>`:''}
    <div class="dt-mini-stats"><span><b>${s.meals}</b> refeições</span><span><b>${s.foods}</b> alimentos</span><span><b>${s.subs}</b> trocas</span>${rec.visible?`<span class="tag green">${ic('check','sm')}No portal</span>`:`<span class="tag">${ic('lock','sm')}Só você vê</span>`}</div>
  </div>`;
}

/* ---------- /dietas ---------- */
function viewDiets(){
  const p = ctx.prof(), list = dietsOf(p.id), cur = list[0];
  let h = `<header class="top"><button class="icon-btn" data-act="go" data-to="home" aria-label="Início">${ic('back')}</button>
    <div class="title-block"><small>${esc(p.name)}</small><b>Plano alimentar</b></div><div class="grow"></div>
    <button class="icon-btn" data-act="dtNew" data-pid="${p.id}" aria-label="Importar plano">${ic('plus')}</button></header>`;
  if (!S) return h + `<div class="card empty"><h3>Indisponível</h3><p>Não foi possível carregar os planos alimentares.</p></div>`;
  if (!S.cloud) h += `<p class="ph-note">${ic('lock','sm')}<span>Os planos estão sendo guardados <b>neste aparelho</b> até a área de dietas ser ativada no banco. Depois sobem sozinhos.</span></p>`;
  if (!cur){
    h += emptyHero(p) + `<button class="cta dt-cta" data-act="dtNew" data-pid="${p.id}"><span class="c-ico">${ic('ul')}</span><span>Importar PDF da dieta <span class="arrows">›››</span></span><span class="c-ico">${dtIcon('leaf')}</span></button>
      <button class="btn ghost sm dt-manual" data-act="dtManual" data-pid="${p.id}">${ic('edit','sm')} Prefere digitar? Montar o plano do zero</button>`;
    return h;
  }
  h += `<h2 class="sec">Plano atual</h2>${miniCard(cur,{title:'Em uso agora'})}`;
  if (list.length>1){ const pg = ctx.paged('dt:'+p.id, list.slice(1), {per:5, pages:false, noun:['plano','planos']});
    h += `<h2 class="sec">Planos anteriores <span class="sec-note">${list.length-1}</span></h2><div class="alist" id="pg-dt:${p.id}">${pg.items.map(r=>dietRow(r,false)).join('')}</div>${pg.html}`; }
  h += `<button class="cta dt-cta" data-act="dtNew" data-pid="${p.id}"><span class="c-ico">${ic('ul')}</span><span>Importar novo plano <span class="arrows">›››</span></span><span class="c-ico">${ic('plus')}</span></button>`;
  return h;
}

/* ---------- /dietas/:id ---------- */
function viewDiet(id){
  const rec = S?.get(id); if (!rec) return viewDiets();
  const p = P(rec.profileId), ui = uiOf(id);
  const chips = [
    rec.assessmentId && ctx.findA(rec.assessmentId) ? `<button class="tag" data-act="go" data-to="detail" data-id="${rec.assessmentId}">${ic('clip','sm')}${esc(consultLabel(rec.assessmentId))}</button>` : '',
    `<button class="tag ${rec.visible?'green':''}" data-act="dtVis" data-id="${id}">${ic(rec.visible?'check':'lock','sm')}${rec.visible?'Visível no portal':'Só você vê'}</button>`,
    rec.data.source==='webdiet' ? `<span class="tag">${ic('ul','sm')}Importado do WebDiet</span>` : '',
  ].filter(Boolean).join('');
  const portal = ctx.portalState(rec.profileId);
  const foot = `<div class="card white dt-share">
    <div class="card-head"><span class="chip-ico" style="background:var(--blue)">${ic('users','sm')}</span><span class="label"><b>${p?esc(firstName(p.name)):'Paciente'} no portal</b><br><span class="small muted">${rec.visible ? (portal==='active' ? 'Vê este plano com o código de acesso' : portal==='none' ? 'Crie o código de acesso na ficha' : portal==='paused' ? 'Acesso pausado na ficha' : 'Vê este plano no portal') : 'Este plano está oculto do paciente'}</span></span></div>
    <button class="toggle" data-act="dtVis" data-id="${id}"><span><b>Mostrar no portal</b><br><span class="small muted">O paciente vê, baixa em PDF e imagem</span></span><span class="switch ${rec.visible?'on':''}"></span></button>
    <div class="dt-share-btns">
      <button class="btn dark sm" data-act="dtSend" data-id="${id}">${p?.phone ? waSvg('sm') : ic('chat','sm')} Enviar ao paciente</button>
      ${p?`<button class="btn ghost sm" data-act="go" data-to="patient" data-id="${p.id}">${ic('user','sm')} Ficha</button>`:''}
    </div></div>`;
  const saved = justSaved?.id===id && Date.now()-justSaved.t < 7000;
  return `<header class="top"><button class="icon-btn" data-act="dtBack" data-pid="${rec.profileId}" aria-label="Voltar">${ic('back')}</button>
    <div class="title-block"><small>Plano alimentar · ${esc(p?.name||'')}</small><b>${esc(rec.title)}</b></div><div class="grow"></div>
    <div class="dt-acts">
      <button class="btn ghost sm dt-d" data-act="dtPdf" data-id="${id}">${ic('print','sm')}<span>PDF</span></button>
      <button class="btn ghost sm dt-d" data-act="dtImg" data-id="${id}">${ic('image','sm')}<span>Imagem</span></button>
      <button class="btn ghost sm dt-d" data-act="dtEdit" data-id="${id}">${ic('edit','sm')}<span>Editar</span></button>
      <button class="icon-btn dt-m" data-act="dtImg" data-id="${id}" aria-label="Baixar imagem">${ic('dl')}</button>
      <button class="icon-btn" data-act="dtMenu" data-id="${id}" aria-label="Mais opções" aria-haspopup="dialog">${ic('gear')}</button>
    </div></header>
  ${saved?`<div class="dt-saved" role="status">${ic('check')}<span><b>Plano publicado!</b> ${rec.visible?'Já aparece no portal do paciente.':'Ele está oculto do portal por enquanto.'}</span></div>`:''}
  ${dietHtml(rec.data, ui, { mode:'nutri', nowMin: nowMinutes(), chips, foot })}`;
}

/* ---------- importar / editar ---------- */
function startImport(pid, aid){
  const p = P(pid) || ctx.prof();
  const last = p ? ctx.listOf(p.id).at(-1) : null;
  imp = { phase:'pick', pid:p?.id||null, aid: aid ?? last?.id ?? null, visible:true, editingId:null, diet:null, read:null, err:'', problems:[] };
}
function startManual(pid){
  startImport(pid);
  const d = emptyDiet(); d.title = 'Plano alimentar'; d.prescribedAt = today();
  d.meals = [{ id:did('m'), time:'08:00', name:'Café da manhã', variants:[{ id:did('v'), label:'', foods:[{ id:did('f'), name:'', qty:'', subs:[] }], notes:'' }] }];
  Object.assign(imp, { phase:'review', diet:d });
}
function startEdit(id){
  const rec = S?.get(id); if (!rec) return false;
  imp = { phase:'review', pid:rec.profileId, aid:rec.assessmentId, visible:rec.visible, editingId:id, diet:clone(rec.data), read:null, err:'', problems:[] };
  return true;
}
// consultas no mesmo dia ganham o peso no nome, para dar para diferenciar
const aOpts = pid => { const l = pid ? ctx.listOf(pid).slice().reverse() : []; return [['none','Sem vínculo com consulta'], ...l.map(a=>[a.id,'Consulta de '+fmtDate(a.date,{day:'2-digit',month:'short',year:'numeric'})+(l.filter(x=>x.date===a.date).length>1 && num(a.weight)!=null ? ` · ${fmt(num(a.weight))} kg` : '')])]; };
function whoCard(){
  const people = db().profiles.filter(p=>!p.archived || p.id===imp.pid);
  return `<div class="card white dt-who">
    <div class="fields two">
      <div class="field"><div class="f-top"><span class="f-label">Paciente</span></div>${dropdown('dtp', people.map(p=>[p.id,p.name]), imp.pid, {icon:'user', label:'Paciente'})}</div>
      <div class="field"><div class="f-top"><span class="f-label">Consulta</span></div><span class="f-hint">O plano fica ligado à avaliação escolhida.</span>${dropdown('dta', aOpts(imp.pid), imp.aid||'none', {icon:'clip', label:'Consulta'})}</div>
    </div></div>`;
}
function viewImport(){
  if (!imp) startImport(db().activeId);
  const editing = !!imp.editingId;
  const head = `<header class="top"><button class="icon-btn" data-act="dtCancel" aria-label="Fechar">${ic('x')}</button>
    <div class="title-block"><small>${editing?'Editar plano':'Plano alimentar'}</small><b>${editing?'Revisar e salvar':imp.phase==='review'&&!imp.read?'Montar plano':'Importar do WebDiet'}</b></div></header>`;
  if (imp.phase==='pick') return head + stepper(1) + `
    ${whoCard()}
    <label class="dt-drop" data-drop="1">
      <input type="file" id="dietFile" accept="application/pdf,.pdf" hidden>
      <span class="dt-drop-art" aria-hidden="true">${docArt()}</span>
      <b>Arraste o PDF aqui <span class="dt-or-t">ou</span> <u>escolha o arquivo</u></b>
      <small>PDF exportado do WebDiet · lido aqui mesmo, no seu navegador</small>
      ${imp.err?`<span class="dt-drop-err" role="alert">${ic('x','sm')}${esc(imp.err)}</span>`:''}
    </label>
    <details class="ph-tips dt-tips"><summary>${ic('target','sm')}<span>Como exportar o PDF no WebDiet</span>${ic('chev','sm')}</summary><ol>
      <li>Abra o paciente no WebDiet e entre no <b>planejamento alimentar</b> pronto.</li>
      <li>Use a opção de <b>imprimir / exportar em PDF</b> do plano e salve o arquivo.</li>
      <li>Envie o arquivo aqui. Refeições, opções, substituições, observações, lista de compras e receitas são reconhecidas sozinhas.</li>
      <li>PDFs de outros sistemas também funcionam se tiverem texto (não foto escaneada). Você revisa tudo antes de publicar.</li></ol></details>
    <button class="btn ghost sm dt-manual" data-act="dtManual" data-pid="${imp.pid||''}">${ic('edit','sm')} Montar o plano do zero, sem PDF</button>`;

  if (imp.phase==='read'){
    const r = imp.read, d = imp.diet, s = d ? dietStats(d) : null;
    const thumbs = r?.thumbs?.length ? r.thumbs : [];
    const items = s ? [
      d.patientName && ['user', `Paciente: <b>${esc(d.patientName)}</b>`],
      ['cal', `<b>${s.meals}</b> refeições${s.options?` · ${s.options} opções extras`:''}`],
      ['clip', `<b>${s.foods}</b> alimentos com quantidade`],
      ['swap', `<b>${s.subs}</b> substituições`],
      s.shopping && ['dl', `Lista de compras com <b>${s.shopping}</b> itens`],
      s.recipes && ['heart', `<b>${s.recipes}</b> ${s.recipes===1?'receita':'receitas'}`],
    ].filter(Boolean) : [];
    const bad = imp.problems.length;
    return head + stepper(2) + `<div class="dt-read ${s?'done':''} ${bad?'bad':''}">
      <div class="dt-pages" aria-hidden="true">${thumbs.length ? thumbs.slice(0,4).map((t,i)=>`<img src="${t}" alt="" style="--i:${i}">`).join('') : `<span class="dt-page-ph"></span><span class="dt-page-ph"></span>`}<span class="dt-scanline"></span></div>
      <div class="dt-read-txt">
        <h2>${bad ? 'Não deu para ler este PDF' : s ? 'Pronto! Veja o que encontramos' : 'Lendo seu PDF…'}</h2>
        <p class="small muted">${esc(r?.name || 'Abrindo o arquivo')}</p>
        ${bad ? `<p>${imp.problems.includes('scan') ? 'Ele parece ser uma imagem (foto ou digitalização), sem texto para ler. Exporte de novo pelo WebDiet ou monte o plano manualmente.' : 'Não encontramos refeições com horário (ex.: “09:30 - Café da manhã”). Você pode montar o plano manualmente aproveitando o que foi lido.'}</p>
          <div class="dt-read-btns"><button class="btn dark sm" data-act="dtRepick">${ic('ul','sm')} Escolher outro PDF</button><button class="btn ghost sm" data-act="dtToReview">${ic('edit','sm')} Montar manualmente</button></div>`
        : `<ul class="dt-found">${items.map(([i,t],k)=>`<li style="--i:${k}"><span class="ok yes">${ic(i,'sm')}</span><span>${t}</span></li>`).join('')}</ul>
          ${s ? `<button class="btn dark dt-go" data-act="dtToReview" style="--i:${items.length}">Revisar plano ${ic('right','sm')}</button>` : `<div class="dt-dots"><i></i><i></i><i></i></div>`}`}
      </div></div>`;
  }

  // ----- revisão -----
  const d = imp.diet, p = P(imp.pid);
  const mism = d.patientName && p && normTxt(firstName(d.patientName)) !== normTxt(firstName(p.name));
  const s = dietStats(d);
  if (imp.preview) return head + `<div class="dt-prev-bar"><span>${ic('image','sm')} Prévia — é assim que ${p?esc(firstName(p.name)):'o paciente'} vai ver</span><button class="btn ghost sm" data-act="dtPreview">${ic('edit','sm')} Voltar a editar</button></div>
    ${dietHtml(d, uiOf('preview'), { mode:'patient', nowMin: nowMinutes() })}
    ${saveBar(editing)}`;
  const inp = (k, v, ph, cls='', type='text') => `<input class="dt-in ${cls}" data-dk="${k}" type="${type}" value="${esc(v??'')}" placeholder="${ph}" autocomplete="off">`;
  const meals = d.meals.map((m, mi) => `<section class="card dt-ed-meal" data-key="em-${m.id}">
      <div class="dt-ed-mh" style="--mc:${KIND_COLOR[mealKind(m.name, m.time)]}">
        <span class="dt-ed-ico">${dtIcon(mealKind(m.name, m.time))}</span>
        <div class="dt-ed-mf">${inp(`m.${m.id}.name`, m.name, 'Nome da refeição', 'dt-in-name')}
          <label class="dt-ed-time">${ic('clock','sm')}${inp(`m.${m.id}.time`, m.time||'', '08:00', 'dt-in-time', 'time')}</label></div>
        <button class="icon-btn sm" data-act="dtDelMeal" data-m="${m.id}" aria-label="Excluir refeição">${ic('trash','sm')}</button></div>
      ${m.variants.map((v, vi) => `<div class="dt-ed-var" data-key="ev-${v.id}">
        ${m.variants.length>1 ? `<div class="dt-ed-vh">${inp(`v.${m.id}.${v.id}.label`, v.label, `Opção ${vi+1}`, 'dt-in-label')}<button class="dt-x" data-act="dtDelVar" data-m="${m.id}" data-v="${v.id}" aria-label="Excluir opção">${ic('x','sm')}</button></div>` : ''}
        <div class="dt-ed-foods">${v.foods.map(f => `<div class="dt-ed-food" data-key="ef-${f.id}">
          ${inp(`f.${m.id}.${v.id}.${f.id}.name`, f.name + (f.detail?` (${f.detail})`:''), 'Alimento', 'dt-in-food')}
          ${inp(`f.${m.id}.${v.id}.${f.id}.qty`, f.qty, 'Quantidade', 'dt-in-qty')}
          <button class="dt-x" data-act="dtDelFood" data-m="${m.id}" data-v="${v.id}" data-f="${f.id}" aria-label="Remover alimento">${ic('x','sm')}</button>
          <div class="dt-ed-subs">${f.subs.map((x,si)=>`<div class="dt-ed-sub" data-key="es-${f.id}-${si}-${f.subs.length}">
              <span class="dt-ed-subic" aria-hidden="true">${si===0?'ou':''}</span>
              ${inp(`s.${m.id}.${v.id}.${f.id}.${si}.name`, x.name + (x.detail?` (${x.detail})`:''), 'Trocar por…', 'dt-in-subname')}
              ${inp(`s.${m.id}.${v.id}.${f.id}.${si}.qty`, x.qty, 'Quantidade', 'dt-in-subqty')}
              <button class="dt-x" data-act="dtDelSub" data-m="${m.id}" data-v="${v.id}" data-f="${f.id}" data-i="${si}" aria-label="Remover troca">${ic('x','sm')}</button></div>`).join('')}
            <button class="dt-addsub" data-act="dtAddSub" data-m="${m.id}" data-v="${v.id}" data-f="${f.id}">${ic('swap','sm')}${f.subs.length ? 'Mais uma troca' : 'Adicionar troca'}</button>
          </div>
        </div>`).join('')}</div>
        <div class="dt-ed-add"><button class="tag" data-act="dtAddFood" data-m="${m.id}" data-v="${v.id}">${ic('plus','sm')}Alimento</button></div>
        <textarea class="dt-in dt-in-notes" data-dk="n.${m.id}.${v.id}" rows="2" placeholder="Observação desta ${m.variants.length>1?'opção':'refeição'} (opcional)">${esc(v.notes)}</textarea>
      </div>`).join('')}
      <button class="tag dt-ed-addvar" data-act="dtAddVar" data-m="${m.id}">${ic('plus','sm')}Adicionar opção para ${esc(m.name||'esta refeição')}</button>
    </section>`).join('');
  return head + (imp.read ? stepper(3) : '') + `
    <div class="card ${mism?'yellow':'green'} dt-sum">
      <div class="card-head"><span class="chip-ico">${ic(mism?'target':'check','sm')}</span><span class="label"><b>${imp.read?`${s.meals} refeições · ${s.foods} alimentos · ${s.subs} trocas`:`${s.meals} ${s.meals===1?'refeição':'refeições'} no plano`}</b><br><span class="small">${mism?`Atenção: o PDF é de <b>${esc(d.patientName)}</b>, mas o paciente escolhido é <b>${esc(p.name)}</b>.`:imp.read?'Confira e ajuste o que quiser. Nada vai para o paciente antes de salvar.':'Escreva as refeições; o paciente vê tudo organizado no portal.'}</span></span></div>
    </div>
    ${whoCard()}
    <div class="card white dt-ed-top">
      <div class="fields two">
        <label class="field"><div class="f-top"><span class="f-label">Título do plano</span></div><div class="f-input text">${inp('title', d.title, 'Ex.: Plano de emagrecimento — fase 1')}</div></label>
        <label class="field"><div class="f-top"><span class="f-label">Data da prescrição</span></div><div class="f-input text">${inp('date', d.prescribedAt||'', '', '', 'date')}</div></label>
      </div>
      <button class="toggle" data-act="dtImpVis"><span><b>Mostrar no portal do paciente</b><br><span class="small muted">Dá para ocultar depois, a qualquer momento</span></span><span class="switch ${imp.visible?'on':''}"></span></button>
    </div>
    <nav class="dt-ed-nav" aria-label="Partes do plano">
      <button data-act="dtJump" data-t="ed-meals">${dtIcon('almoco','sm')}Refeições<em>${s.meals}</em></button>
      <button data-act="dtJump" data-t="ed-shop">${dtIcon('cart','sm')}Compras<em>${d.hideShopping?'—':shoppingList(d).length}</em></button>
      <button data-act="dtJump" data-t="ed-recipes">${dtIcon('pot','sm')}Receitas<em>${d.recipes.length}</em></button>
      <button data-act="dtJump" data-t="ed-notes">${dtIcon('info','sm')}Orientações<em>${d.sections.length + (d.notes.trim()?1:0)}</em></button>
    </nav>
    <h2 class="sec" id="ed-meals">Refeições <span class="sec-note">${s.meals}</span></h2>
    <div class="dt-ed">${meals || '<div class="card empty"><p>Nenhuma refeição ainda.</p></div>'}</div>
    <button class="btn ghost dt-ed-addmeal" data-act="dtAddMeal">${ic('plus','sm')} Adicionar refeição</button>
    ${shopEditor(d)}
    ${recipesEditor(d)}
    ${notesEditor(d)}
    ${saveBar(editing)}`;
}
/* ---------- editor: lista de compras, receitas e orientações ---------- */
const edIn = (k, v, ph, cls='', type='text') => `<input class="dt-in ${cls}" data-dk="${k}" type="${type}" value="${esc(v??'')}" placeholder="${ph}" autocomplete="off">`;
const edTa = (k, v, ph, rows=3, cls='') => `<textarea class="dt-in dt-in-notes ${cls}" data-dk="${k}" rows="${rows}" placeholder="${ph}">${esc(v??'')}</textarea>`;
function shopEditor(d){
  const auto = shoppingList({ ...d, shopping: [] });
  let body = '';
  if (!d.hideShopping){
    if (d.shopping.length) body = `<div class="dt-ed-shop">${d.shopping.map((x,i)=>`<div class="dt-ed-item" data-key="sh-${i}-${d.shopping.length}"><span class="dt-box-o"></span>${edIn(`sh.${i}`, x, 'Item da lista')}<button class="dt-x" data-act="dtDelShop" data-i="${i}" aria-label="Remover item">${ic('x','sm')}</button></div>`).join('')}</div>
      <div class="dt-ed-row"><button class="tag" data-act="dtAddShop">${ic('plus','sm')}Item</button><button class="tag" data-act="dtShopAuto">${dtIcon('spark','sm')}Usar lista automática</button></div>`;
    else body = `<p class="small muted dt-ed-hint">Lista automática: <b>${auto.length} itens</b> montados com todos os alimentos e trocas do plano. Ela se atualiza sozinha quando você muda as refeições.</p>
      ${auto.length?`<div class="dt-ed-chips">${auto.slice(0,10).map(x=>`<span>${esc(x)}</span>`).join('')}${auto.length>10?`<span class="more">+${auto.length-10}</span>`:''}</div>`:''}
      <div class="dt-ed-row"><button class="tag" data-act="dtShopCustom">${ic('edit','sm')}Personalizar a lista</button></div>`;
  }
  return `<h2 class="sec" id="ed-shop">Lista de compras</h2>
  <div class="card white dt-ed-box">
    <button class="toggle" data-act="dtShopOn"><span><b>Incluir lista de compras</b><br><span class="small muted">${d.hideShopping?'Retirada: o paciente não vê a aba Compras':'O paciente marca os itens no mercado'}</span></span><span class="switch ${d.hideShopping?'':'on'}"></span></button>
    ${body}
  </div>`;
}
function recipesEditor(d){
  return `<h2 class="sec" id="ed-recipes">Receitas <span class="sec-note">${d.recipes.length || 'nenhuma'}</span></h2>
  <div class="dt-ed">${d.recipes.map(r=>`<section class="card white dt-ed-box dt-ed-recipe" data-key="er-${r.id}">
      <div class="dt-ed-rh"><span class="dt-ed-ico" style="--mc:var(--peach)">${dtIcon('pot')}</span>${edIn(`r.${r.id}.name`, r.name, 'Nome da receita', 'dt-in-name')}<button class="icon-btn sm" data-act="dtDelRecipe" data-r="${r.id}" aria-label="Excluir receita">${ic('trash','sm')}</button></div>
      <label class="dt-ed-lbl"><span>Rendimento</span>${edIn(`r.${r.id}.yield`, r.yield, 'Ex.: 3 porções')}</label>
      <label class="dt-ed-lbl"><span>Ingredientes <small>um por linha</small></span>${edTa(`r.${r.id}.ing`, r.ingredients.join('\n'), 'Peito de frango — 240 g\nAzeite — 1 colher de sopa', 4)}</label>
      <label class="dt-ed-lbl"><span>Modo de preparo <small>um passo por linha</small></span>${edTa(`r.${r.id}.steps`, r.steps.join('\n'), 'Tempere o frango\nGrelhe em frigideira com azeite', 4)}</label>
    </section>`).join('')}</div>
  <button class="btn ghost dt-ed-addmeal" data-act="dtAddRecipe">${ic('plus','sm')} Adicionar receita</button>`;
}
function notesEditor(d){
  return `<h2 class="sec" id="ed-notes">Orientações</h2>
  <div class="card white dt-ed-box">
    <label class="dt-ed-lbl"><span>Orientações gerais <small>aparecem na aba Orientações do paciente</small></span>${edTa('notes', d.notes, 'Hidratação, horários, temperos liberados, dicas…', 3, 'big')}</label>
  </div>
  <div class="dt-ed">${d.sections.map(x=>`<section class="card white dt-ed-box" data-key="ex-${x.id}">
      <div class="dt-ed-rh"><span class="dt-ed-ico" style="--mc:var(--blue)">${dtIcon('info')}</span>${edIn(`sec.${x.id}.title`, x.title, 'Título da seção', 'dt-in-name')}<button class="icon-btn sm" data-act="dtDelSec" data-s="${x.id}" aria-label="Excluir seção">${ic('trash','sm')}</button></div>
      ${edTa(`sec.${x.id}.lines`, x.lines.join('\n'), 'Texto da seção (um parágrafo por linha)', 3)}
    </section>`).join('')}</div>
  <button class="btn ghost dt-ed-addmeal" data-act="dtAddSec">${ic('plus','sm')} Adicionar seção de orientação</button>`;
}

function saveBar(editing){
  return `<div class="wiz-bar form-bar dt-bar"><div class="in">
    <button class="btn ghost" data-act="dtPreview">${ic(imp.preview?'edit':'image','sm')} ${imp.preview?'Editar':'Prévia'}</button>
    <button class="btn dark" data-act="dtSave">${ic('check')} ${editing?'Salvar alterações':'Publicar plano'}</button>
  </div></div>`;
}

/* ---------- arquivo escolhido ---------- */
async function onFile(file){
  if (!file) return;
  if (!imp) startImport(db().activeId);
  if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)){ imp.err = 'Escolha um arquivo PDF.'; render(); return; }
  imp.err = ''; imp.phase = 'read'; imp.read = { name:file.name, thumbs:[] }; imp.diet = null; imp.problems = []; render();
  const t0 = Date.now();
  try {
    const { readPdf } = await import('./diet-pdf');
    const r = await readPdf(file);
    imp.read = r; render();
    const d = parseDiet(r.pages);
    if (!d.prescribedAt) d.prescribedAt = today();
    imp.problems = dietProblems(d, r.pages);
    // a leitura tem um ritmo mínimo: dá tempo de ver o que foi encontrado
    await new Promise(res=>setTimeout(res, Math.max(0, 900 - (Date.now()-t0))));
    if (!imp || imp.phase!=='read') return;
    imp.diet = d; render();
  } catch (e) {
    if (!imp) return;
    imp.phase = 'pick'; imp.err = e?.message || 'Não foi possível ler este PDF.'; render();
  }
}

/* ---------- edição: o que se digita vai direto para o plano (sem redesenhar a tela) ---------- */
function onInput(el){
  const k = el.dataset.dk; if (!k || !imp?.diet) return false;
  const d = imp.diet, v = el.value, parts = k.split('.');
  const meal = id => d.meals.find(m=>m.id===id), varOf = (m,id) => meal(m)?.variants.find(x=>x.id===id);
  if (k==='title') d.title = v;
  else if (k==='date') d.prescribedAt = v || null;
  else if (k==='notes') d.notes = v;
  else if (parts[0]==='m'){ const m = meal(parts[1]); if (m){ if (parts[2]==='time') m.time = normTime(v); else m.name = v; } }
  else if (parts[0]==='v'){ const x = varOf(parts[1],parts[2]); if (x) x.label = v; }
  else if (parts[0]==='n'){ const x = varOf(parts[1],parts[2]); if (x) x.notes = v; }
  else if (parts[0]==='s'){ const f = varOf(parts[1],parts[2])?.foods.find(x=>x.id===parts[3]); const sb = f?.subs[+parts[4]]; if (sb){ if (parts[5]==='qty') sb.qty = v; else { const sp = splitName(v); sb.name = sp.name; if (sp.detail) sb.detail = sp.detail; else delete sb.detail; } } }
  else if (parts[0]==='sh'){ if (d.shopping[+parts[1]]!=null) d.shopping[+parts[1]] = v; }
  else if (parts[0]==='r'){ const r = d.recipes.find(x=>x.id===parts[1]); if (r){ const lines = v.split('\n').map(x=>x.trim()).filter(Boolean); if (parts[2]==='name') r.name = v; else if (parts[2]==='yield') r.yield = v; else if (parts[2]==='ing') r.ingredients = lines; else r.steps = lines; } }
  else if (parts[0]==='sec'){ const x = d.sections.find(y=>y.id===parts[1]); if (x){ if (parts[2]==='title') x.title = v; else x.lines = v.split('\n').map(y=>y.trim()).filter(Boolean); } }
  else if (parts[0]==='f'){ const f = varOf(parts[1],parts[2])?.foods.find(x=>x.id===parts[3]); if (f){ if (parts[4]==='qty') f.qty = v; else { const sp = splitName(v); f.name = sp.name; if (sp.detail) f.detail = sp.detail; else delete f.detail; } } }
  return true;
}
function findVar(b){ const m = imp?.diet?.meals.find(x=>x.id===b.dataset.m); return { m, v: m?.variants.find(x=>x.id===b.dataset.v) }; }

/* ---------- ações ---------- */
const acts = {
  dtNew: async b => { startImport(b.dataset.pid || db().activeId, b.dataset.aid || undefined); go('dietNew'); },
  dtManual: async b => { startManual(b.dataset.pid || imp?.pid || db().activeId); go('dietNew'); },
  dtBack: async b => { if (b.dataset.pid) ctx.setActive(b.dataset.pid); go('diets'); },
  dtCancel: async () => {
    const leave = () => { const id = imp?.editingId; imp = null; id ? go('diet', id) : go('diets'); };
    if (imp && imp.phase==='review') return sheet(imp.editingId?'Descartar alterações?':'Descartar este plano?', 'O que você revisou aqui não será salvo.', [{label:'Descartar', cls:'danger', fn:async()=>leave()},{label:'Continuar editando'}]);
    leave();
  },
  dtRepick: async () => { imp.phase = 'pick'; imp.read = null; imp.diet = null; imp.problems = []; render(); },
  dtToReview: async () => { if (!imp.diet){ imp.diet = emptyDiet(); imp.diet.prescribedAt = today(); } if (!imp.diet.meals.length) imp.diet.meals.push({ id:did('m'), time:'08:00', name:'Café da manhã', variants:[{ id:did('v'), label:'', foods:[{ id:did('f'), name:'', qty:'', subs:[] }], notes:'' }] }); imp.phase = 'review'; render(); window.scrollTo({top:0,behavior:'smooth'}); },
  dtImpVis: async () => { imp.visible = !imp.visible; render(); },
  dtPreview: async () => { imp.preview = !imp.preview; render(); window.scrollTo({top:0,behavior:'smooth'}); },
  dtAddFood: async b => { const { v } = findVar(b); if (!v) return; v.foods.push({ id:did('f'), name:'', qty:'', subs:[] }); render(); setTimeout(()=>ctx.app().querySelector(`[data-dk="f.${b.dataset.m}.${b.dataset.v}.${v.foods.at(-1).id}.name"]`)?.focus(), 60); },
  dtDelFood: async b => { const { v } = findVar(b); if (!v) return; v.foods = v.foods.filter(f=>f.id!==b.dataset.f); render(); },
  dtAddSub: async b => { const { v } = findVar(b); const f = v?.foods.find(x=>x.id===b.dataset.f); if (!f) return; f.subs.push({ name:'', qty:'' }); render(); setTimeout(()=>ctx.app().querySelector(`[data-dk="s.${b.dataset.m}.${b.dataset.v}.${f.id}.${f.subs.length-1}.name"]`)?.focus(), 60); },
  dtShopOn: async () => { imp.diet.hideShopping = !imp.diet.hideShopping; render(); },
  dtShopCustom: async () => { const d = imp.diet; d.shopping = shoppingList({ ...d, shopping: [] }); if (!d.shopping.length) d.shopping = ['']; render(); },
  dtShopAuto: async () => { imp.diet.shopping = []; render(); },
  dtAddShop: async () => { const d = imp.diet; d.shopping.push(''); render(); setTimeout(()=>ctx.app().querySelector(`[data-dk="sh.${d.shopping.length-1}"]`)?.focus(), 60); },
  dtDelShop: async b => { imp.diet.shopping.splice(+b.dataset.i, 1); render(); },
  dtAddRecipe: async () => { const r = { id:did('r'), name:'', yield:'', ingredients:[], steps:[] }; imp.diet.recipes.push(r); render(); setTimeout(()=>{ const el = ctx.app().querySelector(`[data-dk="r.${r.id}.name"]`); el?.focus(); el?.scrollIntoView({block:'center',behavior:'smooth'}); }, 60); },
  dtDelRecipe: async b => { const d = imp.diet, r = d.recipes.find(x=>x.id===b.dataset.r); if (!r) return; const drop = () => { d.recipes = d.recipes.filter(x=>x!==r); render(); };
    if (r.name.trim() || r.ingredients.length) return sheet(`Excluir a receita ${r.name.trim() ? '“'+r.name.trim()+'”' : ''}?`, 'Ela sai do plano do paciente.', [{label:'Excluir receita', cls:'danger', fn:async()=>drop()},{label:'Cancelar'}]); drop(); },
  dtAddSec: async () => { const x = { id:did('s'), title:'', lines:[] }; imp.diet.sections.push(x); render(); setTimeout(()=>ctx.app().querySelector(`[data-dk="sec.${x.id}.title"]`)?.focus(), 60); },
  dtDelSec: async b => { imp.diet.sections = imp.diet.sections.filter(x=>x.id!==b.dataset.s); render(); },
  dtJump: async b => { const el = document.getElementById(b.dataset.t); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 86, behavior:'smooth' }); },
  dtDelSub: async b => { const { v } = findVar(b); const f = v?.foods.find(x=>x.id===b.dataset.f); if (!f) return; f.subs.splice(+b.dataset.i,1); render(); },
  dtAddVar: async b => { const m = imp.diet.meals.find(x=>x.id===b.dataset.m); if (!m) return; m.variants.forEach((x,i)=>{ if (!x.label) x.label = i===0 ? 'Opção 1' : `Opção ${i+1}`; }); m.variants.push({ id:did('v'), label:`Opção ${m.variants.length+1}`, foods:[{ id:did('f'), name:'', qty:'', subs:[] }], notes:'' }); render(); },
  dtDelVar: async b => { const m = imp.diet.meals.find(x=>x.id===b.dataset.m); if (!m || m.variants.length<2) return; m.variants = m.variants.filter(x=>x.id!==b.dataset.v); if (m.variants.length===1) m.variants[0].label=''; render(); },
  dtAddMeal: async () => { const last = imp.diet.meals.at(-1); const t = last?.time ? `${String(Math.min(23, +last.time.slice(0,2)+3)).padStart(2,'0')}:00` : '08:00'; imp.diet.meals.push({ id:did('m'), time:t, name:'', variants:[{ id:did('v'), label:'', foods:[{ id:did('f'), name:'', qty:'', subs:[] }], notes:'' }] }); render(); setTimeout(()=>{ const el = ctx.app().querySelector(`[data-dk="m.${imp.diet.meals.at(-1).id}.name"]`); el?.focus(); el?.scrollIntoView({block:'center',behavior:'smooth'}); }, 60); },
  dtDelMeal: async b => { const m = imp.diet.meals.find(x=>x.id===b.dataset.m); if (!m) return;
    const drop = () => { imp.diet.meals = imp.diet.meals.filter(x=>x.id!==m.id); render(); };
    if (m.variants.some(v=>v.foods.some(f=>f.name.trim()))) return sheet(`Excluir ${m.name||'esta refeição'}?`, 'Os alimentos e as opções desta refeição saem do plano.', [{label:'Excluir refeição', cls:'danger', fn:async()=>drop()},{label:'Cancelar'}]);
    drop(); },
  dtSave: async () => {
    const d = imp.diet; if (!S) return toast('Planos indisponíveis agora');
    if (!imp.pid || !P(imp.pid)) return toast('Escolha o paciente');
    // limpa linhas vazias e organiza por horário
    d.title = (d.title||'').trim() || 'Plano alimentar';
    for (const m of d.meals){ m.name = (m.name||'').trim() || 'Refeição'; for (const v of m.variants){ v.foods = v.foods.filter(f=>f.name.trim()); for (const f of v.foods) f.subs = f.subs.filter(x=>x.name.trim()); v.label = (v.label||'').trim(); } m.variants = m.variants.filter((v,i)=>v.foods.length || i===0); }
    d.meals = d.meals.filter(m=>m.variants.some(v=>v.foods.length));
    d.shopping = d.shopping.map(x=>x.trim()).filter(Boolean);
    d.recipes = d.recipes.filter(r=>r.name.trim() || r.ingredients.length || r.steps.length).map(r=>({ ...r, name: r.name.trim() || 'Receita' }));
    d.sections = d.sections.filter(x=>x.title.trim() || x.lines.length).map(x=>({ ...x, title: x.title.trim() || 'Orientações' }));
    if (!d.meals.length) return toast('Adicione pelo menos uma refeição com alimento');
    d.meals.sort((a,b)=>(a.time||'99').localeCompare(b.time||'99'));
    const prev = imp.editingId ? S.get(imp.editingId) : null;
    const rec = { id: prev?.id || crypto.randomUUID(), profileId: imp.pid, assessmentId: imp.aid && imp.aid!=='none' ? imp.aid : null, title: d.title, prescribedAt: d.prescribedAt || today(), data: d, visible: imp.visible, createdAt: prev?.createdAt || Date.now(), updatedAt: Date.now() };
    await S.save(rec);
    ctx.setActive(rec.profileId); imp = null; justSaved = { id: rec.id, t: Date.now() }; delete UI['preview'];
    go('diet', rec.id); toast(prev ? 'Plano atualizado ✓' : 'Plano alimentar publicado ✓');
  },
  dtEdit: async b => { if (startEdit(b.dataset.id)) go('dietEdit', b.dataset.id); },
  dtVis: async b => { const rec = S?.get(b.dataset.id); if (!rec) return; const r = await S.save({ ...rec, visible: !rec.visible }); render(); toast(r.visible ? 'Plano visível no portal do paciente' : 'Plano oculto do portal'); },
  dtPdf: async b => { const rec = S?.get(b.dataset.id); if (!rec) return; exportDietPdf(rec.data, metaOf(rec)); },
  dtImg: async b => { const rec = S?.get(b.dataset.id); if (!rec) return; toast('Gerando imagem…'); const blob = await dietImage(rec.data, metaOf(rec)); const r = await shareOrDownload(blob, dietFileName(rec.data, metaOf(rec), 'png'), rec.title); if (r==='downloaded') toast('Imagem baixada ✓'); },
  dtSend: async b => { const rec = S?.get(b.dataset.id); if (!rec) return; await ctx.sendDiet(rec); },
  dtDel: async b => { const rec = S?.get(b.dataset.id); if (!rec) return;
    sheet('Excluir plano alimentar?', `“${rec.title}” sai do app e do portal do paciente. Não pode ser desfeito.`, [{label:'Excluir plano', cls:'danger', fn:async()=>{ await S.remove(rec.id); go('diets'); toast('Plano excluído'); }},{label:'Cancelar'}]); },
  dtMenu: async b => { const rec = S?.get(b.dataset.id); if (!rec) return;
    const then = fn => () => new Promise(r => setTimeout(()=>r(fn()), 260)), fake = {dataset:{id:rec.id}};
    sheet('Plano alimentar', `${rec.title}${rec.prescribedAt?' · '+dShort(rec.prescribedAt):''}`, [
      {label:'Editar plano', icon:ic('edit','sm'), cls:'dark', fn:()=>acts.dtEdit(fake)},
      {label:'Baixar PDF', icon:ic('print','sm'), fn:then(()=>acts.dtPdf(fake))},
      {label:'Baixar imagem', icon:ic('image','sm'), fn:then(()=>acts.dtImg(fake))},
      {label:'Enviar ao paciente', icon:P(rec.profileId)?.phone ? waSvg('sm') : ic('chat','sm'), fn:then(()=>acts.dtSend(fake))},
      {label:rec.visible?'Ocultar do portal':'Mostrar no portal', icon:ic(rec.visible?'lock':'check','sm'), fn:()=>acts.dtVis(fake)},
      {label:'Substituir por um novo PDF', icon:ic('ul','sm'), fn:()=>{ startImport(rec.profileId, rec.assessmentId||undefined); go('dietNew'); }},
      {label:'Excluir plano', icon:ic('trash','sm'), cls:'danger', fn:then(()=>acts.dtDel(fake))},
      {label:'Cancelar'}]); },
};
// abas, opções, trocas e compras da tela do plano
for (const a of ['dtTab','dtOpt','dtSubs','dtCheck','dtClear']) acts[a] = async b => {
  const id = state.route==='diet' ? state.param : 'preview', ui = uiOf(id);
  if (!dietAct(ui, b)) return;
  if (a==='dtCheck' || a==='dtClear') { try { localStorage.setItem('avf.dtshop.'+id, JSON.stringify(ui.checked)); } catch {} }
  render();
};
const ddPick = {
  dtp: v => { if (!imp) return; imp.pid = v; const last = ctx.listOf(v).at(-1); imp.aid = last?.id || null; },
  dta: v => { if (imp) imp.aid = v==='none' ? null : v; },
};

/* ---------- arrastar e soltar o PDF ---------- */
function dragOver(e){ const z = e.target.closest?.('[data-drop]'); if (!z) return; e.preventDefault(); z.classList.add('over'); }
function dragLeave(e){ const z = e.target.closest?.('[data-drop]'); if (z && !z.contains(e.relatedTarget)) z.classList.remove('over'); }
function drop(e){ const z = e.target.closest?.('[data-drop]'); if (!z) return; e.preventDefault(); z.classList.remove('over'); void onFile(e.dataTransfer?.files?.[0]); }

/* ---------- integração com as outras telas ---------- */
function patientSection(p){
  if (!S) return '';
  const list = dietsOf(p.id), cur = list[0];
  if (!cur) return `<h2 class="sec">Plano alimentar</h2><button class="act-row dt-pt-empty" data-act="dtNew" data-pid="${p.id}"><span class="chip-ico" style="background:var(--green)">${dtIcon('leaf','sm')}</span><span class="grow"><b>Importar dieta do WebDiet</b><span>Envie o PDF e ${esc(firstName(p.name))} recebe um plano interativo no portal</span></span>${ic('right','sm')}</button>`;
  return `<h2 class="sec">Plano alimentar ${list.length>1?`<button data-act="openAs" data-to="diets" data-id="${p.id}">Histórico (${list.length})</button>`:''}</h2>${miniCard(cur,{title:'Plano atual'})}`;
}
function assessmentSection(a){
  if (!S) return '';
  const linked = S.list().filter(r=>r.assessmentId===a.id).sort((x,y)=>y.createdAt-x.createdAt)[0];
  if (linked) return `<h2 class="sec">Plano alimentar desta consulta</h2>${miniCard(linked,{title:'Plano entregue'})}`;
  return `<h2 class="sec">Plano alimentar desta consulta</h2><button class="act-row dt-pt-empty" data-act="dtNew" data-pid="${a.profileId}" data-aid="${a.id}"><span class="chip-ico" style="background:var(--green)">${dtIcon('leaf','sm')}</span><span class="grow"><b>Importar a dieta desta consulta</b><span>PDF do WebDiet · fica ligada a esta avaliação</span></span>${ic('right','sm')}</button>`;
}
function homeCard(p){
  const cur = S ? dietsOf(p.id)[0] : null; if (!cur) return '';
  return `<div class="span2 span4-d">${miniCard(cur,{title:'Plano alimentar'})}</div>`;
}

return {
  views:{ diets:viewDiets, diet:viewDiet, dietNew:viewImport, dietEdit:viewImport },
  acts, ddPick, onFile, onInput, dragOver, dragLeave, drop,
  patientSection, assessmentSection, homeCard,
  prepare(route, param){ // chamado ao entrar na rota pela URL
    if (route==='dietEdit' && (!imp || imp.editingId!==param)) { if (!startEdit(param)) return 'diets'; }
    if (route==='dietNew' && (!imp || imp.editingId)) startImport(db().activeId);
    return route;
  },
  forgetPatient(pid){ S?.forgetPatient(pid); },
  unlinkAssessment(aid){ S?.unlinkAssessment(aid); },
  has: () => !!S,
  editing: () => imp?.phase==='review',
};
}
