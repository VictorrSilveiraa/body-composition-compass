/*
 * Relatório A4 da avaliação (vira PDF pelo "Salvar como PDF" do navegador).
 * Montado só na hora de imprimir, fora da tela do app, com a mesma estética do site.
 */
import {num,fmt,fmtDate,calc,bmiClass,bfClass,whrRisk,PROTOCOLS,FOLDS,CIRC_TRUNK,CIRC_LIMBS,foldVal,esc,initials,today,GROUPS} from './calculos.js';
import {goalsStatus,GOAL_KINDS,activityLabel,adjustLabel} from './plano';

/*
 * Contexto extra de cada exportação (opcional — o relatório funciona sem ele):
 *  nutri {name, crn, phone, place} · goal (texto) · nextReturn (AAAA-MM-DD)
 *  photos {[avaliaçãoId]: {front, back, right, left: url}} · diets [{title, prescribedAt, assessmentId, data}]
 */
let CTX = {};
const POSE_L = [['front','Frente'],['back','Costas'],['right','Lado direito'],['left','Lado esquerdo']];
const photosOf = id => (CTX.photos && CTX.photos[id]) || {};
const proLine = () => { const n = CTX.nutri || {}; return [n.name, n.crn].filter(Boolean).join(' · '); };
const extraFacts = () => [CTX.goal && ['Objetivo', esc(CTX.goal)], CTX.nextReturn && ['Próximo retorno', fmtDate(CTX.nextReturn,{day:'2-digit',month:'short',year:'numeric'})]].filter(Boolean);
/** fotos de uma avaliação (as 4 poses) */
function photosBlock(a, title='Fotos de acompanhamento'){
  const ph = photosOf(a.id), have = POSE_L.filter(([k])=>ph[k]);
  if (!have.length) return '';
  return `<section class="rp-block rp-photos"><div class="rp-sec-h"><h3>${ic('image')} ${title}</h3><span class="rp-muted">${fmtDate(a.date,{day:'2-digit',month:'short',year:'numeric'})}</span></div>
    <div class="rp-ph rp-ph${have.length}">${have.map(([k,l])=>`<figure><img src="${ph[k]}" alt="${l}"><figcaption>${l}</figcaption></figure>`).join('')}</div></section>`;
}
/** antes × depois, pose a pose (só as poses com foto nas duas datas) */
function photosPairs(A, B, title='Antes e depois'){
  const pa = photosOf(A.id), pb = photosOf(B.id), both = POSE_L.filter(([k])=>pa[k] && pb[k]);
  if (!both.length) return '';
  return `<section class="rp-block rp-photos"><div class="rp-sec-h"><h3>${ic('image')} ${title}</h3><span class="rp-muted">${fmtDate(A.date,{day:'2-digit',month:'short',year:'numeric'})} → ${fmtDate(B.date,{day:'2-digit',month:'short',year:'numeric'})}</span></div>
    <div class="rp-pairs">${both.map(([k,l])=>`<div class="rp-pair"><h4>${l}</h4><div><figure><img src="${pa[k]}" alt="${l} antes"><figcaption>Antes</figcaption></figure><figure><img src="${pb[k]}" alt="${l} depois"><figcaption>Depois</figcaption></figure></div></div>`).join('')}</div></section>`;
}
/** plano alimentar entregue nesta consulta (resumo: horários e refeições) */
function dietBlock(a){
  const d = (CTX.diets || []).find(x => x.assessmentId === a.id);
  if (!d || !d.data?.meals?.length) return '';
  const meals = d.data.meals.map(m => { const v = m.variants?.[0]; const foods = (v?.foods || []).map(f => f.name).join(', ');
    return `<tr><td class="rp-v">${esc(m.time || '—')}</td><td><b>${esc(m.name)}</b>${m.variants?.length > 1 ? ` <span class="rp-pill">${m.variants.length} opções</span>` : ''}</td><td class="rp-muted">${esc(foods)}</td></tr>`; }).join('');
  return `<section class="rp-block"><div class="rp-sec-h"><h3>${ic('note')} Plano alimentar desta consulta</h3><span class="rp-muted">${esc(d.title || 'Plano alimentar')}${d.prescribedAt ? ' · ' + fmtDate(d.prescribedAt,{day:'2-digit',month:'2-digit',year:'numeric'}) : ''}</span></div>
    <table class="rp-table rp-tight rp-diet"><thead><tr><th>Horário</th><th>Refeição</th><th>Alimentos (opção principal)</th></tr></thead><tbody>${meals}</tbody></table>
    <p class="rp-legend-s">O plano completo, com quantidades, trocas e lista de compras, está no PDF do plano alimentar e no portal do paciente.</p></section>`;
}

/** metas do paciente: como estavam na data da avaliação (ou hoje, no relatório de evolução) */
function goalsBlock(list, p, upTo, title='Metas do acompanhamento'){
  const st = goalsStatus(CTX.goals || [], list, p, upTo); if (!st.length) return '';
  const rows = st.map(s => { const g = s.goal, K = GOAL_KINDS[g.k], pc = Math.round((s.done ? 1 : s.pct) * 100);
    const sit = s.done ? `<span class="rp-status good">Alcançada</span>` : `<span class="rp-status ${s.pace==='away'?'bad':'neu'}">Faltam ${fmt(s.left)} ${g.k==='bf'?'pp':K.u}</span>`;
    return `<tr><td>${esc(K.l)}</td><td class="rp-muted">${fmt(g.from)} ${K.u}<br><small>${fmtDate(g.fromDate,{day:'2-digit',month:'2-digit',year:'2-digit'})}</small></td><td class="rp-v">${fmt(s.cur)} ${K.u}</td><td class="rp-v">${fmt(g.to)} ${K.u}${g.by?`<br><small class="rp-muted">até ${fmtDate(g.by,{day:'2-digit',month:'2-digit',year:'2-digit'})}</small>`:''}</td><td><span class="rp-gbar"><i style="width:${pc}%"></i></span><b class="rp-gpct">${pc}%</b></td><td>${sit}</td></tr>`; }).join('');
  return `<section class="rp-block"><div class="rp-sec-h"><h3>${ic('target')} ${title}</h3><span class="rp-muted">${upTo ? 'situação na data desta avaliação' : 'situação atual'}</span></div>
    <table class="rp-table rp-goals"><thead><tr><th>Medida</th><th>Início</th><th>${upTo ? 'Nesta avaliação' : 'Atual'}</th><th>Meta</th><th>Progresso</th><th>Situação</th></tr></thead><tbody>${rows}</tbody></table></section>`;
}
const kcalTxt = v => Math.round(v).toLocaleString('pt-BR') + ' kcal/dia';

