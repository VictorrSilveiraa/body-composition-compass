import {ageMonths,groupOf,ctxOf,bmiInfo,bfInfo,whrInfo,whtrInfo,calfInfo,audienceNote,GROUP_LABEL} from './publico';
const num = v => { if (v==null || v==='') return null; const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : null; };
const fmt = (v, d=1) => v==null || !isFinite(v) ? '—' : v.toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset()*6e4).toISOString().slice(0,10); };
const toDate = iso => { const [y,m,d] = (iso||today()).split('-').map(Number); return new Date(y, m-1, d); };
const fmtDate = (iso, o) => iso ? toDate(iso).toLocaleDateString('pt-BR', o || {day:'2-digit',month:'short',year:'numeric'}).replace('.', '') : '—';
const getPath = (o, p) => p.split('.').reduce((a,k) => a==null ? a : a[k], o);
const setPath = (o, p, v) => { const ks = p.split('.'); let c = o; ks.slice(0,-1).forEach((k,i) => { if (c[k]==null) c[k] = /^\d+$/.test(ks[i+1]) ? [] : {}; c = c[k]; }); c[ks.at(-1)] = v; };
const clone = o => JSON.parse(JSON.stringify(o));
const initials = n => (n||'?').trim().split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase();
const firstName = n => (n||'').trim().split(/\s+/)[0] || '';
function ageAt(birth, date){
  if (!birth) return null;
  const b = toDate(birth), d = toDate(date);
  let a = d.getFullYear() - b.getFullYear();
  const m = d.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && d.getDate() < b.getDate())) a--;
  return a;
}

/* ---------- catálogo de medidas ---------- */
const CIRC_TRUNK = [
  {k:'neck',l:'Pescoço',h:'Logo abaixo da proeminência laríngea (pomo de Adão).',dir:0},
  {k:'shoulder',l:'Ombros',h:'Maior circunferência, passando sobre os deltoides.',dir:0},
  {k:'chest',l:'Tórax',h:'Na linha dos mamilos, ao final de uma expiração normal.',dir:0},
  {k:'waist',l:'Cintura',h:'Menor circunferência entre a última costela e a crista ilíaca.',dir:-1},
  {k:'abdomen',l:'Abdômen',h:'Na altura da cicatriz umbilical, abdômen relaxado.',dir:-1},
  {k:'hip',l:'Quadril',h:'Maior protuberância dos glúteos, pés juntos.',dir:-1},
];
const CIRC_LIMBS = [
  {k:'arm',l:'Braço relaxado',h:'Ponto médio entre acrômio e olécrano, braço solto ao lado do corpo.'},
  {k:'biceps',l:'Bíceps contraído',h:'Maior circunferência com cotovelo a 90° e bíceps contraído.'},
  {k:'forearm',l:'Antebraço',h:'Maior circunferência, braço estendido e palma para cima.'},
  {k:'thighp',l:'Coxa proximal',h:'Logo abaixo da prega glútea.'},
  {k:'thighm',l:'Coxa medial',h:'Ponto médio entre a prega inguinal e a borda superior da patela.'},
  {k:'calf',l:'Panturrilha',h:'Maior circunferência da perna, em pé, peso distribuído.'},
];
const FOLDS = [
  {k:'triceps',l:'Tricipital',h:'Vertical, face posterior do braço, no ponto médio acrômio–olécrano.'},
  {k:'biceps',l:'Bicipital',h:'Vertical, face anterior do braço, mesmo nível da tricipital.'},
  {k:'subscapular',l:'Subescapular',h:'Oblíqua, 2 cm abaixo do ângulo inferior da escápula.'},
  {k:'chest',l:'Peitoral',h:'Diagonal, entre a linha axilar anterior e o mamilo.'},
  {k:'midaxillary',l:'Axilar média',h:'Vertical, na linha axilar média, altura do processo xifoide.'},
  {k:'suprailiac',l:'Supra-ilíaca',h:'Diagonal, logo acima da crista ilíaca, linha axilar anterior.'},
  {k:'abdominal',l:'Abdominal',h:'Vertical, 2 cm à direita da cicatriz umbilical.'},
  {k:'thigh',l:'Coxa',h:'Vertical, face anterior, ponto médio entre prega inguinal e patela.'},
  {k:'calf',l:'Panturrilha medial',h:'Vertical, face medial da perna, na maior circunferência.'},
];
const FOLD_NAME = Object.fromEntries(FOLDS.map(f=>[f.k,f.l]));

