import { supabase } from '@/integrations/supabase/client';
import { num } from './calculos.js';
import type { Json } from '@/integrations/supabase/types';
import type { SupabaseClient } from '@supabase/supabase-js';

/*
 * Ficha do paciente (contato, objetivo, observações, retorno, arquivado).
 * Fica em colunas novas da tabela "pacientes". Enquanto o banco não tiver essas colunas,
 * a ficha é guardada neste aparelho e sobe sozinha para a nuvem quando as colunas existirem.
 */
export type Ficha = {phone?:string|null;email?:string|null;goal?:string|null;notes?:string|null;returnDays?:number|null;archived?:boolean};
export type LegacyPerson = {id:string;name:string;sex:string;birth:string;height:string|number|null;createdAt?:number} & Ficha;
const FICHA_COLS='telefone,email,objetivo,observacoes,retorno_dias,arquivado';
const loose = supabase as unknown as SupabaseClient;
const fichaKey = (userId:string) => 'avf.ficha.'+userId;
const fichaOf = (p:LegacyPerson):Ficha => ({phone:p.phone||null,email:p.email||null,goal:p.goal||null,notes:p.notes||null,returnDays:num(p.returnDays),archived:!!p.archived});
const fichaRow = (f:Ficha) => ({telefone:f.phone,email:f.email,objetivo:f.goal,observacoes:f.notes,retorno_dias:f.returnDays,arquivado:!!f.archived});
const hasFicha = (f:Ficha) => !!(f.phone||f.email||f.goal||f.notes||f.returnDays||f.archived);
function readLocalFicha(userId:string):Record<string,Ficha>{try{return JSON.parse(localStorage.getItem(fichaKey(userId))||'{}') as Record<string,Ficha>;}catch{return {};}}
function writeLocalFicha(userId:string,people:LegacyPerson[]){try{const m=Object.fromEntries(people.filter(p=>hasFicha(fichaOf(p))).map(p=>[p.id,fichaOf(p)]));Object.keys(m).length?localStorage.setItem(fichaKey(userId),JSON.stringify(m)):localStorage.removeItem(fichaKey(userId));}catch{/* sem armazenamento */}}