const ICON = {
  heart:'<path d="M12 20s-8-4.6-8-10.5A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 8 3.5C20 15.4 12 20 12 20z"/>',
  flame:'<path d="M12 21a7 7 0 0 0 7-7c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-2 2-5 5-5 8a7 7 0 0 0 7 7z"/>',
  scale:'<rect x="3" y="3" width="18" height="18" rx="6"/><path d="M8 10a5 5 0 0 1 8 0"/><path d="M12 10l1.5-2"/>',
  bolt:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  drop:'<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  ruler:'<path d="M4 16 16 4l4 4L8 20z"/><path d="M8 12l2 2M11 9l1.5 1.5M14 6l2 2"/>',
  pinch:'<path d="M7 3v5a5 5 0 0 0 10 0V3"/><path d="M4 21c2-3 5-4 8-4s6 1 8 4"/>',
  chart:'<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  swap:'<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
  book:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.5" r=".9" fill="currentColor"/>',
  note:'<rect x="5" y="4" width="14" height="17" rx="3"/><path d="M9 4V3h6v1M9 11h6M9 15h4"/>',
  image:'<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
};
const ic = n => `<svg class="rp-ico" viewBox="0 0 24 24">${ICON[n]||''}</svg>`;

const sign = (v, d) => (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v), d);
function tone(diff, dir){ if (Math.abs(diff) < 1e-9) return 'flat'; if (!dir) return 'neu'; return diff*dir > 0 ? 'good' : 'bad'; }
function delta(cur, prev, dir=0, d=1, unit=''){
  if (cur==null || prev==null) return '<span class="rp-muted">—</span>';
  const diff = cur - prev;
  if (Math.abs(diff) < Math.pow(10,-d)/2) return '<span class="rp-delta flat">igual</span>';
  return `<span class="rp-delta ${tone(diff,dir)}">${sign(diff,d)}${unit?' '+unit:''}</span>`;
}

function ring(val, max, color){
  const size=132, sw=13, r=(size-sw)/2, C=2*Math.PI*r, arc=.75, v=Math.max(0,Math.min(1,(val||0)/max));
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" style="transform:rotate(135deg)">
    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${C*arc} ${C}"/>
    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${C*arc*v} ${C}"/></svg>`;
}

/** Régua colorida com marcador: bands = [[limite, cor, rótulo], ...] */
function scale(value, min, max, bands, d=1){
  if (value==null) return '';
  const pos = v => Math.max(0, Math.min(100, (v-min)/(max-min)*100));
  let from = min;
  const segs = bands.map(([to,color,label]) => { const s = `<span style="left:${pos(from)}%;width:${pos(Math.min(to,max))-pos(from)}%;background:${color}"><em>${label}</em></span>`; from = to; return s; }).join('');
  const ticks = bands.slice(0,-1).map(([to]) => `<i style="left:${pos(to)}%">${fmt(to, to%1?1:0)}</i>`).join('');
  return `<div class="rp-scale"><div class="rp-scale-bar">${segs}<b style="left:${pos(value)}%"><small>${fmt(value,d)}</small></b></div><div class="rp-scale-ticks">${ticks}</div></div>`;
}

function miniChart(pts, color, d=1, unit=''){
  if (pts.length < 2) return '';
  const W=300, H=110, pl=14, pr=14, pt=22, pb=22;
  const ys = pts.map(p=>p.y); let mn=Math.min(...ys), mx=Math.max(...ys);
  if (mn===mx){ mn-=1; mx+=1; } const pad=(mx-mn)*.2; mn-=pad; mx+=pad;
  const X = i => pl + i*(W-pl-pr)/(pts.length-1), Y = v => pt + (1-(v-mn)/(mx-mn))*(H-pt-pb);
  const P = pts.map((p,i)=>[X(i),Y(p.y)]);
  const line = P.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
  const showLbl = i => pts.length<=6 || i===0 || i===pts.length-1;
  return `<svg viewBox="0 0 ${W} ${H}" class="rp-chart">
    <path d="${line} L${P.at(-1)[0]},${H-pb} L${P[0][0]},${H-pb} Z" fill="${color}" fill-opacity=".14"/>
    <path d="${line}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
    ${P.map((p,i)=>`<circle cx="${p[0]}" cy="${p[1]}" r="${i===P.length-1?4.5:3.2}" fill="${i===P.length-1?color:'#fff'}" stroke="${color}" stroke-width="2"/>
      ${showLbl(i)?`<text x="${p[0]}" y="${p[1]-8}" text-anchor="${i===0?'start':i===P.length-1?'end':'middle'}" font-size="11" font-weight="600" fill="#2e2e2e">${fmt(pts[i].y,d)}</text>`:''}
      ${showLbl(i)?`<text x="${p[0]}" y="${H-6}" text-anchor="${i===0?'start':i===P.length-1?'end':'middle'}" font-size="9.5" fill="#8d8d88">${fmtDate(pts[i].date,{day:'2-digit',month:'2-digit',year:'2-digit'})}</text>`:''}`).join('')}
  </svg>`;
}

const BF_REF = { F:[13,20,24,31], M:[5,13,17,24] };