/*
 * Protocolos de dobras. Cada um tem a faixa de idade em que foi validado (ages[sexo] = [mín., máx.]).
 * dens → densidade corporal (convertida em % de gordura pela equação de Siri);
 * bf → equação que já dá o % de gordura direto (Faulkner, Slaughter).
 * kids: protocolo para crianças e adolescentes. br: desenvolvido com brasileiros.
 */
const PROTOCOLS = {
  jp7:{name:'Pollock 7 dobras',short:'JP7',desc:'Mais completo e preciso. Padrão em consultório.',ages:{M:[18,61],F:[18,55]},
    folds:()=>['chest','midaxillary','triceps','subscapular','abdominal','suprailiac','thigh'],
    dens:(S,a,sex)=> sex==='M' ? 1.112-0.00043499*S+0.00000055*S*S-0.00028826*a : 1.097-0.00046971*S+0.00000056*S*S-0.00012828*a},
  jp3:{name:'Pollock 3 dobras',short:'JP3',desc:'Rápido e prático, ótimo para acompanhamento.',ages:{M:[18,61],F:[18,55]},
    folds:sex=> sex==='M' ? ['chest','abdominal','thigh'] : ['triceps','suprailiac','thigh'],
    dens:(S,a,sex)=> sex==='M' ? 1.10938-0.0008267*S+0.0000016*S*S-0.0002574*a : 1.0994921-0.0009929*S+0.0000023*S*S-0.0001392*a},
  petroski:{name:'Petroski 4 dobras',short:'Petroski',br:true,desc:'Criado e validado com adultos brasileiros.',ages:{M:[18,61],F:[18,51]},
    folds:sex=> sex==='M' ? ['subscapular','triceps','suprailiac','calf'] : ['midaxillary','suprailiac','thigh','calf'],
    dens:(S,a,sex)=> sex==='M' ? 1.10726863-0.00081201*S+0.00000212*S*S-0.00041761*a : 1.19547130-0.07513507*Math.log10(S)-0.00041072*a},
  guedes:{name:'Guedes 3 dobras',short:'Guedes',br:true,desc:'Criado com jovens adultos brasileiros.',ages:{M:[17,27],F:[18,30]},
    folds:sex=> sex==='M' ? ['triceps','suprailiac','abdominal'] : ['subscapular','suprailiac','thigh'],
    dens:(S,a,sex)=> sex==='M' ? 1.17136-0.06706*Math.log10(S) : 1.16650-0.07063*Math.log10(S)},
  dw:{name:'Durnin & Womersley',short:'DW',desc:'4 dobras com coeficientes por faixa etária. Vai até 72 anos.',ages:{M:[16,72],F:[16,72]},
    folds:()=>['biceps','triceps','subscapular','suprailiac'],
    dens:(S,a,sex)=>{
      const t = sex==='M'
        ? [[19,1.1620,.0630],[29,1.1631,.0632],[39,1.1422,.0544],[49,1.1620,.0700],[999,1.1715,.0779]]
        : [[19,1.1549,.0678],[29,1.1599,.0717],[39,1.1423,.0632],[49,1.1333,.0612],[999,1.1339,.0645]];
      const row = t.find(r => a <= r[0]); return row[1] - row[2]*Math.log10(S);
    }},
  faulkner:{name:'Faulkner 4 dobras',short:'Faulkner',desc:'Muito usado com atletas e praticantes de esporte.',ages:{M:[18,60],F:[18,60]},
    folds:()=>['triceps','subscapular','suprailiac','abdominal'],
    bf:S=> 0.153*S + 5.783},
  sl_tc:{name:'Slaughter · tríceps e panturrilha',short:'Slaughter TP',kids:true,desc:'Crianças e adolescentes. Não depende da maturação.',ages:{M:[8,18],F:[8,18]},
    folds:()=>['triceps','calf'],
    bf:(S,a,sex)=> sex==='M' ? 0.735*S + 1.0 : 0.610*S + 5.1},
  sl_ts:{name:'Slaughter · tríceps e subescapular',short:'Slaughter TS',kids:true,desc:'Crianças e adolescentes. Nos meninos, ajusta pela maturação sexual.',ages:{M:[8,18],F:[8,18]},
    folds:()=>['triceps','subscapular'],
    bf:(S,a,sex,x)=>{
      if (sex==='F') return S>35 ? 0.546*S + 9.7 : 1.33*S - 0.013*S*S - 2.5;
      if (S>35) return 0.783*S + 1.6;
      const I = (num(x?.afro)===1 ? [-3.2,-5.2,-6.8] : [-1.7,-3.4,-5.5])[matStage(x, a, sex)-1];
      return 1.21*S - 0.008*S*S + I;
    }},
};
const PROTO_KEYS = Object.keys(PROTOCOLS);
const protoOf = k => PROTOCOLS[k] || PROTOCOLS.jp7;
/** a idade está dentro da faixa em que o protocolo foi validado? (sem idade: sim) */
function protoFits(k, age, sex){ const g = protoOf(k).ages?.[sex==='F'?'F':'M']; return age==null || !g || (age>=g[0] && age<=g[1]); }
function protoAgeTxt(k, sex){ const g = protoOf(k).ages?.[sex==='F'?'F':'M']; return g ? `${g[0]} a ${g[1]} anos` : ''; }
/** protocolo sugerido para a idade (quando o paciente ainda não tem avaliação) */
function protoSuggest(age){ return age!=null && age<18 ? 'sl_tc' : 'jp7'; }
/* maturação sexual (Slaughter): 1 pré-púbere (Tanner 1), 2 púbere (2–3), 3 pós-púbere (4–5).
   Sem resposta do nutricionista, estima pela idade. */
