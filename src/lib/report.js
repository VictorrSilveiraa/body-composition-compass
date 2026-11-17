/*
 * Relatório A4 da avaliação (vira PDF pelo "Salvar como PDF" do navegador).
 * Montado só na hora de imprimir, fora da tela do app, com a mesma estética do site.
 */
import {num,fmt,fmtDate,calc,bmiClass,bfClass,whrRisk,PROTOCOLS,FOLDS,CIRC_TRUNK,CIRC_LIMBS,foldVal,esc,initials,today} from './calculos.js';

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

export function buildReport({a, p, list}){
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
    r.bmr!=null && ['Metabolismo basal (TMB)', fmt(r.bmr,0)+' kcal/dia', 'Energia gasta em repouso total', st('Estimativa','neu')],
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

  const measures = (trunk||limbs||folds) ? `<section class="rp-measures">
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

  const sign_ = `<footer class="rp-foot">
    <div class="rp-signature"><span></span><small>${ex.evaluator?esc(ex.evaluator):'Avaliador(a)'}</small></div>
    <p>Relatório gerado em ${fmtDate(today(),{day:'numeric',month:'long',year:'numeric'})}. Valores estimados por equações de referência; este documento é informativo e não substitui avaliação profissional.</p>
  </footer>`;

  return `<article class="rp">
    <div class="rp-page">${header}${person}${hero}${comp}${scales}${indicators}</div>
    <div class="rp-page">${compare}${evo}${measures}${notes}${guide}${sign_}</div>
  </article>`;
}

/** Monta o relatório, abre a janela de impressão (Salvar como PDF) e limpa depois. */
export function printReport(data){
  let root = document.getElementById('print-root');
  if (!root){ root = document.createElement('div'); root.id = 'print-root'; document.body.appendChild(root); }
  root.innerHTML = buildReport(data);
  const oldTitle = document.title;
  // nome sugerido do arquivo PDF
  document.title = `Avaliação física - ${data.p.name} - ${fmtDate(data.a.date,{day:'2-digit',month:'2-digit',year:'numeric'}).replace(/\//g,'-')}`;
  document.body.classList.add('printing-report');
  const done = () => { document.body.classList.remove('printing-report'); document.title = oldTitle; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  // fora da impressão o relatório fica escondido; só o título precisa voltar (no 'afterprint')
  (document.fonts?.ready ?? Promise.resolve()).then(() => requestAnimationFrame(() => window.print()));
}
