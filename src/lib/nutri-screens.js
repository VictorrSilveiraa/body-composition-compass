import { esc, initials, PROTOCOLS } from './calculos.js';
import {
  SPECIALTIES, BIO_MAX, BRAND_COLORS, brandColor, TREATS, MODES, CRN_REGIONS, crnParts, crnJoin, crnLabel, displayName, signLine,
  specialtiesOf, igHandle, igUrl, webUrl, webLabel, waUrl, placeLine, validate, cleanNutri, checklist, completeness, pdfPrefs, workPrefs, splitTreat,
} from './nutri';
import { FORMULAS, ACTIVITY } from './plano';
import { motivo } from './motivo';

/*
 * Perfil do nutricionista no app: tela do perfil (/perfil) e edição em abas (/perfil/editar, também no 1º acesso).
 *  · Perfil: foto, tratamento (Dra./Dr.), nome, CRN, especialidades, apresentação
 *  · Contato: WhatsApp, e-mail, Instagram, site, link de agendamento, onde e como atende
 *  · Marca e PDF: logo, nome da marca, cor, assinatura e como os PDFs saem
 *  · Preferências: padrões das consultas (retorno, protocolo, 3 leituras, "Confere?"), energia e portal
 * Prévia ao vivo de como o paciente vê (portal) e de como os PDFs saem.
 * Regras e formatação em nutri.ts; imagens em nutri-media.ts + components/media-editor.tsx.
 */