const MAT_L = ['Pré-púbere','Púbere','Pós-púbere'];
function matGuess(age, sex){ if (age==null) return 2; return sex==='F' ? (age<10?1:age<14?2:3) : (age<12?1:age<15?2:3); }
function matStage(x, age, sex){ const m = num(x?.mat); return m===1||m===2||m===3 ? m : matGuess(age, sex); }

const STEPS = [
  {k:'start', l:'Início', i:'clip', c:'blue', t:'Vamos começar', d:'Confira os dados e escolha o protocolo de dobras.'},
  {k:'body',  l:'Corpo', i:'scale', c:'yellow', t:'Peso e altura', d:'Medidas básicas — o IMC é calculado na hora.'},
  {k:'trunk', l:'Tronco', i:'ruler', c:'green', t:'Circunferências do tronco', d:'Use fita métrica inelástica, sem comprimir a pele.'},
  {k:'limbs', l:'Membros', i:'arm', c:'blue', t:'Circunferências dos membros', d:'Meça lado direito e esquerdo. Pule o que não for medir.'},
  {k:'folds', l:'Dobras', i:'pinch', c:'yellow', t:'Dobras cutâneas', d:'Adipômetro no lado direito, leitura em 2 segundos.'},
  {k:'extra', l:'Extras', i:'bolt', c:'green', t:'Bioimpedância e notas', d:'Opcional: valores da balança de bioimpedância e observações.'},
  {k:'photos',l:'Fotos', i:'camera', c:'peach', t:'Fotos de acompanhamento', d:'Opcional: frente, costas e laterais com a câmera guiada.'},
  {k:'review',l:'Resumo', i:'check', c:'blue', t:'Resumo da avaliação', d:'Revise os resultados e salve.'},
];

