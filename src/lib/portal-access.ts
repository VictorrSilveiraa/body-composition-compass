import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { newCode } from './portal-code';

/*
 * Lado do nutricionista: cria, pausa e troca o código de acesso de cada paciente (tabela "acessos_paciente",
 * protegida por RLS — cada nutricionista só vê os próprios). O portal em si é lido pela função do servidor.
 */
export type PatientAccess = { code: string; active: boolean; photos: boolean; notes: boolean; lastAccess: string | null; createdAt: string | null };
type Row = { codigo: string; ativo: boolean; compartilhar_fotos: boolean | null; compartilhar_notas: boolean | null; ultimo_acesso: string | null; criado_em: string | null };
const TABLE = 'acessos_paciente';
const loose = supabase as unknown as SupabaseClient;
const toAccess = (r: Row): PatientAccess => ({ code: r.codigo, active: !!r.ativo, photos: r.compartilhar_fotos !== false, notes: !!r.compartilhar_notas, lastAccess: r.ultimo_acesso, createdAt: r.criado_em });
const COLS = 'codigo,ativo,compartilhar_fotos,compartilhar_notas,ultimo_acesso,criado_em';

/** available=false quando o banco ainda não tem a tabela de acessos */
export async function getAccess(patientId: string): Promise<{ available: boolean; access: PatientAccess | null }> {
  const { data, error } = await loose.from(TABLE).select(COLS).eq('paciente_id', patientId).maybeSingle();
  if (error) return { available: false, access: null };
  return { available: true, access: data ? toAccess(data as Row) : null };
}

/** cria (ou troca) o código; tenta de novo no caso raríssimo de repetir um código existente */
export async function issueCode(patientId: string, keep?: Partial<Pick<PatientAccess, 'photos' | 'notes'>>): Promise<PatientAccess> {
  for (let i = 0; i < 5; i++) {
    const row = { paciente_id: patientId, codigo: newCode(), ativo: true, compartilhar_fotos: keep?.photos ?? true, compartilhar_notas: keep?.notes ?? false, ultimo_acesso: null };
    const { data, error } = await loose.from(TABLE).upsert(row, { onConflict: 'paciente_id' }).select(COLS).single();
    if (!error) return toAccess(data as Row);
    if (error.code !== '23505' || !/codigo/i.test(error.message)) throw error;
  }
  throw new Error('Não foi possível gerar o código. Tente de novo.');
}

export async function updateAccess(patientId: string, patch: Partial<Pick<PatientAccess, 'active' | 'photos' | 'notes'>>): Promise<PatientAccess> {
  const row: Record<string, boolean> = {};
  if (patch.active !== undefined) row['ativo'] = patch.active;
  if (patch.photos !== undefined) row['compartilhar_fotos'] = patch.photos;
  if (patch.notes !== undefined) row['compartilhar_notas'] = patch.notes;
  const { data, error } = await loose.from(TABLE).update(row).eq('paciente_id', patientId).select(COLS).single();
  if (error) throw error;
  return toAccess(data as Row);
}
