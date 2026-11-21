import type { LegacyAssessment, LegacyDB, LegacyPerson, Nutri } from './cloud-data';
import type { DietRecord } from './diets';
import type { Answers, FormKind } from './forms';
import type { Pose } from './poses';
import { num, PROTO_KEYS } from './calculos.js';
import { NUTRI_BACKUP_KEYS } from './nutri';

/*
 * BACKUP COMPLETO (arquivo .json)
 *  · versão 2: pacientes e fichas, avaliações, metas/energia/anamnese, planos alimentares, fotos (dentro do arquivo),
 *    respostas do portal e o perfil profissional — o nutricionista escolhe o que vai no arquivo
 *  · na importação, o nutricionista escolhe de novo o que trazer e quais pacientes; nada é duplicado
 *  · arquivos antigos (versão 1: só pacientes e avaliações) continuam sendo lidos
 * Não vão no arquivo: códigos de acesso ao portal (cada conta gera os seus) e o rascunho da avaliação em andamento.
 */
export type PartKey = 'patients' | 'assessments' | 'plans' | 'diets' | 'photos' | 'responses' | 'nutri';
export const PARTS: { k: PartKey; l: string; d: string }[] = [
  { k: 'patients', l: 'Pacientes e fichas', d: 'Cadastro, contato, objetivo, observações e retorno' },
  { k: 'assessments', l: 'Avaliações', d: 'Peso, dobras, circunferências, bioimpedância e notas' },
  { k: 'plans', l: 'Metas, gasto energético e anamnese', d: 'Metas atuais e anteriores, cálculo de energia e ficha de saúde' },
  { k: 'diets', l: 'Planos alimentares', d: 'Refeições, opções e trocas de cada plano' },
  { k: 'photos', l: 'Fotos das avaliações', d: 'Frente, costas e laterais · deixa o arquivo maior' },
  { k: 'responses', l: 'Respostas do portal', d: 'Pré-consultas e fichas de saúde enviadas pelos pacientes' },
  { k: 'nutri', l: 'Seu perfil profissional', d: 'Dados, contatos, marca, PDFs, preferências e mensagens de retorno (foto, logo e assinatura ficam na conta)' },
];
export type BPhoto = { profileId: string; assessmentId: string; pose: Pose; w: number; h: number; type: string; data: string };
export type BResponse = { patientId: string; kind: FormKind; data: Answers; read: boolean; createdAt: string };
export type BackupFile = {
  app: 'avaliacao-fisica'; version: 2; exportedAt: string; parts: PartKey[];
  by?: { name?: string } | null;
  nutri?: Nutri | null;
  profiles: LegacyPerson[]; assessments: LegacyAssessment[];
  diets?: DietRecord[]; photos?: BPhoto[]; responses?: BResponse[];
};
type Plan = NonNullable<LegacyPerson['plan']> & { anamnese?: { data?: Answers; at?: string; by?: string } | null };
const planOf = (p: LegacyPerson) => (p.plan ?? null) as Plan | null;
const hasPlanData = (p: LegacyPerson) => { const x = planOf(p); return !!x && !!(x.goals?.length || x.energy || x.history?.length || x.anamnese); };
const NUTRI_KEYS = NUTRI_BACKUP_KEYS;