/* ---------- cálculos ---------- */
function foldVal(a, k){
  const f = a?.folds?.[k]; if (f==null) return null;
  let arr = Array.isArray(f) ? f : [f];
  if (!a.multi) arr = arr.slice(0,1);
  const v = arr.map(num).filter(x => x!=null && x>0);
  return v.length ? v.reduce((s,x)=>s+x,0)/v.length : null;
}
function calc(a, p){
  const r = {};
  const sex = p?.sex || 'M';
  const w = num(a.weight), h = num(a.height), c = a.circ || {};
  r.sex = sex;
  r.age = ageAt(p?.birth, a.date);
  r.ageM = ageMonths(p?.birth, a.date);
  r.group = groupOf(r.age, r.ageM);
  /* altura fora do humano (ex.: digitada em metros) não gera IMC absurdo — o "Confere?" avisa no campo */
  const hOk = h && h >= 45 && h <= 260;
  if (w && hOk) r.bmi = w / Math.pow(h/100, 2);
  const waist = num(c.waist), hip = num(c.hip), neck = num(c.neck), abd = num(c.abdomen);
  if (waist && hip) r.whr = waist/hip;
  if (waist && hOk) r.whtr = waist/h;
  // soma de todas as dobras
  const all = FOLDS.map(f => foldVal(a, f.k)).filter(v => v!=null);
  r.foldCount = all.length;
  if (all.length) r.sumAll = all.reduce((s,x)=>s+x,0);
  // protocolo
  const pr = protoOf(a.protocol);
  const need = pr.folds(sex);
  const vals = need.map(k => foldVal(a, k));
  r.protoNeed = need.length; r.protoHave = vals.filter(v=>v!=null).length;
  r.protoFits = protoFits(a.protocol, r.age, sex);
  if (vals.every(v => v!=null) && r.age!=null){
    r.sumProto = vals.reduce((s,x)=>s+x,0);
    let bf;
    if (pr.dens){ r.density = pr.dens(r.sumProto, r.age, sex); bf = (4.95/r.density - 4.5)*100; }
    else bf = pr.bf(r.sumProto, r.age, sex, a.extra || {});
    if (isFinite(bf) && bf > 0 && bf < 70){ r.bf = bf; r.bfSource = pr.short; r.bfMethod = 'proto'; }
    else delete r.density;
  }
  // Marinha dos EUA (estimativa por circunferências) — validada só em adultos
  const navyW = abd || waist;
  if (hOk && neck && navyW && (r.age==null || r.age>=18)){
    let nb = null;
    if (sex==='M' && navyW > neck) nb = 495/(1.0324 - 0.19077*Math.log10(navyW-neck) + 0.15456*Math.log10(h)) - 450;
    if (sex==='F' && hip && (navyW+hip) > neck) nb = 495/(1.29579 - 0.35004*Math.log10(navyW+hip-neck) + 0.22100*Math.log10(h)) - 450;
    if (nb!=null && isFinite(nb) && nb>0 && nb<70) r.navy = nb;
  }
  const bio = num(a.extra?.bf);
  if (r.bf==null && bio!=null){ r.bf = bio; r.bfSource = 'Bioimpedância'; r.bfMethod = 'bio'; }
  if (r.bf==null && r.navy!=null){ r.bf = r.navy; r.bfSource = 'Marinha (circ.)'; r.bfMethod = 'navy'; }
  if (r.bf!=null && w){ r.fatMass = w*r.bf/100; r.leanMass = w - r.fatMass; }
  // metabolismo basal: crianças e adolescentes pela FAO/OMS (Mifflin e Katch-McArdle são equações de adultos)
  if (w && r.age!=null && r.age<18){ r.bmr = faoBmr(w, r.age, sex); r.bmrBy = 'fao'; }
  else if (r.leanMass){ r.bmr = 370 + 21.6*r.leanMass; r.bmrBy = 'katch'; }
  else if (w && hOk && r.age!=null){ r.bmr = 10*w + 6.25*h - 5*r.age + (sex==='M' ? 5 : -161); r.bmrBy = 'mifflin'; }
  // panturrilha (maior dos lados) — usada como sinal de perda muscular em idosos
  const calf = Math.max(num(c.calf_r) ?? 0, num(c.calf_l) ?? 0); if (calf > 0) r.calf = calf;
  return r;
}
/** FAO/OMS (1985), por peso e faixa de idade */
function faoBmr(w, age, sex){
  const t = sex==='M' ? [[3,22.7,495],[10,17.5,651],[18,15.3,679],[30,11.6,879],[60,13.5,487]] : [[3,22.5,499],[10,12.2,746],[18,14.7,496],[30,8.7,829],[60,10.5,596]];
  const row = [...t].reverse().find(x => age >= x[0]) || t[0];
  return row[1]*w + row[2];
}
/* classificações: o 2º argumento é o sexo ('M'/'F') ou o resultado de calc (sexo + idade), que muda a referência
   (crianças e adolescentes: OMS 2007 e Lohman; idosos: Lipschitz) */