/** Páginas de UMA avaliação. o.summary = só a 1ª página (resumo); o.guide/o.foot = incluir glossário/rodapé. */
export function buildReport({a, p, list}, o = {}){
  const sex = p.sex === 'F' ? 'F' : 'M';
  const r = calc(a, p);
  const idx = list.findIndex(x=>x.id===a.id);
  const prev = idx > 0 ? list[idx-1] : null;
  const rp = prev ? calc(prev, p) : null;
  const pr = PROTOCOLS[a.protocol||'jp7'];
  const need = pr.folds(sex);
  const c = a.circ || {}, pc = prev?.circ || {};
  const ex = a.extra || {};
  const h = num(a.height) ?? num(p.height);
  const t = BF_REF[sex];

  /* ---------- cabeçalho e identificação ---------- */
  const header = `<header class="rp-head">
    <div class="rp-brand"><span class="rp-mark">${ic('heart')}</span><div><b>Avaliação Física</b><small>Relatório de composição corporal</small></div></div>
    <div class="rp-head-r"><small>Data da avaliação</small><b>${fmtDate(a.date,{day:'numeric',month:'long',year:'numeric'})}</b><small>Avaliação ${idx+1} de ${list.length}</small></div>
  </header>`;

  const person = `<section class="rp-card rp-blue rp-person">
    <span class="rp-avatar">${esc(initials(p.name))}</span>
    <div class="rp-person-main"><b>${esc(p.name)}</b>
      <div class="rp-facts">
        <span><small>Sexo</small>${sex==='F'?'Feminino':'Masculino'}</span>
        <span><small>Idade na data</small>${r.age ?? '—'} anos</span>
        <span><small>Altura</small>${h!=null?fmt(h,0)+' cm':'—'}</span>
        <span><small>Peso</small>${fmt(num(a.weight))} kg</span>
        <span><small>Protocolo</small>${esc(pr.name)}</span>
        ${ex.evaluator?`<span><small>Avaliador(a)</small>${esc(ex.evaluator)}</span>`:''}
        ${extraFacts().map(([l,v])=>`<span><small>${l}</small>${v}</span>`).join('')}
      </div>
    </div>
  </section>`;

  /* ---------- resumo ---------- */
  const hero = `<section class="rp-summary">
    <div class="rp-card rp-blue rp-hero">
      <div class="rp-hero-l">
        <div class="rp-label">${ic('flame')} Gordura corporal</div>
        <div class="rp-big">${fmt(r.bf)}<small>%</small></div>
        <div class="rp-tags">${r.bf!=null?`<span class="rp-tag">${esc(bfClass(r.bf,sex))}</span>`:''}${rp?delta(r.bf,rp.bf,-1,1,'pp'):''}</div>
        <small class="rp-src">${r.bfSource ? 'Método: '+esc(r.bfSource==='JP7'||r.bfSource==='JP3'||r.bfSource==='DW'?pr.name:r.bfSource) : 'Sem dados suficientes para calcular'}</small>
      </div>
      <div class="rp-ring">${ring(r.bf, 40, 'oklch(0.838 0.083 49)')}<div class="rp-ring-c"><b>${r.leanMass!=null?fmt(r.leanMass):fmt(r.bmi)}</b><span>${r.leanMass!=null?'kg magra':'IMC'}</span></div></div>
    </div>
    <div class="rp-kpis">
      ${[['scale','Peso',num(a.weight),'kg',prev?num(prev.weight):null,0,''],
         ['bolt','Massa magra',r.leanMass,'kg',rp?.leanMass,1,'green'],
         ['drop','Massa gorda',r.fatMass,'kg',rp?.fatMass,-1,'yellow'],
         ['target','IMC',r.bmi,'kg/m²',rp?.bmi,-1,'']].map(([i,l,v,u,pv,dir,col])=>`
        <div class="rp-card rp-kpi ${col?'rp-'+col:''}"><div class="rp-label">${ic(i)} ${l}</div><div class="rp-mid">${fmt(v)}<small>${u}</small></div>${prev?delta(v,pv,dir,1,u==='kg/m²'?'':u):'<span class="rp-muted small">primeira avaliação</span>'}</div>`).join('')}
    </div>
  </section>`;

  const comp = r.fatMass!=null ? `<section class="rp-card rp-yellow rp-comp">
    <div class="rp-sec-h"><h3>Composição corporal</h3><span class="rp-muted">do peso total de ${fmt(num(a.weight))} kg</span></div>
    <div class="rp-combar"><span style="width:${100-r.bf}%;background:oklch(0.877 0.093 129)"><b>${fmt(100-r.bf)}%</b></span><span style="width:${r.bf}%;background:oklch(0.838 0.083 49)"><b>${fmt(r.bf)}%</b></span></div>
    <div class="rp-legend"><span><i style="background:oklch(0.877 0.093 129)"></i>Massa magra <b>${fmt(r.leanMass)} kg</b> — músculos, ossos, órgãos e água</span><span><i style="background:oklch(0.838 0.083 49)"></i>Massa gorda <b>${fmt(r.fatMass)} kg</b> — gordura total</span></div>
  </section>` : '';

  /* ---------- indicadores com referência ---------- */
  const st = (txt, cls) => `<span class="rp-status ${cls}">${esc(txt)}</span>`;
  const bmiCls = b => b==null?'':b<18.5?'neu':b<25?'good':b<30?'warn':'bad';
  const bfCls = v => v==null?'':v<=t[0]?'neu':v<=t[2]?'good':v<=t[3]?'warn':'bad';
  const whrCls = v => { const s = whrRisk(v,sex); return s==='Risco baixo'?'good':s==='Risco moderado'?'warn':'bad'; };
  const rows = [
    r.bf!=null && ['% de gordura', fmt(r.bf)+' %', sex==='F'?'Boa forma: 21–24 % · Média: 25–31 %':'Boa forma: 14–17 % · Média: 18–24 %', st(bfClass(r.bf,sex), bfCls(r.bf))],
    r.bmi!=null && ['IMC', fmt(r.bmi)+' kg/m²', 'Normal: 18,5 a 24,9', st(bmiClass(r.bmi), bmiCls(r.bmi))],
    r.whr!=null && ['Relação cintura/quadril (RCQ)', fmt(r.whr,2), sex==='F'?'Risco baixo: abaixo de 0,80':'Risco baixo: abaixo de 0,95', st(whrRisk(r.whr,sex), whrCls(r.whr))],
    r.whtr!=null && ['Relação cintura/altura (RCE)', fmt(r.whtr,2), 'Ideal: abaixo de 0,50', st(r.whtr<0.5?'Adequada':r.whtr<0.6?'Atenção':'Risco elevado', r.whtr<0.5?'good':r.whtr<0.6?'warn':'bad')],
    ...(() => { const e = CTX.energy ? CTX.energy(a) : null;
      // com o gasto energético configurado: basal da fórmula escolhida, gasto total e meta calórica
      if (e) return [['Metabolismo basal (TMB)', kcalTxt(e.bmr), `Repouso total · ${esc(e.label)}`, st('Estimativa','neu')],
        ['Gasto energético total', kcalTxt(e.tdee), `Basal × atividade ${esc(activityLabel(e.activity).toLowerCase())} (×${String(e.activity).replace('.',',')})`, st('Estimativa','neu')],
        ['Meta calórica diária', kcalTxt(e.target), `${esc(adjustLabel(e.adjust))} · P ${Math.round(e.macros.p.g)} g · G ${Math.round(e.macros.f.g)} g · C ${Math.round(e.macros.c.g)} g`, st('Plano','good')]];
      return [r.bmr!=null && ['Metabolismo basal (TMB)', fmt(r.bmr,0)+' kcal/dia', 'Energia gasta em repouso total', st('Estimativa','neu')]]; })(),
    r.sumProto!=null && [`Soma das dobras (${pr.short})`, fmt(r.sumProto)+' mm', 'Quanto menor, menos gordura subcutânea', rp?.sumProto!=null?delta(r.sumProto,rp.sumProto,-1,1,'mm'):st('Base','neu')],
  ].filter(Boolean);
  const indicators = rows.length ? `<section class="rp-block">
    <div class="rp-sec-h"><h3>${ic('target')} Indicadores de saúde</h3><span class="rp-muted">valor × referência</span></div>
    <table class="rp-table rp-ind"><thead><tr><th>Indicador</th><th>Resultado</th><th>Referência</th><th>Leitura</th></tr></thead>
    <tbody>${rows.map(x=>`<tr><td>${x[0]}</td><td class="rp-v">${x[1]}</td><td class="rp-muted">${x[2]}</td><td>${x[3]}</td></tr>`).join('')}</tbody></table>
  </section>` : '';

  const scales = `<section class="rp-scales">
    ${r.bf!=null?`<div class="rp-card"><div class="rp-label">${ic('flame')} Onde está seu % de gordura</div>${scale(r.bf, sex==='F'?8:2, sex==='F'?42:36, [[t[0],'oklch(0.858 0.055 214)','Essencial'],[t[1],'oklch(0.877 0.093 129)','Atlético'],[t[2],'oklch(0.919 0.065 128)','Boa forma'],[t[3],'oklch(0.908 0.143 102)','Média'],[99,'oklch(0.838 0.083 49)','Acima']])}</div>`:''}
    ${r.bmi!=null?`<div class="rp-card"><div class="rp-label">${ic('target')} Onde está seu IMC</div>${scale(r.bmi, 15, 40, [[18.5,'oklch(0.858 0.055 214)','Baixo'],[25,'oklch(0.877 0.093 129)','Normal'],[30,'oklch(0.908 0.143 102)','Sobrepeso'],[35,'oklch(0.838 0.083 49)','Obes. I'],[99,'oklch(0.785 0.099 20)','Obes. II+']])}</div>`:''}
  </section>`;

  /* ---------- comparação e evolução ---------- */
  const cmpRows = [
    ['Peso','kg',num(a.weight),prev&&num(prev.weight),0,1],
    ['% de gordura','%',r.bf,rp?.bf,-1,1,'pp'],
    ['Massa magra','kg',r.leanMass,rp?.leanMass,1,1],
    ['Massa gorda','kg',r.fatMass,rp?.fatMass,-1,1],
    ['IMC','',r.bmi,rp?.bmi,-1,1],
    ['Cintura','cm',num(c.waist),num(pc.waist),-1,1],
    ['Abdômen','cm',num(c.abdomen),num(pc.abdomen),-1,1],
    ['Quadril','cm',num(c.hip),num(pc.hip),-1,1],
    ['RCQ','',r.whr,rp?.whr,-1,2],
    ['Soma de todas as dobras','mm',r.sumAll,rp?.sumAll,-1,1],
    ['Metabolismo basal','kcal',r.bmr,rp?.bmr,0,0],
  ].filter(x=>x[2]!=null||x[3]!=null);
  const days = prev ? Math.round((new Date(a.date)-new Date(prev.date))/864e5) : 0;
  const compare = prev ? `<section class="rp-block">
    <div class="rp-sec-h"><h3>${ic('swap')} Comparação com a avaliação anterior</h3><span class="rp-muted">${fmtDate(prev.date)} → ${fmtDate(a.date)} · ${days} dias</span></div>
    <table class="rp-table"><thead><tr><th>Medida</th><th>Anterior</th><th>Atual</th><th>Variação</th></tr></thead>
    <tbody>${cmpRows.map(([l,u,v,pv,dir,d,du])=>`<tr><td>${l}</td><td class="rp-muted">${fmt(pv,d)}${pv!=null&&u?' '+u:''}</td><td class="rp-v">${fmt(v,d)}${v!=null&&u?' '+u:''}</td><td>${delta(v,pv,dir,d,du??u)}</td></tr>`).join('')}</tbody></table>
    <p class="rp-legend-s"><span class="rp-delta good">verde</span> evolução favorável · <span class="rp-delta bad">laranja</span> pede atenção · <span class="rp-delta neu">azul</span> variação neutra (sem melhor ou pior) · pp = pontos percentuais</p>
  </section>` : '';

  const upTo = list.slice(0, idx+1);
  const series = (get) => upTo.map(x=>({date:x.date, y:get(x, calc(x,p))})).filter(x=>x.y!=null);
  const evo = upTo.length >= 2 ? `<section class="rp-block">
    <div class="rp-sec-h"><h3>${ic('chart')} Evolução até esta avaliação</h3><span class="rp-muted">${upTo.length} avaliações</span></div>
    <div class="rp-charts">
      ${[['Peso','kg',x=>num(x.weight),'oklch(0.502 0.069 215)'],['% de gordura','%',(x,rr)=>rr.bf,'oklch(0.55 0.143 40)'],['Massa magra','kg',(x,rr)=>rr.leanMass,'oklch(0.55 0.129 134)']]
        .map(([l,u,g,col])=>{ const s=series(g); return s.length>=2?`<div class="rp-card rp-white"><div class="rp-label">${l} <span class="rp-muted">(${u})</span></div>${miniChart(s,col)}</div>`:''; }).join('')}
    </div>
  </section>` : '';

  /* ---------- medidas ---------- */
  const trunk = CIRC_TRUNK.filter(x=>num(c[x.k])!=null).map(x=>`<tr><td>${x.l}</td><td class="rp-v">${fmt(num(c[x.k]))} cm</td><td>${prev?delta(num(c[x.k]),num(pc[x.k]),x.dir,1,'cm'):''}</td></tr>`).join('');
  const limbs = CIRC_LIMBS.filter(x=>num(c[x.k+'_r'])!=null||num(c[x.k+'_l'])!=null).map(x=>`<tr><td>${x.l}</td><td class="rp-v">${fmt(num(c[x.k+'_r']))}</td><td class="rp-v">${fmt(num(c[x.k+'_l']))}</td></tr>`).join('');
  const reads = k => { const f = a.folds?.[k]; const arr = (Array.isArray(f)?f:[f]).map(num).filter(v=>v!=null&&v>0); return a.multi && arr.length>1 ? arr.map(v=>fmt(v)).join(' · ') : ''; };
  const folds = FOLDS.filter(f=>foldVal(a,f.k)!=null).map(f=>`<tr><td>${f.l} ${need.includes(f.k)?`<span class="rp-pill">${pr.short}</span>`:''}</td><td class="rp-muted">${reads(f.k)}</td><td class="rp-v">${fmt(foldVal(a,f.k))} mm</td><td>${prev?delta(foldVal(a,f.k),foldVal(prev,f.k),-1,1,''):''}</td></tr>`).join('');
  const bio = [['% de gordura (bio)',num(ex.bf),'%'],['Massa muscular',num(ex.muscle),'kg'],['Gordura visceral',num(ex.visceral),'nível'],['Água corporal',num(ex.water),'%']].filter(x=>x[1]!=null);

  const measures = (trunk||limbs||folds||bio.length) ? `<section class="rp-measures">
    <div class="rp-sec-h"><h3>${ic('ruler')} Medidas coletadas</h3></div>
    <div class="rp-cols">
      <div>
        ${trunk?`<div class="rp-grp"><h4>Circunferências do tronco</h4><table class="rp-table rp-tight"><tbody>${trunk}</tbody></table></div>`:''}
        ${limbs?`<div class="rp-grp"><h4>Circunferências dos membros (cm)</h4><table class="rp-table rp-tight"><thead><tr><th></th><th>Direito</th><th>Esquerdo</th></tr></thead><tbody>${limbs}</tbody></table></div>`:''}
        ${bio.length?`<div class="rp-grp"><h4>Bioimpedância</h4><table class="rp-table rp-tight"><tbody>${bio.map(([l,v,u])=>`<tr><td>${l}</td><td class="rp-v">${fmt(v)} ${u}</td></tr>`).join('')}</tbody></table></div>`:''}
      </div>
      <div>
        ${folds?`<div class="rp-grp"><h4>Dobras cutâneas ${a.multi?'<span class="rp-muted">(média de 3 leituras)</span>':''}</h4><table class="rp-table rp-tight rp-folds"><tbody>${folds}</tbody></table>
        <div class="rp-sums">${r.sumProto!=null?`<span><small>Soma ${pr.short}</small><b>${fmt(r.sumProto)} mm</b></span>`:''}${r.sumAll!=null?`<span><small>Soma total</small><b>${fmt(r.sumAll)} mm</b></span>`:''}${r.density!=null?`<span><small>Densidade</small><b>${fmt(r.density,4)} g/ml</b></span>`:''}</div></div>`:''}
      </div>
    </div>
  </section>` : '';

  const notes = ex.notes ? `<section class="rp-card rp-notes"><div class="rp-label">${ic('note')} Observações</div><p>${esc(ex.notes)}</p></section>` : '';

  /* ---------- como ler + metodologia ---------- */
  const guide = `<section class="rp-block rp-guide">
    <div class="rp-sec-h"><h3>${ic('book')} Entenda seus resultados</h3></div>
    <div class="rp-glossary">
      <div><b>% de gordura</b><p>Quanto do seu peso é gordura. É o principal indicador de composição corporal — mais importante que o peso sozinho.</p></div>
      <div><b>Massa magra</b><p>Tudo que não é gordura: músculos, ossos, órgãos e água. Manter ou aumentar é sinal de bom treino e boa alimentação.</p></div>
      <div><b>IMC</b><p>Relação entre peso e altura. É uma triagem rápida, mas não separa músculo de gordura.</p></div>
      <div><b>RCQ e RCE</b><p>Mostram onde a gordura está. Gordura concentrada na cintura está mais ligada a risco cardiovascular.</p></div>
      <div><b>Metabolismo basal</b><p>Calorias que o corpo gasta em repouso total para se manter funcionando. Base para planejar a dieta.</p></div>
      <div><b>Dobras cutâneas</b><p>Espessura da gordura sob a pele, medida com adipômetro. A soma é ótima para acompanhar sua evolução.</p></div>
    </div>
    <p class="rp-method"><b>Metodologia.</b> ${
      r.bfSource && ['JP7','JP3','DW'].includes(r.bfSource)
        ? `Densidade corporal pela equação de ${esc(pr.name)} (${need.length} dobras); % de gordura pela equação de Siri: %G = (4,95 ÷ densidade − 4,5) × 100.`
        : r.bfSource==='Bioimpedância' ? '% de gordura informado pela balança de bioimpedância.'
        : r.bfSource ? '% de gordura estimado pela fórmula da Marinha dos EUA (circunferências e altura).' : '% de gordura não calculado: faltam medidas do protocolo.'}
      ${r.leanMass!=null ? 'Metabolismo basal pela equação de Katch-McArdle: 370 + 21,6 × massa magra (kg).' : r.bmr!=null ? 'Metabolismo basal pela equação de Mifflin-St Jeor.' : ''}
      Classificação de % de gordura segundo o American Council on Exercise (ACE); IMC segundo a OMS.</p>
  </section>`;

  const foot = o.foot === false ? '' : footer(ex.evaluator);
  if (o.summary) return `<div class="rp-page">${header}${person}${hero}${comp}${scales}${indicators}${foot}</div>`;
  return `<div class="rp-page">${header}${person}${hero}${comp}${scales}${indicators}</div>
    <div class="rp-page">${compare}${goalsBlock(list.slice(0, idx+1), p, a.date)}${o.evo === false ? '' : evo}${measures}${notes}${photosBlock(a)}${dietBlock(a)}${o.guide === false ? '' : guide}${foot}</div>`;
}