export function nutriScreens(ctx){
const { options, state, ic, go, render, toast, sheet, dropdown, formBar, fmtPhone, phoneDigits, idCard } = ctx;
const N = () => ctx.nutri();
const RETURNS = [15,30,45,60,90];
const TABS = [['perfil','Perfil','user'],['contato','Contato','phone'],['marca','Marca e PDF','badge'],['prefs','Preferências','gear']];
const SETUP_TABS = ['perfil','contato','marca'];

/* ---------- imagens (links temporários; recarregados quando o caminho muda) ---------- */
let MU = { photo:'', logo:'', sign:'' }, muKey = null, muBusy = null;
function media(){
  const n = N(), key = [n.photoPath, n.logoPath, n.signPath].join('|');
  if (!options.media || key === muKey || muBusy) return MU;
  muBusy = options.media.urls(n).then(u => { MU = u; muKey = key; }).catch(() => { muKey = key; }).finally(() => { muBusy = null; render(); });
  return MU;
}
/** links atuais (espera carregar) — usado antes de gerar PDF */
async function mediaNow(){ media(); if (muBusy) await muBusy; return MU; }
const nameOf = () => (N().name||'').trim() || (options.email||'').split('@')[0] || 'Nutricionista';
/** conteúdo do avatar (foto ou iniciais) — usado no menu, no topo e no perfil */
const avatarInner = () => { const u = media().photo; return u ? `<img src="${esc(u)}" alt="">` : esc(initials(nameOf())); };
const avatar = (cls='') => `<span class="avatar ${cls}${media().photo?' has-img':''}">${avatarInner()}</span>`;

/* ---------- formulário (estado da edição, fora do perfil salvo até "Salvar") ---------- */
function formOf(n){
  const { reg, num } = crnParts(n.crn), st = splitTreat(n.name);
  // "Dra." digitado no nome vira a opção de tratamento (evita "Dra. Dra. Helena")
  return { ...JSON.parse(JSON.stringify(n)), name: st.rest, treat: n.treat || st.treat || '', crnReg: reg, crnNum: num, specialties: specialtiesOf(n), pdf: pdfPrefs(n), prefs: workPrefs(n), returnDays: n.returnDays || 30 };
}
const comparable = f => { const { photoPath, logoPath, signPath, tourSeen, ...rest } = f; return JSON.stringify(rest); };
function initForm(tab){
  const f = formOf(N()); state.form = { nu: f, nuBase: comparable(f), nuTab: TABS.some(t=>t[0]===tab) ? tab : 'perfil' };
}
const F = () => { if (!state.form?.nu) initForm(); return state.form.nu; };
const dirty = () => !!state.form?.nu && comparable(state.form.nu) !== state.form.nuBase;
/** o formulário vira perfil (sem os campos auxiliares) */
function toProfile(f){
  const { crnReg, crnNum, ...rest } = f;
  const n = cleanNutri({ ...rest, crn: crnJoin(crnReg, crnNum), phone: fmtPhone(f.phone||'') });
  // imagens e flags vêm sempre do perfil salvo (são gravadas na hora, fora do "Salvar")
  const cur = N(); n.photoPath = cur.photoPath || null; n.logoPath = cur.logoPath || null; n.signPath = cur.signPath || null;
  if (cur.tourSeen) n.tourSeen = true; if (cur.returnMsg) n.returnMsg = cur.returnMsg;
  return n;
}
let pvTimer = 0;
function onInput(el){
  const k = el.dataset.nu; if (!k) return false;
  const f = F();
  if (k.startsWith('pdf.')) f.pdf[k.slice(4)] = el.value; else f[k] = el.value;
  if (k==='bio'){ const c = app()?.querySelector('[data-nu-count]'); if (c){ c.textContent = `${el.value.length}/${BIO_MAX}`; c.classList.toggle('over', el.value.length > BIO_MAX); } }
  // prévia ao vivo sem atrapalhar a digitação
  clearTimeout(pvTimer); pvTimer = setTimeout(render, 160);
  return true;
}
const app = () => ctx.app();

/* ---------- prévias ---------- */
function portalPreview(f){
  const n = toPreview(f), sp = specialtiesOf(n), crn = crnLabel(n.crn), pl = placeLine(n);
  const btn = (on, icon, l) => on ? `<span class="nu-pv-b">${ic(icon,'sm')}${l}</span>` : '';
  return `<div class="nu-pv nu-pv-portal" aria-label="Prévia do portal do paciente">
    <div class="nu-pv-who">${media().photo ? `<span class="avatar has-img"><img src="${esc(media().photo)}" alt=""></span>` : `<span class="avatar">${esc(initials(n.name||'?'))}</span>`}
      <span class="grow"><small>Seu nutricionista</small><b>${esc(displayName(n) || 'Seu nome aqui')}</b><span>${esc([crn, sp.slice(0,3).join(', ')].filter(Boolean).join(' · ') || 'Acompanhamento nutricional')}</span></span></div>
    ${n.bio ? `<p class="nu-pv-bio">${esc(n.bio)}</p>` : ''}
    <div class="nu-pv-bs">${btn(waUrl(n.phone),'chat','WhatsApp')}${btn(n.booking,'cal','Agendar')}${btn(igHandle(n.instagram),'link','Instagram')}${btn(webUrl(n.site) && !n.booking,'link','Site')}</div>
    ${pl ? `<span class="nu-pv-pl">${ic('pin','sm')}${esc(pl)}</span>` : ''}
  </div>`;
}
const toPreview = f => ({ ...f, crn: crnJoin(f.crnReg, f.crnNum) });
function pdfPreview(f){
  const n = toPreview(f), pp = f.pdf, col = brandColor(f.color), brand = (n.clinic||'').trim() || displayName(n) || 'Sua marca';
  const head = pp.head==='logoOnly' && media().logo ? `<img class="nu-pdf-logo only" src="${esc(media().logo)}" alt=""><span><small>Relatório de composição corporal</small></span>`
    : pp.head==='logo' && media().logo ? `<img class="nu-pdf-logo" src="${esc(media().logo)}" alt=""><span><b>${esc(brand)}</b><small>Relatório de composição corporal</small></span>`
    : pp.head==='system' ? `<span class="nu-pdf-mark" style="background:var(--yellow)">${ic('heart','sm')}</span><span><b>Avaliação Física</b><small>Relatório de composição corporal</small></span>`
    : `<span class="nu-pdf-mark" style="background:${col.bg};color:${col.ink}">${esc(initials(brand))}</span><span><b>${esc(brand)}</b><small>Relatório de composição corporal</small></span>`;
  const contacts = pp.contacts ? [fmtPhone(n.phone||''), igHandle(n.instagram) ? '@'+igHandle(n.instagram) : '', webLabel(n.site), (n.email||'').trim()].filter(Boolean).join(' · ') : '';
  const sign = pp.sign==='image' && media().sign ? `<img src="${esc(media().sign)}" alt="">` : '';
  return `<div class="nu-pv nu-pv-pdf" style="--pv-accent:${pp.head==='system'?'var(--yellow)':col.bg};--pv-ink:${pp.head==='system'?'var(--yellow-ink)':col.ink}" aria-label="Prévia do PDF">
    <div class="nu-pdf-head">${head}<span class="nu-pdf-date"><small>Data da avaliação</small><b>21 nov 2026</b></span></div>
    <div class="nu-pdf-body"><i style="width:62%"></i><i style="width:88%"></i><span class="nu-pdf-cards"><i></i><i></i><i></i></span><i style="width:74%"></i></div>
    <div class="nu-pdf-foot">${pp.sign!=='none' ? `<span class="nu-pdf-sign">${sign}<span class="line"></span><small>${esc(signLine(n) || 'Seu nome · CRN')}</small></span>` : ''}
      <span class="nu-pdf-note">${contacts ? `<b>${esc(contacts)}</b>` : ''}${esc((pp.note||'').trim() || 'Valores estimados por equações de referência; este documento é informativo…')}</span></div>
  </div>`;
}

/* ---------- campos ---------- */
const tf = (k, label, ph, { hint='', type='text', val, pre='', mode='', max='' } = {}) => {
  const v = val ?? (k.startsWith('pdf.') ? F().pdf[k.slice(4)] : F()[k]) ?? '';
  return `<label class="field"><div class="f-top"><span class="f-label">${label}</span></div>${hint?`<span class="f-hint">${hint}</span>`:''}
    <div class="f-input text${pre?' has-pre':''}">${pre?`<em class="f-pre">${pre}</em>`:''}<input data-nu="${k}" type="${type}" value="${esc(type==='tel'?fmtPhone(v):v)}" placeholder="${esc(ph)}" autocomplete="off"${type==='tel'?' inputmode="tel" data-mask="phone" maxlength="15"':''}${mode?` inputmode="${mode}"`:''}${max?` maxlength="${max}"`:''}></div></label>`;
};
const seg = (act, opts, cur, cls='') => `<div class="seg full ${cls}" role="radiogroup">${opts.map(([v,l,dis])=>`<button type="button" role="radio" aria-checked="${v===cur}" class="${v===cur?'on':''}" data-act="${act}" data-v="${v}"${dis?' disabled':''}>${l}</button>`).join('')}</div>`;
const toggle = (k, on, title, sub) => `<button type="button" class="toggle" data-act="nuPref" data-k="${k}" aria-pressed="${on}"><span><b>${title}</b><br><span class="small muted">${sub}</span></span><span class="switch ${on?'on':''}"></span></button>`;
function mediaTile(k, title, sub, emptyIco){
  const u = media()[k], has = !!N()[k+'Path'];
  return `<div class="nu-media nu-media-${k}">
    <div class="nu-media-pv">${u ? `<img src="${esc(u)}" alt="">` : has ? '<span class="me-spin"></span>' : ic(emptyIco)}</div>
    <div class="grow"><b>${title}</b><span>${sub}</span></div>
    <button type="button" class="btn ${has?'ghost':'dark'} sm" data-act="nuMedia" data-k="${k}">${has ? 'Trocar' : 'Adicionar'}</button></div>`;
}

function tabPerfil(f){
  const sp = f.specialties, custom = sp.filter(s=>!SPECIALTIES.includes(s));
  const photo = media().photo;
  return `<div class="nu-photo">
      <button type="button" class="nu-photo-av" data-act="nuMedia" data-k="photo" aria-label="${N().photoPath?'Trocar foto':'Adicionar foto'}">${photo ? `<img src="${esc(photo)}" alt="">` : `<span>${esc(initials(f.name||nameOf()))}</span>`}<em>${ic('camera','sm')}</em></button>
      <div class="grow"><b>Foto de perfil</b><span>Seus pacientes reconhecem você no portal. Use uma foto de rosto, com boa luz.</span>
        <button type="button" class="btn ${N().photoPath?'ghost':'dark'} sm" data-act="nuMedia" data-k="photo">${N().photoPath ? 'Trocar foto' : 'Adicionar foto'}</button></div></div>
    <div class="form-grid">
      <div class="field"><div class="f-top"><span class="f-label">Como prefere ser chamado(a)</span></div><span class="f-hint">Vale para o portal, os PDFs e as mensagens: ${esc(displayName({ ...f, name: f.name || 'Helena Duarte' }))}</span>
        ${seg('nuTreat', TREATS.map(t=>[t.k,t.l]), f.treat||'')}</div>
      ${tf('name','Nome completo','Seu nome',{hint:'Aparece como avaliador(a) nas avaliações e nos relatórios.'})}
      <div class="field"><div class="f-top"><span class="f-label">Registro profissional (CRN)</span></div><span class="f-hint">Sai nos PDFs como ${esc(crnLabel(crnJoin(f.crnReg||'3', f.crnNum||'12345')))}.</span>
        <div class="nu-crn">${dropdown('nuCrnReg', [['','Região'], ...CRN_REGIONS.map(r=>[r,`CRN-${r}`])], f.crnReg||'', {label:'Região do CRN'})}
          <div class="f-input text"><input data-nu="crnNum" value="${esc(f.crnNum||'')}" placeholder="Número" inputmode="numeric" autocomplete="off" aria-label="Número do CRN" maxlength="12"></div></div></div>
      <div class="field"><div class="f-top"><span class="f-label">Especialidades</span><span class="f-prev">${sp.length ? `${sp.length} ${sp.length===1?'escolhida':'escolhidas'}` : 'escolha até 6'}</span></div>
        <span class="f-hint">Aparecem no portal e no seu perfil.</span>
        <div class="nu-chips">${SPECIALTIES.map(s=>`<button type="button" class="chip ${sp.includes(s)?'on':''}" data-act="nuSpec" data-v="${esc(s)}" aria-pressed="${sp.includes(s)}">${sp.includes(s)?ic('check','sm'):''}${esc(s)}</button>`).join('')}
          ${custom.map(s=>`<button type="button" class="chip on" data-act="nuSpec" data-v="${esc(s)}" aria-label="Tirar ${esc(s)}">${esc(s)}${ic('x','sm')}</button>`).join('')}</div>
        <div class="nu-add"><div class="f-input text"><input id="nu-spec-add" placeholder="Outra especialidade" maxlength="40" autocomplete="off" enterkeyhint="done"></div><button type="button" class="btn ghost sm" data-act="nuSpecAdd">${ic('plus','sm')} Incluir</button></div></div>
      <label class="field"><div class="f-top"><span class="f-label">Apresentação</span><span class="f-prev nu-count ${(f.bio||'').length>BIO_MAX?'over':''}" data-nu-count>${(f.bio||'').length}/${BIO_MAX}</span></div>
        <span class="f-hint">Uma ou duas frases para o paciente conhecer seu trabalho. Aparece no portal.</span>
        <div class="f-input"><textarea data-nu="bio" maxlength="${BIO_MAX}" rows="3" placeholder="Ex.: Ajudo mulheres a emagrecer sem dietas restritivas, com foco em comportamento e rotina real.">${esc(f.bio||'')}</textarea></div></label>
    </div>`;
}
function tabContato(f){
  return `<div class="form-grid">
      ${tf('phone','WhatsApp','(11) 99999-9999',{type:'tel', hint:'Vira o botão “Falar no WhatsApp” no portal do paciente.'})}
      ${tf('email','E-mail de contato',options.email||'seu@email.com',{type:'email', mode:'email', hint:'Opcional. Aparece no portal e no rodapé dos PDFs (se você quiser).'})}
      <div class="fields two">${tf('instagram','Instagram','seu.perfil',{pre:'@', hint:'Sem o @'})}${tf('site','Site','www.seusite.com.br',{mode:'url', hint:'Opcional'})}</div>
      ${tf('booking','Link de agendamento','https://…',{mode:'url', hint:'Calendly, Google Agenda, Doctoralia… vira o botão “Agendar consulta” no portal.'})}
    </div>
    <h2 class="sec">Atendimento</h2>
    <div class="form-grid">
      <div class="field"><div class="f-top"><span class="f-label">Como você atende</span></div>${seg('nuMode', MODES.map(m=>[m.k,m.l]), f.mode||'', 'three')}</div>
      ${f.mode==='online' ? '' : `${tf('place','Local de atendimento','Ex.: Consultório Vida Leve, Moema',{hint:'Nome do consultório, clínica ou bairro.'})}
      ${tf('address','Endereço','Rua, número, cidade',{hint:'Opcional. No portal vira um link para o mapa.'})}`}
    </div>`;
}
function tabMarca(f){
  const pp = f.pdf, hasSign = !!N().signPath;
  return `<div class="form-grid">
      ${mediaTile('logo','Logo','PNG com fundo transparente fica melhor. Se tiver fundo branco, o sistema tira.','image')}
      ${tf('clinic','Nome da marca ou consultório',displayName(toPreview(f)) || 'Ex.: Nutri Helena Duarte',{hint:'No topo dos PDFs, ao lado do logo. Sem ele, vai o seu nome.', max:'60'})}
      <div class="field"><div class="f-top"><span class="f-label">Cor da marca</span><span class="f-prev">${esc(brandColor(f.color).l)}</span></div><span class="f-hint">Detalhes dos PDFs e do seu portal.</span>
        <div class="nu-colors" role="radiogroup" aria-label="Cor da marca">${BRAND_COLORS.map(c=>`<button type="button" role="radio" aria-checked="${brandColor(f.color).k===c.k}" class="nu-color ${brandColor(f.color).k===c.k?'on':''}" data-act="nuColor" data-v="${c.k}" style="--c:${c.bg};--ci:${c.ink}" aria-label="${c.l}" title="${c.l}"><i></i></button>`).join('')}</div></div>
      ${mediaTile('sign','Assinatura','Desenhe na tela ou envie a foto da sua assinatura no papel.','edit')}
    </div>
    <h2 class="sec">Seus PDFs</h2>
    <div class="form-grid">
      <div class="field"><div class="f-top"><span class="f-label">Topo do documento</span></div>
        ${seg('nuPdfHead', [['logo','Logo e nome'],['logoOnly','Só o logo'],['name','Só o nome']], pp.head==='system' ? 'name' : pp.head, 'three')}
        ${(pp.head==='logo' || pp.head==='logoOnly') && !N().logoPath ? '<span class="f-hint nu-warn">Sem logo cadastrado: sai o nome com as iniciais na cor da marca.</span>' : ''}</div>
      <div class="field"><div class="f-top"><span class="f-label">Assinatura no rodapé</span></div>
        ${seg('nuPdfSign', [['image','Minha assinatura',!hasSign],['line','Linha para assinar'],['none','Sem assinatura']], pp.sign==='image' && !hasSign ? 'line' : pp.sign, 'three')}
        ${!hasSign ? '<span class="f-hint">Cadastre a assinatura acima para os PDFs já saírem assinados.</span>' : ''}</div>
      ${toggle('pdf.contacts', pp.contacts, 'Contatos no rodapé', 'WhatsApp, Instagram, site e e-mail, para o paciente achar você')}
      <label class="field"><div class="f-top"><span class="f-label">Texto final do rodapé</span><span class="f-prev">opcional</span></div><span class="f-hint">Ex.: horário de atendimento, um recado ou o aviso legal da sua clínica. Vazio = aviso padrão.</span>
        <div class="f-input"><textarea data-nu="pdf.note" rows="2" maxlength="220" placeholder="Valores estimados por equações de referência; este documento é informativo e não substitui avaliação profissional.">${esc(pp.note||'')}</textarea></div></label>
      <button type="button" class="act-row" data-act="nuTest"><span class="chip-ico">${ic('pdf','sm')}</span><span class="grow"><b>Ver um PDF de teste</b><span>Usa a última avaliação, já com as mudanças desta tela</span></span>${ic('right','sm')}</button>
    </div>`;
}
function tabPrefs(f){
  const p = f.prefs, adults = Object.entries(PROTOCOLS).filter(([,pr])=>!pr.kids).map(([k,pr])=>[k,pr.name]);
  return `<h2 class="sec" style="margin-top:4px">Consultas</h2>
    <div class="form-grid">
      <div class="field"><div class="f-top"><span class="f-label">Retorno padrão</span></div><span class="f-hint">Para pacientes sem retorno próprio. Define quem aparece como “atrasado”.</span>
        ${dropdown('nuRet', RETURNS.map(d=>[String(d),`A cada ${d} dias`]), String(f.returnDays||30), {label:'Retorno padrão'})}</div>
      <div class="field"><div class="f-top"><span class="f-label">Protocolo de dobras padrão</span></div><span class="f-hint">Na 1ª avaliação de um adulto. Crianças começam com Slaughter; nos retornos vale o protocolo anterior.</span>
        ${dropdown('nuProto', adults, p.proto, {label:'Protocolo padrão'})}</div>
      ${toggle('multi', p.multi, 'Medir cada dobra 3 vezes', 'A avaliação já começa com as 3 leituras e usa a média')}
      ${toggle('check', p.check, 'Avisos “Confere?”', 'Pergunta quando um valor foge muito do esperado ou da avaliação anterior')}
    </div>
    <h2 class="sec">Gasto energético</h2>
    <div class="form-grid"><p class="f-hint nu-p">Ponto de partida para quem ainda não tem o cálculo configurado. Em cada paciente dá para ajustar.</p>
      <div class="fields two">
        <div class="field"><div class="f-top"><span class="f-label">Fórmula do basal</span></div>${dropdown('nuFormula', FORMULAS.map(x=>[x.k,x.l,x.d]), p.formula, {label:'Fórmula do basal'})}</div>
        <div class="field"><div class="f-top"><span class="f-label">Nível de atividade</span></div>${dropdown('nuActivity', ACTIVITY.map(a=>[String(a.v),`${a.l} · ×${String(a.v).replace('.',',')}`,a.d]), String(p.activity), {label:'Nível de atividade'})}</div>
      </div></div>
    <h2 class="sec">Portal do paciente</h2>
    <div class="form-grid"><p class="f-hint nu-p">Como cada novo acesso ao portal já começa. Depois você muda paciente a paciente.</p>
      ${toggle('sharePhotos', p.sharePhotos, 'Compartilhar fotos', 'O paciente vê as fotos de acompanhamento e o antes e depois')}
      ${toggle('shareNotes', p.shareNotes, 'Compartilhar observações', 'As observações escritas em cada avaliação aparecem para o paciente')}
      <button type="button" class="act-row" data-act="nuMsgs"><span class="chip-ico">${ic('chat','sm')}</span><span class="grow"><b>Mensagens de retorno</b><span>Textos prontos do WhatsApp para avisar os pacientes</span></span>${ic('right','sm')}</button>
    </div>`;
}

/* =========================================================
   EDITAR (abas) — também é o 1º passo do primeiro acesso
   ========================================================= */
function viewEdit(first, setupHtml){
  const f = F(), tab = state.form.nuTab || 'perfil', tabs = first ? TABS.filter(t=>SETUP_TABS.includes(t[0])) : TABS;
  const ti = tabs.findIndex(t=>t[0]===tab), cl = checklist(toProfileSafe(f));
  const doneTab = k => cl.filter(x=>x.tab===k).every(x=>x.done);
  const body = tab==='contato' ? tabContato(f) : tab==='marca' ? tabMarca(f) : tab==='prefs' ? tabPrefs(f) : tabPerfil(f);
  const pv = tab==='marca' ? pdfPreview(f) + portalPreview(f) : portalPreview(f) + pdfPreview(f);
  const bar = first
    ? formBar(ti>0 ? `data-v="${ti-1}"` : 'data-v="0"', ti<tabs.length-1 ? `data-act="nuStep" data-v="${ti+1}"` : 'data-act="nuSave"', ti<tabs.length-1 ? 'Continuar' : 'Concluir perfil', ti>0 ? 'Voltar' : 'Pular por agora', ti>0 ? 'nuStep' : 'skipSetup')
    : formBar('data-v=""', 'data-act="nuSave"', 'Salvar perfil', 'Cancelar', 'nuLeave');
  return `${first ? setupHtml : `<header class="top"><button class="icon-btn" data-act="nuLeave" aria-label="Voltar">${ic('back')}</button><div class="title-block"><small>Perfil profissional</small><b>Editar perfil</b></div><div class="grow"></div>${dirty()?'<span class="tag yellow nu-dirty">Não salvo</span>':''}</header>`}
    <nav class="nu-tabs" role="tablist" aria-label="Partes do perfil">${tabs.map(([k,l,i],n)=>`<button type="button" role="tab" aria-selected="${k===tab}" class="${k===tab?'on':''}" data-act="nuTab" data-v="${k}"><span class="nu-tab-ico">${k!==tab && k!=='prefs' && doneTab(k) ? ic('check','sm') : first ? n+1 : ic(i,'sm')}</span>${l}</button>`).join('')}</nav>
    <div class="nu-edit">
      <section class="nu-main" data-key="nu-${tab}">${body}</section>
      <aside class="nu-aside"><h3 class="nu-aside-t">${ic('eye','sm')} Prévia ao vivo</h3>${pv}</aside>
    </div>
    ${bar}`;
}
const toProfileSafe = f => { try { return toProfile(f); } catch { return f; } };

/* =========================================================
   PERFIL (visão)
   ========================================================= */
function viewProfile(o){
  const n = N(), pct = completeness(n), cl = checklist(n).filter(x=>!x.done), sp = specialtiesOf(n);
  const row = (k, v, raw) => `<div class="kv-row kv-t"><span class="k">${k}</span><span class="t ${v?'':'none'}">${v ? (raw ? v : esc(v)) : 'Não informado'}</span></div>`;
  const link = (u, l) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(l)}</a>`;
  const ig = igHandle(n.instagram), site = webUrl(n.site);
  const card = idCard({ tone:'yellow', edit:'data-act="nuGo" data-v="perfil" aria-label="Editar perfil profissional"', nav:{back:'data-act="go" data-to="home"', small:'', title:''}, tiles:true, cls:'idc-pro', linksCls:'d-only',
    avatar: avatar('xl nu-av'), ring: pct<100 ? pct : null, ringLabel:`Perfil ${pct}% completo`, ringShort:'perfil',
    name: esc(displayName(n) || nameOf()), sub: [esc(sp.slice(0,2).join(' · ') || 'Nutricionista'), crnLabel(n.crn)?`<span class="nowrap">${esc(crnLabel(n.crn))}</span>`:null].filter(Boolean).join(' · '),
    chips: [placeLine(n) && `<span class="tag">${ic('pin','sm')}${esc(placeLine(n))}</span>`, ig && `<span class="tag">@${esc(ig)}</span>`].filter(Boolean).join(''),
    stats: o.stats, links: [] });
  return `${o.header}${card}
  ${cl.length ? `<section class="nu-todo"><div class="nu-todo-h"><b>Deixe seu perfil completo</b><span>${pct}% pronto · cada item aparece para seus pacientes ou nos PDFs</span></div>
    <div class="nu-todo-l">${cl.map(x=>`<button type="button" class="nu-todo-i" data-act="nuGo" data-v="${x.tab}"><span class="chip-ico">${ic(x.k==='photo'?'camera':x.k==='logo'?'image':x.k==='sign'?'edit':x.k==='phone'?'phone':x.k==='place'?'pin':'badge','sm')}</span><span class="grow"><b>${x.l}</b><small>${x.why}</small></span>${ic('plus','sm')}</button>`).join('')}</div></section>` : ''}
  ${o.banner}
  <div class="two-col">
  <div>
    <h2 class="sec">Seus dados <button data-act="nuGo" data-v="perfil">editar</button></h2>
    <div class="kv">
      ${row('Registro', crnLabel(n.crn))}${row('Especialidades', sp.join(', '))}
      ${n.bio ? `<div class="kv-row kv-t kv-bio"><span class="k">Apresentação</span><span class="t">${esc(n.bio)}</span></div>` : row('Apresentação', '')}
    </div>
    <h2 class="sec">Contato e atendimento <button data-act="nuGo" data-v="contato">editar</button></h2>
    <div class="kv">
      ${row('WhatsApp', fmtPhone(n.phone||''))}${row('E-mail', n.email)}${row('Instagram', ig ? link(igUrl(ig), '@'+ig) : '', true)}${row('Site', site ? link(site, webLabel(site)) : '', true)}
      ${row('Agendamento', n.booking ? link(n.booking, webLabel(n.booking).slice(0,40)) : '', true)}${row('Atendimento', placeLine(n))}${n.address ? row('Endereço', n.address) : ''}
      <div class="kv-row"><span class="k">Retorno padrão</span><span class="t">a cada ${n.returnDays||30} dias</span></div>
    </div>
    ${o.patients}
  </div>
  <div>
    <h2 class="sec">Como você aparece <button data-act="nuGo" data-v="marca">marca e PDF</button></h2>
    <div class="nu-shows">${portalPreview(formOf(n))}${pdfPreview(formOf(n))}</div>
    <button type="button" class="act-row nu-test" data-act="nuTest"><span class="chip-ico">${ic('pdf','sm')}</span><span class="grow"><b>Ver um PDF de teste</b><span>Com a sua marca, na última avaliação</span></span>${ic('right','sm')}</button>
    <button type="button" class="act-row" data-act="nuGo" data-v="prefs"><span class="chip-ico">${ic('gear','sm')}</span><span class="grow"><b>Preferências</b><span>${esc(prefsLine(n))}</span></span>${ic('right','sm')}</button>
    ${o.account}
  </div></div>`;
}
function prefsLine(n){
  const p = workPrefs(n);
  return [`Retorno ${n.returnDays||30} dias`, PROTOCOLS[p.proto]?.short || 'JP7', p.multi ? '3 leituras' : null, p.check ? '“Confere?” ligado' : '“Confere?” desligado'].filter(Boolean).join(' · ');
}

/* =========================================================
   AÇÕES
   ========================================================= */
async function openMedia(k){
  if (!options.media || !options.mediaEditor) return toast('Envio de imagens indisponível neste aparelho');
  await mediaNow();
  const path = N()[k+'Path'];
  const persist = async next => { await options.saveNutri(next); ctx.setNutri(next); muKey = null; media(); };
  options.mediaEditor({ kind:k, current: MU[k] || '', color: brandColor(F().color), name: N().name,
    onSave: async blob => {
      const p = await options.media.upload(k, blob);
      try { await persist({ ...N(), [k+'Path']: p }); } catch (e) { await options.media.remove(p); throw new Error(motivo(e, 'Não foi possível salvar a imagem.')); }
      if (path && path!==p) await options.media.remove(path);
      if (k==='sign' && state.form?.nu) state.form.nu.pdf.sign = 'image';
      if (k==='sign'){ const n = N(); if (pdfPrefs(n).sign!=='image') await persist({ ...n, pdf: { ...pdfPrefs(n), sign:'image' } }).catch(()=>{}); }
      toast(k==='photo' ? 'Foto atualizada ✓' : k==='logo' ? 'Logo salvo ✓' : 'Assinatura salva ✓');
    },
    onRemove: path ? async () => {
      const n = { ...N(), [k+'Path']: null }; if (k==='sign' && pdfPrefs(n).sign==='image') n.pdf = { ...pdfPrefs(n), sign:'line' };
      await persist(n); await options.media.remove(path); MU = { ...MU, [k]:'' };
      if (k==='sign' && state.form?.nu?.pdf?.sign==='image') state.form.nu.pdf.sign = 'line';
      toast(k==='photo' ? 'Foto removida' : k==='logo' ? 'Logo removido' : 'Assinatura removida'); render();
    } : undefined });
}
function leave(){
  if (!dirty()) return go('profile');
  sheet('Sair sem salvar?', 'As mudanças desta tela ainda não foram salvas. Fotos, logo e assinatura já ficaram guardados.', [
    {label:'Salvar e sair', cls:'dark', fn: async () => { await ACT.nuSave(); }},
    {label:'Sair sem salvar', cls:'danger', fn: async () => { state.form = {}; go('profile'); }},
    {label:'Continuar editando'}]);
}
/* erro de validação → aba e campo para corrigir */
const ERR_FIELD = [[/nome/i,'perfil','name'],[/CRN/i,'perfil','crnNum'],[/apresenta/i,'perfil','bio'],[/WhatsApp/i,'contato','phone'],[/e-mail/i,'contato','email'],[/Instagram/i,'contato','instagram'],[/agendamento/i,'contato','booking'],[/site/i,'contato','site']];
function showErr(msg){ const [, tab, k] = ERR_FIELD.find(([re])=>re.test(msg)) || [null,'perfil','name']; toast(msg); if (state.form.nuTab!==tab){ state.form.nuTab = tab; render(); } setTimeout(()=>{ const el = app()?.querySelector(`[data-nu="${k}"]`); if (el){ el.scrollIntoView({block:'center',behavior:'smooth'}); el.focus({preventScroll:true}); } }, 120); }
const ACT = {
  nuGo: async b => { state.nuWant = b.dataset.v; go('nutri'); },
  nuTab: async b => { state.form.nuTab = b.dataset.v; render(); window.scrollTo({top:0,behavior:'smooth'}); },
  nuStep: async b => {
    // 1º acesso: só segue com o nome preenchido
    if (+b.dataset.v > SETUP_TABS.indexOf(state.form.nuTab) && !(F().name||'').trim()){ toast('Informe seu nome para continuar'); state.form.nuTab='perfil'; render(); setTimeout(()=>app()?.querySelector('[data-nu="name"]')?.focus(),80); return; }
    state.form.nuTab = SETUP_TABS[+b.dataset.v] || 'perfil'; render(); window.scrollTo({top:0,behavior:'smooth'});
  },
  nuTreat: async b => { F().treat = b.dataset.v; render(); },
  nuMode: async b => { F().mode = b.dataset.v; render(); },
  nuColor: async b => { F().color = b.dataset.v; render(); },
  nuPdfHead: async b => { F().pdf.head = b.dataset.v; render(); },
  nuPdfSign: async b => { F().pdf.sign = b.dataset.v; render(); },
  nuPref: async b => { const k = b.dataset.k, f = F(); if (k.startsWith('pdf.')) f.pdf[k.slice(4)] = !f.pdf[k.slice(4)]; else f.prefs[k] = !f.prefs[k]; render(); },
  nuSpec: async b => { const f = F(), v = b.dataset.v; if (f.specialties.includes(v)) f.specialties = f.specialties.filter(x=>x!==v); else { if (f.specialties.length>=6) return toast('Escolha até 6 especialidades'); f.specialties = [...f.specialties, v]; } render(); },
  nuSpecAdd: async () => {
    const el = document.getElementById('nu-spec-add'), v = (el?.value||'').trim().replace(/\s+/g,' '); if (!v) return el?.focus();
    const f = F(); if (f.specialties.some(s=>s.toLowerCase()===v.toLowerCase())) return toast('Essa especialidade já está na lista');
    if (f.specialties.length>=6) return toast('Escolha até 6 especialidades');
    f.specialties = [...f.specialties, v.charAt(0).toUpperCase()+v.slice(1)]; el.value=''; render();
  },
  nuMedia: async b => openMedia(b.dataset.k),
  nuMsgs: async () => { if (dirty()) return toast('Salve o perfil antes de sair desta tela'); go('returns'); },
  nuLeave: async () => leave(),
  nuSave: async () => {
    // valida o que foi digitado (antes de limpar: Instagram/site inválido não pode sumir calado)
    const f = F(), err = validate({ ...f, crn: crnJoin(f.crnReg, f.crnNum) }), next = err ? null : toProfile(f);
    if (err) return showErr(err);
    const setup = ctx.inSetup();
    await options.saveNutri(next); ctx.setNutri(next); state.form = {};
    if (setup){ state.setup = true; go('onboard'); toast('Perfil salvo ✓'); return; }
    go('profile'); toast('Perfil salvo ✓');
  },
  nuTest: async () => ctx.testPdf(state.route==='nutri' ? toProfile(F()) : N()),
};
const ddPick = {
  nuCrnReg: v => { F().crnReg = v; },
  nuRet: v => { F().returnDays = +v || 30; },
  nuProto: v => { F().prefs.proto = v; },
  nuFormula: v => { F().prefs.formula = v; },
  nuActivity: v => { F().prefs.activity = +v || 1.55; },
};
/* Enter no campo "Outra especialidade" inclui na lista */
function onKey(e){ if (e.key==='Enter' && e.target.id==='nu-spec-add'){ e.preventDefault(); ACT.nuSpecAdd(); return true; } return false; }

return { viewEdit, viewProfile, initForm, onInput, onKey, acts: ACT, ddPick, avatar, avatarInner, media, mediaNow, dirty, phoneDigits };
}
