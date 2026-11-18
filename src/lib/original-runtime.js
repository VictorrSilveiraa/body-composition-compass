import {num,fmt,today,toDate,fmtDate,ageAt,foldVal,calc,bmiClass,bfClass,whrRisk,PROTOCOLS,FOLDS,CIRC_TRUNK,CIRC_LIMBS,STEPS,METRICS,GROUPS,MET,esc,getPath,setPath,clone,initials,firstName} from "./calculos.js";
import {motivo} from "./motivo";
import {tick} from "./motion";
import {POSES,POSE_KEYS,poseLabel,poseSvg} from "./poses.js";
import {exportPdf} from "./report.js";
const FOLD_NAME=Object.fromEntries(FOLDS.map(f=>[f.k,f.l]));
export function mountOriginal(options){

/* =========================================================
   Avaliação Física — app estático (localStorage)
   ========================================================= */
const uid = () => crypto.randomUUID(); const DRAFT_KEY = 'avf.draft.'+options.userId;

/* ---------- ícones ---------- */
const I = {
  back:'<path d="M15 18l-6-6 6-6"/>',
  right:'<path d="M9 18l6-6-6-6"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  x:'<path d="M18 6 6 18M6 6l12 12"/>',
  home:'<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  cal:'<rect x="3" y="4.5" width="18" height="16.5" rx="4"/><path d="M8 2.5v4M16 2.5v4M3 10h18"/><circle cx="8" cy="14.5" r=".6" fill="currentColor"/><circle cx="12" cy="14.5" r=".6" fill="currentColor"/><circle cx="16" cy="14.5" r=".6" fill="currentColor"/>',
  chart:'<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.7c2.2.6 3.5 2.4 3.5 5.3"/>',
  scale:'<rect x="3" y="3" width="18" height="18" rx="6"/><path d="M8 10a5 5 0 0 1 8 0"/><path d="M12 10l1.5-2"/>',
  ruler:'<path d="M4 16 16 4l4 4L8 20z"/><path d="M8 12l2 2M11 9l1.5 1.5M14 6l2 2"/>',
  arm:'<path d="M5 20c0-6 2-9 5-10l2-5c1-2 4-1 3.5 1L14 10c4 0 6 3 5 6-1 3-5 4-9 4z"/>',
  pinch:'<path d="M7 3v5a5 5 0 0 0 10 0V3"/><path d="M4 21c2-3 5-4 8-4s6 1 8 4"/>',
  bolt:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  clip:'<rect x="5" y="4" width="14" height="17" rx="3"/><path d="M9 4V3h6v1M9 11h6M9 15h4"/>',
  edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  drop:'<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  flame:'<path d="M12 21a7 7 0 0 0 7-7c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-2 2-5 5-5 8a7 7 0 0 0 7 7z"/>',
  up:'<path d="M12 19V5M6 11l6-6 6 6"/>',
  down:'<path d="M12 5v14M6 13l6 6 6-6"/>',
  eq:'<path d="M6 10h12M6 14h12"/>',
  dl:'<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  ul:'<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
  table:'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 10h18M9 10v10"/>',
  print:'<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  swap:'<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  heart:'<path d="M12 20s-8-4.6-8-10.5A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 8 3.5C20 15.4 12 20 12 20z"/>',
  out:'<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M10 16l-4-4 4-4M6 12h10"/>',
  phone:'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  mail:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>',
  chat:'<path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z"/><path d="M9 10h6M9 13.5h4"/>',
  chev:'<path d="m6.5 9.5 5.5 5.5 5.5-5.5"/>',
  search:'<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  archive:'<rect x="3" y="4" width="18" height="5" rx="2"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4"/>',
  badge:'<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.6-1.4 1.7-2 3-2s2.4.6 3 2M14.5 10h3.5M14.5 13.5h3"/>',
  pin:'<path d="M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  sort:'<path d="M7 4v16M3.5 16.5 7 20l3.5-3.5M17 20V4M13.5 7.5 17 4l3.5 3.5"/>',
  steth:'<path d="M6 3v6a5 5 0 0 0 10 0V3"/><path d="M11 14v2a4 4 0 0 0 8 0v-2"/><circle cx="19" cy="12" r="2"/>',
  code:'<path d="M8.5 4C6.5 4 6 5 6 7v2.2c0 1.4-.8 2.3-2 2.8 1.2.5 2 1.4 2 2.8V17c0 2 .5 3 2.5 3M15.5 4c2 0 2.5 1 2.5 3v2.2c0 1.4.8 2.3 2 2.8-1.2.5-2 1.4-2 2.8V17c0 2-.5 3-2.5 3"/>',
  camera:'<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
  image:'<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  lock:'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
};
const ic = (n, cls='') => `<svg class="ico ${cls}" viewBox="0 0 24 24">${I[n]||''}</svg>`;

/* ---------- estado / storage ---------- */
let db = options.db;
let draft = loadDraft();
const state = { route:'home', param:null, step:0, editingId:null, evo:'weight', cmpA:null, cmpB:null, cmpTab:'evo', onlyFilled:true, pq:'', pf:'active', ps:'recent', dd:null, form:{}, setup:false };
let nutri = { returnDays:30, ...(options.nutri||{}) };
try { Object.assign(state,JSON.parse(sessionStorage.getItem('avf.view.'+options.userId)||'{}')); } catch {}

let draftTimer; let draftPending = Promise.resolve();
async function save(){ await options.save(db); }
function loadDraft(){
 const cloud = options.draft;
 try { const local=JSON.parse(localStorage.getItem(DRAFT_KEY)); if(local && (!cloud || local._savedAt > (cloud._savedAt||0))) return local; } catch {}
 return cloud;
}
function saveDraft(){
 const copy=draft ? {...draft,_step:state.step,_editing:state.editingId,_savedAt:Date.now()} : null;
 draft=copy;
 try { copy ? localStorage.setItem(DRAFT_KEY,JSON.stringify(copy)) : localStorage.removeItem(DRAFT_KEY); } catch {}
 clearTimeout(draftTimer);
 draftTimer=setTimeout(()=> { draftPending=draftPending.catch(()=>{}).then(()=>options.saveDraft(copy)).catch(()=>toast('Sem conexão. Rascunho guardado neste aparelho.')); },800);
}
const prof = () => db.profiles.find(p => p.id===db.activeId) || db.profiles[0];
const listOf = pid => db.assessments.filter(a => a.profileId===pid).sort((x,y)=> x.date===y.date ? (x.createdAt||0)-(y.createdAt||0) : x.date<y.date ? -1 : 1);
const findA = id => db.assessments.find(a => a.id===id);
function prevOf(a){ const l = listOf(a.profileId).filter(x=>x.id!==a.id && (x.date<a.date || (x.date===a.date && (x.createdAt||0)<(a.createdAt||Infinity)))); return l.at(-1) || null; }

/* ---------- nutricionista & pacientes ---------- */
const nutriName = () => (nutri.name||'').trim() || (options.email||'').split('@')[0] || 'Nutricionista';
// CRN exibido sempre como "CRN 3-12345", mesmo se a pessoa digitar o prefixo "CRN"
const crnLabel = () => { const c = (nutri.crn||'').trim().replace(/^crn[\s:-]*/i,''); return c ? 'CRN '+c : ''; };
const nutriSign = () => (nutri.name||'').trim() ? nutri.name.trim() + (crnLabel() ? ' · ' + crnLabel() : '') : '';
// primeiro acesso: antes do primeiro paciente, o nutricionista monta o próprio perfil (pode pular)
const SETUP_KEY = 'avf.setup.'+options.userId;
const setupSkipped = () => { try { return localStorage.getItem(SETUP_KEY)==='skip'; } catch { return false; } };
const needsSetup = () => !db.profiles.length && !(nutri.name||'').trim() && !setupSkipped();
// state.setup: está no fluxo de boas-vindas (perfil → primeiro paciente, que é opcional)
const inSetup = () => !db.profiles.length && (!!state.setup || needsSetup());
const setupSteps = n => `<ol class="setup-steps" aria-label="Primeiros passos">${['Seu perfil','Primeiro paciente'].map((l,i)=>{ const done = i+1<n && !!(nutri.name||'').trim(), back = i+1<n;
  const inner = `<span class="n">${done?ic('check','sm'):i+1}</span>${l}`;
  return `<li class="${i+1===n?'on':done?'done':''}"${i+1===n?' aria-current="step"':''}>${back?`<button type="button" data-act="go" data-to="nutri" aria-label="Voltar para ${l}">${inner}</button>`:inner}</li>`; }).join('')}</ol>`;
/* ---------- tour de apresentação (1º acesso; dá para rever pelo Perfil) ---------- */
const TOUR_KEY = 'avf.tour.'+options.userId;
let tourOn = false, tourTimer = 0;
const tourSeen = () => { if (nutri.tourSeen) return true; try { return localStorage.getItem(TOUR_KEY)==='1'; } catch { return false; } };
function tourSteps(){
  const has = db.profiles.length>0, nm = (nutri.name||'').trim() ? firstName(nutri.name) : '';
  return [
    {art:'hello', title: nm ? `Boas-vindas, ${nm}!` : 'Boas-vindas!', text:'Em menos de um minuto você conhece o essencial: onde ficam seus pacientes, como registrar uma avaliação e acompanhar a evolução.', cta:'Começar tour'},
    {sel:['.nav [data-to="patients"]'], icon:ic('users'), title:'Pacientes', text:'Sua lista de atendimento. Busque por nome ou telefone, filtre quem está com retorno atrasado e abra a ficha de cada um.'},
    has
      ? {sel:['.side-cta','.top-home [data-act="new"]','.cta-new'], icon:ic('plus'), title:'Nova avaliação', text:'Quando o paciente chegar, comece por aqui. Se precisar parar no meio, o rascunho fica salvo para continuar depois.'}
      : {sel:['.cta-first','.side-pt'], icon:ic('plus'), title:'Cadastre o primeiro paciente', text:'Tudo começa aqui. Nome, sexo, nascimento e altura bastam — contato, objetivo e retorno você completa quando quiser.'},
    {sel:['.nav [data-to="list"]'], icon:ic('clip'), title:'Avaliações', text:'Peso, circunferências e dobras cutâneas em 7 etapas, com o % de gordura calculado na hora. O histórico de cada paciente fica aqui.'},
    {sel:['.nav [data-to="compare"]'], icon:ic('chart'), title:'Evolução', text:'Gráficos de cada medida ao longo do tempo e comparativo lado a lado entre duas consultas. Tudo pode virar PDF para entregar.'},
    {sel:['.nav [data-to="profile"]'], icon:ic('user'), title:'Seu perfil', text:'Nome e CRN que assinam as avaliações, retorno padrão e backup dos dados. Quer rever este tour? Ele fica aqui também.'},
    has
      ? {art:'done', title:'Tudo pronto!', text:'Bom atendimento! Seus pacientes e avaliações estão a um toque de distância.', cta:'Começar a usar'}
      : {art:'done', title:'Tudo pronto!', text:'Que tal cadastrar seu primeiro paciente agora? Leva menos de um minuto.', cta:'Cadastrar paciente', alt:'Explorar sozinho', action:'newProfile'},
  ];
}
function startTour(){
  if (tourOn || !options.tour) return;
  clearTimeout(tourTimer); tourOn = true; state.dd = null;
  options.tour({ steps: tourSteps(), onClose: action => {
    tourOn = false;
    try { localStorage.setItem(TOUR_KEY,'1'); } catch {}
    if (!nutri.tourSeen){ nutri = {...nutri, tourSeen:true}; Promise.resolve(options.saveNutri?.(nutri)).catch(()=>{}); }
    if (action==='newProfile') go('onboard');
  }});
}
// abre sozinho na primeira visita ao painel (depois do perfil), com a tela já desenhada
function maybeTour(){
  if (tourOn || tourTimer || state.route!=='home' || inSetup() || tourSeen()) return;
  tourTimer = setTimeout(()=>{ tourTimer = 0; if (state.route==='home' && !tourSeen() && !document.querySelector('.scrim')) startTour(); }, 900);
}
const GOALS = [['emagrecimento','Emagrecimento'],['hipertrofia','Hipertrofia'],['saude','Saúde e bem-estar'],['performance','Performance esportiva'],['reeducacao','Reeducação alimentar'],['clinico','Acompanhamento clínico']];
const goalLabel = k => GOALS.find(g=>g[0]===k)?.[1] || '';
const RETURNS = [15,30,45,60,90];
const isoOf = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const addDays = (iso, n) => { const d = toDate(iso); d.setDate(d.getDate()+n); return isoOf(d); };
const daysTo = iso => Math.round((toDate(iso) - toDate(today())) / 864e5);
const returnEvery = p => num(p.returnDays) || num(nutri.returnDays) || 30;
const AV_COLORS = ['var(--peach)','var(--blue-2)','var(--green-2)','var(--yellow-2)','var(--pink)'];
const avColor = id => AV_COLORS[[...String(id)].reduce((s,c)=>s+c.charCodeAt(0),0) % AV_COLORS.length];
const plural = (n, one, many) => `${n} ${n===1?one:many}`;
const ago = iso => { const d = -daysTo(iso); return d<=0 ? 'hoje' : d===1 ? 'ontem' : d<31 ? `há ${d} dias` : d<365 ? `há ${Math.round(d/30)} ${Math.round(d/30)===1?'mês':'meses'}` : `há ${Math.round(d/365)} ${Math.round(d/365)===1?'ano':'anos'}`; };
// situação do paciente: arquivado, sem avaliação, retorno atrasado / próximo / em dia
function pStatus(p){
  const last = listOf(p.id).at(-1);
  if (p.archived) return {k:'arch', l:'Arquivado', cls:'muted'};
  if (!last) return {k:'none', l:'Sem avaliação', cls:'yellow'};
  const next = addDays(last.date, returnEvery(p)), left = daysTo(next);
  if (left < 0) return {k:'late', l:`Retorno atrasado ${-left} ${-left===1?'dia':'dias'}`, short:`Atrasado ${-left}d`, cls:'peach', next, left};
  if (left <= 7) return {k:'soon', l: left===0 ? 'Retorno hoje' : `Retorno em ${left} ${left===1?'dia':'dias'}`, short: left===0?'Hoje':`Em ${left}d`, cls:'blue', next, left};
  return {k:'ok', l:'Em dia', cls:'green', next, left};
}
function setActive(id){ if (db.activeId===id) return; db.activeId = id; state.cmpA = state.cmpB = null; try { localStorage.setItem('avf.active.'+options.userId, id); } catch {} }
function pAvatar(p, cls=''){ return `<span class="avatar ${cls}" style="background:${avColor(p.id)}">${esc(initials(p.name))}</span>`; }
function pMeta(p){ return [p.sex==='F'?'Feminino':'Masculino', ageAt(p.birth)!=null?ageAt(p.birth)+' anos':null, num(p.height)?fmt(num(p.height),0)+' cm':null].filter(Boolean).join(' · '); }
const phoneDigits = s => String(s||'').replace(/\D/g,'');
// telefone sempre no padrão (11) 98765-4321 — fixo com 8 dígitos: (11) 3456-7890
function fmtPhone(s){
  let d = phoneDigits(s); if (d.length>11 && d.startsWith('55')) d = d.slice(2); d = d.slice(0,11);
  if (!d) return ''; if (d.length<=2) return `(${d}`;
  const ddd = d.slice(0,2), r = d.slice(2); if (r.length<=4) return `(${ddd}) ${r}`;
  const cut = d.length===11 ? 5 : 4; return `(${ddd}) ${r.slice(0,cut)}${r.length>cut?'-'+r.slice(cut):''}`;
}
// menu suspenso no estilo do site (substitui o <select> do navegador). Valor e abertura vivem no state.
function dropdown(id, opts, value, {icon='', cls='', label=''}={}){
  const same = v => String(v)===String(value ?? '');
  const cur = opts.find(o=>same(o[0])) || opts[0], open = state.dd===id;
  return `<div class="dd ${cls} ${open?'open':''}">
    <button type="button" class="dd-btn" data-act="ddToggle" data-dd="${id}" aria-haspopup="listbox" aria-expanded="${open}"${label?` aria-label="${label}"`:''}>${icon?ic(icon,'sm'):''}<span class="dd-val">${esc(cur[1])}</span>${ic('chev','sm dd-chev')}</button>
    ${open?`<div class="dd-menu" role="listbox">${opts.map(([v,l,sub])=>`<button type="button" role="option" aria-selected="${same(v)}" class="dd-opt ${same(v)?'on':''}" data-act="ddPick" data-dd="${id}" data-v="${v}"><span class="grow">${esc(l)}${sub?`<small>${esc(sub)}</small>`:''}</span>${same(v)?ic('check','sm'):''}</button>`).join('')}</div>`:''}
  </div>`;
}
const DD_PICK = {
  psort: v => { state.ps = v; },
  goal: v => { state.form.goal = v; },
  ret: v => { state.form.ret = v; },
  nret: v => { state.form.nret = v; },
};
function initForm(route, param){
  if (route==='onboard'){ const p = param ? db.profiles.find(x=>x.id===param) : null; state.form = { goal:p?.goal||'', ret:num(p?.returnDays)?String(num(p.returnDays)):'' }; }
  if (route==='nutri') state.form = { nret:String(num(nutri.returnDays)||30) };
}
const waLink = s => { const d = phoneDigits(s); return d ? 'https://wa.me/' + (d.length<=11 ? '55'+d : d) : ''; };
function teamStats(){
  const act = db.profiles.filter(p=>!p.archived), st = act.map(pStatus);
  const since = addDays(today(), -30);
  return { total:db.profiles.length, active:act.length, late:st.filter(s=>s.k==='late').length, soon:st.filter(s=>s.k==='soon').length, none:st.filter(s=>s.k==='none').length, arch:db.profiles.length-act.length,
    month: db.assessments.filter(a=>a.date>=since && db.profiles.some(p=>p.id===a.profileId)).length, all: db.assessments.length };
}

/* ---------- componentes ---------- */
function deltaChip(cur, prev, dir=0, unit='', d=1){
  if (cur==null || prev==null) return '';
  const diff = cur - prev;
  if (Math.abs(diff) < Math.pow(10,-d)/2) return `<span class="delta flat">${ic('eq')} igual</span>`;
  const cls = dir===0 ? 'neu' : (diff*dir>0 ? 'good' : 'bad');
  return `<span class="delta ${cls}">${ic(diff>0?'up':'down')}${fmt(Math.abs(diff),d)}${unit?' '+unit:''}</span>`;
}
function smoothPath(P){
  if (P.length<2) return '';
  const f = p => p.map(n=>n.toFixed(1)).join(',');
  let d = `M${f(P[0])}`;
  for (let i=0;i<P.length-1;i++){
    const p0=P[i-1]||P[i], p1=P[i], p2=P[i+1], p3=P[i+2]||p2;
    const c1=[p1[0]+(p2[0]-p0[0])/6, p1[1]+(p2[1]-p0[1])/6], c2=[p2[0]-(p3[0]-p1[0])/6, p2[1]-(p3[1]-p1[1])/6];
    d += ` C${f(c1)} ${f(c2)} ${f(p2)}`;
  }
  return d;
}
function sparkline(vals, color='var(--blue-ink)'){
  const v = vals.filter(x=>x!=null);
  if (v.length<2) return '';
  const W=140,H=44; let mn=Math.min(...v), mx=Math.max(...v); if (mn===mx){mn-=1;mx+=1}
  const P = v.map((y,i)=>[4+i*(W-8)/(v.length-1), 6+(1-(y-mn)/(mx-mn))*(H-12)]);
  const L = P.at(-1);
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" style="width:100%;height:44px;margin-top:8px" preserveAspectRatio="none"><path d="${smoothPath(P)}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg><div style="position:relative;height:0"><span class="spark-dot" style="position:absolute;right:${(W-L[0])/W*100}%;bottom:${(H-L[1])/H*44 - 6}px;transform:translateX(50%);width:12px;height:12px;border-radius:50%;background:var(--green-2);box-shadow:0 0 0 3px var(--surface)"></span></div>`;
}
function lineChart(pts, {unit='', d=1, color='var(--ink)', fill='var(--blue)'}={}){
  if (!pts.length) return `<div class="empty"><p>Sem dados para esta medida ainda.</p></div>`;
  const W=400,H=220,pl=22,pr=22,pt=34,pb=34;
  const ys = pts.map(p=>p.y); let mn=Math.min(...ys), mx=Math.max(...ys);
  if (mn===mx){ mn-=1; mx+=1; } const pad=(mx-mn)*.18; mn-=pad; mx+=pad;
  const X = i => pts.length===1 ? W/2 : pl + i*(W-pl-pr)/(pts.length-1);
  const Y = v => pt + (1-(v-mn)/(mx-mn))*(H-pt-pb);
  const P = pts.map((p,i)=>[X(i),Y(p.y)]);
  const line = smoothPath(P);
  const area = line ? `${line} L${P.at(-1)[0]},${H-pb} L${P[0][0]},${H-pb} Z` : '';
  const many = pts.length > 8;
  const iMin = ys.indexOf(Math.min(...ys)), iMax = ys.indexOf(Math.max(...ys));
  const showLabel = i => !many || i===0 || i===pts.length-1 || i===iMin || i===iMax;
  const step = Math.ceil(pts.length/6);
  const gid = 'g'+Math.random().toString(36).slice(2,7);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${fill}" stop-opacity=".95"/><stop offset="1" stop-color="${fill}" stop-opacity="0"/></linearGradient></defs>
    ${[0,.5,1].map(t=>`<line x1="${pl}" x2="${W-pr}" y1="${pt+t*(H-pt-pb)}" y2="${pt+t*(H-pt-pb)}" stroke="var(--line)" stroke-dasharray="3 6"/>`).join('')}
    ${area?`<path d="${area}" fill="url(#${gid})"/>`:''}
    ${line?`<path d="${line}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>`:''}
    ${P.map((p,i)=>`
      <circle style="--i:${i}" cx="${p[0]}" cy="${p[1]}" r="${i===P.length-1?7:5}" fill="${i===P.length-1?'var(--yellow-2)':'var(--surface)'}" stroke="${color}" stroke-width="2.5"/>
      ${showLabel(i)?`<text class="pt-label" style="--i:${i}" x="${p[0]}" y="${p[1]-14}" text-anchor="middle" font-size="17" font-weight="600" fill="var(--ink)">${fmt(pts[i].y,d)}</text>`:''}
      ${(i%step===0 || i===P.length-1)?`<text x="${p[0]}" y="${H-8}" text-anchor="${i===0&&P.length>1?'start':i===P.length-1&&P.length>1?'end':'middle'}" font-size="14" fill="var(--muted)">${fmtDate(pts[i].date,{day:'2-digit',month:'short'}).replace(' de ',' ')}</text>`:''}
    `).join('')}
  </svg>`;
}
function ring(val, max, color='var(--peach)'){
  const size=150, sw=14, r=(size-sw)/2, C=2*Math.PI*r, arc=.75;
  const v = Math.max(0, Math.min(1, (val||0)/max));
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" style="transform:rotate(135deg)">
    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="var(--ring-track)" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${C*arc} ${C}"/>
    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${C*arc*v} ${C}" style="transition:stroke-dasharray .8s ease"/>
  </svg>`;
}
function topbar(p){
  return `<header class="top top-home">
    <button class="avatar" style="background:${avColor(p.id)}" data-act="go" data-to="patient" data-id="${p.id}" aria-label="Ficha de ${esc(p.name)}">${esc(initials(p.name))}</button>
    <button class="hello hello-pt" data-act="go" data-to="patients" aria-label="Trocar paciente"><small>Paciente</small><b>${esc(firstName(p.name))} ${ic('chev','sm')}</b></button>
    <div class="grow"></div>
    <span class="top-date">${fmtDate(today(),{weekday:'long',day:'numeric',month:'long'})}</span>
    <button class="icon-btn" data-act="go" data-to="patients" aria-label="Pacientes">${ic('users')}</button>
    <button class="icon-btn ${hasDraft()?'dot':''}" data-act="new" aria-label="Nova avaliação">${ic('plus')}</button>
  </header>`;
}
function dpill(iso, on){
  const d = toDate(iso);
  return `<div class="dpill ${on?'on':''}"><small>${d.toLocaleDateString('pt-BR',{month:'short'}).replace('.','')}</small><b>${String(d.getDate()).padStart(2,'0')}</b><small>${String(d.getFullYear()).slice(2)}</small></div>`;
}
function aItem(a, p, on){
  const r = calc(a,p), pv = prevOf(a), rp = pv ? calc(pv,p) : null;
  return `<button class="aitem" data-act="go" data-to="detail" data-id="${a.id}">
    ${dpill(a.date, on)}
    <div class="info">
      <b>${fmtDate(a.date,{weekday:'long',day:'numeric',month:'long'})}</b>
      <div class="stats">
        <span><em>${fmt(num(a.weight))}</em> kg</span>
        ${r.bf!=null?`<span><em>${fmt(r.bf)}</em>% gordura</span>`:''}
        ${pv?deltaChip(num(a.weight), num(pv.weight), 0, 'kg'):''}
      </div>
    </div>
    ${ic('right','sm')}
  </button>`;
}
const hasDraft = () => !!draft;

/* =========================================================
   FOTOS DE ACOMPANHAMENTO (frente, costas e laterais)
   ========================================================= */
const PH = options.photos || null;
let phTick = 0;
const phFail = new Set();
function phRefresh(){ if (phTick) return; phTick = setTimeout(()=>{ phTick = 0; render(); }, 40); }
const phOf = aid => (PH && aid) ? PH.of(aid) : [];
const phGet = (aid, pose) => (PH && aid) ? PH.get(aid, pose) : null;
function phSync(){ if (PH) PH.sync(new Set(db.assessments.map(a=>a.id))).catch(()=>{}); }
// avaliação do rascunho: id real (editando) ou um id provisório que vira o id da avaliação ao salvar
function draftAid(){ if (!draft) return null; if (state.editingId) return state.editingId; if (!draft.tid) draft.tid = uid(); return draft.tid; }
const aidOwner = aid => findA(aid) || (draft && draftAid()===aid ? draft : null);
function phImg(m, alt=''){
  if (!m) return '';
  const u = PH.cachedUrl(m.id);
  if (u) return `<img src="${u}" alt="${esc(alt)}" draggable="false">`;
  if (phFail.has(m.id)) return `<span class="ph-load fail">${ic('image')}</span>`;
  PH.url(m).then(x=>{ if (!x) phFail.add(m.id); phRefresh(); }).catch(()=>{ phFail.add(m.id); phRefresh(); });
  return `<span class="ph-load"></span>`;
}
const shortDate = d => fmtDate(d,{day:'2-digit',month:'2-digit',year:'2-digit'});
const slugOf = s => (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'paciente';

async function openCamera(aid, start, pickFile=false){
  if (!PH) return toast('Fotos indisponíveis neste navegador');
  const a = aidOwner(aid); if (!a) return;
  const p = db.profiles.find(x=>x.id===a.profileId); if (!p) return;
  const existing = {}, ghosts = {}; let ghostLabel = '';
  for (const m of phOf(aid)) existing[m.pose] = await PH.url(m);
  // guia "foto anterior": a consulta mais recente antes desta que tenha cada pose
  const prevs = listOf(p.id).filter(x=>x.id!==aid && x.date<=a.date).reverse();
  for (const k of POSE_KEYS){ for (const x of prevs){ const m = phGet(x.id,k); if (m){ const u = await PH.url(m); if (u){ ghosts[k] = u; ghostLabel ||= 'Consulta de '+shortDate(x.date); } break; } } }
  options.camera({ title: p.name, subtitle: fmtDate(a.date,{day:'2-digit',month:'short',year:'numeric'}), poses: POSE_KEYS,
    start: start || POSE_KEYS.find(k=>!existing[k]) || 'front', existing, ghosts, ghostLabel, pickFile,
    onPhoto: async (pose, blob, w, h) => {
      await PH.add({assessmentId:aid, profileId:p.id, pose}, blob, w, h);
      if (draft && draftAid()===aid) saveDraft();
      phSync(); render();
    },
    onClose: () => render() });
}
function openViewer(aid, pose){
  const a = aidOwner(aid); if (!a || !PH) return;
  const p = db.profiles.find(x=>x.id===a.profileId);
  const ms = POSE_KEYS.map(k=>phGet(aid,k)).filter(Boolean);
  if (!ms.length) return;
  options.viewer({
    items: ms.map(m=>({ id:m.id, pose:m.pose, title:poseLabel(m.pose), sub:`${p?.name||''} · ${fmtDate(a.date,{day:'numeric',month:'short',year:'numeric'})}`, url:()=>PH.url(m) })),
    index: Math.max(0, ms.findIndex(m=>m.pose===pose)),
    onRetake: it => setTimeout(()=>openCamera(aid, it.pose), 240),
    onDownload: async it => { const m = ms.find(x=>x.id===it.id); const b = m && await PH.blob(m); if (b) download(`${slugOf(p?.name)}-${slugOf(poseLabel(m.pose))}-${a.date}.jpg`, b, 'image/jpeg'); else toast('Não foi possível baixar a foto'); },
    onDelete: async it => { await PH.remove(it.id); render(); toast('Foto excluída'); },
    onClose: () => render() });
}
// quatro espaços (frente, costas, lados): foto, ou silhueta pronta para fotografar
function phSlots(aid, cls=''){
  return `<div class="ph-slots ${cls}">${POSES.map(P=>{ const m = phGet(aid,P.k); return m
    ? `<button class="ph-slot has" data-act="phView" data-aid="${aid}" data-pose="${P.k}" aria-label="Ver foto: ${P.l}">${phImg(m,P.l)}<span class="ph-lbl">${P.l}</span></button>`
    : `<button class="ph-slot" data-act="phCam" data-aid="${aid}" data-pose="${P.k}" aria-label="Fotografar: ${P.l}">${poseSvg(P.k,{guides:true})}<span class="ph-lbl">${ic('plus','sm')}${P.l}</span></button>`; }).join('')}</div>`;
}
const phNote = () => `<p class="ph-note">${ic('lock','sm')}<span>As fotos são privadas e só aparecem para você. Peça a autorização do paciente antes de fotografar.${PH && !PH.cloud ? ' <b>Por enquanto, ficam salvas neste aparelho.</b>' : ''}</span></p>`;
const phTips = () => `<details class="ph-tips"><summary>${ic('target','sm')}<span>Dicas para fotos comparáveis</span>${ic('chev','sm')}</summary><ol>
  <li><b>Mesmo lugar e luz:</b> fundo liso, luz de frente, sem contraluz.</li>
  <li><b>Mesma distância:</b> celular reto, na altura do umbigo, a uns 2,5 m — sem zoom.</li>
  <li><b>Roupa justa ou de banho</b> e cabelo preso, para ver o contorno do corpo.</li>
  <li><b>Mesma condição:</b> de preferência no mesmo horário e em jejum.</li>
  <li><b>Use o guia “Foto anterior”</b> na câmera para repetir o enquadramento da última consulta.</li></ol></details>`;
// bloco de fotos na página da avaliação
function phSection(a){
  if (!PH) return '';
  const n = phOf(a.id).length;
  const prevWith = listOf(a.profileId).filter(x=>x.id!==a.id && x.date<=a.date && phOf(x.id).length).at(-1);
  return `<section class="ph-sec no-print">
    <h2 class="sec">Fotos <span class="sec-note">${n ? `${n} de 4` : 'opcional'}</span><span class="grow"></span>
      ${n && prevWith ? `<button class="sec-btn" data-act="phCompare" data-a="${prevWith.id}" data-b="${a.id}">${ic('swap','sm')}<span>Comparar com ${shortDate(prevWith.date)}</span></button>` : ''}
      <button class="sec-btn dark" data-act="phCam" data-aid="${a.id}">${ic('camera','sm')}<span>${n ? (n<4 ? 'Completar' : 'Câmera') : 'Fotografar'}</span></button></h2>
    ${phSlots(a.id)}
    ${n ? '' : `<p class="ph-empty-hint">Toque numa pose para abrir a câmera com a silhueta-guia, ou <button data-act="phCam" data-aid="${a.id}" data-file="1">escolha da galeria</button>.</p>`}
  </section>`;
}
// aba "Fotos" da Evolução: lado a lado, deslizar (antes/depois) e sobrepor
function viewPhotoCompare(p, list){
  const name = firstName(p.name);
  const withPh = list.filter(a=>phOf(a.id).length);
  if (!PH) return `<div class="card empty"><h3>Fotos indisponíveis</h3><p>Este navegador não permite guardar fotos.</p></div>`;
  if (!withPh.length) return `<div class="card blue empty ph-empty">${poseSvg('front',{guides:true,cls:'e-sil'})}<h3>Nenhuma foto ainda</h3>
    <p>Fotografe ${esc(name)} com a câmera guiada: a silhueta e a foto anterior ajudam a repetir o mesmo enquadramento em cada consulta.</p>
    <button class="btn dark" style="margin:18px auto 0;display:inline-flex" data-act="phCam" data-aid="${list.at(-1).id}">${ic('camera','sm')} Fotografar na última avaliação</button></div>`;
  const poses = POSES.filter(P=>list.some(a=>phGet(a.id,P.k)));
  if (!poses.some(P=>P.k===state.phPose)) state.phPose = poses[0].k;
  const k = state.phPose, dated = list.filter(a=>phGet(a.id,k));
  if (!dated.some(a=>a.id===state.phA)) state.phA = dated[0].id;
  if (!dated.some(a=>a.id===state.phB) || (dated.length>1 && state.phB===state.phA)) state.phB = dated.at(-1).id;
  const chips = `<div class="chips ph-poses" role="tablist" aria-label="Pose">${poses.map(P=>`<button class="chip ${P.k===k?'on':''}" role="tab" aria-selected="${P.k===k}" data-act="phPose" data-v="${P.k}">${P.l}<span class="n">${list.filter(a=>phGet(a.id,P.k)).length}</span></button>`).join('')}</div>`;
  const cap = (a, tag) => { const r = calc(a,p); return `<span class="phc-cap"><b>${tag}</b><span>${fmtDate(a.date,{day:'2-digit',month:'short',year:'numeric'})}</span><small>${fmt(num(a.weight))} kg${r.bf!=null?` · ${fmt(r.bf)}% gordura`:''}</small></span>`; };
  if (dated.length < 2){
    const a = dated[0], last = list.at(-1);
    return chips + `<div class="phc-one">
      <figure class="phc-fig" data-act="phView" data-aid="${a.id}" data-pose="${k}">${phImg(phGet(a.id,k), poseLabel(k))}${cap(a,'Única foto')}</figure>
      <div class="phc-one-txt"><h3>Falta só mais uma</h3><p>Com uma segunda consulta fotografada na pose <b>${poseLabel(k).toLowerCase()}</b>, você compara o antes e depois lado a lado, deslizando ou sobrepondo as fotos.</p>
      ${last.id!==a.id ? `<button class="btn dark sm" data-act="phCam" data-aid="${last.id}" data-pose="${k}">${ic('camera','sm')} Fotografar em ${shortDate(last.date)}</button>` : ''}</div></div>`;
  }
  const A = findA(state.phA), B = findA(state.phB), mA = phGet(A.id,k), mB = phGet(B.id,k), rA = calc(A,p), rB = calc(B,p);
  const mode = state.phMode || 'side', x = state.phX ?? 50, o = state.phO ?? 50;
  const opts = sel => dated.slice().reverse().map(a=>`<option value="${a.id}" ${a.id===sel?'selected':''}>${shortDate(a.date)}</option>`).join('');
  const days = Math.round((toDate(B.date)-toDate(A.date))/864e5);
  const stats = [['Peso',num(B.weight),num(A.weight),0,'kg'],['Gordura',rB.bf,rA.bf,-1,'pp'],['Massa magra',rB.leanMass,rA.leanMass,1,'kg'],['Cintura',num(B.circ?.waist),num(A.circ?.waist),-1,'cm']].filter(s=>s[1]!=null&&s[2]!=null);
  const daysTxt = days===0 ? 'Fotos do mesmo dia' : `${Math.abs(days)} ${Math.abs(days)===1?'dia':'dias'} entre as fotos`;
  // computador: comparação à esquerda, painel (datas, variação, todas as fotos) à direita; celular: tudo empilhado
  let h = chips + `<div class="ph-layout"><div class="ph-main">
    <div class="ph-bar">
      <div class="seg ph-modes" role="tablist" aria-label="Modo de comparação">${[['side','Lado a lado'],['wipe','Deslizar'],['fade','Sobrepor']].map(([v,l])=>`<button role="tab" aria-selected="${mode===v}" class="${mode===v?'on':''}" data-act="phMode" data-v="${v}">${l}</button>`).join('')}</div>
      <button class="btn ghost sm ph-share" data-act="phShare" aria-label="Baixar imagem do antes e depois">${ic('dl','sm')}<span>Baixar imagem</span></button>
    </div>
    <div class="phc phc-${mode}" style="--x:${x}%;--o:${o/100}">`;
  if (mode==='side') h += `<figure class="phc-fig" data-act="phView" data-aid="${A.id}" data-pose="${k}">${phImg(mA,'Antes')}${cap(A,'Antes')}</figure>
      <figure class="phc-fig" data-act="phView" data-aid="${B.id}" data-pose="${k}">${phImg(mB,'Depois')}${cap(B,'Depois')}</figure>`;
  else h += `<div class="phc-stage" tabindex="0" role="slider" aria-label="${mode==='wipe'?'Deslize para comparar antes e depois':'Arraste para sobrepor as fotos'}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${mode==='wipe'?x:o}">
        <div class="phc-a">${phImg(mA,'Antes')}</div><div class="phc-b">${phImg(mB,'Depois')}</div>
        ${mode==='wipe' ? `<span class="phc-handle"><i>${ic('swap','sm')}</i></span>` : `<span class="phc-fader"><i></i></span>`}
        <span class="phc-tag l">Antes · ${shortDate(A.date)}</span><span class="phc-tag r">Depois · ${shortDate(B.date)}</span>
      </div>`;
  h += `</div>
    <p class="small muted ph-days">${daysTxt}${mode!=='side' ? ` · ${mode==='wipe' ? 'arraste sobre a foto para deslizar' : 'arraste para a direita para mostrar a mais recente'}` : ''}</p>
  </div>
  <aside class="ph-aside">
    <div class="cmp-pick">
      <label class="sel a"><small>Antes (A)</small><select data-ch="phA">${opts(A.id)}</select></label>
      <button class="vs" data-act="phSwap" aria-label="Inverter">${ic('swap','sm')}</button>
      <label class="sel b"><small>Depois (B)</small><select data-ch="phB">${opts(B.id)}</select></label>
    </div>
    ${stats.length ? `<div class="ph-stats">${stats.map(([l,b,a,dir,u])=>`<div class="stat"><small>${l}</small>${deltaChip(b,a,dir,u)}</div>`).join('')}</div>` : ''}
    <div class="ph-all">
      <h3 class="ph-all-h">Todas as fotos · ${poseLabel(k)}<span>${plural(dated.length,'foto','fotos')}</span></h3>
      <div class="ph-strip">${dated.slice().reverse().map(a=>`<button class="ph-th ${a.id===A.id?'is-a':''} ${a.id===B.id?'is-b':''}" data-act="phView" data-aid="${a.id}" data-pose="${k}" aria-label="Ver foto de ${shortDate(a.date)}"><span class="ph-th-img">${phImg(phGet(a.id,k), shortDate(a.date))}${a.id===A.id?'<em>A</em>':a.id===B.id?'<em class="b">B</em>':''}</span><span class="ph-th-d">${shortDate(a.date)}</span></button>`).join('')}</div>
    </div>
  </aside></div>`;
  return h;
}

/* =========================================================
   VIEWS
   ========================================================= */
function viewOnboard(editP){
  const p = editP || {name:'',sex:'',birth:'',height:''};
  const isNew = !editP;
  const back = editP ? `data-to="patient" data-id="${editP.id}"` : 'data-to="patients"';
  // boas-vindas: o primeiro paciente é opcional — "Fazer depois" leva ao painel vazio, pronto para quando houver paciente
  const setup = isNew && inSetup(), nm = (nutri.name||'').trim();
  return `
  ${!setup ? `<header class="top"><button class="icon-btn" data-act="go" ${back} aria-label="Voltar">${ic('back')}</button><div class="title-block"><small>Pacientes</small><b>${isNew?(db.profiles.length?'Novo paciente':'Primeiro paciente'):'Editar paciente'}</b></div></header>` : ''}
  ${setup ? `${setupSteps(2)}<div class="onb-hero"><div class="blob"></div><div class="blob b2"></div>
    <div style="position:relative"><span class="tag" style="margin-bottom:14px">${ic('users','sm')} Primeiro paciente · opcional</span>
    <h1>${nm ? `Perfil pronto, ${esc(firstName(nm))}!` : 'Sua conta está pronta!'}</h1>
    <p>Já tem alguém para avaliar? Cadastre agora. Se ainda não, toque em <b>Fazer depois</b> — seu painel fica pronto para quando o primeiro paciente chegar.</p></div></div>` : ''}
  <h2 class="sec" style="margin-top:6px">${isNew?'Dados do paciente':'Dados pessoais'}</h2>
  <div class="form-grid">
    <label class="field"><div class="f-top"><span class="f-label">Nome</span></div>
      <div class="f-input text"><input id="pf-name" value="${esc(p.name)}" placeholder="Nome completo" autocomplete="off"></div></label>
    <div class="field"><div class="f-top"><span class="f-label">Sexo biológico</span></div>
      <span class="f-hint">Usado nas equações de composição corporal.</span>
      <div class="seg full" style="margin-top:10px" id="pf-sex">
        <button type="button" data-act="pfsex" data-v="F" class="${p.sex==='F'?'on':''}">Feminino</button>
        <button type="button" data-act="pfsex" data-v="M" class="${p.sex==='M'?'on':''}">Masculino</button>
      </div></div>
    <div class="fields two">
      <label class="field"><div class="f-top"><span class="f-label">Nascimento</span></div>
        <div class="f-input text"><input id="pf-birth" type="date" value="${esc(p.birth)}" max="${today()}"></div></label>
      <label class="field"><div class="f-top"><span class="f-label">Altura</span></div>
        <div class="f-input"><input id="pf-height" inputmode="decimal" value="${esc(p.height??'')}" placeholder="170"><em>cm</em></div></label>
    </div>
  </div>

  <h2 class="sec">Contato <span class="sec-note">opcional</span></h2>
  <div class="fields two">
    <label class="field"><div class="f-top"><span class="f-label">Telefone / WhatsApp</span></div>
      <div class="f-input text"><input id="pf-phone" type="tel" inputmode="tel" data-mask="phone" maxlength="15" value="${esc(fmtPhone(p.phone))}" placeholder="(11) 99999-9999" autocomplete="off"></div></label>
    <label class="field"><div class="f-top"><span class="f-label">E-mail</span></div>
      <div class="f-input text"><input id="pf-email" type="email" inputmode="email" value="${esc(p.email||'')}" placeholder="paciente@email.com" autocomplete="off"></div></label>
  </div>

  <h2 class="sec">Acompanhamento</h2>
  <div class="form-grid">
    <div class="fields two">
      <div class="field"><div class="f-top"><span class="f-label">Objetivo</span></div>
        ${dropdown('goal', [['','Não definido'], ...GOALS], state.form.goal, {label:'Objetivo do paciente'})}</div>
      <div class="field"><div class="f-top"><span class="f-label">Retorno a cada</span></div>
        ${dropdown('ret', [['',`Padrão do perfil · ${num(nutri.returnDays)||30} dias`,'Usa o retorno definido no seu perfil'], ...RETURNS.map(d=>[String(d),`${d} dias`])], state.form.ret, {label:'Intervalo de retorno'})}</div>
    </div>
    <p class="f-hint" style="margin:-2px 6px 0">O retorno define quando a próxima avaliação aparece como “atrasada” na lista de pacientes.</p>
    <label class="field"><div class="f-top"><span class="f-label">Observações</span><span class="f-prev">só você vê</span></div>
      <span class="f-hint">Histórico clínico, restrições, rotina de treino, medicamentos…</span>
      <div class="f-input"><textarea id="pf-notes" placeholder="Anotações sobre o paciente">${esc(p.notes||'')}</textarea></div></label>
  </div>
  ${options.fichaCloud ? '' : `<p class="small muted" style="margin:12px 4px 0">Contato, objetivo e observações ficam salvos neste aparelho até o banco de dados receber os novos campos.</p>`}
  ${setup ? `<p class="small muted" style="text-align:center;margin-top:22px">Já usava o sistema em outra conta? Traga seus pacientes de um backup.</p>
  <button class="btn ghost sm" style="margin:12px auto 0;display:flex" data-act="import">${ic('ul','sm')} Restaurar backup</button>` : ''}
  ${setup
    ? formBar('data-v="1"', `data-act="saveProfile" data-id=""`, 'Cadastrar paciente', 'Fazer depois', 'setupLater')
    : formBar(back, `data-act="saveProfile" data-id="${editP?editP.id:''}"`, isNew ? 'Cadastrar paciente' : 'Salvar alterações')}`;
}
// barra de ações dos formulários: fixa no rodapé (celular) / pílula flutuante (computador) — sempre à mão
function formBar(cancelAttrs, saveAttrs, saveLabel, cancelLabel='Cancelar', cancelAct='go'){
  return `<div class="wiz-bar form-bar"><div class="in">
    ${cancelAttrs ? `<button class="btn ghost" data-act="${cancelAct}" ${cancelAttrs}>${cancelLabel}</button>` : ''}
    <button class="btn dark" ${saveAttrs}>${ic('check')} ${saveLabel}</button>
  </div></div>`;
}

/* ---------- PAINEL SEM PACIENTES (conta nova) ---------- */
function nutriTopbar(){
  return `<header class="top top-home">
    <button class="avatar" style="background:var(--yellow-2)" data-act="go" data-to="profile" aria-label="Seu perfil">${esc(initials(nutriName()))}</button>
    <button class="hello" data-act="go" data-to="profile"><small>Olá,</small><b>${esc(firstName(nutriName()))}</b></button>
    <div class="grow"></div>
    <span class="top-date">${fmtDate(today(),{weekday:'long',day:'numeric',month:'long'})}</span>
    <button class="icon-btn" data-act="newProfile" aria-label="Cadastrar paciente">${ic('plus')}</button>
  </header>`;
}
function viewWelcome(){
  const hasName = !!(nutri.name||'').trim();
  const step = (done, icn, title, sub, act='') => `<div class="check-row"><span class="ok ${done?'yes':''}">${ic(done?'check':icn,'sm')}</span><span class="grow"><b>${title}</b><span class="small muted">${sub}</span></span>${act}</div>`;
  const feats = [
    ['blue','users','Pacientes organizados','Busca, filtros e alerta de retorno atrasado.'],
    ['yellow','clip','Avaliação guiada','Peso, circunferências e dobras em 7 etapas.'],
    ['green','chart','Evolução clara','Gráficos e comparativo entre consultas.'],
    ['','print','Relatórios em PDF','Prontos para entregar ao paciente.']];
  return `${nutriTopbar()}
  <h1 class="headline">${hasName ? `${esc(firstName(nutriName()))}, seu espaço de atendimento está pronto.` : 'Seu espaço de atendimento está pronto.'}</h1>
  <div class="card white welcome-card">
    <div class="card-head"><span class="chip-ico" style="background:var(--yellow-2)">${ic('target','sm')}</span><span class="label"><b>Primeiros passos</b><br><span class="small muted">${hasName?1:0} de 3 concluídos</span></span><button class="tag right" style="margin-left:auto" data-act="tour">${ic('target','sm')} Como funciona</button></div>
    <div class="check-list">
      ${step(hasName,'badge','Perfil profissional', hasName ? `${esc(nutriSign())}` : 'Nome e CRN nas avaliações e nos PDFs', hasName ? '' : `<button data-act="go" data-to="nutri">Completar</button>`)}
      ${step(false,'users','Cadastrar o primeiro paciente','Dados, contato, objetivo e retorno', `<button data-act="newProfile">Cadastrar</button>`)}
      ${step(false,'clip','Registrar a primeira avaliação','Liberado depois de cadastrar um paciente')}
    </div>
  </div>
  <button class="cta cta-new cta-first" data-act="newProfile"><span class="c-ico">${ic('users')}</span><span>Cadastrar primeiro paciente <span class="arrows">›››</span></span><span class="c-ico">${ic('plus')}</span></button>
  <h2 class="sec">O que você pode fazer aqui</h2>
  <div class="dash">${feats.map(([c,i,t,d])=>`<div class="card ${c}"><div class="card-head"><span class="chip-ico">${ic(i,'sm')}</span><span class="label">${t}</span></div><span class="small">${d}</span></div>`).join('')}</div>
  <p class="small muted" style="text-align:center;margin-top:22px">Já usava o sistema em outra conta?</p>
  <button class="btn ghost sm" style="margin:10px auto 0;display:flex" data-act="import">${ic('ul','sm')} Restaurar backup</button>`;
}
// telas que dependem de um paciente, abertas antes do primeiro cadastro
function viewNoPatient(route){
  const M = {
    list:['Avaliações','cal','As avaliações aparecem aqui','Cadastre um paciente e registre a primeira avaliação: o histórico fica organizado da mais recente para a mais antiga.'],
    compare:['Evolução','chart','A evolução começa na primeira avaliação','Com um paciente cadastrado e avaliado, você acompanha peso, gordura e medidas em gráficos e compara consultas.'],
  }[route] || ['Pacientes','users','Nenhum paciente cadastrado','Cadastre quem você atende para registrar avaliações, acompanhar retornos e gerar relatórios.'];
  return `<header class="top"><button class="icon-btn" data-act="go" data-to="home" aria-label="Início">${ic('back')}</button>
    <div class="title-block"><small>${esc(nutriName())}</small><b>${M[0]}</b></div></header>
  <div class="card blue empty"><div class="e-ico">${ic(M[1])}</div><h3>${M[2]}</h3><p>${M[3]}</p>
    <button class="btn dark" style="margin:18px auto 0;display:inline-flex" data-act="newProfile">${ic('plus','sm')} Cadastrar paciente</button></div>`;
}

function viewHome(){
  if (!db.profiles.length) return viewWelcome();
  const p = prof(), list = listOf(p.id);
  let h = topbar(p);
  if (hasDraft()) h += `<button class="draft-banner" data-act="resume">${ic('edit')}<span class="grow">Avaliação de ${esc(firstName((db.profiles.find(x=>x.id===draft.profileId)||p).name))} ${draft._editing?'em edição':'em andamento'} — ${fmtDate(draft.date)}</span><b>Continuar</b></button>`;
  if (!list.length){
    h += `<h1 class="headline">Vamos registrar a primeira avaliação de ${esc(firstName(p.name))}.</h1>
    <div class="card blue empty"><div class="e-ico">${ic('clip')}</div><h3>Nenhuma avaliação ainda</h3>
    <p>Em poucos passos você registra peso, circunferências e dobras cutâneas. Depois é só comparar.</p></div>
    <div class="dash" style="margin-top:12px">
      ${STEPS.slice(1,5).map(s=>`<div class="card ${s.c}"><div class="card-head"><span class="chip-ico">${ic(s.i)}</span><span class="label">${s.l}</span></div><span class="small">${s.d}</span></div>`).join('')}
    </div>
    ${ctaNew()}`;
    return h;
  }
  const last = list.at(-1), prev = list.at(-2), r = calc(last,p), rp = prev ? calc(prev,p) : null;
  const improving = rp && r.bf!=null && rp.bf!=null && r.bf < rp.bf;
  const head = improving ? `A evolução de ${firstName(p.name)} está ficando ótima!` : list.length>1 ? `Painel de ${firstName(p.name)} em dia.` : `Primeira avaliação de ${firstName(p.name)} registrada!`;
  const weights = list.map(a=>num(a.weight));
  const c = last.circ || {};
  const pills = [['Braço',avgLR(c,'biceps')??avgLR(c,'arm')],['Cintura',num(c.waist)],['Abdôm.',num(c.abdomen)],['Quadril',num(c.hip)],['Coxa',avgLR(c,'thighm')??avgLR(c,'thighp')],['Pantur.',avgLR(c,'calf')]].filter(x=>x[1]!=null);
  const pmax = Math.max(...pills.map(x=>x[1]), 1);

  h += `<h1 class="headline">${esc(head)}</h1>
  <div class="dash">
    <div class="card blue span2 span2-d hero" data-act="go" data-to="detail" data-id="${last.id}" style="cursor:pointer">
      <div class="left">
        <div class="card-head"><span class="chip-ico">${ic(r.bf!=null?'flame':'scale')}</span><span class="label">${r.bf!=null?'Gordura corporal':'Peso atual'}</span></div>
        <div>
          <div class="big xl">${r.bf!=null?fmt(r.bf):fmt(num(last.weight))}<small>${r.bf!=null?'%':'kg'}</small></div>
          <div class="sub">${r.bf!=null ? `${esc(bfClass(r.bf,p.sex))} ${rp?deltaChip(r.bf,rp.bf,-1,'pp'):''}` : esc(bmiClass(r.bmi))}</div>
        </div>
        <div class="sub small">${ic('cal','sm')} ${fmtDate(last.date,{day:'numeric',month:'long',year:'numeric'})}</div>
      </div>
      <div class="ring-wrap">${ring(r.bf!=null?r.bf:r.bmi, r.bf!=null?40:40)}<div class="center"><div class="inner"><b>${r.leanMass?fmt(r.leanMass):fmt(r.bmi)}</b><span>${r.leanMass?'kg magra':'IMC'}</span></div></div></div>
    </div>

    <div class="card" data-act="evo" data-m="weight" style="cursor:pointer">
      <div class="card-head"><span class="label">Peso<br>atual</span><span class="chip-ico right">${ic('scale','sm')}</span></div>
      <div class="mid">${fmt(num(last.weight))}<small>kg</small></div>
      ${prev?`<div class="sub">${deltaChip(num(last.weight),num(prev.weight),0,'kg')}</div>`:''}
      ${sparkline(weights)}
    </div>
    <div class="card green" data-act="evo" data-m="leanMass" style="cursor:pointer">
      <div class="card-head"><span class="label">Massa<br>magra</span><span class="chip-ico right">${ic('bolt','sm')}</span></div>
      <div class="mid">${fmt(r.leanMass)}<small>kg</small></div>
      ${rp?`<div class="sub">${deltaChip(r.leanMass,rp.leanMass,1,'kg')}</div>`:''}
      ${sparkline(list.map(a=>calc(a,p).leanMass),'var(--green-ink)')}
    </div>

    <div class="card yellow span2 span2-d">
      <div class="card-head"><span class="label">Composição corporal</span><span class="tag right" style="margin-left:auto">${esc(r.bfSource||'—')}</span></div>
      ${r.fatMass!=null ? `
      <div class="combar"><span style="width:${100-r.bf}%;background:var(--green-2)"></span><span style="width:${r.bf}%;background:var(--peach)"></span></div>
      <div class="legend"><span><i style="background:var(--green-2)"></i>Magra <b>${fmt(r.leanMass)} kg</b></span><span><i style="background:var(--peach)"></i>Gorda <b>${fmt(r.fatMass)} kg</b></span></div>
      ` : `<p class="small" style="margin-top:6px">Preencha as dobras do protocolo (ou % da bioimpedância) para ver a composição.</p>`}
      <div class="dash" style="margin-top:14px;grid-template-columns:repeat(3,1fr);gap:8px">
        <div class="stat"><small>IMC</small><b>${fmt(r.bmi)}</b></div>
        <div class="stat"><small>RCQ</small><b>${fmt(r.whr,2)}</b></div>
        <div class="stat"><small>TMB</small><b>${fmt(r.bmr,0)}</b></div>
      </div>
    </div>

    ${pills.length ? `<div class="card span2 span2-d">
      <div class="card-head"><span class="label">Medidas (cm)</span><button class="tag right" style="margin-left:auto" data-act="go" data-to="detail" data-id="${last.id}">Ver todas</button></div>
      <div class="pills" style="grid-template-columns:repeat(${pills.length},1fr)">
        ${pills.map(([l,v])=>{ const pc = 26 + 48*(v/pmax); /* teto 74%: a bolinha (e o anel verde) cabe inteira no tubo */ return `<div class="pill"><div class="tube"><div class="fill" style="height:${pc}%"></div><div class="val" style="bottom:${pc}%">${fmt(v,v>=100?0:1)}</div></div><small>${l}</small></div>`; }).join('')}
      </div></div>` : ''}

    ${list.length>1 ? `<div class="card white span2 span4-d" data-act="go" data-to="compare" style="cursor:pointer">
      <div class="card-head"><span class="chip-ico" style="background:var(--blue)">${ic('swap','sm')}</span><span class="label"><b>Comparar avaliações</b><br><span class="small muted">${fmtDate(prev.date)} → ${fmtDate(last.date)}</span></span><span class="right" style="margin-left:auto">${ic('right')}</span></div>
      <div class="dash" style="grid-template-columns:repeat(3,1fr);gap:8px">
        ${[['Peso',num(last.weight),num(prev.weight),0,'kg'],['Gordura',r.bf,rp.bf,-1,'pp'],['Cintura',num(c.waist),num(prev.circ?.waist),-1,'cm']].map(([l,a,b,dir,u])=>`<div class="stat" style="background:var(--card)"><small>${l}</small>${a!=null&&b!=null?deltaChip(a,b,dir,u):'<b>—</b>'}</div>`).join('')}
      </div></div>` : ''}
  </div>

  <h2 class="sec">Últimas avaliações <button data-act="go" data-to="list">Ver todas</button></h2>
  <div class="alist">${list.slice(-3).reverse().map((a,i)=>aItem(a,p,i===0)).join('')}</div>
  ${ctaNew()}`;
  return h;
}
function avgLR(c, k){ const v=[num(c[k+'_r']),num(c[k+'_l'])].filter(x=>x!=null); return v.length? v.reduce((s,x)=>s+x,0)/v.length : null; }
function ctaNew(){
  return `<button class="cta cta-new" data-act="new"><span class="c-ico">${ic('clip')}</span><span>${hasDraft()?'Continuar avaliação':'Nova avaliação'} <span class="arrows">›››</span></span><span class="c-ico">${ic('plus')}</span></button>`;
}

function viewList(){
  const p = prof(), list = listOf(p.id).reverse();
  return `<header class="top"><button class="icon-btn" data-act="go" data-to="home">${ic('back')}</button>
    <div class="title-block"><small>${esc(p.name)}</small><b>Avaliações</b></div><div class="grow"></div>
    <button class="icon-btn" data-act="new">${ic('plus')}</button></header>
  ${list.length ? `<p class="muted small" style="margin:-8px 2px 14px">${list.length} ${list.length>1?'avaliações registradas':'avaliação registrada'}</p>
  <div class="alist">${list.map((a,i)=>aItem(a,p,i===0)).join('')}</div>` :
  `<div class="card empty"><div class="e-ico">${ic('cal')}</div><h3>Nenhuma avaliação ainda</h3><p>As avaliações de ${esc(firstName(p.name))} aparecem aqui, da mais recente para a mais antiga.</p></div>`}
  ${ctaNew()}`;
}

function viewDetail(id){
  const a = findA(id); if (!a) return viewHome();
  const p = db.profiles.find(x=>x.id===a.profileId) || prof();
  const r = calc(a,p), pv = prevOf(a), rp = pv ? calc(pv,p) : null;
  const row = (l, v, u, d=1, pvv=null, dir=0) => v==null ? '' : `<div class="kv-row"><span class="k">${l}</span><span>${pvv!=null?deltaChip(v,pvv,dir,'',d):''}</span><span class="v">${fmt(v,d)}<small>${u}</small></span></div>`;
  const c = a.circ||{}, pc = pv?.circ||{};
  const trunk = CIRC_TRUNK.map(x=>row(x.l, num(c[x.k]), 'cm', 1, num(pc[x.k]), x.dir)).join('');
  const limbs = CIRC_LIMBS.map(x=>{
    const R=num(c[x.k+'_r']), L=num(c[x.k+'_l']); if (R==null&&L==null) return '';
    return `<div class="kv-row" style="grid-template-columns:1fr 70px 70px"><span class="k">${x.l}</span><span class="v">${fmt(R)}<small>D</small></span><span class="v">${fmt(L)}<small>E</small></span></div>`;
  }).join('');
  const need = PROTOCOLS[a.protocol||'jp7'].folds(p.sex);
  const folds = FOLDS.map(f=>{ const v = foldVal(a,f.k); if (v==null) return ''; return `<div class="kv-row"><span class="k">${f.l} ${need.includes(f.k)?'<span class="tag blue" style="padding:2px 7px;font-size:10px">'+PROTOCOLS[a.protocol||'jp7'].short+'</span>':''}</span><span>${pv?deltaChip(v,foldVal(pv,f.k),-1,''):''}</span><span class="v">${fmt(v)}<small>mm</small></span></div>`; }).join('');
  const ex = a.extra || {};
  const bio = [['% Gordura',num(ex.bf),'%'],['Massa muscular',num(ex.muscle),'kg'],['Gordura visceral',num(ex.visceral),''],['Água corporal',num(ex.water),'%']].map(([l,v,u])=>row(l,v,u)).join('');
  return `<header class="top no-print-sm"><button class="icon-btn no-print" data-act="back">${ic('back')}</button>
    <div class="title-block"><small>Avaliação · ${esc(p.name)}</small><b>${fmtDate(a.date,{day:'numeric',month:'long',year:'numeric'})}</b></div><div class="grow"></div>
    <div class="dt-acts no-print">
      ${pv?`<button class="btn ghost sm dt-d" data-act="cmpWith" data-a="${pv.id}" data-b="${a.id}">${ic('swap','sm')}<span>Comparar com a anterior</span></button>`:''}
      <button class="btn ghost sm dt-d" data-act="print" data-id="${a.id}">${ic('print','sm')}<span>PDF</span></button>
      <button class="btn ghost sm dt-d" data-act="edit" data-id="${a.id}">${ic('edit','sm')}<span>Editar</span></button>
      <button class="btn ghost sm dt-d dt-del" data-act="del" data-id="${a.id}" aria-label="Excluir avaliação" title="Excluir avaliação">${ic('trash','sm')}</button>
      <button class="icon-btn dt-m" data-act="print" data-id="${a.id}" aria-label="Exportar PDF">${ic('print')}</button>
      <button class="icon-btn dt-m" data-act="aMenu" data-id="${a.id}" aria-label="Opções da avaliação" aria-haspopup="dialog">${ic('gear')}</button>
    </div></header>

  <div class="dash detail-dash">
    <div class="card blue span2 span2-d hero">
      <div class="left">
        <div class="card-head"><span class="chip-ico">${ic('flame')}</span><span class="label">Gordura corporal<br><span class="small">${esc(r.bfSource||'sem dados suficientes')}</span></span></div>
        <div><div class="big xl">${fmt(r.bf)}<small>%</small></div>
        <div class="sub">${esc(bfClass(r.bf,p.sex))} ${rp?deltaChip(r.bf,rp.bf,-1,'pp'):''}</div></div>
      </div>
      <div class="ring-wrap">${ring(r.bf,40)}<div class="center"><div class="inner"><b>${r.age??'—'}</b><span>anos</span></div></div></div>
    </div>
    <div class="card"><div class="card-head"><span class="label">Peso</span><span class="chip-ico right">${ic('scale','sm')}</span></div>
      <div class="mid">${fmt(num(a.weight))}<small>kg</small></div><div class="sub">${pv?deltaChip(num(a.weight),num(pv.weight),0,'kg'):`<span class="small">Altura ${fmt(num(a.height),0)} cm</span>`}</div></div>
    <div class="card green"><div class="card-head"><span class="label">Massa magra</span><span class="chip-ico right">${ic('bolt','sm')}</span></div>
      <div class="mid">${fmt(r.leanMass)}<small>kg</small></div><div class="sub">${rp?deltaChip(r.leanMass,rp.leanMass,1,'kg'):''}</div></div>
    <div class="card yellow"><div class="card-head"><span class="label">Massa gorda</span><span class="chip-ico right">${ic('drop','sm')}</span></div>
      <div class="mid">${fmt(r.fatMass)}<small>kg</small></div><div class="sub">${rp?deltaChip(r.fatMass,rp.fatMass,-1,'kg'):''}</div></div>
    <div class="card"><div class="card-head"><span class="label">IMC</span><span class="chip-ico right">${ic('target','sm')}</span></div>
      <div class="mid">${fmt(r.bmi)}</div><div class="sub small">${esc(bmiClass(r.bmi))}</div></div>
  </div>

  ${phSection(a)}

  <div class="two-col">
  <div>
    <h2 class="sec">Índices</h2>
    <div class="kv">
      ${row('Relação cintura/quadril', r.whr, '', 2, rp?.whr, -1)}
      ${r.whr!=null?`<div class="kv-row"><span class="k muted small">Classificação RCQ</span><span></span><span class="v small">${whrRisk(r.whr,p.sex)}</span></div>`:''}
      ${row('Relação cintura/altura', r.whtr, '', 2, rp?.whtr, -1)}
      ${row('Soma das dobras ('+(PROTOCOLS[a.protocol||'jp7'].short)+')', r.sumProto, 'mm', 1, rp?.sumProto, -1)}
      ${row('Soma de todas as dobras', r.sumAll, 'mm', 1, rp?.sumAll, -1)}
      ${row('Densidade corporal', r.density, 'g/ml', 4)}
      ${r.navy!=null && r.bfSource!=='Marinha (circ.)' ? row('% Gordura (Marinha, circ.)', r.navy, '%') : ''}
      ${row('Metabolismo basal', r.bmr, 'kcal', 0)}
      ${row('Altura', num(a.height), 'cm', 0)}
    </div>
    ${trunk?`<h2 class="sec">Circunferências — tronco</h2><div class="kv">${trunk}</div>`:''}
    ${limbs?`<h2 class="sec">Circunferências — membros</h2><div class="kv">${limbs}</div>`:''}
  </div>
  <div>
    ${folds?`<h2 class="sec">Dobras cutâneas <span class="tag">${PROTOCOLS[a.protocol||'jp7'].name}</span></h2><div class="kv">${folds}</div>`:''}
    ${bio?`<h2 class="sec">Bioimpedância</h2><div class="kv">${bio}</div>`:''}
    ${ex.evaluator?`<h2 class="sec">Avaliador(a)</h2><div class="notes">${esc(ex.evaluator)}</div>`:''}
    ${ex.notes?`<h2 class="sec">Observações</h2><div class="notes">${esc(ex.notes)}</div>`:''}
  </div>
  </div>`;
}

function viewCompare(){
  const p = prof(), list = listOf(p.id);
  let h = `<header class="top"><button class="icon-btn" data-act="go" data-to="home">${ic('back')}</button>
    <div class="title-block"><small>${esc(p.name)}</small><b>Evolução</b></div><div class="grow"></div>
    ${list.length && state.cmpTab!=='ph'?`<button class="icon-btn" data-act="exportCmp" aria-label="Exportar PDF" title="${state.cmpTab==='ab'?'Exportar comparativo em PDF':'Exportar evolução em PDF'}">${ic('dl')}</button>`:''}</header>
    <div class="seg full" style="margin-bottom:16px">
      <button data-act="cmpTab" data-v="evo" class="${state.cmpTab==='evo'?'on':''}">Linha do tempo</button>
      <button data-act="cmpTab" data-v="ab" class="${state.cmpTab==='ab'?'on':''}">A × B</button>
      <button data-act="cmpTab" data-v="ph" class="${state.cmpTab==='ph'?'on':''}">${ic('camera','sm')} Fotos</button>
    </div>`;
  if (list.length < 1) return h + `<div class="card empty"><div class="e-ico">${ic('chart')}</div><h3>Sem avaliações</h3><p>Registre a primeira avaliação de ${esc(firstName(p.name))} para acompanhar a evolução.</p></div>${ctaNew()}`;
  if (state.cmpTab==='ph') return h + viewPhotoCompare(p, list);
  const R = list.map(a=>({a, r:calc(a,p)}));

  if (state.cmpTab==='evo'){
    const avail = METRICS.filter(m => R.some(x => m.get(x.a,x.r)!=null));
    if (!avail.find(m=>m.k===state.evo)) state.evo = avail[0]?.k || 'weight';
    const m = MET[state.evo];
    const pts = R.map(x=>({date:x.a.date, y:m.get(x.a,x.r), id:x.a.id})).filter(x=>x.y!=null);
    const first = pts[0]?.y, lastv = pts.at(-1)?.y, d = m.d ?? 1;
    const color = m.dir===1 ? 'var(--green-ink)' : m.dir===-1 ? 'var(--ink)' : 'var(--blue-ink)';
    const fill = m.dir===1 ? 'var(--green)' : m.dir===-1 ? 'var(--yellow)' : 'var(--blue)';
    h += `<div class="chips">${avail.map(x=>`<button class="chip ${x.k===state.evo?'on':''}" data-act="evo" data-m="${x.k}">${x.l}</button>`).join('')}</div>
    <div class="evo-grid"><div class="evo-main">
    <div class="card white" data-key="evo-${state.evo}">
      <div class="card-head"><span class="label"><b style="font-size:18px">${m.l}</b><br><span class="small muted">${pts.length} ${pts.length>1?'registros':'registro'}${m.u?' · '+m.u:''}</span></span>
        <span style="margin-left:auto">${pts.length>1?deltaChip(lastv,first,m.dir,m.u,d):''}</span></div>
      ${lineChart(pts,{d,color,fill})}
      <div class="stat-row">
        <div class="stat" style="background:var(--card)"><small>Inicial</small><b>${fmt(first,d)}</b></div>
        <div class="stat" style="background:var(--card)"><small>Atual</small><b>${fmt(lastv,d)}</b></div>
        <div class="stat" style="background:var(--card)"><small>Variação</small><b>${pts.length>1?(lastv-first>0?'+':'')+fmt(lastv-first,d):'—'}</b></div>
      </div>
    </div>
    </div><div class="evo-side">
    <h2 class="sec">Histórico</h2>
    <div class="kv" data-key="hist-${state.evo}">${pts.slice().reverse().map((x,i,arr)=>`<div class="kv-row" data-act="go" data-to="detail" data-id="${x.id}" style="cursor:pointer"><span class="k">${fmtDate(x.date)}</span><span>${arr[i+1]?deltaChip(x.y,arr[i+1].y,m.dir,'',d):''}</span><span class="v">${fmt(x.y,d)}<small>${m.u}</small></span></div>`).join('')}</div>
    </div></div>`;
    return h;
  }

  // ---- A × B
  if (list.length < 2) return h + `<div class="card blue empty"><div class="e-ico">${ic('swap')}</div><h3>Falta só mais uma</h3><p>Com duas avaliações de ${esc(firstName(p.name))} você vê o comparativo lado a lado de cada medida.</p></div>${ctaNew()}`;
  if (!findA(state.cmpA) || findA(state.cmpA).profileId!==p.id) state.cmpA = list.at(-2).id;
  if (!findA(state.cmpB) || findA(state.cmpB).profileId!==p.id) state.cmpB = list.at(-1).id;
  const A = findA(state.cmpA), B = findA(state.cmpB), rA = calc(A,p), rB = calc(B,p);
  const opts = sel => list.slice().reverse().map(a=>`<option value="${a.id}" ${a.id===sel?'selected':''}>${fmtDate(a.date,{day:'2-digit',month:'2-digit',year:'2-digit'})}</option>`).join('');
  const days = Math.round((toDate(B.date)-toDate(A.date))/864e5);
  const big = [['Peso',num(B.weight),num(A.weight),0,'kg','',''],['Gordura',rB.bf,rA.bf,-1,'pp','blue','%'],['Massa magra',rB.leanMass,rA.leanMass,1,'kg','green','kg'],['Massa gorda',rB.fatMass,rA.fatMass,-1,'kg','yellow','kg']];
  h += `<div class="cmp-pick">
      <label class="sel a"><small>Antes (A)</small><select data-ch="cmpA">${opts(A.id)}</select></label>
      <button class="vs" data-act="swapAB" aria-label="Inverter">${ic('swap','sm')}</button>
      <label class="sel b"><small>Depois (B)</small><select data-ch="cmpB">${opts(B.id)}</select></label>
    </div>
    <div class="cmp-meta"><p class="small muted">${Math.abs(days)} dias entre as avaliações${days<0?' (A é mais recente que B)':''}</p>
      <div class="cmp-legend" aria-label="Legenda das setas"><span><span class="delta good">${ic('down')}</span>Favorável</span><span><span class="delta bad">${ic('up')}</span>Desfavorável</span><span><span class="delta neu">${ic('up')}</span>Neutro</span></div></div>
    <div class="dash" data-key="ab-${A.id}-${B.id}">
      ${big.map(([l,b,a,dir,u,col,uu])=>`<div class="card ${col}"><div class="card-head"><span class="label">${l}</span></div>
        <div class="mid">${fmt(b)}<small>${uu||u}</small></div>
        <div class="sub">${a!=null&&b!=null?deltaChip(b,a,dir,u):'<span class="small muted">sem dados</span>'}</div>
        <div class="small muted" style="margin-top:6px">antes: ${fmt(a)}</div></div>`).join('')}
    </div>
    ${(()=>{ const k = POSE_KEYS.find(q=>phGet(A.id,q) && phGet(B.id,q)); return k ? `<button class="ph-teaser" data-act="phCompare" data-a="${A.id}" data-b="${B.id}"><span class="ph-tz">${phImg(phGet(A.id,k),'Antes')}</span><span class="ph-tz">${phImg(phGet(B.id,k),'Depois')}</span><span class="grow"><b>Ver as fotos lado a lado</b><span>${poseLabel(k)} · ${shortDate(A.date)} → ${shortDate(B.date)}</span></span>${ic('right','sm')}</button>` : ''; })()}
    <button class="toggle" style="margin-top:16px" data-act="onlyFilled"><span>Mostrar só medidas preenchidas nas duas</span><span class="switch ${state.onlyFilled?'on':''}"></span></button>
    <div class="two-col">`;
  const cols = [[],[]];
  GROUPS.forEach((g,gi)=>{
    const rows = g.items.map(m=>{
      const va = m.get(A,rA), vb = m.get(B,rB);
      if (state.onlyFilled ? (va==null||vb==null) : (va==null&&vb==null)) return '';
      const d = m.d ?? 1;
      let bar = '';
      if (va!=null && vb!=null && va!==0){
        const pct = (vb-va)/Math.abs(va)*100, w = Math.min(50, Math.abs(pct)*2.5);
        const cls = Math.abs(vb-va)<1e-9 ? 'var(--line)' : m.dir===0 ? 'var(--blue-2)' : ((vb-va)*m.dir>0 ? 'var(--green-2)' : 'var(--peach)');
        bar = `<div class="bar-d"><i class="${pct<0?'neg':'pos'}" style="left:${pct<0?50-w:50}%;width:${Math.max(w,1)}%;background:${cls}"></i><i style="left:calc(50% - 1px);width:2px;background:var(--muted)"></i></div>`;
      }
      return `<div class="cmp-row"><span class="k">${m.l}</span><span>${va!=null&&vb!=null?deltaChip(vb,va,m.dir,'',d):''}</span>
        <span class="vals">${fmt(va,d)} → <b>${fmt(vb,d)}</b> ${m.u}</span><span class="vals">${va&&vb?((vb-va)/Math.abs(va)*100>0?'+':'')+fmt((vb-va)/Math.abs(va)*100,1)+'%':''}</span>${bar}</div>`;
    }).join('');
    if (rows) cols[gi<2?0:1].push(`<h2 class="sec">${g.g}</h2><div class="kv">${rows}</div>`);
  });
  h += `<div>${cols[0].join('')}</div><div>${cols[1].join('')}</div></div>`;
  return h;
}

/* ---------- PACIENTES ---------- */
const norm = t => String(t||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
function kpi(k, label, val, cls, icn, act=true){
  const tag = act ? 'button' : 'div';
  return `<${tag} class="kpi ${cls} ${act&&state.route==='patients'&&state.pf===k?'on':''}" ${act?`data-act="pfilter" data-v="${k}"`:''}><span class="chip-ico">${ic(icn,'sm')}</span><b>${val}</b><small>${label}</small></${tag}>`;
}
function ptCard({p, st, list}){
  const last = list.at(-1), r = last ? calc(last,p) : null, on = p.id===db.activeId;
  const stIco = st.k==='ok' ? ic('check','sm') : (st.k==='late'||st.k==='soon') ? ic('clock','sm') : st.k==='arch' ? ic('archive','sm') : '';
  return `<div class="pt-cell" data-key="pt-${p.id}"><button class="pt-card ${on?'on':''}" data-act="go" data-to="patient" data-id="${p.id}">
    <span class="pt-top">${pAvatar(p)}<span class="pt-name"><b>${esc(p.name)}</b><small>${esc(pMeta(p))}</small></span>${ic('right','sm')}</span>
    <span class="pt-tags"><span class="tag ${st.cls}">${stIco}${st.l}</span>${p.goal?`<span class="tag">${esc(goalLabel(p.goal))}</span>`:''}${on?`<span class="tag dark">Atual</span>`:''}</span>
    <span class="pt-nums">${last
      ? `<span><small>Peso</small><b>${fmt(num(last.weight))}<small>kg</small></b></span><span><small>Gordura</small><b>${r.bf!=null?fmt(r.bf)+'<small>%</small>':'—'}</b></span><span><small>${plural(list.length,'avaliação','avaliações')}</small><b class="d">${ago(last.date)}</b></span>`
      : `<span class="pt-none">Nenhuma avaliação registrada ainda</span>`}</span>
  </button></div>`;
}
function viewPatients(){
  if (!db.profiles.length) return `<header class="top"><button class="icon-btn" data-act="go" data-to="home" aria-label="Início">${ic('back')}</button>
    <div class="title-block"><small>${esc(nutriName())}</small><b>Pacientes</b></div><div class="grow"></div>
    <button class="btn dark sm pt-new" data-act="newProfile">${ic('plus','sm')}<span>Novo paciente</span></button></header>
  <div class="card blue empty"><div class="e-ico">${ic('users')}</div><h3>Sua lista de pacientes começa aqui</h3>
    <p>Cadastre quem você atende. Depois, busque por nome ou telefone, filtre por retorno atrasado e veja a situação de cada um.</p>
    <button class="btn dark" style="margin:18px auto 0;display:inline-flex" data-act="newProfile">${ic('plus','sm')} Cadastrar primeiro paciente</button></div>
  <div class="pt-kpis" style="margin-top:16px">
    ${kpi('active','Pacientes ativos',0,'blue','users',false)}${kpi('late','Retornos atrasados',0,'peach','clock',false)}${kpi('soon','Retornos em 7 dias',0,'yellow','cal',false)}${kpi('month','Avaliações em 30 dias',0,'green','clip',false)}
  </div>`;
  const s = teamStats();
  const FILTERS = [['active','Ativos',s.active],['late','Atrasados',s.late],['soon','Próximos 7 dias',s.soon],['none','Sem avaliação',s.none],['arch','Arquivados',s.arch],['all','Todos',s.total]];
  if (!FILTERS.some(f=>f[0]===state.pf)) state.pf = 'active';
  const q = norm(state.pq.trim()), qd = phoneDigits(state.pq);
  const rows = db.profiles.map(p=>({p, st:pStatus(p), list:listOf(p.id)}));
  let shown = rows.filter(r => state.pf==='all' ? true : state.pf==='active' ? !r.p.archived : state.pf==='arch' ? !!r.p.archived : r.st.k===state.pf);
  if (q) shown = shown.filter(r => norm(r.p.name).includes(q) || norm(r.p.email).includes(q) || norm(goalLabel(r.p.goal)).includes(q) || (qd.length>2 && phoneDigits(r.p.phone).includes(qd)));
  const lastD = r => r.list.at(-1)?.date || '';
  const SORT = {
    recent:(a,b)=> lastD(b).localeCompare(lastD(a)) || (b.p.createdAt||0)-(a.p.createdAt||0),
    next:(a,b)=> (a.st.next||'9999').localeCompare(b.st.next||'9999'),
    name:(a,b)=> a.p.name.localeCompare(b.p.name,'pt-BR'),
  };
  shown.sort(SORT[state.ps] || SORT.recent);
  const emptyMsg = q ? ['Nenhum paciente encontrado', `Nada com “${esc(state.pq.trim())}” em ${FILTERS.find(f=>f[0]===state.pf)[1].toLowerCase()}. Tente outro nome ou veja “Todos”.`]
    : {late:['Nenhum retorno atrasado','Todos os pacientes ativos estão com a avaliação em dia.'], soon:['Nenhum retorno nos próximos 7 dias','Quando um retorno estiver chegando, ele aparece aqui.'], none:['Todos já foram avaliados','Pacientes cadastrados sem avaliação aparecem aqui.'], arch:['Nenhum paciente arquivado','Arquive quem encerrou o acompanhamento: o histórico fica guardado e a lista principal, limpa.']}[state.pf] || ['Nenhum paciente aqui','Cadastre um paciente para começar.'];
  return `<header class="top"><button class="icon-btn" data-act="go" data-to="home" aria-label="Início">${ic('back')}</button>
    <div class="title-block"><small>${esc(nutriName())}</small><b>Pacientes</b></div><div class="grow"></div>
    <button class="btn dark sm pt-new" data-act="newProfile">${ic('plus','sm')}<span>Novo paciente</span></button></header>
  <div class="pt-kpis">
    ${kpi('active','Pacientes ativos',s.active,'blue','users')}
    ${kpi('late','Retornos atrasados',s.late,'peach','clock')}
    ${kpi('soon','Retornos em 7 dias',s.soon,'yellow','cal')}
    ${kpi('month','Avaliações em 30 dias',s.month,'green','clip',false)}
  </div>
  <div class="pt-bar">
    <label class="pt-search">${ic('search','sm')}<input id="pt-q" type="search" value="${esc(state.pq)}" placeholder="Buscar por nome, telefone ou e-mail" autocomplete="off" enterkeyhint="search" aria-label="Buscar por nome, telefone, e-mail ou objetivo"></label>
    <div class="pt-filters" role="tablist" aria-label="Filtrar pacientes">${FILTERS.map(([k,l,n])=>`<button class="chip ${state.pf===k?'on':''}" role="tab" aria-selected="${state.pf===k}" data-act="pfilter" data-v="${k}">${l}<span class="n">${n}</span></button>`).join('')}</div>
    <span class="pt-count">${plural(shown.length,'paciente','pacientes')}${q&&shown.length?' encontrados':''}</span>
    ${dropdown('psort', [['recent','Avaliação mais recente','Quem foi avaliado por último primeiro'],['next','Próximo retorno','Retornos atrasados e mais próximos primeiro'],['name','Nome (A–Z)','Ordem alfabética']], state.ps, {icon:'sort', cls:'pt-sort', label:'Ordenar pacientes'})}
  </div>
  ${shown.length
    ? `<div class="pt-grid">${shown.map(ptCard).join('')}</div>`
    : `<div class="card empty"><div class="e-ico">${ic(q?'search':'users')}</div><h3>${emptyMsg[0]}</h3><p>${emptyMsg[1]}</p></div>`}`;
}

/* ---------- ACESSO DO PACIENTE (portal somente leitura) ---------- */
const PA = {}; // por paciente: {loaded, available, access}
const fmtAccessCode = c => c.length > 4 ? c.slice(0,4)+'-'+c.slice(4) : c;
const portalLink = c => `${location.origin}/paciente#${c}`;
function paLoad(pid){
  if (!options.portalAccess || PA[pid]) return;
  PA[pid] = {loaded:false};
  options.portalAccess.get(pid).then(r=>{ PA[pid] = {loaded:true, ...r}; render(); }).catch(()=>{ PA[pid] = {loaded:true, available:false, access:null}; render(); });
}
function paSection(p){
  if (!options.portalAccess) return '';
  paLoad(p.id);
  const s = PA[p.id], fn = esc(firstName(p.name));
  let body;
  if (!s?.loaded) body = `<div class="pa-card"><span class="ph-load" style="position:static;display:block;height:96px;border-radius:18px"></span></div>`;
  else if (!s.available) body = `<div class="pa-card muted"><p class="small">O portal do paciente está sendo ativado. Assim que estiver pronto, você cria aqui o código de acesso de ${fn}.</p></div>`;
  else if (!s.access) body = `<div class="pa-card pa-empty">
      <span class="pa-ico">${ic('lock')}</span>
      <b>Compartilhe a evolução com ${fn}</b>
      <p>Com um código, ${fn} vê avaliações, medidas, gráficos e fotos — só para visualizar, sem poder alterar nada.</p>
      <button class="btn dark sm" data-act="paCreate" data-id="${p.id}">${ic('plus','sm')} Criar código de acesso</button></div>`;
  else {
    const a = s.access;
    const seen = a.lastAccess ? `Último acesso ${ago(a.lastAccess.slice(0,10))}` : 'Ainda não acessou';
    body = `<div class="pa-card ${a.active?'':'paused'}">
      <div class="pa-code"><small>Código de acesso</small><b>${fmtAccessCode(a.code)}</b>
        <span class="tag ${a.active?'green':''}">${a.active ? ic('check','sm')+'Ativo' : 'Pausado'}</span></div>
      <p class="pa-seen">${ic('clock','sm')}${seen}</p>
      <div class="pa-btns">
        <button class="pa-b" data-act="paSend" data-id="${p.id}">${ic('chat','sm')}<span>${p.phone ? 'WhatsApp' : 'Enviar'}</span></button>
        <button class="pa-b" data-act="paCopy" data-id="${p.id}" data-what="code">${ic('clip','sm')}<span>Copiar código</span></button>
        <button class="pa-b" data-act="paCopy" data-id="${p.id}" data-what="link">${ic('swap','sm')}<span>Copiar link</span></button>
      </div>
      <h3 class="pa-h">O que ${fn} pode ver</h3>
      <button class="toggle pa-t on" disabled><span><b>Avaliações, medidas e gráficos</b><br><span class="small muted">Sempre visível</span></span><span class="switch on"></span></button>
      <button class="toggle pa-t" data-act="paTog" data-id="${p.id}" data-k="photos"><span><b>Fotos</b><br><span class="small muted">Antes e depois de cada pose</span></span><span class="switch ${a.photos?'on':''}"></span></button>
      <button class="toggle pa-t" data-act="paTog" data-id="${p.id}" data-k="notes"><span><b>Observações das avaliações</b><br><span class="small muted">As notas da ficha continuam só suas</span></span><span class="switch ${a.notes?'on':''}"></span></button>
      <div class="pa-foot">
        <button data-act="paTog" data-id="${p.id}" data-k="active">${a.active ? 'Pausar acesso' : 'Reativar acesso'}</button>
        <button data-act="paNew" data-id="${p.id}">Gerar novo código</button>
      </div>
    </div>`;
  }
  return `<h2 class="sec">Acesso do paciente</h2>${body}`;
}
async function paCopyText(text, ok){
  try { await navigator.clipboard.writeText(text); toast(ok); }
  catch { sheet('Copie o texto abaixo', text, [{label:'Fechar'}]); }
}

/* ---------- FICHA DO PACIENTE ---------- */
function viewPatient(id){
  const p = db.profiles.find(x=>x.id===id); if (!p) return viewPatients();
  const list = listOf(p.id), last = list.at(-1), first = list[0], st = pStatus(p);
  const r = last ? calc(last,p) : null, r0 = list.length>1 ? calc(first,p) : null;
  const wa = waLink(p.phone), cont = draft && draft.profileId===p.id;
  const since = r0 ? `<span class="small muted">desde ${fmtDate(first.date,{day:'2-digit',month:'short'})}</span>` : '';
  const metric = (label, val, unit, d0, dir, du, icn, cls='') => `<div class="card ${cls}"><div class="card-head"><span class="label">${label}</span><span class="chip-ico right">${ic(icn,'sm')}</span></div>
    <div class="mid">${val!=null?fmt(val):'—'}<small>${val!=null?unit:''}</small></div>${r0&&val!=null&&d0!=null?`<div class="sub">${deltaChip(val,d0,dir,du)} ${since}</div>`:''}</div>`;
  let h = `<header class="top"><button class="icon-btn" data-act="go" data-to="patients" aria-label="Pacientes">${ic('back')}</button>
    <div class="title-block"><small>Pacientes</small><b>Ficha do paciente</b></div><div class="grow"></div>
    <button class="icon-btn" data-act="go" data-to="onboard" data-id="${p.id}" aria-label="Editar paciente">${ic('edit')}</button></header>
  <div class="pt-layout"><div class="pt-main">
  <div class="card blue pt-hero">
    <div class="pt-id">${pAvatar(p,'xl')}<div class="grow"><h1>${esc(p.name)}</h1><div class="small">${esc(pMeta(p))}</div></div></div>
    <div class="pt-tags"><span class="tag ${st.cls==='muted'?'':st.cls}">${st.l}</span>${p.goal?`<span class="tag">${ic('target','sm')}${esc(goalLabel(p.goal))}</span>`:''}<span class="tag">${ic('clock','sm')}Retorno a cada ${returnEvery(p)} dias</span></div>
    ${(p.phone||p.email) ? `<div class="pt-contact">${wa?`<a class="pc wa" href="${wa}" target="_blank" rel="noopener">${ic('chat','sm')}WhatsApp</a>`:''}${p.phone?`<a class="pc" href="tel:${phoneDigits(p.phone)}">${ic('phone','sm')}${esc(fmtPhone(p.phone))}</a>`:''}${p.email?`<a class="pc" href="mailto:${esc(p.email)}">${ic('mail','sm')}<span>${esc(p.email)}</span></a>`:''}</div>`
      : `<div class="pt-contact"><button class="pc" data-act="go" data-to="onboard" data-id="${p.id}">${ic('plus','sm')}Adicionar telefone ou e-mail</button></div>`}
  </div>
  <div class="pt-actions">
    <button class="pa main" data-act="newFor" data-id="${p.id}">${ic(cont?'edit':'plus')}<span>${cont?'Continuar avaliação':'Nova avaliação'}</span></button>
    <button class="pa" data-act="openAs" data-to="home" data-id="${p.id}">${ic('home')}<span>Painel</span></button>
    <button class="pa" data-act="openAs" data-to="compare" data-id="${p.id}">${ic('chart')}<span>Evolução</span></button>
    <button class="pa" data-act="print">${ic('print')}<span>PDF</span></button>
  </div>`;
  if (!last){
    h += `<div class="card empty" style="margin-top:16px"><div class="e-ico">${ic('clip')}</div><h3>Nenhuma avaliação ainda</h3><p>Registre a primeira avaliação de ${esc(firstName(p.name))} para acompanhar peso, gordura e medidas a cada retorno.</p></div>`;
  } else {
    h += `<h2 class="sec">Resultados atuais <span class="sec-note">${fmtDate(last.date,{day:'numeric',month:'short',year:'numeric'})}</span></h2>
    <div class="dash pt-sum">
      ${metric('Peso', num(last.weight), 'kg', r0&&num(first.weight), 0, 'kg', 'scale')}
      ${metric('Gordura', r.bf, '%', r0?.bf, -1, 'pp', 'flame', 'blue')}
      ${metric('Massa magra', r.leanMass, 'kg', r0?.leanMass, 1, 'kg', 'bolt', 'green')}
      ${metric('Cintura', num(last.circ?.waist), 'cm', r0&&num(first.circ?.waist), -1, 'cm', 'ruler', 'yellow')}
    </div>
    <h2 class="sec">Avaliações <button data-act="openAs" data-to="list" data-id="${p.id}">Ver todas (${list.length})</button></h2>
    <div class="alist">${list.slice(-4).reverse().map((a,i)=>aItem(a,p,i===0)).join('')}</div>`;
  }
  h += `</div><aside class="pt-aside">
    <h2 class="sec">Agenda</h2>
    <div class="kv">
      <div class="kv-row"><span class="k">Primeira avaliação</span><span class="t">${first?fmtDate(first.date):'—'}</span></div>
      <div class="kv-row"><span class="k">Última avaliação</span><span class="t">${last?`${fmtDate(last.date)} <small>${ago(last.date)}</small>`:'—'}</span></div>
      <div class="kv-row"><span class="k">Próximo retorno</span><span class="t ${st.k}">${st.next?`${fmtDate(st.next)} <small>${st.short||st.l}</small>`:p.archived?'Arquivado':'Após a 1ª avaliação'}</span></div>
      <div class="kv-row"><span class="k">Cadastro</span><span class="t">${p.createdAt?fmtDate(isoOf(new Date(p.createdAt))):'—'}</span></div>
    </div>
    <h2 class="sec">Observações <button data-act="go" data-to="onboard" data-id="${p.id}">editar</button></h2>
    <div class="notes ${p.notes?'':'muted'}">${p.notes?esc(p.notes):'Sem observações. Registre histórico clínico, restrições e combinados.'}</div>
    ${paSection(p)}
    <h2 class="sec">Gerenciar</h2>
    <div class="actions">
      <button class="act-row" data-act="go" data-to="onboard" data-id="${p.id}"><span class="chip-ico">${ic('edit','sm')}</span><span class="grow"><b>Editar dados</b><span>Nome, medidas, contato, objetivo e retorno</span></span></button>
      <button class="act-row" data-act="exportPt" data-id="${p.id}" aria-haspopup="dialog"><span class="chip-ico">${ic('dl','sm')}</span><span class="grow"><b>Exportar dados</b><span>Planilha (CSV) ou arquivo JSON</span></span>${ic('right','sm')}</button>
      <button class="act-row" data-act="archive" data-id="${p.id}"><span class="chip-ico">${ic('archive','sm')}</span><span class="grow"><b>${p.archived?'Reativar paciente':'Arquivar paciente'}</b><span>${p.archived?'Volta para a lista de ativos':'Sai da lista de ativos; o histórico fica guardado'}</span></span></button>
      <button class="act-row danger" data-act="delProfile" data-id="${p.id}"><span class="chip-ico">${ic('trash','sm')}</span><span class="grow"><b>Excluir paciente</b><span style="color:inherit;opacity:.7">Remove ${esc(firstName(p.name))} e todas as avaliações</span></span></button>
    </div>
  </aside></div>`;
  return h;
}

/* ---------- PERFIL DO NUTRICIONISTA ---------- */
function viewProfile(){
  const s = teamStats(), done = !!((nutri.name||'').trim() && (nutri.crn||'').trim());
  const row = (k, v) => `<div class="kv-row"><span class="k">${k}</span><span class="t ${v?'':'none'}">${v?esc(v):'Não informado'}</span></div>`;
  return `<header class="top"><button class="icon-btn" data-act="go" data-to="home" aria-label="Início">${ic('back')}</button><div class="title-block"><small>Sua conta</small><b>Perfil profissional</b></div><div class="grow"></div>
    <button class="icon-btn" data-act="go" data-to="nutri" aria-label="Editar perfil">${ic('edit')}</button></header>
  <div class="card yellow nu-hero">
    <span class="avatar xl">${esc(initials(nutriName()))}</span>
    <div class="grow"><span class="tag">${ic('steth','sm')}${esc((nutri.specialty||'').trim()||'Nutricionista')}</span><h1>${esc(nutriName())}</h1>
      <div class="small">${[crnLabel()?esc(crnLabel()):null, esc(options.email||'')].filter(Boolean).join(' · ')}</div></div>
  </div>
  ${done?'':`<button class="draft-banner" data-act="go" data-to="nutri">${ic('badge')}<span class="grow">Complete seu perfil: nome e CRN entram como avaliador(a) nas novas avaliações e nos PDFs.</span><b>Completar</b></button>`}
  <div class="pt-kpis">
    ${kpi('active','Pacientes ativos',s.active,'blue','users')}
    ${kpi('late','Retornos atrasados',s.late,'peach','clock')}
    ${kpi('month','Avaliações em 30 dias',s.month,'green','clip',false)}
    ${kpi('all','Avaliações no total',s.all,'','chart',false)}
  </div>
  <div class="two-col">
  <div>
    <h2 class="sec">Atendimento <button data-act="go" data-to="nutri">editar</button></h2>
    <div class="kv">
      ${row('Registro (CRN)', nutri.crn)}${row('Especialidade', nutri.specialty)}${row('Telefone', fmtPhone(nutri.phone))}${row('Local de atendimento', nutri.place)}
      <div class="kv-row"><span class="k">Retorno padrão</span><span class="t">a cada ${returnEvery({})} dias</span></div>
    </div>
    <h2 class="sec">Pacientes</h2>
    <div class="actions">
      <button class="act-row" data-act="go" data-to="patients"><span class="chip-ico">${ic('users','sm')}</span><span class="grow"><b>Gerenciar pacientes</b><span>${plural(s.active,'ativo','ativos')}${s.arch?` · ${plural(s.arch,'arquivado','arquivados')}`:''} · busca e filtros por retorno</span></span>${ic('right','sm')}</button>
      <button class="act-row" data-act="newProfile"><span class="chip-ico">${ic('plus','sm')}</span><span class="grow"><b>Cadastrar paciente</b><span>Dados, contato, objetivo e observações</span></span>${ic('right','sm')}</button>
    </div>
  </div>
  <div>
    <h2 class="sec">Dados e conta</h2>
    <div class="actions">
      <button class="act-row" data-act="tour"><span class="chip-ico">${ic('target','sm')}</span><span class="grow"><b>Tour de apresentação</b><span>Reveja em 1 minuto como usar o sistema</span></span>${ic('right','sm')}</button>
      <button class="act-row" data-act="export"><span class="chip-ico">${ic('dl','sm')}</span><span class="grow"><b>Exportar backup</b><span>Arquivo .json com todos os pacientes e avaliações</span></span></button>
      <button class="act-row" data-act="import"><span class="chip-ico">${ic('ul','sm')}</span><span class="grow"><b>Restaurar backup</b><span>Importa um arquivo .json exportado antes, sem duplicar</span></span></button>
    </div>
    <button class="logout-row" data-act="logout"><span class="chip-ico">${ic('out','sm')}</span><span class="grow"><b>Sair da conta</b><span>${esc(options.email||'')}</span></span></button>
  </div></div>
  <p class="small muted" style="margin-top:20px;text-align:center">Seus dados estão salvos na sua conta.</p>`;
}
function viewNutri(){
  const tf = (id, label, val, ph, hint='', type='text') => `<label class="field"><div class="f-top"><span class="f-label">${label}</span></div>${hint?`<span class="f-hint">${hint}</span>`:''}
    <div class="f-input text"><input id="${id}" type="${type}" value="${esc(type==='tel'?fmtPhone(val):(val||''))}" placeholder="${ph}" autocomplete="off"${type==='tel'?' inputmode="tel" data-mask="phone" maxlength="15"':''}></div></label>`;
  const first = inSetup();
  return `${first ? `${setupSteps(1)}<div class="onb-hero"><div class="blob"></div><div class="blob b2"></div>
    <div style="position:relative"><span class="tag" style="margin-bottom:14px">${ic('steth','sm')} Bem-vindo(a)</span>
    <h1>Vamos começar por você.</h1>
    <p>Seu nome e CRN aparecem como avaliador(a) em cada avaliação e nos relatórios em PDF. Depois, se quiser, você já cadastra o primeiro paciente.</p></div></div>`
    : `<header class="top"><button class="icon-btn" data-act="go" data-to="profile" aria-label="Voltar">${ic('back')}</button><div class="title-block"><small>Perfil profissional</small><b>Editar perfil</b></div></header>`}
  <h2 class="sec" style="margin-top:6px">Identificação</h2>
  <div class="form-grid">
    ${tf('nu-name','Nome completo',nutri.name,'Seu nome','Aparece como avaliador(a) nas avaliações e nos relatórios em PDF.')}
    <div class="fields two">${tf('nu-crn','CRN',nutri.crn,'Ex.: 3-12345')}${tf('nu-spec','Especialidade',nutri.specialty,'Ex.: Nutrição esportiva')}</div>
  </div>
  <h2 class="sec">Atendimento</h2>
  <div class="form-grid">
    <div class="fields two">${tf('nu-phone','Telefone',nutri.phone,'(11) 99999-9999','','tel')}${tf('nu-place','Local de atendimento',nutri.place,'Clínica, cidade ou online')}</div>
    <div class="field"><div class="f-top"><span class="f-label">Retorno padrão</span></div><span class="f-hint">Vale para os pacientes sem um retorno próprio. Define quem aparece como “atrasado”.</span>
      ${dropdown('nret', RETURNS.map(d=>[String(d),`A cada ${d} dias`]), state.form.nret, {label:'Retorno padrão'})}</div>
  </div>
  ${first ? `<p class="small muted" style="text-align:center;margin-top:22px">Conta: ${esc(options.email||'')} · dá para mudar tudo depois em Perfil.</p>` : ''}
  ${first ? formBar('data-v="1"', 'data-act="saveNutri"', 'Continuar', 'Pular por agora', 'skipSetup') : formBar('data-to="profile"', 'data-act="saveNutri"', 'Salvar perfil')}`;
}

/* ---------- WIZARD ---------- */
function newDraft(){
  const p = prof(), last = listOf(p.id).at(-1);
  return {id:null, tid:uid(), profileId:p.id, date:today(), weight:'', height: p.height || last?.height || '', protocol: last?.protocol || 'jp7', multi:false, circ:{}, folds:{}, extra: nutriSign() ? {evaluator:nutriSign()} : {}};
}
function wizPrev(){
  if (!draft) return null;
  const list = listOf(draft.profileId).filter(a=>a.id!==state.editingId && a.date<=draft.date);
  return list.at(-1) || null;
}
function field(key, label, unit, hint, o={}){
  const v = getPath(draft, key) ?? '';
  const pv = wizPrev(); const pvv = pv ? num(getPath(pv, key)) : null;
  return `<label class="field ${o.req?'req':''}"><div class="f-top"><span class="f-label">${label}${o.tag||''}</span>${pvv!=null?`<span class="f-prev">anterior ${fmt(pvv)}</span>`:''}</div>
    ${hint?`<span class="f-hint">${hint}</span>`:''}
    <div class="f-input"><input inputmode="decimal" enterkeyhint="next" data-k="${key}" value="${esc(v)}" placeholder="0,0" autocomplete="off"><em>${unit}</em></div></label>`;
}
function pairField(c){
  const pv = wizPrev();
  const pr = pv ? num(pv.circ?.[c.k+'_r']) : null, pl = pv ? num(pv.circ?.[c.k+'_l']) : null;
  return `<div class="field"><div class="f-top"><span class="f-label">${c.l}</span>${pr!=null||pl!=null?`<span class="f-prev">ant. ${fmt(pr)} / ${fmt(pl)}</span>`:''}</div>
    <span class="f-hint">${c.h}</span>
    <div class="pair">
      <div><label>Direito</label><div class="f-input"><input inputmode="decimal" enterkeyhint="next" data-k="circ.${c.k}_r" value="${esc(draft.circ?.[c.k+'_r']??'')}" placeholder="0,0" autocomplete="off"><em>cm</em></div></div>
      <div><label>Esquerdo</label><div class="f-input"><input inputmode="decimal" enterkeyhint="next" data-k="circ.${c.k}_l" value="${esc(draft.circ?.[c.k+'_l']??'')}" placeholder="0,0" autocomplete="off"><em>cm</em></div></div>
    </div></div>`;
}
function foldField(f, req){
  const pv = wizPrev(); const pvv = pv ? foldVal(pv, f.k) : null;
  const arr = Array.isArray(draft.folds?.[f.k]) ? draft.folds[f.k] : [draft.folds?.[f.k]];
  const tag = req ? ` <span class="tag blue" style="padding:2px 8px;font-size:11px;vertical-align:2px">${PROTOCOLS[draft.protocol].short}</span>` : '';
  const inp = i => `<div class="f-input"><input inputmode="decimal" enterkeyhint="next" data-k="folds.${f.k}.${i}" value="${esc(arr[i]??'')}" placeholder="${draft.multi?(i+1)+'ª':'0,0'}" autocomplete="off"><em>mm</em></div>`;
  return `<div class="field ${req?'req':''}"><div class="f-top"><span class="f-label">${f.l}${tag}</span>${pvv!=null?`<span class="f-prev">anterior ${fmt(pvv)}</span>`:''}</div>
    <span class="f-hint">${f.h}</span>
    ${draft.multi ? `<div class="triple">${inp(0)}${inp(1)}${inp(2)}</div><div class="avg-line"><span>Média</span><b data-live="avg-${f.k}">${fmt(foldVal(draft,f.k))} mm</b></div>` : inp(0)}
  </div>`;
}
function stepFilled(k){
  const d = draft, p = prof();
  const cnt = arr => arr.filter(v=>num(v)!=null).length;
  switch(k){
    case 'start': return [1,1];
    case 'body': return [cnt([d.weight,d.height]),2];
    case 'trunk': return [cnt(CIRC_TRUNK.map(c=>d.circ?.[c.k])), CIRC_TRUNK.length];
    case 'limbs': return [cnt(CIRC_LIMBS.flatMap(c=>[d.circ?.[c.k+'_r'],d.circ?.[c.k+'_l']])), CIRC_LIMBS.length*2];
    case 'folds': { const need = PROTOCOLS[d.protocol].folds(p.sex); return [need.filter(f=>foldVal(d,f)!=null).length, need.length]; }
    case 'photos': { const aid = state.editingId || draft.tid; return [aid ? phOf(aid).length : 0, 4]; }
    case 'extra': return [cnt([d.extra?.bf,d.extra?.muscle,d.extra?.visceral,d.extra?.water]) + (d.extra?.notes?1:0), 5];
    default: return [0,0];
  }
}
function viewWizard(){
  const p = prof(), s = STEPS[state.step], r = calc(draft, p);
  let body = '';
  const intro = `<div class="step-intro"><span class="s-ico" style="background:var(--${s.c})">${ic(s.i)}</span><div><h2>${s.t}</h2><p>${s.d}</p></div></div>`;
  switch(s.k){
    case 'start':
      body = `<div class="card blue" style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
          <span class="avatar" style="background:var(--surface)">${esc(initials(p.name))}</span>
          <div class="grow"><b style="font-weight:600">${esc(p.name)}</b><div class="small">${p.sex==='F'?'Feminino':'Masculino'} · <span data-live="age">${r.age??'—'}</span> anos na data</div></div>
          <button class="tag" data-act="go" data-to="patients">Trocar</button></div>
        <div class="fields two">
          <label class="field"><div class="f-top"><span class="f-label">Data da avaliação</span></div>
            <div class="f-input text"><input type="date" data-k="date" value="${esc(draft.date)}" max="${today()}"></div></label>
          <label class="field"><div class="f-top"><span class="f-label">Avaliador(a)</span><span class="f-prev">opcional</span></div>
            <div class="f-input text"><input data-k="extra.evaluator" value="${esc(draft.extra?.evaluator??'')}" placeholder="Nome do nutricionista"></div></label>
        </div>
        <h2 class="sec">Protocolo de dobras</h2>
        <div class="proto-grid">${Object.entries(PROTOCOLS).map(([k,pr])=>`<button class="proto ${draft.protocol===k?'on':''}" data-act="proto" data-v="${k}">
          <span class="radio"></span><span><b>${pr.name}</b><span>${pr.desc}<br>${pr.folds(p.sex).map(f=>FOLD_NAME[f]).join(', ')}</span></span></button>`).join('')}</div>`;
      break;
    case 'body':
      body = `<div class="fields two">${field('weight','Peso','kg','Com roupas leves, sem calçados.')}${field('height','Altura','cm','Em pé, descalço, olhando para frente.')}</div>
        <div class="card yellow" style="margin-top:12px">
          <div class="card-head"><span class="chip-ico">${ic('target','sm')}</span><span class="label">Índice de Massa Corporal</span></div>
          <div class="big"><span data-live="bmi">${fmt(r.bmi)}</span><small>kg/m²</small></div>
          <div class="sub" data-live="bmiClass">${esc(bmiClass(r.bmi))}</div>
          <div class="bmi-scale"><i data-live="bmiPos" style="left:${bmiPos(r.bmi)}%"></i></div>
          <div class="bmi-legend"><span>15</span><span>18,5</span><span>25</span><span>30</span><span>35</span><span>40</span></div>
        </div>`;
      break;
    case 'trunk':
      body = `<div class="card green live"><div class="lv"><small>RCQ</small><b data-live="whr">${fmt(r.whr,2)}</b></div><div class="lv"><small>Cintura/altura</small><b data-live="whtr">${fmt(r.whtr,2)}</b></div><div class="lv"><small>% G (Marinha)</small><b><span data-live="navy">${fmt(r.navy)}</span><small>%</small></b></div></div>
        <div class="fields two">${CIRC_TRUNK.map(c=>field('circ.'+c.k,c.l,'cm',c.h)).join('')}</div>`;
      break;
    case 'limbs':
      body = `<div class="fields two">${CIRC_LIMBS.map(pairField).join('')}</div>`;
      break;
    case 'folds': {
      const need = PROTOCOLS[draft.protocol].folds(p.sex);
      body = `<div class="card yellow live">
          <div class="lv"><small>Protocolo</small><b style="font-size:18px">${PROTOCOLS[draft.protocol].short} <span class="small" data-live="protoHave">${r.protoHave}/${r.protoNeed}</span></b></div>
          <div class="lv"><small>Soma</small><b><span data-live="sumProto">${fmt(r.sumProto)}</span><small>mm</small></b></div>
          <div class="lv"><small>% Gordura</small><b><span data-live="bfProto">${r.bfSource===PROTOCOLS[draft.protocol].short?fmt(r.bf):'—'}</span><small>%</small></b></div></div>
        <button class="toggle" data-act="multi"><span><b style="font-weight:600">Medir 3 vezes cada dobra</b><br><span class="small muted">Usa a média das leituras — mais precisão</span></span><span class="switch ${draft.multi?'on':''}"></span></button>
        <div class="fields two">${FOLDS.filter(f=>need.includes(f.k)).map(f=>foldField(f,true)).join('')}</div>
        <h2 class="sec">Outras dobras <span class="tag">opcional</span></h2>
        <div class="fields two">${FOLDS.filter(f=>!need.includes(f.k)).map(f=>foldField(f,false)).join('')}</div>`;
      break; }
    case 'extra':
      body = `<div class="fields two">
          ${field('extra.bf','% Gordura (bio)','%','Valor da balança de bioimpedância.')}
          ${field('extra.muscle','Massa muscular','kg','Massa muscular esquelética.')}
          ${field('extra.visceral','Gordura visceral','nível','Nível indicado pelo aparelho.')}
          ${field('extra.water','Água corporal','%','Percentual de água total.')}
        </div>
        <label class="field" style="margin-top:10px"><div class="f-top"><span class="f-label">Observações</span></div>
          <span class="f-hint">Objetivos, rotina, alimentação, sensações, orientações do nutricionista…</span>
          <div class="f-input"><textarea data-k="extra.notes" placeholder="Escreva aqui…">${esc(draft.extra?.notes??'')}</textarea></div></label>`;
      break;
    case 'photos': {
      const aid = draftAid(), n = phOf(aid).length;
      body = `${phSlots(aid,'big')}
        <div class="ph-cta">
          <button class="cta" data-act="phCam" data-aid="${aid}"><span class="c-ico">${ic('camera')}</span><span>${n ? (n<4 ? 'Continuar com a câmera' : 'Abrir a câmera de novo') : 'Abrir câmera guiada'} <span class="arrows">›››</span></span><span class="c-ico">${ic('plus')}</span></button>
          <button class="btn ghost" data-act="phCam" data-aid="${aid}" data-file="1">${ic('image','sm')} Escolher da galeria</button>
        </div>
        ${phTips()}${phNote()}`;
      break; }
    case 'review': {
      const pv = wizPrev(), rp = pv ? calc(pv,p) : null;
      body = `<div class="dash detail-dash">
          <div class="card blue span2 span2-d hero" style="min-height:170px"><div class="left">
            <div class="card-head"><span class="chip-ico">${ic('flame')}</span><span class="label">Gordura corporal<br><span class="small">${esc(r.bfSource||'sem dados suficientes')}</span></span></div>
            <div><div class="big">${fmt(r.bf)}<small>%</small></div><div class="sub">${esc(bfClass(r.bf,p.sex))} ${rp?deltaChip(r.bf,rp.bf,-1,'pp'):''}</div></div></div>
            <div class="ring-wrap">${ring(r.bf,40)}<div class="center"><div class="inner"><b>${fmt(num(draft.weight))}</b><span>kg</span></div></div></div></div>
          <div class="card green"><div class="card-head"><span class="label">Massa magra</span></div><div class="mid">${fmt(r.leanMass)}<small>kg</small></div><div class="sub">${rp?deltaChip(r.leanMass,rp.leanMass,1,'kg'):''}</div></div>
          <div class="card yellow"><div class="card-head"><span class="label">Massa gorda</span></div><div class="mid">${fmt(r.fatMass)}<small>kg</small></div><div class="sub">${rp?deltaChip(r.fatMass,rp.fatMass,-1,'kg'):''}</div></div>
          <div class="card"><div class="card-head"><span class="label">IMC</span></div><div class="mid">${fmt(r.bmi)}</div><div class="sub small">${esc(bmiClass(r.bmi))}</div></div>
          <div class="card"><div class="card-head"><span class="label">RCQ</span></div><div class="mid">${fmt(r.whr,2)}</div><div class="sub small">${esc(whrRisk(r.whr,p.sex))}</div></div>
        </div>
        <h2 class="sec">O que foi preenchido</h2>
        <div class="check-list">${STEPS.slice(1,7).map((st,i)=>{ const [f,t] = stepFilled(st.k); const ok = (st.k==='extra'||st.k==='photos') ? f>0 : f===t; return `<div class="check-row"><span class="ok ${ok?'yes':''}">${ok?ic('check','sm'):ic(st.i,'sm')}</span><span class="grow"><b>${st.l}</b><span class="small muted">${f} de ${t} ${st.k==='folds'?'dobras do protocolo':st.k==='photos'?'fotos (opcional)':'campos'}</span></span><button data-act="step" data-i="${i+1}">Editar</button></div>`; }).join('')}</div>
        ${!num(draft.weight)?`<p class="small" style="color:var(--red-ink);margin-top:12px">Informe pelo menos o peso para salvar.</p>`:''}`;
      break; }
  }
  const pct = (state.step)/(STEPS.length-1)*100;
  return `<div class="wiz">
    <header class="top"><button class="icon-btn" data-act="wizExit" aria-label="Sair">${ic('x')}</button>
      <div class="title-block"><small>Passo ${state.step+1} de ${STEPS.length}${state.editingId?' · editando':''}</small><b>${state.editingId?'Editar avaliação':'Nova avaliação'}</b></div>
      <div class="grow"></div><span class="tag yellow">${fmtDate(draft.date,{day:'2-digit',month:'short'})}</span></header>
    <aside class="wiz-side">
    <div class="steps">${STEPS.map((st,i)=>{ const [f,t] = stepFilled(st.k); const done = f>0 && (i<state.step || f===t) && i!==state.step; return `<button class="step-chip ${i===state.step?'on':''} ${done?'done':''}" data-act="step" data-i="${i}"><span class="n">${done&&i!==state.step?ic('check','sm'):i+1}</span>${st.l}</button>`; }).join('')}</div>
    <div class="progress"><span style="width:${pct}%"></span></div>
    <div class="wiz-bar"><div class="in">
      ${state.step>0?`<button class="btn ghost" data-act="prevStep">${ic('back')} <span>Voltar</span></button>`:''}
      ${state.step<STEPS.length-1
        ? `<button class="btn primary" data-act="nextStep">Próximo · ${STEPS[state.step+1].l} <span class="arrows" style="letter-spacing:0">›››</span></button>`
        : `<button class="btn dark" data-act="saveA" ${num(draft.weight)?'':'disabled'}>${ic('check')} Salvar avaliação</button>`}
    </div></div>
    <p class="wiz-tip">Dica: <b>Enter</b> pula para o próximo campo.</p>
    </aside>
    <section class="step-view" data-key="step-${state.step}" data-dir="${state.stepDir||'fwd'}">${intro}${body}</section>
  </div>`;
}
function bmiPos(b){ if (b==null) return 0; return Math.max(0, Math.min(100, (b-15)/(40-15)*100)); }

function updateLive(){
  const p = prof(), r = calc(draft, p);
  const set = (k, v) => document.querySelectorAll(`[data-live="${k}"]`).forEach(el => { v = String(v); if (el.textContent === v) return; el.textContent = v; tick(el); });
  set('age', r.age ?? '—');
  set('bmi', fmt(r.bmi)); set('bmiClass', bmiClass(r.bmi));
  const bp = document.querySelector('[data-live="bmiPos"]'); if (bp) bp.style.left = bmiPos(r.bmi)+'%';
  set('whr', fmt(r.whr,2)); set('whtr', fmt(r.whtr,2)); set('navy', fmt(r.navy));
  set('protoHave', `${r.protoHave}/${r.protoNeed}`); set('sumProto', fmt(r.sumProto));
  set('bfProto', r.bfSource===PROTOCOLS[draft.protocol].short ? fmt(r.bf) : '—');
  FOLDS.forEach(f => set('avg-'+f.k, fmt(foldVal(draft,f.k))+' mm'));
  // chips de passo
  document.querySelectorAll('.step-chip').forEach((el,i)=>{
    if (i===state.step) return;
    const [f,t] = stepFilled(STEPS[i].k); const done = !!(f>0 && (i<state.step || f===t));
    if (el.classList.contains('done') === done) return;
    el.classList.toggle('done', done);
    el.querySelector('.n').innerHTML = done ? ic('check','sm') : i+1;
  });
}

/* =========================================================
   RENDER / ROUTER
   ========================================================= */
let app = options.app;
const ORDER = {home:0,patients:1,patient:2,list:3,detail:4,compare:5,profile:6,nutri:7,onboard:8,wizard:9};
let lastRoute = null;
function render(){
  // sem pacientes: primeiro o perfil do nutricionista (1º acesso), depois o cadastro do paciente
  // sem pacientes: 1º acesso passa pelo perfil; depois o sistema funciona normalmente, com telas vazias que convidam a cadastrar
  if (!db.profiles.length){
    if (needsSetup() && !['onboard','nutri'].includes(state.route)){ state.route = 'nutri'; state.param = null; initForm('nutri', null); }
    if (state.route==='nutri' && state.form.nret==null) initForm('nutri', null);
    if (state.route==='onboard' && state.param){ state.param = null; initForm('onboard', null); }
  } else if (state.setup) state.setup = false;
  if (db.profiles.length && !db.profiles.find(p=>p.id===db.activeId)) { db.activeId = db.profiles[0].id; }
  if (state.route==='wizard' && !draft) state.route = 'home';
  let html = '';
  if (!db.profiles.length && ['list','detail','compare','patient','wizard'].includes(state.route)) html = viewNoPatient(state.route);
  else switch(state.route){
    case 'onboard': html = `<div class="narrow">${viewOnboard(state.param ? db.profiles.find(p=>p.id===state.param) : null)}</div>`; break;
    case 'list': html = viewList(); break;
    case 'detail': html = viewDetail(state.param); break;
    case 'compare': html = viewCompare(); break;
    case 'profile': html = viewProfile(); break;
    case 'nutri': html = `<div class="narrow">${viewNutri()}</div>`; break;
    case 'patients': html = viewPatients(); break;
    case 'patient': html = viewPatient(state.param); break;
    case 'wizard': html = viewWizard(); break;
    default: html = viewHome();
  }
  const showNav = !['wizard','onboard','nutri'].includes(state.route);
  let navHtml='';
  if(showNav){ const tabs=[['home','home','Início'],['patients','users','Pacientes'],['list','cal','Avaliações'],['compare','chart','Evolução'],['profile','user','Perfil']]; const cur={detail:'list',patient:'patients'}[state.route]||state.route;
  // No celular: só os botões (pílula flutuante). No computador vira barra lateral com marca, paciente atual, atalho e nutricionista.
  const p = prof(), n = p ? listOf(p.id).length : 0;
  navHtml=`<nav class="nav">
    <div class="side-brand"><span class="mark">${ic('heart','sm')}</span><span>Avaliação<br>Física</span></div>
    <div class="side-links">${tabs.map(([r,i,l])=>`<button class="${cur===r?'on':''}" data-act="go" data-to="${r}" aria-label="${l}">${ic(i)}<span>${l}</span></button>`).join('')}</div>
    ${p ? `<button class="side-pt" data-act="go" data-to="patient" data-id="${p.id}"><small>Paciente atual</small><span class="row">${pAvatar(p)}<span class="grow"><b>${esc(p.name)}</b><small>${plural(n,'avaliação','avaliações')}</small></span>${ic('right','sm')}</span></button>
    <button class="side-cta" data-act="new">${ic('plus')}<span>${hasDraft()?'Continuar avaliação':'Nova avaliação'}</span></button>`
    : `<button class="side-pt" data-act="newProfile"><small>Nenhum paciente ainda</small><span class="row"><span class="avatar" style="background:var(--yellow-2)">${ic('plus','sm')}</span><span class="grow"><b>Cadastrar paciente</b><small>Comece pelo primeiro</small></span>${ic('right','sm')}</span></button>`}
    <button class="side-prof" data-act="go" data-to="profile"><span class="avatar">${esc(initials(nutriName()))}</span><span class="grow"><b>${esc(nutriName())}</b><small>${crnLabel()?esc(crnLabel()):'Perfil profissional'}</small></span>${ic('right','sm')}</button>
  </nav>`; }
  // key muda = tela nova (anima a entrada); dir = indo "para frente" ou voltando
  const key = state.route==='wizard' ? 'wizard' : state.route+':'+(state.param||'');
  const dir = lastRoute==null || (ORDER[state.route]??0) >= (ORDER[lastRoute]??0) ? 'fwd' : 'back';
  lastRoute = state.route;
  options.render(html, navHtml, key, dir);
  maybeTour();
}
function routePath(route,param){const paths={home:'/',patients:'/pacientes',patient:'/pacientes/'+param,nutri:'/perfil/editar',list:'/avaliacoes',detail:'/avaliacoes/'+param,compare:'/evolucao',profile:'/perfil',wizard:state.editingId?'/avaliacoes/'+state.editingId+'/editar':'/nova',onboard:param?'/pessoa/'+param+'/editar':'/pessoa/nova'};return paths[route]||'/';}
// Muda a URL e deixa o syncPath desenhar a tela nova numa única passada (sem piscar a tela antiga).
function go(route,param=null,push=true){state.route=route;state.param=param;state.dd=null;try{sessionStorage.setItem('avf.view.'+options.userId,JSON.stringify(state));}catch{} const to=routePath(route,param); if(push && to!==window.location.pathname) options.navigate(to); else render();}
function syncPath(path){
 let route='home',param=null;
 if(path==='/avaliacoes') route='list'; else if(path==='/evolucao')route='compare';else if(path==='/perfil')route='profile';else if(path==='/perfil/editar')route='nutri';else if(path==='/pacientes')route='patients';else if(path.startsWith('/pacientes/')){route='patient';param=path.split('/')[2];if(db.profiles.some(p=>p.id===param))setActive(param);}else if(path==='/nova')route='wizard';else if(path.startsWith('/pessoa/')){route='onboard';param=path.endsWith('/editar')?path.split('/')[2]:null;}else if(path.startsWith('/avaliacoes/')){param=path.split('/')[2];route=path.endsWith('/editar')?'wizard':'detail';}
 if(route==='wizard' && !draft){if(param&&findA(param)){draft=clone(findA(param));state.editingId=param;db.activeId=draft.profileId;}else if(prof()){draft=newDraft();state.editingId=null;} }
 initForm(route,param); state.dd=null;
 state.route=route;state.param=param;if(route==='wizard'&&draft){state.step=draft._step||0;state.editingId=draft._editing||state.editingId||null;}render();
}
/* ---------- sheet & toast ---------- */
function sheet(title,text,buttons){options.sheet({title,text,buttons});}
function toast(msg){ options.toast(msg); }
function download(name, content, type){
  const blob = new Blob([content], {type}); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

/* ---------- ações ---------- */
const ACT = {
 logout: async () => sheet('Sair da conta?', `Você vai sair de ${options.email||'sua conta'}. Seus pacientes e avaliações continuam salvos.`, [
    {label:'Sair da conta', icon:ic('out','sm'), cls:'danger', fn:async()=>{ await options.logout(); }},
    {label:'Cancelar'}]),
  go: async b => { if (b.dataset.to==='compare' && !b.dataset.keep) {} go(b.dataset.to, b.dataset.id||null); },
  back: async () => go('home'),
  new: async () => {
    // sem paciente não há quem avaliar: leva ao cadastro e explica
    if (!db.profiles.length){ go('onboard'); toast('Cadastre o paciente que você vai avaliar'); return; }
    if (!draft){ draft = newDraft(); state.step = 0; state.editingId = null; }
    else { state.step = draft._step||0; state.editingId = draft._editing||null; }
    saveDraft(); go('wizard');
  },
  resume: async () => ACT.new(),
  /* ---------- acesso do paciente ---------- */
  paCreate: async b => {
    const pid = b.dataset.id; const access = await options.portalAccess.issue(pid);
    PA[pid] = {loaded:true, available:true, access}; render(); toast('Código criado ✓ Agora é só enviar para o paciente');
  },
  paCopy: async b => {
    const a = PA[b.dataset.id]?.access; if (!a) return;
    if (b.dataset.what==='link') await paCopyText(portalLink(a.code), 'Link copiado ✓');
    else await paCopyText(fmtAccessCode(a.code), 'Código copiado ✓');
  },
  paSend: async b => {
    const p = db.profiles.find(x=>x.id===b.dataset.id), a = PA[b.dataset.id]?.access; if (!p || !a) return;
    const msg = `Olá, ${firstName(p.name)}! Agora você pode acompanhar suas avaliações, medidas e evolução online.\n\nAcesse: ${portalLink(a.code)}\nSeu código: ${fmtAccessCode(a.code)}\n\n${nutriName()}`;
    const wa = waLink(p.phone);
    if (wa) { window.open(wa + '?text=' + encodeURIComponent(msg), '_blank', 'noopener'); return; }
    if (navigator.share && matchMedia('(pointer: coarse)').matches){ try { await navigator.share({text:msg}); return; } catch (e) { if (e?.name==='AbortError') return; } }
    await paCopyText(msg, 'Mensagem copiada ✓ Cole no WhatsApp ou e-mail do paciente');
  },
  paTog: async b => {
    const pid = b.dataset.id, a = PA[pid]?.access; if (!a) return;
    const k = b.dataset.k, patch = {[k]: !a[k]};
    const access = await options.portalAccess.update(pid, patch);
    PA[pid] = {...PA[pid], access}; render();
    toast(k==='active' ? (access.active ? 'Acesso reativado' : 'Acesso pausado — o código não funciona até reativar') : k==='photos' ? (access.photos ? 'Fotos visíveis para o paciente' : 'Fotos ocultas do paciente') : (access.notes ? 'Observações visíveis para o paciente' : 'Observações ocultas do paciente'));
  },
  paNew: async b => {
    const pid = b.dataset.id, a = PA[pid]?.access; if (!a) return;
    sheet('Gerar novo código?', 'O código atual para de funcionar na hora. Envie o novo código para o paciente.', [
      {label:'Gerar novo código', cls:'dark', fn:async()=>{ const access = await options.portalAccess.issue(pid, {photos:a.photos, notes:a.notes}); PA[pid] = {loaded:true, available:true, access}; render(); toast('Novo código criado ✓'); }},
      {label:'Cancelar'}]);
  },
  /* ---------- fotos ---------- */
  phCam: async b => openCamera(b.dataset.aid, b.dataset.pose || null, !!b.dataset.file),
  phView: async b => openViewer(b.dataset.aid, b.dataset.pose),
  phCompare: async b => {
    const A = findA(b.dataset.a), B = findA(b.dataset.b); if (!A || !B) return;
    setActive(A.profileId); state.cmpTab = 'ph'; state.phA = A.id; state.phB = B.id;
    state.phPose = POSE_KEYS.find(k=>phGet(A.id,k) && phGet(B.id,k)) || state.phPose;
    go('compare');
  },
  phPose: async b => { state.phPose = b.dataset.v; render(); },
  phMode: async b => { state.phMode = b.dataset.v; render(); },
  phSwap: async () => { [state.phA, state.phB] = [state.phB, state.phA]; render(); },
  // baixa (ou compartilha, no celular) uma imagem com o antes e depois lado a lado
  phShare: async () => {
    const p = prof(), A = findA(state.phA), B = findA(state.phB), k = state.phPose;
    const mA = A && phGet(A.id,k), mB = B && phGet(B.id,k); if (!mA || !mB) return;
    const sub = a => { const r = calc(a,p); return `${fmt(num(a.weight))} kg${r.bf!=null?` · ${fmt(r.bf)}% gordura`:''}`; };
    const blob = await options.composeComparison(PH, [
      {meta:mA, label:`Antes · ${fmtDate(A.date,{day:'2-digit',month:'short',year:'numeric'})}`, sub:sub(A)},
      {meta:mB, label:`Depois · ${fmtDate(B.date,{day:'2-digit',month:'short',year:'numeric'})}`, sub:sub(B)}], `${p.name} · ${poseLabel(k)}`);
    const name = `comparacao-${slugOf(p.name)}-${slugOf(poseLabel(k))}-${A.date}-${B.date}.jpg`;
    const file = typeof File==='function' ? new File([blob], name, {type:'image/jpeg'}) : null;
    if (file && navigator.canShare?.({files:[file]}) && matchMedia('(pointer: coarse)').matches){
      try { await navigator.share({files:[file], title:`${p.name} · antes e depois`}); return; } catch (e) { if (e?.name==='AbortError') return; }
    }
    download(name, blob, 'image/jpeg'); toast('Imagem baixada');
  },
  // celular: engrenagem do detalhe abre um menu com todas as ações da avaliação
  aMenu: async b => {
    const a = findA(b.dataset.id); if (!a) return;
    const p = db.profiles.find(x=>x.id===a.profileId) || prof(), pv = prevOf(a);
    // espera o painel fechar antes de abrir o próximo (PDF e Excluir têm painel próprio)
    const then = fn => () => new Promise(r => setTimeout(()=>r(fn()), 260));
    const fake = {dataset:{id:a.id}};
    sheet('Opções da avaliação', `${p.name} · ${fmtDate(a.date,{day:'numeric',month:'long',year:'numeric'})}`, [
      {label:'Editar avaliação', icon:ic('edit','sm'), cls:'dark', fn:then(()=>ACT.edit(fake))},
      pv && {label:'Comparar com a anterior', icon:ic('swap','sm'), fn:()=>ACT.cmpWith({dataset:{a:pv.id, b:a.id}})},
      PH && {label:phOf(a.id).length ? 'Fotos · câmera guiada' : 'Adicionar fotos', icon:ic('camera','sm'), fn:then(()=>openCamera(a.id))},
      {label:'Exportar em PDF', icon:ic('print','sm'), fn:then(()=>ACT.print(fake))},
      {label:'Excluir avaliação', icon:ic('trash','sm'), cls:'danger', fn:then(()=>ACT.del(fake))},
      {label:'Cancelar'}].filter(Boolean));
  },
  edit: async b => {
    const a = findA(b.dataset.id); if (!a) return;
    const start = async () => { if (draft && !draft._editing && draft.tid) PH?.removeAssessment(draft.tid); draft = clone(a); draft.circ ||= {}; draft.folds ||= {}; draft.extra ||= {}; state.editingId = a.id; state.step = 1; db.activeId = a.profileId; saveDraft(); go('wizard'); };
    if (draft && draft._editing!==a.id) sheet('Substituir rascunho?', 'Há uma avaliação em andamento. Editar esta vai descartar o rascunho atual.', [{label:'Descartar e editar',cls:'dark',fn:start},{label:'Cancelar'}]);
    else start();
  },
  step: async b => { const i = +b.dataset.i; state.stepDir = i<state.step ? 'back' : 'fwd'; state.step = i; saveDraft(); render(); window.scrollTo({top:0,behavior:'smooth'}); },
  nextStep: async () => { state.stepDir = 'fwd'; state.step = Math.min(STEPS.length-1, state.step+1); saveDraft(); render(); window.scrollTo({top:0,behavior:'smooth'}); },
  prevStep: async () => { state.stepDir = 'back'; state.step = Math.max(0, state.step-1); saveDraft(); render(); window.scrollTo({top:0,behavior:'smooth'}); },
  proto: async b => { draft.protocol = b.dataset.v; saveDraft(); render(); },
  multi: async () => { draft.multi = !draft.multi; saveDraft(); render(); },
  wizExit: async () => sheet('Sair da avaliação?', 'O que você já preencheu fica salvo como rascunho para continuar depois.', [
    {label:'Sair e manter rascunho', cls:'dark', fn:async ()=>{ saveDraft(); go('home'); }},
    {label:'Descartar alterações', cls:'danger', fn:async ()=>{ if (draft && !state.editingId && draft.tid) PH?.removeAssessment(draft.tid); draft=null; state.editingId=null; saveDraft(); go('home'); toast('Rascunho descartado'); }},
    {label:'Continuar preenchendo'}]),
  saveA: async () => {
    if (!num(draft.weight) || num(draft.weight)<=0){ toast('Informe o peso'); return; }
    if(draft.date>today()) return toast("A data não pode ser futura");
    const {_step, _editing, _savedAt, tid, ...data} = draft;
    if (state.editingId){
      const i = db.assessments.findIndex(a=>a.id===state.editingId);
      data.id = state.editingId; data.updatedAt = Date.now();
      if (i>=0) db.assessments[i] = data; else db.assessments.push(data);
    } else {
      data.id = tid || uid(); data.createdAt = Date.now(); db.assessments.push(data);
    }
    const p = prof(); if (num(data.height) && !p.height){ p.height = data.height; }
    await save(); const id = data.id; draft = null; state.editingId = null; saveDraft(); clearTimeout(draftTimer); await draftPending; await options.saveDraft(null);
     phSync(); go('detail', id); toast('Avaliação salva ✓');
  },
  del: async b => sheet('Excluir avaliação?', 'Esta ação não pode ser desfeita.', [
    {label:'Excluir', cls:'danger', fn:async ()=>{ db.assessments = db.assessments.filter(a=>a.id!==b.dataset.id); PH?.removeAssessment(b.dataset.id); await save(); go('list'); toast('Avaliação excluída'); }},
    {label:'Cancelar'}]),
  // menu de PDFs: no detalhe (b.dataset.id/param = avaliação) ou geral (Perfil), usando a última avaliação
  print: async b => {
    const a = findA(b.dataset.id || (state.route==='detail' ? state.param : null)) || listOf(prof().id).at(-1);
    if (!a) return toast('Nenhuma avaliação para exportar');
    const p = db.profiles.find(x=>x.id===a.profileId) || prof(), list = listOf(p.id), i = list.findIndex(x=>x.id===a.id), prev = i>0 ? list[i-1] : null;
    const isLast = i === list.length-1, quem = state.route==='detail' ? 'Esta avaliação' : 'Última avaliação';
    const opts = [
      {label:`${quem} — relatório completo`, cls:'dark', fn:async()=>exportPdf('assessment',{a,p,list})},
      {label:`${quem} — resumo em 1 página`, fn:async()=>exportPdf('summary',{a,p,list})},
      prev && {label:`Comparativo com a anterior (${fmtDate(prev.date,{day:'2-digit',month:'2-digit'})} × ${fmtDate(a.date,{day:'2-digit',month:'2-digit'})})`, fn:async()=>exportPdf('compare',{p,A:prev,B:a})},
      list.length>1 && {label:`Evolução — todas as ${list.length} avaliações`, fn:async()=>exportPdf('evolution',{p,list})},
      {label:'Histórico completo — tudo em um PDF', fn:async()=>exportPdf('full',{p,list})},
      {label:'Cancelar'},
    ].filter(Boolean);
    sheet('Exportar PDF', `${p.name} ·${list.length} ${list.length===1?'avaliação':'avaliações'}${isLast||state.route!=='detail'?'':' · avaliação de '+fmtDate(a.date)}. Na janela que abrir, escolha "Salvar como PDF".`, opts);
  },
  exportCmp: async () => {
    const p = prof(), list = listOf(p.id);
    if (state.cmpTab==='ab'){ const A = findA(state.cmpA), B = findA(state.cmpB); if (A && B) return exportPdf('compare',{p,A,B}); }
    if (list.length < 2) return toast('A evolução precisa de pelo menos 2 avaliações');
    exportPdf('evolution',{p,list});
  },
  evo: async b => { state.evo = b.dataset.m; state.cmpTab = 'evo'; if (state.route!=='compare') go('compare'); else render(); },
  cmpTab: async b => { state.cmpTab = b.dataset.v; render(); },
  cmpWith: async b => { state.cmpA = b.dataset.a; state.cmpB = b.dataset.b; state.cmpTab = 'ab'; go('compare'); },
  swapAB: async () => { [state.cmpA, state.cmpB] = [state.cmpB, state.cmpA]; render(); },
  onlyFilled: async () => { state.onlyFilled = !state.onlyFilled; render(); },
  pfsex: async b => { document.querySelectorAll('#pf-sex button').forEach(x=>x.classList.toggle('on', x===b)); },
  saveProfile: async b => {
    const name = document.getElementById('pf-name').value.trim();
    const sex = document.querySelector('#pf-sex .on')?.dataset.v;
    const birth = document.getElementById('pf-birth').value;
    const height = document.getElementById('pf-height').value.trim();
    if (!name) return toast('Informe o nome');
    if (!sex) return toast('Selecione o sexo');
    if (!birth || birth>today()) return toast('Informe a data de nascimento');
    const email = document.getElementById('pf-email').value.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast('E-mail inválido');
    const phone = fmtPhone(document.getElementById('pf-phone').value);
    if (phone && phoneDigits(phone).length < 10) return toast('Telefone incompleto: use DDD + número');
    const ficha = { phone: phone || null, email: email || null,
      goal: state.form.goal || null, returnDays: num(state.form.ret) || null,
      notes: document.getElementById('pf-notes').value.trim() || null };
    let id = b.dataset.id;
    if (id){ Object.assign(db.profiles.find(p=>p.id===id), {name,sex,birth,height}, ficha); }
    else { const p = {id:uid(), name, sex, birth, height, ...ficha, archived:false, createdAt:Date.now()}; db.profiles.push(p); id = p.id; setActive(id); }
    const first = db.profiles.length===1 && !b.dataset.id;
    state.setup = false; try { localStorage.setItem(SETUP_KEY,'skip'); } catch {}
    await save(); go(first ? 'home' : 'patient', first ? null : id); toast(b.dataset.id ? 'Paciente atualizado' : 'Paciente cadastrado ✓');
  },
  editProfile: async () => go('onboard', prof().id),
  newProfile: async () => go('onboard'),
  switchProfile: async b => { setActive(b.dataset.id); go('home'); toast('Paciente: '+prof().name); },
  openAs: async b => { setActive(b.dataset.id); go(b.dataset.to); },
  // nova avaliação a partir da ficha: se houver rascunho de outro paciente, pergunta antes
  newFor: async b => {
    const p = db.profiles.find(x=>x.id===b.dataset.id); if (!p) return;
    if (draft && draft.profileId!==p.id){
      const other = db.profiles.find(x=>x.id===draft.profileId);
      return sheet('Avaliação em andamento', `Existe uma avaliação ${draft._editing?'em edição':'não concluída'} de ${other?other.name:'outro paciente'}. O que deseja fazer?`, [
        {label:`Começar a de ${firstName(p.name)} (descarta a outra)`, cls:'dark', fn:async()=>{ if (draft && !draft._editing && draft.tid) PH?.removeAssessment(draft.tid); draft=null; state.editingId=null; setActive(p.id); await ACT.new(); }},
        other && {label:`Continuar a de ${firstName(other.name)}`, fn:async()=>{ setActive(other.id); await ACT.new(); }},
        {label:'Cancelar'}].filter(Boolean));
    }
    setActive(p.id); await ACT.new();
  },
  archive: async b => {
    const p = db.profiles.find(x=>x.id===b.dataset.id); if (!p) return;
    p.archived = !p.archived; await save(); render(); toast(p.archived ? `${firstName(p.name)} foi arquivado` : `${firstName(p.name)} voltou para os ativos`);
  },
  ddToggle: async b => { state.dd = state.dd===b.dataset.dd ? null : b.dataset.dd; render(); },
  ddPick: async b => { const fn = DD_PICK[b.dataset.dd]; state.dd = null; if (fn) fn(b.dataset.v); render(); app.querySelector(`[data-act="ddToggle"][data-dd="${b.dataset.dd}"]`)?.focus({preventScroll:true}); },
  pfilter: async b => { state.pf = b.dataset.v; if (state.route!=='patients') go('patients'); else { try{sessionStorage.setItem('avf.view.'+options.userId,JSON.stringify(state));}catch{} render(); } },
  saveNutri: async () => {
    const v = id => document.getElementById(id).value.trim();
    const next = { name:v('nu-name'), crn:v('nu-crn'), specialty:v('nu-spec'), phone:fmtPhone(v('nu-phone')), place:v('nu-place'), returnDays: num(state.form.nret) || 30, ...(nutri.tourSeen ? {tourSeen:true} : {}) };
    if (!next.name) return toast('Informe seu nome');
    if (next.phone && phoneDigits(next.phone).length < 10) return toast('Telefone incompleto: use DDD + número');
    const setup = inSetup();
    await options.saveNutri(next); nutri = next;
    if (setup){ state.setup = true; go('onboard'); toast('Perfil salvo ✓'); return; }
    go('profile'); toast('Perfil salvo ✓');
  },
  tour: async () => { if (state.route!=='home'){ go('home'); setTimeout(startTour, 650); } else startTour(); },
  skipSetup: async () => { try { localStorage.setItem(SETUP_KEY,'skip'); } catch {} state.setup = true; go('onboard'); },
  setupLater: async () => { try { localStorage.setItem(SETUP_KEY,'skip'); } catch {} state.setup = false; go('home'); toast('Tudo pronto! Cadastre o paciente quando quiser.'); },
  delProfile: async b => { const p = db.profiles.find(x=>x.id===b.dataset.id) || prof(); sheet(`Excluir ${p.name}?`, `Isso remove o paciente e ${plural(listOf(p.id).length,'avaliação','avaliações')}. Não pode ser desfeito — se quiser só tirar da lista, use “Arquivar”.`, [
    {label:'Excluir definitivamente', cls:'danger', fn:async ()=>{ for (const a of listOf(p.id)) PH?.removeAssessment(a.id); db.assessments = db.assessments.filter(a=>a.profileId!==p.id); db.profiles = db.profiles.filter(x=>x.id!==p.id); if (db.activeId===p.id) db.activeId = (db.profiles.find(x=>!x.archived)||db.profiles[0])?.id||null; if (draft?.profileId===p.id){ draft=null; saveDraft(); } await save(); go(db.profiles.length?'patients':'home'); toast('Paciente excluído'); }},
    {label:'Cancelar'}]); },
  export: async () => { download(`avaliacao-fisica-backup-${today()}.json`, JSON.stringify({app:'avaliacao-fisica', version:1, exportedAt:new Date().toISOString(), ...db}, null, 2), 'application/json'); toast('Backup exportado'); },
  import: async () => document.getElementById('importFile').click(),
  // ficha do paciente: escolhe o formato (planilha para abrir no Excel; JSON com os dados completos, restaurável)
  exportPt: async b => {
    const p = db.profiles.find(x=>x.id===b.dataset.id) || prof(); if (!p) return;
    const n = listOf(p.id).length, slug = norm(firstName(p.name)).replace(/[^a-z0-9]+/g,'-') || 'paciente';
    sheet(`Exportar dados de ${firstName(p.name)}`, n ? `${plural(n,'avaliação','avaliações')} · escolha o formato do arquivo.` : 'Ainda sem avaliações — a planilha fica disponível depois da primeira.', [
      {label:'Planilha (CSV)', sub:'Abre no Excel ou Google Planilhas · uma linha por avaliação', icon:ic('table'), cls:'opt', fn:()=>ACT.csv({dataset:{id:p.id}})},
      {label:'Arquivo JSON', sub:'Ficha e avaliações completas · dá para restaurar depois', icon:ic('code'), cls:'opt', fn:async()=>{
        download(`paciente-${slug}-${today()}.json`, JSON.stringify({app:'avaliacao-fisica', version:1, exportedAt:new Date().toISOString(), activeId:p.id, profiles:[p], assessments:listOf(p.id)}, null, 2), 'application/json'); toast('Arquivo JSON exportado'); }},
      {label:'Cancelar'}]);
  },
  csv: async b => {
    const p = db.profiles.find(x=>x.id===b?.dataset?.id) || prof(), list = listOf(p.id);
    if (!list.length) return toast('Nenhuma avaliação para exportar');
    const cols = [{l:'Data',get:a=>a.date},{l:'Protocolo',get:a=>PROTOCOLS[a.protocol||'jp7'].short},{l:'Altura (cm)',get:a=>num(a.height)}, ...METRICS.map(m=>({l:m.l+(m.u?` (${m.u})`:''), get:(a,r)=>m.get(a,r), d:m.d??2}))];
    const cell = v => v==null ? '' : typeof v==='number' ? v.toFixed(2).replace('.',',') : `"${String(v).replace(/"/g,'""')}"`;
    const rows = [cols.map(c=>cell(c.l)).join(';'), ...list.map(a=>{ const r = calc(a,p); return cols.map(c=>cell(c.get(a,r))).join(';'); })];
    download(`avaliacoes-${firstName(p.name).toLowerCase()}-${today()}.csv`, '﻿'+rows.join('\n'), 'text/csv;charset=utf-8'); toast('Planilha exportada');
  },
};
const click = async e => {
  // menu aberto + clique fora dele: fecha
  if (state.dd && !e.target.closest('.dd')){ state.dd = null; render(); }
  const b = e.target.closest('[data-act]'); if (!b) return;
  const fn = ACT[b.dataset.act]; if (fn){ e.preventDefault();
    // ação demorada (salvar na nuvem): o botão "respira" e bloqueia clique duplo
    const busy = setTimeout(()=>b.setAttribute('data-busy',''), 180);
    try { await fn(b,e); } catch (e2) { toast(motivo(e2,'Não foi possível salvar. Tente novamente.')); }
    finally { clearTimeout(busy); b.removeAttribute('data-busy'); } }
};
const input = e => {
  if (e.target.id==='pt-q'){ state.pq = e.target.value; render(); return; }
  if (e.target.dataset?.mask==='phone'){
    const el = e.target, v = fmtPhone(el.value);
    // apagando: não recoloca o traço/parêntese que a pessoa acabou de remover
    if (e.inputType?.startsWith('delete') && phoneDigits(v)===phoneDigits(el.value) && v.length>el.value.length) return;
    if (v!==el.value){ el.value = v; el.setSelectionRange(v.length, v.length); }
    return;
  }
  const k = e.target.dataset?.k;
  if (k && draft && state.route==='wizard'){ setPath(draft, k, e.target.value); saveDraft(); updateLive(); }
};
const change = e => {
  const c = e.target.dataset?.ch;
  if (c==='cmpA' || c==='cmpB'){ state[c] = e.target.value; render(); }
  if (c==='phA' || c==='phB'){ state[c] = e.target.value; render(); }
  if (e.target.dataset?.k==='date' && state.route==='wizard') render();
};
// Enter avança para o próximo campo
// comparativo de fotos: arrastar sobre a foto move o divisor (Deslizar) ou a transparência (Sobrepor)
let phDrag = null;
function phSet(st, v){
  v = Math.max(0, Math.min(100, Math.round(v)));
  const fade = state.phMode==='fade'; state[fade ? 'phO' : 'phX'] = v;
  const box = st.closest('.phc'); box?.style.setProperty(fade ? '--o' : '--x', fade ? String(v/100) : v+'%'); st.setAttribute('aria-valuenow', v);
}
const pdown = e => { const st = e.target.closest?.('.phc-stage'); if (!st) return; phDrag = st; st.setPointerCapture?.(e.pointerId); const r = st.getBoundingClientRect(); phSet(st, (e.clientX-r.left)/r.width*100); };
const pmove = e => { if (!phDrag) return; const r = phDrag.getBoundingClientRect(); phSet(phDrag, (e.clientX-r.left)/r.width*100); };
const pup = () => { phDrag = null; };
const keydown = e => {
  if ((e.key==='ArrowLeft'||e.key==='ArrowRight') && e.target.classList?.contains('phc-stage')){ e.preventDefault(); const cur = state.phMode==='fade' ? (state.phO??50) : (state.phX??50); phSet(e.target, cur + (e.key==='ArrowRight'?5:-5)); return; }
  if (e.key==='Escape' && state.dd){ const id = state.dd; state.dd = null; render(); app.querySelector(`[data-act="ddToggle"][data-dd="${id}"]`)?.focus({preventScroll:true}); return; }
  // setas navegam entre as opções do menu aberto
  if ((e.key==='ArrowDown'||e.key==='ArrowUp') && state.dd){ const o=[...app.querySelectorAll('.dd.open .dd-opt')]; if(o.length){ e.preventDefault(); const i=o.indexOf(document.activeElement); o[(i<0?(e.key==='ArrowDown'?0:o.length-1):(i+(e.key==='ArrowDown'?1:-1)+o.length)%o.length)].focus(); } return; }
  if (e.key!=='Enter' || !e.target.matches('input[data-k]')) return;
  e.preventDefault();
  const ins = [...document.querySelectorAll('input[data-k]')]; const i = ins.indexOf(e.target);
  if (ins[i+1]) ins[i+1].focus(); else { e.target.blur(); ACT.nextStep(); }
};

const importChange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const data=JSON.parse(await f.text());const preview=options.previewImport(data);sheet('Importar backup',`${preview.profiles.length} pessoas e ${preview.assessments.length} avaliações.`,[{label:'Importar sem duplicar',cls:'dark',fn:async()=>{try{db=await options.importBackup(preview);go('home');toast('Backup importado');}catch(e2){toast(motivo(e2,'Não foi possível importar o backup'));}}},{label:'Cancelar'}]);}catch(e2){toast(motivo(e2,'Arquivo de backup inválido'));}e.target.value='';};
let file=null;
function listen(on){
  const m = on ? 'addEventListener' : 'removeEventListener';
  if (on) file = document.getElementById('importFile');
  file?.[m]('change',importChange);
  app[m]('click',click); app[m]('input',input); app[m]('change',change); app[m]('keydown',keydown);
  app[m]('pointerdown',pdown); app[m]('pointermove',pmove); app[m]('pointerup',pup); app[m]('pointercancel',pup);
}
listen(true);
syncPath(options.path);
phSync();
// attach: o app continua vivo entre páginas; só troca o elemento onde desenha (sem recarregar dados).
function attach(el, path){ listen(false); app = el; listen(true); syncPath(path); }
return {syncPath,attach,destroy(){clearTimeout(draftTimer); draftPending.catch(()=>{}).then(()=>options.saveDraft(draft)).catch(()=>{});listen(false);}};

}