/* Perfil do nutricionista: guardado nos dados da própria conta (não precisa de tabela). */
export type Nutri = {name?:string;crn?:string;specialty?:string;phone?:string;place?:string;returnDays?:number;tourSeen?:boolean};
export async function saveNutri(nutri:Nutri){const {error}=await supabase.auth.updateUser({data:{nutri}});if(error)throw error;}
export type LegacyAssessment = {id:string;profileId:string;date:string;weight:string|number; height:string|number|null;protocol:string;multi:boolean;circ:Record<string,unknown>;folds:Record<string,unknown>;extra:Record<string,unknown>;createdAt?:number};
export type LegacyDB={profiles:LegacyPerson[];assessments:LegacyAssessment[];activeId:string|null};
export type Draft = LegacyAssessment & {_step?:number;_editing?:string|null;_savedAt?:number};
const numericObject=(o:Record<string,unknown>)=>Object.fromEntries(Object.entries(o).flatMap(([k,v])=>{const n=num(v);return n===null?[]:[[k,n]];}));
export async function loadCloud(userId:string) {
  const people:LegacyPerson[]=[]; const assessments:LegacyAssessment[]=[];
  for(let from=0;;from+=1000){const {data,error}=await supabase.from('pacientes').select('*').order('created_at').range(from,from+999);if(error)throw error;people.push(...(data??[]).map(p=>{const x=p as Record<string,unknown>;return {id:p.id,name:p.nome,sex:p.sexo,birth:p.nascimento,height:p.altura_cm,createdAt:Date.parse(p.created_at),phone:(x['telefone'] as string)??null,email:(x['email'] as string)??null,goal:(x['objetivo'] as string)??null,notes:(x['observacoes'] as string)??null,returnDays:(x['retorno_dias'] as number)??null,archived:!!x['arquivado']};}));if((data?.length??0)<1000)break;}
  // a ficha já tem colunas no banco? (se não, fica neste aparelho até o banco ser atualizado)
  const probe=await loose.from('pacientes').select(FICHA_COLS).limit(1);
  const fichaCloud=!probe.error;
  const local=readLocalFicha(userId);
  for(const p of people){const f=local[p.id];if(!f)continue;for(const k of Object.keys(f) as (keyof Ficha)[]){if(!p[k]&&f[k])(p as Record<string,unknown>)[k]=f[k];}}
  if(fichaCloud&&Object.keys(local).length){
    for(const p of people.filter(x=>local[x.id])){const {error}=await loose.from('pacientes').update(fichaRow(fichaOf(p))).eq('id',p.id);if(error)throw error;}
    try{localStorage.removeItem(fichaKey(userId));}catch{/* ok */}
  }
  for(let from=0;;from+=1000){const {data,error}=await supabase.from('avaliacoes').select('*').order('data').range(from,from+999);if(error)throw error;assessments.push(...(data??[]).map(a=>({id:a.id,profileId:a.paciente_id,date:a.data,weight:a.peso_kg,height:a.altura_cm,protocol:a.protocolo,multi:a.medir_3x,circ:a.circunferencias as Record<string,unknown>,folds:a.dobras as Record<string,unknown>,extra:{...(a.bioimpedancia as Record<string,unknown>),evaluator:a.avaliador,notes:a.observacoes},createdAt:Date.parse(a.created_at)})));if((data?.length??0)<1000)break;}
  const {data,error}=await supabase.from('rascunhos').select('*').maybeSingle(); if(error)throw error;
  let activeId=people[0]?.id??null;
  try{const stored=localStorage.getItem('avf.active.'+userId);if(people.some(p=>p.id===stored))activeId=stored;}catch{}
  return {fichaCloud,db:{profiles:people,assessments,activeId},draft:data?{...(data.dados as object),_step:data.passo,_editing:data.avaliacao_id,_savedAt:Date.parse(data.updated_at)} as Draft:null};
}
export function cloudRepository(userId:string,initial:LegacyDB,fichaCloud=false){
  let snapshot=structuredClone(initial);
  let queue=Promise.resolve();
  async function save(db:LegacyDB){
    const copy=structuredClone(db);
    if(!fichaCloud)writeLocalFicha(userId,copy.profiles);
    const task=queue.catch(()=>{}).then(async()=>{
      for(const p of copy.profiles){if(JSON.stringify(snapshot.profiles.find(x=>x.id===p.id))===JSON.stringify(p))continue;const base={id:p.id,owner_id:userId,nome:p.name,sexo:p.sex,nascimento:p.birth,altura_cm:num(p.height)};const {error}=fichaCloud?await loose.from('pacientes').upsert({...base,...fichaRow(fichaOf(p))}):await supabase.from('pacientes').upsert(base);if(error)throw error;}
      for(const a of copy.assessments){if(JSON.stringify(snapshot.assessments.find(x=>x.id===a.id))===JSON.stringify(a))continue;
        const folds=Object.fromEntries(Object.entries(a.folds??{}).map(([k,v])=>[k,(Array.isArray(v)?v:[v]).slice(0,3).map(num)]));
        const {error}=await supabase.from('avaliacoes').upsert({id:a.id,owner_id:userId,paciente_id:a.profileId,data:a.date,peso_kg:num(a.weight)??0,altura_cm:num(a.height),protocolo:a.protocol,medir_3x:a.multi,circunferencias:numericObject(a.circ??{}),dobras:folds as Json,bioimpedancia:numericObject(Object.fromEntries(['bf','muscle','visceral','water'].map(k=>[k,a.extra?.[k]]))),avaliador:String(a.extra?.['evaluator']??''),observacoes:String(a.extra?.['notes']??'')});if(error)throw error;
      }
      for(const a of snapshot.assessments.filter(x=>!copy.assessments.some(y=>y.id===x.id))){const {error}=await supabase.from('avaliacoes').delete().eq('id',a.id);if(error)throw error;}
      for(const p of snapshot.profiles.filter(x=>!copy.profiles.some(y=>y.id===x.id))){const {error}=await supabase.from('pacientes').delete().eq('id',p.id);if(error)throw error;}
      snapshot=copy;try{localStorage.setItem('avf.active.'+userId,copy.activeId??'');}catch{}
    });queue=task;return task;
  }
  async function saveDraft(draft:Draft|null){const result=draft?await supabase.from('rascunhos').upsert({owner_id:userId,avaliacao_id:draft._editing??null,passo:draft._step??0,dados:draft as unknown as Json}):await supabase.from('rascunhos').delete().eq('owner_id',userId);if(result.error)throw result.error;}
  return {save,saveDraft,previewImport,async importBackup(imported:LegacyDB){const merged=mergeBackup(snapshot,imported);await save(merged);return merged;}};
}
export function previewImport(value:unknown):LegacyDB{
  if(!value||typeof value!=='object')throw new Error('Backup inválido');
  const d=value as LegacyDB;if(!Array.isArray(d.profiles)||!Array.isArray(d.assessments))throw new Error('Backup inválido');
  if(d.profiles.some(p=>!p.id||!p.name||!['F','M'].includes(p.sex)||!/^\d{4}-\d{2}-\d{2}$/.test(p.birth)))throw new Error('Pessoa inválida');
  if(d.assessments.some(a=>!d.profiles.some(p=>p.id===a.profileId)||!a.date||!(Number(num(a.weight))>0)||!['jp7','jp3','dw'].includes(a.protocol??'jp7')))throw new Error('Avaliação inválida');
  return d;
}
export function mergeBackup(current:LegacyDB, imported:LegacyDB):LegacyDB{
  const db=structuredClone(current),mapping=new Map<string,string>();
  for(const p of imported.profiles){let match=db.profiles.find(x=>x.name.trim().toLowerCase()===p.name.trim().toLowerCase()&&x.birth===p.birth&&x.sex===p.sex);if(!match){match={...p,id:crypto.randomUUID()};db.profiles.push(match);}mapping.set(p.id,match.id);}
  for(const a of imported.assessments){const pid=mapping.get(a.profileId);if(!pid)throw new Error('Pessoa ausente');if(db.assessments.some(x=>x.profileId===pid&&x.date===a.date&&num(x.weight)===num(a.weight)))continue;db.assessments.push({...a,id:crypto.randomUUID(),profileId:pid,protocol:a.protocol??'jp7',multi:!!a.multi,circ:a.circ??{},folds:a.folds??{},extra:a.extra??{}});}
  db.activeId??=mapping.get(imported.activeId??'')??db.profiles[0]?.id??null;return db;
}