/* =========================================================
   Peças comuns dos outros relatórios
   ========================================================= */
const longDate = iso => fmtDate(iso,{day:'numeric',month:'long',year:'numeric'});
const shortDate = iso => fmtDate(iso,{day:'2-digit',month:'2-digit',year:'numeric'});
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);

function footer(evaluator){
  return `<footer class="rp-foot">
    <div class="rp-signature"><span></span><small>${evaluator ? esc(evaluator) : proLine() ? esc(proLine()) : 'Avaliador(a)'}</small></div>
    ${CTX.nutri?.name ? `<p class="rp-pro"><b>Nutricionista responsável:</b> ${esc(proLine())}${CTX.nutri.phone ? ' · ' + esc(CTX.nutri.phone) : ''}${CTX.nutri.place ? ' · ' + esc(CTX.nutri.place) : ''}</p>` : ''}
    <p>Relatório gerado em ${longDate(today())}. Valores estimados por equações de referência; este documento é informativo e não substitui avaliação profissional.</p>
  </footer>`;
}
function head(subtitle, rSmall, rBig, rSub){
  return `<header class="rp-head">
    <div class="rp-brand"><span class="rp-mark">${ic('heart')}</span><div><b>Avaliação Física</b><small>${subtitle}</small></div></div>
    <div class="rp-head-r"><small>${rSmall}</small><b>${rBig}</b>${rSub?`<small>${rSub}</small>`:''}</div>
  </header>`;
}
function personCard(p, facts){
  return `<section class="rp-card rp-blue rp-person"><span class="rp-avatar">${esc(initials(p.name))}</span>
    <div class="rp-person-main"><b>${esc(p.name)}</b><div class="rp-facts">${facts.filter(Boolean).map(([l,v])=>`<span><small>${l}</small>${v}</span>`).join('')}</div></div></section>`;
}
function glossary(){
  return `<section class="rp-block rp-guide">
    <div class="rp-sec-h"><h3>${ic('book')} Entenda os indicadores</h3></div>
    <div class="rp-glossary">
      <div><b>% de gordura</b><p>Quanto do peso é gordura. Principal indicador de composição corporal — mais importante que o peso sozinho.</p></div>
      <div><b>Massa magra</b><p>Tudo que não é gordura: músculos, ossos, órgãos e água. Manter ou aumentar indica bom treino e alimentação.</p></div>
      <div><b>IMC</b><p>Relação entre peso e altura. Triagem rápida, mas não separa músculo de gordura.</p></div>
      <div><b>RCQ e RCE</b><p>Mostram onde a gordura está. Gordura concentrada na cintura está mais ligada a risco cardiovascular.</p></div>
      <div><b>Metabolismo basal</b><p>Calorias gastas em repouso total. Base para planejar a dieta.</p></div>
      <div><b>Dobras cutâneas</b><p>Espessura da gordura sob a pele. A soma das dobras é ótima para acompanhar a evolução.</p></div>
    </div>
    <p class="rp-method"><b>Metodologia.</b> % de gordura por dobras cutâneas (Pollock 7 ou 3 dobras, Durnin & Womersley) e equação de Siri; na falta de dobras, bioimpedância ou fórmula da Marinha dos EUA. Metabolismo basal por Katch-McArdle (com massa magra) ou Mifflin-St Jeor. Classificações: ACE (% de gordura) e OMS (IMC). pp = pontos percentuais.</p>
  </section>`;
}
const legendLine = `<p class="rp-legend-s"><span class="rp-delta good">verde</span> evolução favorável · <span class="rp-delta bad">laranja</span> pede atenção · <span class="rp-delta neu">azul</span> variação neutra · pp = pontos percentuais</p>`;

