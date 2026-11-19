import { esc, fmtDate, firstName } from './calculos.js';
import { PARTS, base64ToBlob, backupName, blobToBase64, exportCounts, fmtSize, makeBackup, matchPatients, planImport, readBackup } from './backup';
import { motivo } from './motivo';

/*
 * BACKUP (/perfil/backup): exportar e importar o arquivo .json escolhendo o que vai/volta.
 *  · exportar: quais pacientes e quais partes (fichas, avaliações, metas/anamnese, planos, fotos, respostas, perfil)
 *  · importar: mostra o que tem no arquivo, quais pacientes já existem nesta conta e deixa escolher tudo de novo
 * A lógica (montar, ler e juntar) fica em backup.ts, com testes.
 */
export function backupScreens(ctx){
const { options, state, ic, go, render, toast, formBar, download } = ctx;
const R = options.responses || null, PH = options.photos || null, DI = options.diets || null;
const db = () => ctx.db();
const PHOTO_EST = 260e3; // tamanho médio de uma foto no arquivo (estimativa para avisar o tamanho)
const byName = (a, b) => a.name.localeCompare(b.name, 'pt-BR');
const plural = (n, one, many) => `${n} ${n===1?one:many}`;
const UNIT = { patients:['paciente','pacientes'], assessments:['avaliação','avaliações'], plans:['paciente com metas/anamnese','pacientes com metas/anamnese'], diets:['plano alimentar','planos alimentares'], photos:['foto','fotos'], responses:['resposta','respostas'], nutri:['perfil','perfil'] };
const respAll = () => R?.all ? R.all().map(r=>({ patientId:r.patientId, kind:r.kind, data:r.data, read:r.read, createdAt:r.createdAt })) : [];
const photosOf = ids => PH ? PH.list().filter(m=>ids.has(m.profileId) && db().assessments.some(a=>a.id===m.assessmentId)) : [];

/* ---------- estado ---------- */
function startExport(ids){
  const all = db().profiles.map(p=>p.id);
  state.bk = { mode:'out', ids: ids?.length ? ids : all, parts: PARTS.map(p=>p.k).filter(k=>k!=='photos' || (PH && PH.list().length < 200)), busy:'' };
  go('backup');
}
async function openFile(){
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = async () => {
    const f = inp.files?.[0]; if (!f) return;
    try {
      const r = readBackup(JSON.parse(await f.text()));
      const match = matchPatients(db(), r.file), hasName = !!(ctx.nutri().name);
      state.bk = { mode:'in', fileName: f.name, size: f.size, read: r, match: [...match.keys()],
        ids: r.file.profiles.map(p=>p.id), parts: r.file.parts.filter(k=>k!=='nutri' || !hasName), existing:'keep', busy:'' };
      go('backup');
    } catch (e) { toast(motivo(e, 'Não foi possível ler o arquivo. Confira se é um backup .json do sistema.')); }
  };
  inp.click();
}

/* ---------- partes da tela ---------- */
const head = (title, sub) => `<header class="top"><button class="icon-btn" data-act="go" data-to="profile" aria-label="Voltar">${ic('back')}</button><div class="title-block"><small>${sub}</small><b>${title}</b></div></header>`;
function partRow(k, l, d, on, n, o={}){
  const off = o.disabled, locked = o.locked;
  return `<button class="toggle bk-part${off?' off':''}" ${off||locked?'disabled':''} data-act="bkPart" data-k="${k}" aria-pressed="${on}">
    <span class="grow"><b>${l}</b><br><span class="small muted">${off ? (o.why||'Não está no arquivo') : d}</span></span>
    ${n!=null && !off ? `<em class="bk-n">${k==='nutri'?'':n}</em>` : ''}<span class="switch ${on&&!off?'on':''}"></span></button>`;
}
function ptList(list, sel, tag){
  const all = list.length && list.every(p=>sel.has(p.id));
  return `<div class="bk-pts-h"><span>${sel.size} de ${list.length} selecionados</span><button data-act="bkAll">${all?'Desmarcar todos':'Marcar todos'}</button></div>
    <div class="bk-pts">${list.map(p=>`<button class="bk-pt${sel.has(p.id)?' on':''}" data-act="bkPt" data-id="${esc(p.id)}" aria-pressed="${sel.has(p.id)}"><span class="bk-ck">${sel.has(p.id)?ic('check','sm'):''}</span><span class="grow"><b>${esc(p.name)}</b><small>${tag(p)}</small></span></button>`).join('')}</div>`;
}

/* ---------- exportar ---------- */
function viewExport(){
  const b = state.bk, sel = new Set(b.ids), parts = new Set(b.parts), ps = db().profiles.slice().sort(byName);
  const nPh = photosOf(sel).length, c = exportCounts({ db: db(), nutri: ctx.nutri(), diets: DI ? DI.list() : [], responses: respAll() }, sel, nPh);
  const rows = PARTS.map(p => {
    if (p.k==='patients') return partRow(p.k, p.l, p.d, true, c.patients, {locked:true});
    if (p.k==='photos' && !PH) return partRow(p.k, p.l, p.d, false, 0, {disabled:true, why:'Fotos indisponíveis neste aparelho'});
    if (p.k==='responses' && !R?.available()) return partRow(p.k, p.l, p.d, false, 0, {disabled:true, why:'Portal ainda sem respostas neste banco'});
    if (p.k==='diets' && !DI) return partRow(p.k, p.l, p.d, false, 0, {disabled:true, why:'Planos alimentares indisponíveis'});
    const d = p.k==='photos' && c.photos ? `${p.d} · cerca de ${fmtSize(c.photos*PHOTO_EST)}` : p.k==='nutri' ? (ctx.nutri().name ? `${esc(ctx.nutri().name)}${ctx.nutri().crn?' · '+esc(ctx.nutri().crn):''}` : 'Perfil ainda não preenchido') : p.d;
    return partRow(p.k, p.l, d, parts.has(p.k), c[p.k]);
  }).join('');
  const sum = PARTS.filter(p=>parts.has(p.k) && c[p.k] && p.k!=='nutri').map(p=>plural(c[p.k], ...UNIT[p.k])).concat(parts.has('nutri') && c.nutri ? ['seu perfil'] : []);
  return `${head('Exportar backup','Dados e conta')}
  <div class="card bk-intro"><span class="chip-ico">${ic('dl','sm')}</span><p>Escolha <b>quais pacientes</b> e <b>o que levar</b>. O arquivo .json guarda uma cópia de segurança e também serve para levar tudo para outra conta — lá você escolhe de novo o que importar.</p></div>
  <div class="bk-grid">
    <section><h2 class="sec">O que incluir</h2><div class="bk-parts">${rows}</div>
      <p class="small muted bk-note">${ic('lock','sm')} Não vão no arquivo: códigos de acesso ao portal (cada conta cria os seus) e a avaliação em andamento.</p></section>
    <section><h2 class="sec">Pacientes</h2>${ps.length ? ptList(ps, sel, p => [p.archived?'Arquivado':'', plural(db().assessments.filter(a=>a.profileId===p.id).length,'avaliação','avaliações')].filter(Boolean).join(' · ')) : '<div class="card empty"><p>Nenhum paciente cadastrado.</p></div>'}</section>
  </div>
  <div class="card bk-sum">${b.busy ? `<span class="bk-spin"></span><b>${esc(b.busy)}</b>` : sel.size ? `<b>No arquivo:</b> ${sum.join(' · ')}${parts.has('photos') && c.photos ? ` <small>(cerca de ${fmtSize(c.photos*PHOTO_EST)})</small>` : ''}` : 'Selecione pelo menos um paciente.'}</div>
  ${formBar('data-act="go" data-to="profile"', `data-act="bkExport"${sel.size&&!b.busy?'':' disabled'}`, b.busy ? 'Preparando…' : 'Baixar backup')}`;
}
async function doExport(){
  const b = state.bk; if (!b || b.busy) return;
  const sel = new Set(b.ids), parts = new Set(b.parts); if (!sel.size) return toast('Selecione pelo menos um paciente');
  const photos = [];
  try {
    if (parts.has('photos') && PH){
      const metas = photosOf(sel);
      for (let i = 0; i < metas.length; i++){
        b.busy = `Preparando fotos ${i+1} de ${metas.length}…`; render();
        const m = metas[i], blob = await PH.blob(m).catch(()=>null); if (!blob) continue;
        photos.push({ profileId:m.profileId, assessmentId:m.assessmentId, pose:m.pose, w:m.w, h:m.h, type: blob.type || 'image/jpeg', data: await blobToBase64(blob) });
      }
    }
    const file = makeBackup({ db: db(), nutri: ctx.nutri(), diets: DI ? DI.list() : [], responses: respAll() }, { parts, ids: sel }, photos);
    const one = sel.size===1 ? db().profiles.find(p=>sel.has(p.id)) : null;
    const who = one ? firstName(one.name).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-') : '';
    download(backupName(file, who), JSON.stringify(file, null, 1), 'application/json');
    b.busy = ''; render();
    toast(`Backup baixado ✓ ${plural(file.profiles.length,'paciente','pacientes')}${photos.length?` e ${plural(photos.length,'foto','fotos')}`:''}`);
  } catch (e) { b.busy = ''; render(); toast(motivo(e, 'Não foi possível montar o backup. Tente de novo.')); }
}

/* ---------- importar ---------- */
function viewImport(){
  const b = state.bk, f = b.read.file, c = b.read.counts, sel = new Set(b.ids), parts = new Set(b.parts), ex = new Set(b.match);
  if (b.result) return viewDone();
  const exSel = [...sel].filter(id=>ex.has(id)).length;
  const rows = PARTS.map(p => {
    if (p.k==='patients') return partRow(p.k, p.l, p.d, true, c.patients, {locked:true});
    if (!f.parts.includes(p.k)) return partRow(p.k, p.l, p.d, false, 0, {disabled:true});
    if (p.k==='photos' && !parts.has('assessments')) return partRow(p.k, p.l, p.d, false, c.photos, {disabled:true, why:'Precisa importar as avaliações junto'});
    const d = p.k==='nutri' ? `${esc(f.nutri?.name||'Perfil')}${f.nutri?.crn?' · '+esc(f.nutri.crn):''}${ctx.nutri().name ? ' · substitui o seu atual' : ''}` : p.k==='photos' ? `${p.d.split(' · ')[0]}` : p.k==='responses' ? `${p.d}` : p.d;
    return partRow(p.k, p.l, d, parts.has(p.k), c[p.k]);
  }).join('');
  const when = f.exportedAt ? fmtDate(f.exportedAt.slice(0,10),{day:'numeric',month:'long',year:'numeric'}) : '';
  const ps = f.profiles.slice().sort(byName);
  return `${head('Importar backup','Dados e conta')}
  <div class="card bk-file"><span class="chip-ico">${ic('ul','sm')}</span><span class="grow"><b>${esc(b.fileName)}</b><small>${[when && `Exportado em ${when}`, f.by?.name && `por ${esc(f.by.name)}`, fmtSize(b.size)].filter(Boolean).join(' · ')}</small></span><button class="btn ghost sm" data-act="bkPick">Trocar arquivo</button></div>
  ${b.read.warnings.length ? `<div class="card bk-warn">${ic('target','sm')}<div><b>${plural(b.read.warnings.length,'item do arquivo ficou de fora','itens do arquivo ficaram de fora')}</b><ul>${b.read.warnings.slice(0,6).map(w=>`<li>${esc(w)}</li>`).join('')}</ul></div></div>` : ''}
  <div class="bk-grid">
    <section><h2 class="sec">O que trazer</h2><div class="bk-parts">${rows}</div>
      ${ex.size ? `<h2 class="sec">Pacientes que já existem nesta conta <span class="sec-note">${exSel}</span></h2>
      <div class="bk-ex">
        <button class="bk-opt${b.existing==='keep'?' on':''}" data-act="bkExisting" data-v="keep"><span class="bk-radio"></span><span><b>Manter os desta conta e completar</b><small>Só preenche o que estiver em branco e acrescenta avaliações, planos e fotos que faltam</small></span></button>
        <button class="bk-opt${b.existing==='update'?' on':''}" data-act="bkExisting" data-v="update"><span class="bk-radio"></span><span><b>Atualizar com os dados do arquivo</b><small>Contato, objetivo, observações, metas e anamnese passam a ser os do arquivo</small></span></button>
      </div>` : ''}
      <p class="small muted bk-note">${ic('check','sm')} Nada é duplicado: paciente com o mesmo nome, nascimento e sexo é reconhecido, e avaliações da mesma data e peso não entram de novo.</p></section>
    <section><h2 class="sec">Pacientes do arquivo</h2>${ptList(ps, sel, p => `${ex.has(p.id)?'<span class="bk-tag">Já existe</span>':'<span class="bk-tag new">Novo</span>'} ${plural(f.assessments.filter(a=>a.profileId===p.id).length,'avaliação','avaliações')}`)}</section>
  </div>
  <div class="card bk-sum">${b.busy ? `<span class="bk-spin"></span><b>${esc(b.busy)}</b>` : sel.size ? `<b>Vai importar:</b> ${plural(sel.size,'paciente','pacientes')}${exSel?` (${exSel} já ${exSel===1?'existe':'existem'})`:''} · ${PARTS.filter(p=>p.k!=='patients'&&parts.has(p.k)&&f.parts.includes(p.k)).map(p=>p.l.toLowerCase()).join(', ') || 'só as fichas'}` : 'Selecione pelo menos um paciente.'}</div>
  ${formBar('data-act="go" data-to="profile"', `data-act="bkImport"${sel.size&&!b.busy?'':' disabled'}`, b.busy ? 'Importando…' : 'Importar')}`;
}
function viewDone(){
  const r = state.bk.result, rep = r.report;
  const line = (n, txt, ico='check') => n ? `<li>${ic(ico,'sm')}<span>${txt}</span></li>` : '';
  return `${head('Importação concluída','Dados e conta')}
  <div class="card bk-done"><span class="bk-done-ico">${ic('check')}</span><h3>Backup importado</h3>
    <ul>
      ${line(rep.newPatients, plural(rep.newPatients,'paciente novo','pacientes novos'))}
      ${line(rep.updatedPatients, plural(rep.updatedPatients,'paciente atualizado','pacientes atualizados'))}
      ${line(rep.assessments, plural(rep.assessments,'avaliação nova','avaliações novas'))}
      ${line(rep.sameAssessments, `${plural(rep.sameAssessments,'avaliação já existia','avaliações já existiam')} (não duplicadas)`, 'swap')}
      ${line(rep.plans, plural(rep.plans,'paciente com metas/anamnese','pacientes com metas/anamnese'))}
      ${line(rep.diets, plural(rep.diets,'plano alimentar','planos alimentares'))}
      ${line(r.photos, plural(r.photos,'foto','fotos'))}
      ${line(r.responses, plural(r.responses,'resposta do portal','respostas do portal'))}
      ${line(r.nutri, 'Seu perfil profissional atualizado')}
      ${!rep.newPatients && !rep.updatedPatients && !rep.assessments && !rep.diets && !r.photos && !r.responses && !r.nutri ? '<li>'+ic('check','sm')+'<span>Tudo do arquivo já estava nesta conta.</span></li>' : ''}
    </ul>
    ${r.problems.length ? `<div class="bk-warn in">${r.problems.map(x=>`<p>${esc(x)}</p>`).join('')}</div>` : ''}
    <div class="bk-done-btns"><button class="btn ghost" data-act="go" data-to="profile">Voltar ao perfil</button><button class="btn dark" data-act="go" data-to="patients">${ic('users','sm')} Ver pacientes</button></div>
  </div>`;
}
async function doImport(){
  const b = state.bk; if (!b || b.busy || b.mode!=='in') return;
  const sel = new Set(b.ids); if (!sel.size) return toast('Selecione pelo menos um paciente');
  const step = t => { b.busy = t; render(); };
  const problems = [];
  try {
    step('Juntando pacientes e avaliações…');
    const plan = planImport({ db: db(), diets: DI ? DI.list() : [], responses: respAll(), photoPoses: aid => PH ? PH.of(aid).map(m=>m.pose) : [] },
      b.read.file, { parts: new Set(b.parts), ids: sel, existing: b.existing });
    ctx.setDb(plan.db); await ctx.save();
    if (plan.diets.length && DI){ step('Salvando planos alimentares…'); for (const d of plan.diets){ try { await DI.save(d); } catch { problems.push(`Plano "${d.title}" não foi salvo.`); } } }
    let nPh = 0;
    if (plan.photos.length && PH){
      for (let i = 0; i < plan.photos.length; i++){ step(`Salvando fotos ${i+1} de ${plan.photos.length}…`); const x = plan.photos[i];
        try { await PH.add({ assessmentId:x.assessmentId, profileId:x.profileId, pose:x.pose }, base64ToBlob(x.data, x.type), x.w, x.h); nPh++; } catch { /* segue */ } }
      if (nPh < plan.photos.length) problems.push(`${plan.photos.length - nPh} foto(s) não puderam ser salvas.`);
      ctx.phSync();
    }
    let nR = 0;
    if (plan.responses.length && R?.importMany){
      step('Salvando respostas do portal…');
      try { nR = await R.importMany(options.userId, plan.responses); }
      catch { problems.push(`As ${plan.responses.length} respostas do portal não foram importadas: o banco ainda não permite. Peça ao Lovable a permissão (PROMPT_LOVABLE_IMPORTAR.md) e importe o arquivo de novo — o resto não será duplicado.`); }
    }
    let nN = false;
    if (plan.nutri){ try { const next = { ...ctx.nutri(), ...plan.nutri }; await options.saveNutri(next); ctx.setNutri(next); nN = true; } catch { problems.push('O perfil profissional não foi atualizado.'); } }
    b.busy = ''; b.result = { report: plan.report, photos: nPh, responses: nR, nutri: nN, problems };
    render(); window.scrollTo({ top:0 });
  } catch (e) { b.busy = ''; render(); toast(motivo(e, 'Não foi possível importar. Nada foi alterado nas avaliações já salvas.')); }
}

/* ---------- tela e ações ---------- */
function viewBackup(){
  if (!state.bk) state.bk = { mode:'out', ids: db().profiles.map(p=>p.id), parts: PARTS.map(p=>p.k).filter(k=>k!=='photos'), busy:'' };
  return `<div class="narrow bk">${state.bk.mode==='in' ? viewImport() : viewExport()}</div>`;
}
const toggle = (arr, v) => arr.includes(v) ? arr.filter(x=>x!==v) : [...arr, v];
const acts = {
  backupOut: async b => startExport(b.dataset.id ? [b.dataset.id] : null),
  backupIn: async () => openFile(),
  bkPick: async () => openFile(),
  bkPart: async b => { const s = state.bk; if (!s || s.busy) return; s.parts = toggle(s.parts, b.dataset.k); if (b.dataset.k==='assessments' && !s.parts.includes('assessments')) s.parts = s.parts.filter(k=>k!=='photos'); render(); },
  bkPt: async b => { const s = state.bk; if (!s || s.busy) return; s.ids = toggle(s.ids, b.dataset.id); render(); },
  bkAll: async () => { const s = state.bk; if (!s || s.busy) return; const all = s.mode==='in' ? s.read.file.profiles.map(p=>p.id) : db().profiles.map(p=>p.id); s.ids = s.ids.length===all.length ? [] : all; render(); },
  bkExisting: async b => { if (!state.bk) return; state.bk.existing = b.dataset.v; render(); },
  bkExport: async () => doExport(),
  bkImport: async () => doImport(),
};
return { viewBackup, acts, startExport, openFile };
}
