import {describe,it,expect} from 'vitest';
import {calc,ageAt,foldVal,bmiClass,whrRisk,PROTOCOLS,num} from '@/lib/calculos.js';
import {mergeBackup} from '@/lib/cloud-data';
describe('Fórmulas da avaliação',()=>{
 const person={sex:'F',birth:'1994-05-10'};
 const assessment={date:'2026-11-17',weight:'68,4',height:'165',protocol:'jp7',multi:false,circ:{},extra:{},folds:{chest:[12],midaxillary:[14],triceps:[20],subscapular:[16],abdominal:[24],suprailiac:[18],thigh:[28]}};
 it('Pollock 7 mulher 32 anos soma 132 resulta 25,7% e massas 50,8 e 17,6',()=>{const r=calc(assessment,person);expect(r.age).toBe(32);expect(r.sumProto).toBe(132);expect(r.bf).toBeCloseTo(25.6639,4);expect(r.leanMass).toBeCloseTo(50.8459,4);expect(r.fatMass).toBeCloseTo(17.5541,4);});
 it('idade conta anos completos',()=>{expect(ageAt('1994-05-10','2026-05-09')).toBe(31);expect(ageAt('1994-05-10','2026-05-10')).toBe(32);});
 it('dobras usam somente primeiro valor ou média positiva',()=>{expect(foldVal({folds:{triceps:[12,18,0]},multi:false},'triceps')).toBe(12);expect(foldVal({folds:{triceps:[12,18,0]},multi:true},'triceps')).toBe(15);});
 it('aceita vírgula e ponto',()=>{expect(num('68,4')).toBe(68.4);expect(num('68.4')).toBe(68.4);expect(num('')).toBeNull();});
 it('classifica limites IMC',()=>{expect(bmiClass(18.49)).toBe('Abaixo do peso');expect(bmiClass(18.5)).toBe('Peso normal');expect(bmiClass(25)).toBe('Sobrepeso');expect(bmiClass(30)).toBe('Obesidade grau I');expect(bmiClass(35)).toBe('Obesidade grau II');expect(bmiClass(40)).toBe('Obesidade grau III');});
 it('RCQ segue limites por sexo',()=>{expect(whrRisk(.8,'F')).toBe('Risco moderado');expect(whrRisk(.85,'F')).toBe('Risco alto');expect(whrRisk(.94,'M')).toBe('Risco baixo');expect(whrRisk(1,'M')).toBe('Risco alto');});
 it('dobras completas prevalecem à bioimpedância e bio prevalece à Marinha',()=>{expect(calc({...assessment,extra:{bf:30}},person).bfSource).toBe('JP7');expect(calc({...assessment,folds:{},extra:{bf:27},circ:{waist:72,hip:96,neck:32}},person).bf).toBe(27);expect(calc({...assessment,folds:{},circ:{waist:72,hip:96,neck:32}},person).bfSource).toBe('Marinha (circ.)');});
 it('TMB Katch e Mifflin exatos',()=>{expect(calc(assessment,person).bmr).toBeCloseTo(1468.2712622044298,6);expect(calc({...assessment,folds:{}},person).bmr).toBe(1394.25);});
 it('Pollock 3 equações exatas',()=>{expect(PROTOCOLS.jp3.dens(60,32,'M')).toBeCloseTo(1.0573012,7);expect(PROTOCOLS.jp3.dens(60,32,'F')).toBeCloseTo(1.0437437,7);});
 it.each([[19,1.1549,.0678],[29,1.1599,.0717],[39,1.1423,.0632],[49,1.1333,.0612],[50,1.1339,.0645]])('DW mulher faixa %s', (age,c,m)=>{expect(PROTOCOLS.dw.dens(100,age,'F')).toBeCloseTo(c-m*2,8);});
 it.each([[19,1.162,.063],[29,1.1631,.0632],[39,1.1422,.0544],[49,1.162,.07],[50,1.1715,.0779]])('DW homem faixa %s',(age,c,m)=>{expect(PROTOCOLS.dw.dens(100,age,'M')).toBeCloseTo(c-m*2,8);});
});
describe('Importação antiga',()=>{it('cria UUIDs, mantém ligações e ignora pessoa + data + peso duplicados',()=>{const old={profiles:[{id:'abc',name:'Ana',sex:'F',birth:'1994-05-10',height:'165'}],activeId:'abc',assessments:[{id:'xyz',profileId:'abc',date:'2026-11-17',weight:'68,4',height:'165',protocol:'jp7',multi:false,circ:{},folds:{},extra:{}}]};const merged=mergeBackup({profiles:[],assessments:[],activeId:null},old);expect(merged.profiles[0]?.id).toMatch(/^[\da-f-]{36}$/);expect(merged.assessments[0]?.profileId).toBe(merged.profiles[0]?.id);expect(mergeBackup(merged,old).assessments.length).toBe(1);});});