/* métricas usadas nos relatórios de evolução */
const EVO = [
  {k:'weight',l:'Peso',u:'kg',dir:0,get:(a)=>num(a.weight),col:'oklch(0.502 0.069 215)'},
  {k:'bf',l:'% de gordura',u:'%',du:'pp',dir:-1,get:(a,r)=>r.bf,col:'oklch(0.55 0.143 40)'},
  {k:'lean',l:'Massa magra',u:'kg',dir:1,get:(a,r)=>r.leanMass,col:'oklch(0.55 0.129 134)'},
  {k:'fat',l:'Massa gorda',u:'kg',dir:-1,get:(a,r)=>r.fatMass,col:'oklch(0.536 0.103 99)'},
  {k:'bmi',l:'IMC',u:'',dir:-1,get:(a,r)=>r.bmi,col:'oklch(0.45 0.05 260)'},
  {k:'waist',l:'Cintura',u:'cm',dir:-1,get:(a)=>num(a.circ?.waist),col:'oklch(0.502 0.069 215)'},
  {k:'abd',l:'Abdômen',u:'cm',dir:-1,get:(a)=>num(a.circ?.abdomen),col:'oklch(0.502 0.069 215)'},
  {k:'hip',l:'Quadril',u:'cm',dir:-1,get:(a)=>num(a.circ?.hip),col:'oklch(0.502 0.069 215)'},
  {k:'sum',l:'Soma das dobras',u:'mm',dir:-1,get:(a,r)=>r.sumAll,col:'oklch(0.536 0.103 99)'},
  {k:'whr',l:'Relação cintura/quadril',u:'',dir:-1,d:2,get:(a,r)=>r.whr,col:'oklch(0.45 0.05 260)'},
  {k:'muscle',l:'Massa muscular (bio)',u:'kg',dir:1,get:(a)=>num(a.extra?.muscle),col:'oklch(0.55 0.129 134)'},
  {k:'visc',l:'Gordura visceral (bio)',u:'',dir:-1,get:(a)=>num(a.extra?.visceral),col:'oklch(0.55 0.143 40)'},
  {k:'water',l:'Água corporal (bio)',u:'%',dir:0,get:(a)=>num(a.extra?.water),col:'oklch(0.502 0.069 215)'},
];