/* ---------- exportar ---------- */
export type ExportSource = { db: LegacyDB; nutri: Nutri; diets: DietRecord[]; responses: BResponse[] };
/** quantos itens de cada parte os pacientes escolhidos têm (para a tela mostrar antes de baixar) */
export function exportCounts(src: ExportSource, ids: Set<string>, photos: number): Record<PartKey, number> {
  const ps = src.db.profiles.filter((p) => ids.has(p.id)), as = src.db.assessments.filter((a) => ids.has(a.profileId));
  return {
    patients: ps.length, assessments: as.length, plans: ps.filter(hasPlanData).length,
    diets: src.diets.filter((d) => ids.has(d.profileId)).length, photos,
    responses: src.responses.filter((r) => ids.has(r.patientId)).length, nutri: src.nutri.name || src.nutri.crn ? 1 : 0,
  };
}
export function makeBackup(src: ExportSource, sel: { parts: Set<PartKey>; ids: Set<string> }, photos: BPhoto[] = [], now = new Date()): BackupFile {
  const on = (k: PartKey) => sel.parts.has(k);
  const profiles = on('patients') ? src.db.profiles.filter((p) => sel.ids.has(p.id)).map((p) => { const c = structuredClone(p); if (!on('plans')) delete c.plan; return c; }) : [];
  const keep = new Set(profiles.map((p) => p.id));
  const assessments = on('assessments') ? src.db.assessments.filter((a) => keep.has(a.profileId)).map((a) => structuredClone(a)) : [];
  const aKeep = new Set(assessments.map((a) => a.id));
  const nutri = on('nutri') ? Object.fromEntries(NUTRI_KEYS.filter((k) => src.nutri[k] != null && src.nutri[k] !== '').map((k) => [k, src.nutri[k]])) as Nutri : null;
  const parts = PARTS.map((p) => p.k).filter(on);
  return {
    app: 'avaliacao-fisica', version: 2, exportedAt: now.toISOString(), parts, by: src.nutri.name ? { name: src.nutri.name } : null,
    ...(nutri ? { nutri } : {}),
    profiles, assessments,
    ...(on('diets') ? { diets: src.diets.filter((d) => keep.has(d.profileId)).map((d) => ({ ...structuredClone(d), assessmentId: d.assessmentId && aKeep.has(d.assessmentId) ? d.assessmentId : null })) } : {}),
    ...(on('photos') ? { photos: photos.filter((x) => aKeep.has(x.assessmentId)) } : {}),
    ...(on('responses') ? { responses: src.responses.filter((r) => keep.has(r.patientId)).map((r) => structuredClone(r)) } : {}),
  };
}
export const backupName = (b: BackupFile, who?: string) => `avaliacao-fisica-${who ? who + '-' : ''}backup-${b.exportedAt.slice(0, 10)}.json`;

/* ---------- ler o arquivo (versão 1 ou 2) ---------- */
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const POSES = ['front', 'back', 'right', 'left'];
export type ReadResult = { file: BackupFile; warnings: string[]; counts: Record<PartKey, number> };
export function readBackup(raw: unknown): ReadResult {
  if (!raw || typeof raw !== 'object') throw new Error('Este arquivo não é um backup do sistema.');
  const d = raw as Record<string, unknown>;
  if (!Array.isArray(d['profiles']) || !Array.isArray(d['assessments'])) throw new Error('Este arquivo não é um backup do sistema (faltam pacientes e avaliações).');
  const warnings: string[] = [];
  const profiles: LegacyPerson[] = [];
  for (const x of d['profiles'] as LegacyPerson[]) {
    if (!x || typeof x !== 'object' || !x.id || !String(x.name ?? '').trim()) { warnings.push('Um paciente sem nome foi ignorado.'); continue; }
    if (!['F', 'M'].includes(x.sex) || !DATE.test(String(x.birth ?? ''))) { warnings.push(`${x.name}: sexo ou data de nascimento inválidos — paciente ignorado.`); continue; }
    if (profiles.some((p) => p.id === x.id)) continue;
    profiles.push(x);
  }
  const pid = new Set(profiles.map((p) => p.id));
  const assessments: LegacyAssessment[] = []; let badA = 0;
  for (const a of d['assessments'] as LegacyAssessment[]) {
    if (!a || !pid.has(a.profileId) || !DATE.test(String(a.date ?? '')) || !(Number(num(a.weight)) > 0)) { badA++; continue; }
    assessments.push({ ...a, protocol: (PROTO_KEYS as string[]).includes(a.protocol) ? a.protocol : 'jp7', multi: !!a.multi, circ: a.circ ?? {}, folds: a.folds ?? {}, extra: a.extra ?? {} });
  }
  if (badA) warnings.push(`${badA} ${badA === 1 ? 'avaliação incompleta foi ignorada' : 'avaliações incompletas foram ignoradas'} (sem paciente, data ou peso).`);
  const aid = new Set(assessments.map((a) => a.id));
  const diets = (Array.isArray(d['diets']) ? d['diets'] as DietRecord[] : []).filter((x) => x && pid.has(x.profileId) && x.data && Array.isArray(x.data.meals))
    .map((x) => ({ ...x, assessmentId: x.assessmentId && aid.has(x.assessmentId) ? x.assessmentId : null }));
  const photos = (Array.isArray(d['photos']) ? d['photos'] as BPhoto[] : []).filter((x) => x && aid.has(x.assessmentId) && POSES.includes(x.pose) && typeof x.data === 'string' && x.data.length > 100);
  const responses = (Array.isArray(d['responses']) ? d['responses'] as BResponse[] : []).filter((x) => x && pid.has(x.patientId) && (x.kind === 'pre_consulta' || x.kind === 'anamnese') && x.data && typeof x.createdAt === 'string');
  const nutri = d['nutri'] && typeof d['nutri'] === 'object' ? Object.fromEntries(NUTRI_KEYS.filter((k) => (d['nutri'] as Nutri)[k] != null).map((k) => [k, (d['nutri'] as Nutri)[k]])) as Nutri : null;
  const v1 = d['version'] !== 2;
  const parts: PartKey[] = ['patients'];
  if (assessments.length) parts.push('assessments');
  if (profiles.some(hasPlanData)) parts.push('plans');
  if (diets.length) parts.push('diets');
  if (photos.length) parts.push('photos');
  if (responses.length) parts.push('responses');
  if (nutri && Object.keys(nutri).length) parts.push('nutri');
  const file: BackupFile = { app: 'avaliacao-fisica', version: 2, exportedAt: typeof d['exportedAt'] === 'string' ? d['exportedAt'] : '', parts,
    by: v1 ? null : (d['by'] as BackupFile['by']) ?? null, nutri, profiles, assessments, diets, photos, responses };
  return { file, warnings, counts: { patients: profiles.length, assessments: assessments.length, plans: profiles.filter(hasPlanData).length, diets: diets.length, photos: photos.length, responses: responses.length, nutri: nutri && Object.keys(nutri).length ? 1 : 0 } };
}

