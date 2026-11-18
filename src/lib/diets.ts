import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Diet } from './diet-parse';

/*
 * Planos alimentares do nutricionista (tabela "dietas", protegida por RLS — cada um só vê os seus).
 * Enquanto o banco não tiver a tabela, os planos ficam guardados neste aparelho
 * e sobem sozinhos para a nuvem quando a tabela existir (igual à ficha do paciente).
 */
export type DietRecord = {
  id: string; profileId: string; assessmentId: string | null; title: string; prescribedAt: string | null;
  data: Diet; visible: boolean; createdAt: number; updatedAt: number;
};
const TABLE = 'dietas';
const loose = supabase as unknown as SupabaseClient;
const localKey = (u: string) => 'avf.dietas.' + u;
type Row = { id: string; paciente_id: string; avaliacao_id: string | null; titulo: string | null; prescrito_em: string | null; dados: Diet; visivel_paciente: boolean | null; created_at: string; updated_at: string | null };
const fromRow = (r: Row): DietRecord => ({ id: r.id, profileId: r.paciente_id, assessmentId: r.avaliacao_id, title: r.titulo || r.dados?.title || 'Plano alimentar', prescribedAt: r.prescrito_em, data: r.dados, visible: r.visivel_paciente !== false, createdAt: Date.parse(r.created_at), updatedAt: Date.parse(r.updated_at ?? r.created_at) });
const toRow = (d: DietRecord, owner: string) => ({ id: d.id, owner_id: owner, paciente_id: d.profileId, avaliacao_id: d.assessmentId, titulo: d.title.slice(0, 200), prescrito_em: d.prescribedAt, dados: d.data, visivel_paciente: d.visible });
function readLocal(u: string): DietRecord[] { try { return JSON.parse(localStorage.getItem(localKey(u)) || '[]') as DietRecord[]; } catch { return []; } }
function writeLocal(u: string, list: DietRecord[]) { try { if (list.length) localStorage.setItem(localKey(u), JSON.stringify(list)); else localStorage.removeItem(localKey(u)); } catch { /* sem espaço: segue só na memória */ } }

export async function loadDiets(userId: string): Promise<{ cloud: boolean; list: DietRecord[] }> {
  const local = readLocal(userId);
  try {
    const probe = await loose.from(TABLE).select('id').limit(1);
    if (probe.error) return { cloud: false, list: local };
    const list: DietRecord[] = [];
    for (let from = 0; ; from += 500) {
      const { data, error } = await loose.from(TABLE).select('*').order('created_at').range(from, from + 499);
      if (error) throw error;
      list.push(...((data ?? []) as Row[]).map(fromRow));
      if ((data?.length ?? 0) < 500) break;
    }
    // planos criados antes de a tabela existir: sobem agora
    for (const d of local.filter((x) => !list.some((y) => y.id === x.id))) {
      const { error } = await loose.from(TABLE).upsert(toRow(d, userId));
      if (!error) list.push(d);
    }
    if (local.length) writeLocal(userId, []);
    return { cloud: true, list };
  } catch { return { cloud: false, list: local }; }
}

export function dietStore(userId: string, cloud: boolean, initial: DietRecord[]) {
  let list = [...initial];
  let queue: Promise<unknown> = Promise.resolve();
  const persistLocal = () => { if (!cloud) writeLocal(userId, list); };
  const run = <T>(job: () => Promise<T>) => { const t = queue.catch(() => {}).then(job); queue = t; return t; };
  return {
    cloud,
    list: () => list,
    get: (id: string) => list.find((d) => d.id === id) ?? null,
    ofPatient: (pid: string) => list.filter((d) => d.profileId === pid).sort((a, b) => (b.prescribedAt ?? '').localeCompare(a.prescribedAt ?? '') || b.createdAt - a.createdAt),
    async save(d: DietRecord) {
      const rec = { ...d, updatedAt: Date.now() };
      list = [...list.filter((x) => x.id !== d.id), rec];
      persistLocal();
      if (cloud) await run(async () => { const { error } = await loose.from(TABLE).upsert(toRow(rec, userId)); if (error) throw error; });
      return rec;
    },
    async remove(id: string) {
      list = list.filter((x) => x.id !== id); persistLocal();
      if (cloud) await run(async () => { const { error } = await loose.from(TABLE).delete().eq('id', id); if (error) throw error; });
    },
    /** paciente ou avaliação apagados: o banco já cuida (cascata / vínculo removido); aqui só atualiza a memória */
    forgetPatient(pid: string) { list = list.filter((x) => x.profileId !== pid); persistLocal(); },
    unlinkAssessment(aid: string) { list = list.map((x) => (x.assessmentId === aid ? { ...x, assessmentId: null } : x)); persistLocal(); },
  };
}
export type DietStore = ReturnType<typeof dietStore>;