/** Relatório de evolução: todas as avaliações da pessoa. */
export function buildEvolution({p, list}, o = {}){
  const sex = p.sex === 'F' ? 'F' : 'M';
  const R = list.map(a => ({a, r: calc(a, p)}));
  const first = R[0], last = R.at(-1);
  const days = daysBetween(first.a.date, last.a.date);
  const val = (m, x) => m.get(x.a, x.r);

  const hd = head('Relatório de evolução', 'Período', `${fmtDate(first.a.date)} → ${fmtDate(last.a.date)}`, `${list.length} avaliações · ${days} dias`);
  const person = personCard(p, [['Sexo', sex==='F'?'Feminino':'Masculino'], ['Idade atual', `${last.r.age ?? '—'} anos`], num(p.height)!=null && ['Altura', fmt(num(p.height),0)+' cm'], ['Primeira avaliação', longDate(first.a.date)], ['Última avaliação', longDate(last.a.date)], ...extraFacts()]);

  // frase-resumo
  const parts = [];
  const dW = num(last.a.weight) - num(first.a.weight); if (isFinite(dW)) parts.push(`${sign(dW,1)} kg de peso`);
  if (first.r.bf!=null && last.r.bf!=null) parts.push(`${sign(last.r.bf-first.r.bf,1)} pp de gordura`);
  if (first.r.leanMass!=null && last.r.leanMass!=null) parts.push(`${sign(last.r.leanMass-first.r.leanMass,1)} kg de massa magra`);
  const wst = [num(first.a.circ?.waist), num(last.a.circ?.waist)]; if (wst[0]!=null && wst[1]!=null) parts.push(`${sign(wst[1]-wst[0],1)} cm de cintura`);
  const headline = parts.length ? `<section class="rp-card rp-yellow rp-headline"><small>Em ${days} dias</small><p>${parts.join(' · ')}</p></section>` : '';

  const kpis = `<section class="rp-kpis rp-kpis4">${EVO.slice(0,4).map(m => { const a = val(m, first), b = val(m, last); return `
    <div class="rp-card rp-kpi ${m.k==='lean'?'rp-green':m.k==='fat'?'rp-yellow':m.k==='bf'?'rp-blue':''}"><div class="rp-label">${m.l}</div>
      <div class="rp-mid">${fmt(b)}<small>${m.u}</small></div>
      <small class="rp-muted">início: ${fmt(a)} ${m.u}</small>${delta(b, a, m.dir, 1, m.du ?? m.u)}</div>`; }).join('')}</section>`;

  const charts = EVO.map(m => { const s = R.map(x => ({date:x.a.date, y:val(m,x)})).filter(x=>x.y!=null); if (s.length < 2) return '';
    return `<div class="rp-card rp-white"><div class="rp-sec-h rp-chart-h"><div class="rp-label">${m.l} ${m.u?`<span class="rp-muted">(${m.u})</span>`:''}</div>${delta(s.at(-1).y, s[0].y, m.dir, m.d ?? 1, m.du ?? m.u)}</div>${miniChart(s, m.col, m.d ?? 1)}</div>`; }).join('');

  const cols = EVO.filter(m => R.some(x => val(m,x)!=null)).slice(0, 8);
  const table = `<section class="rp-block"><div class="rp-sec-h"><h3>${ic('note')} Todas as avaliações</h3><span class="rp-muted">da mais antiga para a mais recente</span></div>
    <table class="rp-table rp-all"><thead><tr><th>Data</th>${cols.map(m=>`<th>${m.l}${m.u?` <span>(${m.u})</span>`:''}</th>`).join('')}</tr></thead>
    <tbody>${R.map((x,i)=>`<tr><td class="rp-v">${shortDate(x.a.date)}</td>${cols.map(m=>{ const v = val(m,x), pv = i ? val(m,R[i-1]) : null; return `<td><b>${fmt(v, m.d ?? 1)}</b>${i && v!=null && pv!=null ? `<em class="${tone(v-pv, m.dir)}">${sign(v-pv, m.d ?? 1)}</em>` : ''}</td>`; }).join('')}</tr>`).join('')}</tbody></table></section>`;

  // circunferências e dobras: primeira × última
  const rowsFL = (items) => items.map(([l, g, dir]) => { const a = g(first.a), b = g(last.a); if (a==null && b==null) return ''; return `<tr><td>${l}</td><td class="rp-muted">${fmt(a)}</td><td class="rp-v">${fmt(b)}</td><td>${delta(b, a, dir, 1, '')}</td></tr>`; }).join('');
  const circ = rowsFL([...CIRC_TRUNK.map(c=>[c.l, a=>num(a.circ?.[c.k]), c.dir]), ...CIRC_LIMBS.flatMap(c=>[[c.l+' (D)', a=>num(a.circ?.[c.k+'_r']), 0],[c.l+' (E)', a=>num(a.circ?.[c.k+'_l']), 0]])]);
  const folds = rowsFL(FOLDS.map(f=>[f.l, a=>foldVal(a,f.k), -1]));
  const th = `<thead><tr><th></th><th>${shortDate(first.a.date)}</th><th>${shortDate(last.a.date)}</th><th>Variação</th></tr></thead>`;
  const fl = (circ || folds) ? `<section><div class="rp-sec-h"><h3>${ic('ruler')} Medidas: primeira × última avaliação</h3></div>
    <div class="rp-cols">${circ?`<div class="rp-grp"><h4>Circunferências (cm)</h4><table class="rp-table rp-tight">${th}<tbody>${circ}</tbody></table></div>`:'<div></div>'}
    ${folds?`<div class="rp-grp"><h4>Dobras cutâneas (mm)</h4><table class="rp-table rp-tight">${th}<tbody>${folds}</tbody></table></div>`:''}</div>${legendLine}</section>` : '';

  return `<div class="rp-page">${hd}${person}${headline}${kpis}<section><div class="rp-sec-h"><h3>${ic('chart')} Gráficos de evolução</h3><span class="rp-muted">valor inicial → atual</span></div><div class="rp-charts rp-charts2">${charts}</div></section></div>
    <div class="rp-page">${goalsBlock(list, p)}${table}${fl}${photosPairs(first.a, last.a, 'Antes e depois: primeira × última avaliação')}${o.guide === false ? '' : glossary()}${o.foot === false ? '' : footer()}</div>`;
}