/* ---------- importar ---------- */
const key = (p: { name: string; birth: string; sex: string }) => `${p.name.trim().toLowerCase()}|${p.birth}|${p.sex}`;
/** paciente do arquivo que já existe nesta conta (mesmo nome, nascimento e sexo) */
export function matchPatients(cur: LegacyDB, file: BackupFile): Map<string, string> {
  const m = new Map<string, string>(), byKey = new Map(cur.profiles.map((p) => [key(p), p.id]));
  for (const p of file.profiles) { const id = byKey.get(key(p)); if (id) m.set(p.id, id); }
  return m;
}
export type ImportChoice = { parts: Set<PartKey>; ids: Set<string>; existing: 'keep' | 'update' };
export type ImportCurrent = { db: LegacyDB; diets: DietRecord[]; responses: BResponse[]; photoPoses: (assessmentId: string) => Pose[] };
export type ImportPlan = {
  db: LegacyDB; diets: DietRecord[]; responses: BResponse[];
  photos: (BPhoto & { assessmentId: string; profileId: string })[];
  nutri: Nutri | null;
  report: { newPatients: number; updatedPatients: number; assessments: number; sameAssessments: number; plans: number; diets: number; photos: number; responses: number };
};
const FICHA = ['phone', 'email', 'goal', 'notes', 'returnDays'] as const;
const empty = (v: unknown) => v == null || v === '' || v === 0;
function mergePlan(cur: Plan | null, inc: Plan | null, update: boolean): Plan | null {
  if (!inc) return cur;
  const out: Plan = { ...(cur ?? {}) };
  if (inc.goals?.length && (update || !cur?.goals?.length)) out.goals = structuredClone(inc.goals);
  if (inc.energy && (update || !cur?.energy)) out.energy = structuredClone(inc.energy);
  if (inc.anamnese && (update || !cur?.anamnese)) out.anamnese = structuredClone(inc.anamnese);
  const hist = [...(cur?.history ?? [])];
  for (const h of inc.history ?? []) if (!hist.some((x) => x.k === h.k && x.fromDate === h.fromDate && x.endedAt === h.endedAt)) hist.push(structuredClone(h));
  if (hist.length) out.history = hist;
  return out;
}
/** monta o resultado da importação (sem gravar nada): banco novo + o que falta enviar (planos, fotos, respostas) */
export function planImport(cur: ImportCurrent, file: BackupFile, ch: ImportChoice, newId: () => string = () => crypto.randomUUID()): ImportPlan {
  const on = (k: PartKey) => ch.parts.has(k) && file.parts.includes(k);
  const db = structuredClone(cur.db), match = matchPatients(cur.db, file), pMap = new Map<string, string>(), aMap = new Map<string, string>();
  const rep = { newPatients: 0, updatedPatients: 0, assessments: 0, sameAssessments: 0, plans: 0, diets: 0, photos: 0, responses: 0 };
  for (const p of file.profiles) {
    if (!ch.ids.has(p.id)) continue;
    const ex = match.get(p.id), target = ex ? db.profiles.find((x) => x.id === ex) : null;
    if (target) {
      pMap.set(p.id, target.id);
      let changed = false;
      for (const k of FICHA) { const v = p[k]; if (!empty(v) && (ch.existing === 'update' || empty(target[k])) && target[k] !== v) { (target as Record<string, unknown>)[k] = v; changed = true; } }
      if (ch.existing === 'update' && p.height && target.height !== p.height) { target.height = p.height; changed = true; }
      if (on('plans') && p.plan) { const np = mergePlan(planOf(target), planOf(p), ch.existing === 'update'); if (JSON.stringify(np) !== JSON.stringify(target.plan ?? null)) { target.plan = np; changed = true; rep.plans++; } }
      if (changed) rep.updatedPatients++;
    } else {
      const id = newId(); pMap.set(p.id, id);
      const c: LegacyPerson = { ...structuredClone(p), id, createdAt: Date.now() };
      if (!on('plans')) delete c.plan; else if (hasPlanData(p)) rep.plans++;
      db.profiles.push(c); rep.newPatients++;
    }
  }
  if (on('assessments')) for (const a of file.assessments) {
    const pid = pMap.get(a.profileId); if (!pid) continue;
    const same = db.assessments.find((x) => x.profileId === pid && x.date === a.date && num(x.weight) === num(a.weight));
    if (same) { aMap.set(a.id, same.id); rep.sameAssessments++; continue; }
    const id = newId(); aMap.set(a.id, id);
    db.assessments.push({ ...structuredClone(a), id, profileId: pid, createdAt: Date.now() });
    rep.assessments++;
  }
  db.activeId ??= db.profiles[0]?.id ?? null;
  const diets: DietRecord[] = [];
  if (on('diets')) for (const d of file.diets ?? []) {
    const pid = pMap.get(d.profileId); if (!pid) continue;
    if ([...cur.diets, ...diets].some((x) => x.profileId === pid && x.title === d.title && (x.prescribedAt ?? '') === (d.prescribedAt ?? ''))) continue;
    diets.push({ ...structuredClone(d), id: newId(), profileId: pid, assessmentId: d.assessmentId ? aMap.get(d.assessmentId) ?? null : null, createdAt: Date.now(), updatedAt: Date.now() });
  }
  rep.diets = diets.length;
  const photos: ImportPlan['photos'] = [];
  if (on('photos') && on('assessments')) for (const x of file.photos ?? []) {
    const aid = aMap.get(x.assessmentId), pid = pMap.get(x.profileId); if (!aid || !pid) continue;
    if (cur.photoPoses(aid).includes(x.pose) || photos.some((y) => y.assessmentId === aid && y.pose === x.pose)) continue;
    photos.push({ ...x, assessmentId: aid, profileId: pid });
  }
  rep.photos = photos.length;
  const responses: BResponse[] = [];
  if (on('responses')) for (const r of file.responses ?? []) {
    const pid = pMap.get(r.patientId); if (!pid) continue;
    if ([...cur.responses, ...responses].some((x) => x.patientId === pid && x.kind === r.kind && x.createdAt === r.createdAt)) continue;
    responses.push({ ...structuredClone(r), patientId: pid });
  }
  rep.responses = responses.length;
  return { db, diets, photos, responses, nutri: on('nutri') ? file.nutri ?? null : null, report: rep };
}

/* ---------- fotos dentro do arquivo (base64) ---------- */
export async function blobToBase64(b: Blob): Promise<string> {
  // arrayBuffer() não existe em navegadores antigos: FileReader como alternativa
  const buf = typeof b.arrayBuffer === 'function' ? await b.arrayBuffer() : await new Promise<ArrayBuffer>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result as ArrayBuffer); fr.onerror = () => rej(fr.error); fr.readAsArrayBuffer(b); });
  const bytes = new Uint8Array(buf); let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function base64ToBlob(data: string, type = 'image/jpeg'): Blob {
  const s = atob(data), bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return new Blob([bytes], { type });
}
/** tamanho legível ("3,4 MB") */
export const fmtSize = (bytes: number) => bytes < 1e6 ? `${Math.max(1, Math.round(bytes / 1e3))} KB` : `${(bytes / 1e6).toFixed(1).replace('.', ',')} MB`;