const bmiClass = (b, c) => bmiInfo(b, c)?.cls ?? '';
const bfClass = (bf, c) => bfInfo(bf, c)?.cls ?? '';
const whrRisk = (v, c) => whrInfo(v, c)?.cls ?? '';

/* ---------- métricas (comparativo / evolução) ---------- */
const GROUPS = [
  {g:'Composição corporal', items:[
    {k:'weight',l:'Peso',u:'kg',dir:0,get:(a)=>num(a.weight)},
    {k:'bf',l:'% Gordura',u:'%',dir:-1,get:(a,r)=>r.bf},
    {k:'fatMass',l:'Massa gorda',u:'kg',dir:-1,get:(a,r)=>r.fatMass},
    {k:'leanMass',l:'Massa magra',u:'kg',dir:1,get:(a,r)=>r.leanMass},
    {k:'bmi',l:'IMC',u:'',dir:-1,get:(a,r)=>r.bmi},
    {k:'whr',l:'Relação cintura/quadril',u:'',dir:-1,d:2,get:(a,r)=>r.whr},
    {k:'whtr',l:'Relação cintura/altura',u:'',dir:-1,d:2,get:(a,r)=>r.whtr},
    {k:'sumAll',l:'Soma das dobras',u:'mm',dir:-1,get:(a,r)=>r.sumAll},
    {k:'bmr',l:'Metabolismo basal',u:'kcal',dir:0,d:0,get:(a,r)=>r.bmr},
    {k:'muscle',l:'Massa muscular (bio)',u:'kg',dir:1,get:(a)=>num(a.extra?.muscle)},
    {k:'visceral',l:'Gordura visceral (bio)',u:'',dir:-1,get:(a)=>num(a.extra?.visceral)},
  ]},
  {g:'Circunferências — tronco', items: CIRC_TRUNK.map(c=>({k:'c_'+c.k,l:c.l,u:'cm',dir:c.dir,get:(a)=>num(a.circ?.[c.k])}))},
  {g:'Circunferências — membros', items: CIRC_LIMBS.flatMap(c=>[
    {k:'c_'+c.k+'_r',l:c.l+' (D)',u:'cm',dir:0,get:(a)=>num(a.circ?.[c.k+'_r'])},
    {k:'c_'+c.k+'_l',l:c.l+' (E)',u:'cm',dir:0,get:(a)=>num(a.circ?.[c.k+'_l'])},
  ])},
  {g:'Dobras cutâneas', items: FOLDS.map(f=>({k:'f_'+f.k,l:f.l,u:'mm',dir:-1,get:(a)=>foldVal(a,f.k)}))},
];
const METRICS = GROUPS.flatMap(g=>g.items);
const MET = Object.fromEntries(METRICS.map(m=>[m.k,m]));


export {num,fmt,today,toDate,fmtDate,ageAt,ageMonths,foldVal,calc,bmiClass,bfClass,whrRisk,bmiInfo,bfInfo,whrInfo,whtrInfo,calfInfo,ctxOf,audienceNote,GROUP_LABEL,PROTOCOLS,PROTO_KEYS,protoOf,protoFits,protoAgeTxt,protoSuggest,matGuess,matStage,MAT_L,FOLD_NAME,FOLDS,CIRC_TRUNK,CIRC_LIMBS,STEPS,METRICS,GROUPS,MET,esc,getPath,setPath,clone,initials,firstName};