/** Comparativo entre duas avaliações (A = antes, B = depois). */
export function buildCompare({p, A, B}){
  const sex = p.sex === 'F' ? 'F' : 'M';
  const rA = calc(A, p), rB = calc(B, p);
  const days = daysBetween(A.date, B.date);
  const hd = head('Comparativo entre avaliações', 'Antes → Depois', `${fmtDate(A.date)} → ${fmtDate(B.date)}`, `${Math.abs(days)} dias entre as avaliações`);
  const person = personCard(p, [['Sexo', sex==='F'?'Feminino':'Masculino'], ['Idade', `${rB.age ?? '—'} anos`], num(B.height)!=null && ['Altura', fmt(num(B.height),0)+' cm'], ['Antes (A)', longDate(A.date)], ['Depois (B)', longDate(B.date)], ...extraFacts()]);

  const kpis = `<section class="rp-kpis rp-kpis4">${EVO.slice(0,4).map(m => { const a = m.get(A,rA), b = m.get(B,rB); return `
    <div class="rp-card rp-kpi ${m.k==='lean'?'rp-green':m.k==='fat'?'rp-yellow':m.k==='bf'?'rp-blue':''}"><div class="rp-label">${m.l}</div>
      <div class="rp-ab"><span><small>A</small>${fmt(a)}</span><i>→</i><span><small>B</small><b>${fmt(b)}</b></span><em>${m.u}</em></div>${delta(b, a, m.dir, 1, m.du ?? m.u)}</div>`; }).join('')}</section>`;

  const bar = (r, label) => r.fatMass==null ? '' : `<div class="rp-cbar"><small>${label}</small><div class="rp-combar"><span style="width:${100-r.bf}%;background:oklch(0.877 0.093 129)"><b>${fmt(r.leanMass)} kg magra</b></span><span style="width:${r.bf}%;background:oklch(0.838 0.083 49)"><b>${fmt(r.fatMass)} kg</b></span></div></div>`;
  const comp = (rA.fatMass!=null || rB.fatMass!=null) ? `<section class="rp-card rp-yellow"><div class="rp-sec-h"><h3>Composição corporal</h3><span class="rp-muted">massa magra × massa gorda</span></div>${bar(rA, 'Antes · '+fmtDate(A.date))}${bar(rB, 'Depois · '+fmtDate(B.date))}</section>` : '';

  const groups = GROUPS.map(g => {
    const rows = g.items.map(m => { const va = m.get(A,rA), vb = m.get(B,rB); if (va==null && vb==null) return ''; const d = m.d ?? 1;
      const pct = va && vb!=null ? (vb-va)/Math.abs(va)*100 : null;
      return `<tr><td>${m.l}</td><td class="rp-muted">${fmt(va,d)}</td><td class="rp-v">${fmt(vb,d)}</td><td>${delta(vb, va, m.dir, d, m.k==='bf'?'pp':m.u)}</td><td class="rp-muted">${pct!=null?sign(pct,1)+'%':''}</td></tr>`; }).join('');
    return rows ? `<div class="rp-grp"><h4>${g.g}</h4><table class="rp-table rp-tight rp-cmp"><thead><tr><th></th><th>A</th><th>B</th><th>Variação</th><th>%</th></tr></thead><tbody>${rows}</tbody></table></div>` : '';
  }).filter(Boolean);
  const half = Math.ceil(groups.length / 2);
  const tables = `<section><div class="rp-sec-h"><h3>${ic('swap')} Todas as medidas</h3><span class="rp-muted">A = ${shortDate(A.date)} · B = ${shortDate(B.date)}</span></div>
    <div class="rp-cols"><div>${groups.slice(0, half).join('')}</div><div>${groups.slice(half).join('')}</div></div>${legendLine}</section>`;

  const pics = photosPairs(A, B);
  return `<div class="rp-page">${hd}${person}${kpis}${comp}${tables}${pics ? '' : footer(B.extra?.evaluator)}</div>${pics ? `<div class="rp-page">${pics}${footer(B.extra?.evaluator)}</div>` : ''}`;
}

