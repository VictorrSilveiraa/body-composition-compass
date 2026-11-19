import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Answers, FormKind } from './forms';

/*
 * Respostas que os pacientes enviam pelo portal (pré-consulta e ficha de saúde/anamnese).
 * Tabela "respostas_paciente": o nutricionista só lê, marca como lida e apaga as próprias (RLS);
 * quem grava é a função de servidor do portal. Sem a tabela, a lista fica vazia e nada quebra.
 */
export type Resposta = { id: string; patientId: string; kind: FormKind; data: Answers; read: boolean; createdAt: string };
type Row = { id: string; paciente_id: string; tipo: string; dados: Answers | null; lida: boolean | null; created_at: string };
const TABLE = 'respostas_paciente';
const loose = supabase as unknown as SupabaseClient;
const toResp = (r: Row): Resposta => ({ id: r.id, patientId: r.paciente_id, kind: r.tipo === 'anamnese' ? 'anamnese' : 'pre_consulta', data: r.dados ?? {}, read: !!r.lida, createdAt: r.created_at });

export async function loadResponses(): Promise<{ available: boolean; list: Resposta[] }> {
  try {
    const { data, error } = await loose.from(TABLE).select('id,paciente_id,tipo,dados,lida,created_at').order('created_at', { ascending: false }).limit(500);
    if (error) return { available: false, list: [] };
    return { available: true, list: ((data ?? []) as Row[]).map(toResp) };
  } catch { return { available: false, list: [] }; }
}

export function responseStore(available: boolean, initial: Resposta[]) {
  let list = initial.slice();
  return {
    available: () => available,
    /** do paciente, da mais recente para a mais antiga */
    ofPatient: (pid: string, kind?: FormKind) => list.filter((r) => r.patientId === pid && (!kind || r.kind === kind)),
    unread: (pid?: string) => list.filter((r) => !r.read && (!pid || r.patientId === pid)),
    async markRead(ids: string[]) {
      const todo = ids.filter((id) => list.some((r) => r.id === id && !r.read)); if (!todo.length) return;
      list = list.map((r) => (todo.includes(r.id) ? { ...r, read: true } : r));
      if (available) { const { error } = await loose.from(TABLE).update({ lida: true }).in('id', todo); if (error) throw error; }
    },
    /** busca de novo (ex.: ao voltar para a aba): respostas que chegaram enquanto o app estava aberto */
    async refresh() { const r = await loadResponses(); if (r.available) { available = true; list = r.list; } return r.available; },
    /** todas as respostas (para o backup) */
    all: () => list.slice(),
    /**
     * Importação de backup: grava respostas trazidas de outra conta. Precisa da permissão de inserir do
     * próprio nutricionista na tabela (prompt PROMPT_LOVABLE_IMPORTAR.md); sem ela, devolve o erro.
     */
    async importMany(owner: string, rows: { patientId: string; kind: FormKind; data: Answers; read: boolean; createdAt: string }[]) {
      if (!rows.length) return 0;
      if (!available) throw new Error('Respostas do portal indisponíveis neste banco');
      const { data, error } = await loose.from(TABLE).insert(rows.map((r) => ({ owner_id: owner, paciente_id: r.patientId, tipo: r.kind, dados: r.data, lida: r.read, created_at: r.createdAt })))
        .select('id,paciente_id,tipo,dados,lida,created_at');
      if (error) throw error;
      list = [...((data ?? []) as Row[]).map(toResp), ...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      return (data ?? []).length;
    },
    /** apaga respostas (o nutricionista exclui uma pré-consulta ou descarta a ficha enviada) */
    async remove(ids: string[]) {
      if (!ids.length) return;
      if (available) { const { error } = await loose.from(TABLE).delete().in('id', ids); if (error) throw error; }
      list = list.filter((r) => !ids.includes(r.id));
    },
    forgetPatient(pid: string) { list = list.filter((r) => r.patientId !== pid); },
  };
}
export type ResponseStore = ReturnType<typeof responseStore>;