/** Capa + índice do histórico completo. */
function buildCover({p, list}){
  const sex = p.sex === 'F' ? 'F' : 'M';
  const R = list.map(a => ({a, r: calc(a, p)}));
  const first = R[0], last = R.at(-1);
  return `<div class="rp-page rp-cover">
    ${head('Histórico completo', 'Gerado em', longDate(today()))}
    <section class="rp-card rp-blue rp-cover-hero"><small>Relatório completo de avaliações físicas</small><h1>${esc(p.name)}</h1>
      <div class="rp-facts"><span><small>Sexo</small>${sex==='F'?'Feminino':'Masculino'}</span><span><small>Idade atual</small>${last.r.age ?? '—'} anos</span>${num(p.height)!=null?`<span><small>Altura</small>${fmt(num(p.height),0)} cm</span>`:''}<span><small>Avaliações</small>${list.length}</span><span><small>Período</small>${fmtDate(first.a.date)} → ${fmtDate(last.a.date)}</span>${extraFacts().map(([l,v])=>`<span><small>${l}</small>${v}</span>`).join('')}${proLine()?`<span><small>Nutricionista</small>${esc(proLine())}</span>`:''}</div></section>
    <section class="rp-block"><div class="rp-sec-h"><h3>${ic('note')} Conteúdo</h3></div>
      <ol class="rp-toc">${list.length>1?'<li><b>Evolução</b><span>gráficos, tabela de todas as avaliações e primeira × última</span></li>':''}${R.map((x,i)=>`<li><b>Avaliação ${i+1} — ${longDate(x.a.date)}</b><span>${fmt(num(x.a.weight))} kg · ${x.r.bf!=null?fmt(x.r.bf)+'% de gordura':'sem % de gordura'} · ${esc(PROTOCOLS[x.a.protocol||'jp7'].name)}</span></li>`).join('')}<li><b>Entenda os indicadores</b><span>glossário e metodologia</span></li></ol></section>
  </div>`;
}

/* =========================================================
   Exportação: monta o documento e abre "Salvar como PDF"
   ========================================================= */
export function reportHtml(kind, data){
  const {p, list = []} = data;
  CTX = data.ctx || {};
  switch (kind){
    case 'summary': return buildReport(data, {summary:true});
    case 'evolution': return buildEvolution({p, list});
    case 'compare': return buildCompare(data);
    case 'full': return buildCover({p, list})
      + (list.length > 1 ? buildEvolution({p, list}, {guide:false, foot:false}) : '')
      + list.map(a => buildReport({a, p, list}, {guide:false, foot:false, evo:false})).join('')
      + `<div class="rp-page">${glossary()}${footer()}</div>`;
    default: return buildReport(data);
  }
}
export function reportTitle(kind, data){
  const n = data.p.name, d = iso => shortDate(iso).replace(/\//g,'-');
  switch (kind){
    case 'summary': return `Resumo da avaliação - ${n} - ${d(data.a.date)}`;
    case 'evolution': return `Evolução - ${n} - ${d(data.list[0].date)} a ${d(data.list.at(-1).date)}`;
    case 'compare': return `Comparativo - ${n} - ${d(data.A.date)} x ${d(data.B.date)}`;
    case 'full': return `Histórico completo - ${n}`;
    default: return `Avaliação física - ${n} - ${d(data.a.date)}`;
  }
}

export function exportPdf(kind, data){
  let root = document.getElementById('print-root');
  if (!root){ root = document.createElement('div'); root.id = 'print-root'; document.body.appendChild(root); }
  root.innerHTML = `<article class="rp">${reportHtml(kind, data)}</article>`;
  const oldTitle = document.title;
  document.title = reportTitle(kind, data); // vira o nome sugerido do arquivo PDF
  document.body.classList.add('printing-report');
  const done = () => { document.body.classList.remove('printing-report'); document.title = oldTitle; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  // fora da impressão o relatório fica escondido; só o título precisa voltar (no 'afterprint')
  // espera as fontes e as fotos carregarem (no máximo 8 s) para nada sair em branco no PDF
  const imgs = [...root.querySelectorAll('img')];
  const loaded = Promise.all(imgs.map(i => i.complete ? null : new Promise(res => { i.onload = i.onerror = res; })));
  Promise.all([document.fonts?.ready ?? Promise.resolve(), Promise.race([loaded, new Promise(res => setTimeout(res, 8000))])])
    .then(() => requestAnimationFrame(() => window.print()));
}
