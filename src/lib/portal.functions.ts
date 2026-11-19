import { createServerFn } from '@tanstack/react-start';
import { isCode, normCode, type PortalAssessment, type PortalData, type PortalDiet, type PortalPhoto, type PortalResult, type SubmitResult } from './portal-code';
import { ANAMNESE_FORM, FORMS, cleanAnswers, type FormKind } from './forms';

/*
 * Portal do paciente — roda SÓ no servidor.
 * O paciente não tem conta: ele envia o código e esta função, com a chave de serviço (que nunca vai ao navegador),
 * confere o código e devolve apenas os dados daquele paciente, já filtrados e somente para leitura.
 * Nunca saem daqui: observações privadas da ficha, contato do paciente, rascunhos, dados de outros pacientes.
 */
const POSE_APP: Record<string, PortalPhoto['pose']> = { frente: 'front', costas: 'back', lado_direito: 'right', lado_esquerdo: 'left' };
const PHOTO_BUCKET = 'fotos-avaliacoes';
const n = (v: unknown) => { const x = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v); return Number.isFinite(x) && v !== null && v !== '' ? x : null; };
const numObj = (o: unknown) => Object.fromEntries(Object.entries((o ?? {}) as Record<string, unknown>).flatMap(([k, v]) => { const x = n(v); return x === null ? [] : [[k, x]]; })) as Record<string, number>;
// dobras: cada ponto pode ter até 3 leituras
const foldsOf = (o: unknown) => Object.fromEntries(Object.entries((o ?? {}) as Record<string, unknown>).map(([k, v]) => [k, Array.isArray(v) ? v.map(n) : n(v)])) as Record<string, (number | null)[] | number | null>;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Access = { paciente_id: string; owner_id: string; codigo: string; ativo: boolean; compartilhar_fotos: boolean | null; compartilhar_notas: boolean | null };

export const getPatientPortal = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => {
    const code = normCode(String((input as { code?: unknown })?.code ?? ''));
    return { code };
  })
  .handler(async ({ data }): Promise<PortalResult> => {
    // qualquer falha inesperada (ex.: servidor sem a chave de serviço) vira "indisponível", nunca vaza detalhes
    try { return await loadPortal(data.code); } catch { return { ok: false, reason: 'unavailable' }; }
  });

/*
 * O paciente envia um formulário (pré-consulta ou ficha de saúde). Só grava se o código for válido e o acesso
 * estiver ativo; as respostas são limpas pela mesma descrição do formulário (forms.ts) e há limite de envios por dia.
 */
export const submitPortalForm = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => {
    const i = (input ?? {}) as { code?: unknown; kind?: unknown; data?: unknown };
    const kind: FormKind = i.kind === 'anamnese' ? 'anamnese' : 'pre_consulta';
    return { code: normCode(String(i.code ?? '')), kind, data: i.data };
  })
  .handler(async ({ data }): Promise<SubmitResult> => {
    try {
      if (!isCode(data.code)) { await wait(500); return { ok: false, reason: 'invalid' }; }
      const answers = cleanAnswers(FORMS[data.kind], data.data);
      if (!Object.keys(answers).length) return { ok: false, reason: 'empty' };
      const admin = (await import('@/integrations/supabase/client.server')).supabaseAdmin;
      const db = admin as unknown as import('@supabase/supabase-js').SupabaseClient;
      const acc = await db.from('acessos_paciente').select('paciente_id,owner_id,ativo').eq('codigo', data.code).maybeSingle();
      const a = acc.data as { paciente_id: string; owner_id: string; ativo: boolean } | null;
      if (acc.error) return { ok: false, reason: 'unavailable' };
      if (!a || !a.ativo) { await wait(500); return { ok: false, reason: 'invalid' }; }
      const since = new Date(Date.now() - 864e5).toISOString();
      const n = await db.from('respostas_paciente').select('id', { count: 'exact', head: true }).eq('paciente_id', a.paciente_id).gte('created_at', since);
      if (n.error) return { ok: false, reason: 'unavailable' };
      if ((n.count ?? 0) >= 10) return { ok: false, reason: 'limit' };
      const ins = await db.from('respostas_paciente').insert({ owner_id: a.owner_id, paciente_id: a.paciente_id, tipo: data.kind, dados: answers }).select('created_at').single();
      if (ins.error) return { ok: false, reason: 'unavailable' };
      return { ok: true, at: String((ins.data as { created_at: string }).created_at) };
    } catch { return { ok: false, reason: 'unavailable' }; }
  });

async function loadPortal(code: string): Promise<PortalResult> {
    const data = { code };
    // código com formato impossível: nem consulta o banco (mas responde no mesmo tempo, para não ajudar tentativas)
    if (!isCode(data.code)) { await wait(500); return { ok: false, reason: 'invalid' }; }
    let admin;
    try { admin = (await import('@/integrations/supabase/client.server')).supabaseAdmin; }
    catch { return { ok: false, reason: 'unavailable' }; }
    const db = admin as unknown as import('@supabase/supabase-js').SupabaseClient;

    const acc = await db.from('acessos_paciente').select('paciente_id,owner_id,codigo,ativo,compartilhar_fotos,compartilhar_notas').eq('codigo', data.code).maybeSingle();
    if (acc.error) return { ok: false, reason: 'unavailable' };
    const access = acc.data as Access | null;
    if (!access || !access.ativo) { await wait(500); return { ok: false, reason: 'invalid' }; }

    const pat = await db.from('pacientes').select('id,owner_id,nome,sexo,nascimento,altura_cm,objetivo,retorno_dias').eq('id', access.paciente_id).eq('owner_id', access.owner_id).maybeSingle();
    if (pat.error) return { ok: false, reason: 'unavailable' };
    if (!pat.data) { await wait(500); return { ok: false, reason: 'invalid' }; }
    const p = pat.data as Record<string, unknown>;

    const av = await db.from('avaliacoes').select('id,data,peso_kg,altura_cm,protocolo,medir_3x,circunferencias,dobras,bioimpedancia,avaliador,observacoes,updated_at,created_at')
      .eq('paciente_id', access.paciente_id).eq('owner_id', access.owner_id).order('data');
    if (av.error) return { ok: false, reason: 'unavailable' };
    const shareNotes = !!access.compartilhar_notas, sharePhotos = access.compartilhar_fotos !== false;
    let updatedAt: string | null = null;
    const assessments: PortalAssessment[] = (av.data ?? []).map((row) => {
      const a = row as Record<string, unknown>;
      const up = String(a['updated_at'] ?? a['created_at'] ?? ''); if (up && (!updatedAt || up > updatedAt)) updatedAt = up;
      const bio = numObj(a['bioimpedancia']);
      return {
        id: String(a['id']), date: String(a['data']), weight: n(a['peso_kg']) ?? 0, height: n(a['altura_cm']), protocol: String(a['protocolo'] ?? 'jp7'), multi: !!a['medir_3x'],
        circ: numObj(a['circunferencias']), folds: foldsOf(a['dobras']),
        extra: { ...bio, evaluator: String(a['avaliador'] ?? '') || undefined, notes: shareNotes ? String(a['observacoes'] ?? '') || undefined : undefined },
      };
    });

    // fotos: links temporários (1 hora) gerados aqui; o bucket continua privado
    const photos: PortalPhoto[] = [];
    if (sharePhotos && assessments.length) {
      const ph = await db.from('fotos_avaliacao').select('avaliacao_id,pose,caminho,largura,altura').eq('paciente_id', access.paciente_id).eq('owner_id', access.owner_id);
      const rows = (ph.error ? [] : ph.data ?? []) as { avaliacao_id: string; pose: string; caminho: string; largura: number | null; altura: number | null }[];
      const ok = rows.filter((r) => POSE_APP[r.pose] && assessments.some((a) => a.id === r.avaliacao_id));
      if (ok.length) {
        const signed = await db.storage.from(PHOTO_BUCKET).createSignedUrls(ok.map((r) => r.caminho), 3600);
        (signed.data ?? []).forEach((s, i) => { const r = ok[i]!; if (s.signedUrl) photos.push({ assessmentId: r.avaliacao_id, pose: POSE_APP[r.pose]!, url: s.signedUrl, w: r.largura ?? 1200, h: r.altura ?? 1600 }); });
      }
    }

    // planos alimentares marcados como visíveis (se a tabela ainda não existir, o portal segue sem a aba Dieta)
    const diets: PortalDiet[] = [];
    try {
      const dt = await db.from('dietas').select('id,titulo,prescrito_em,avaliacao_id,dados,visivel_paciente,created_at,updated_at')
        .eq('paciente_id', access.paciente_id).eq('owner_id', access.owner_id).eq('visivel_paciente', true)
        .order('prescrito_em', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
      for (const row of (dt.error ? [] : dt.data ?? []) as Record<string, unknown>[]) {
        const dados = row['dados'] as PortalDiet['data'] | null;
        if (!dados || !Array.isArray(dados.meals)) continue;
        const up = String(row['updated_at'] ?? row['created_at'] ?? ''); if (up && (!updatedAt || up > updatedAt)) updatedAt = up;
        diets.push({ id: String(row['id']), title: String(row['titulo'] ?? dados.title ?? 'Plano alimentar'), prescribedAt: (row['prescrito_em'] as string | null) ?? null, assessmentId: (row['avaliacao_id'] as string | null) ?? null, data: dados, updatedAt: up || null });
      }
    } catch { /* sem dietas */ }

    // metas e energia diária (coluna "plano"; sem a coluna, o portal segue sem elas). A energia só vai se o nutricionista liberou.
    let plan: PortalData['patient']['plan'] = null;
    try {
      const pl = await db.from('pacientes').select('plano').eq('id', access.paciente_id).eq('owner_id', access.owner_id).maybeSingle();
      const raw = (pl.error ? null : (pl.data as { plano?: unknown } | null)?.plano) as { goals?: unknown; energy?: unknown } | null | undefined;
      if (raw && typeof raw === 'object') {
        const goals = (Array.isArray(raw.goals) ? raw.goals : []).filter((g): g is NonNullable<PortalData['patient']['plan']>['goals'][number] => !!g && typeof g === 'object' && typeof (g as { to?: unknown }).to === 'number' && typeof (g as { from?: unknown }).from === 'number');
        const e = raw.energy as NonNullable<PortalData['patient']['plan']>['energy'];
        // histórico: o paciente vê só as conquistas (metas alcançadas)
        const history = (Array.isArray((raw as { history?: unknown }).history) ? (raw as { history: unknown[] }).history : [])
          .filter((h): h is NonNullable<NonNullable<PortalData['patient']['plan']>['history']>[number] => !!h && typeof h === 'object' && (h as { done?: unknown }).done === true);
        plan = { goals, energy: e && typeof e === 'object' && e.share ? e : null, history };
      }
    } catch { /* sem plano */ }

    // formulários (pré-consulta e ficha de saúde): sem a tabela de respostas, o portal segue sem eles
    let forms: PortalData['forms'] = null;
    try {
      const rs = await db.from('respostas_paciente').select('tipo,dados,created_at').eq('paciente_id', access.paciente_id).eq('owner_id', access.owner_id).order('created_at', { ascending: false }).limit(30);
      if (!rs.error) {
        const rows = (rs.data ?? []) as { tipo: string; dados: unknown; created_at: string }[];
        const pre = rows.find((r) => r.tipo === 'pre_consulta'), an = rows.find((r) => r.tipo === 'anamnese');
        // ficha para pré-preencher: a revisada pelo nutricionista ou, se não houver, a última enviada pelo paciente
        const pl = await db.from('pacientes').select('plano').eq('id', access.paciente_id).eq('owner_id', access.owner_id).maybeSingle();
        const reviewed = (pl.error ? null : (pl.data as { plano?: { anamnese?: { data?: unknown } } } | null)?.plano?.anamnese?.data) ?? an?.dados ?? null;
        forms = { pre: pre?.created_at ?? null, anamnese: an?.created_at ?? null, anamneseData: reviewed ? cleanAnswers(ANAMNESE_FORM, reviewed) : null };
      }
    } catch { /* sem formulários */ }

    // perfil profissional do nutricionista (nome, CRN, especialidade, contato de atendimento)
    let nutri: PortalData['nutri'] = { name: '', crn: '', specialty: '', phone: '', place: '', returnDays: null };
    try {
      const u = await admin.auth.admin.getUserById(access.owner_id);
      const m = ((u.data?.user?.user_metadata ?? {}) as { nutri?: Record<string, unknown> }).nutri ?? {};
      nutri = { name: String(m['name'] ?? ''), crn: String(m['crn'] ?? ''), specialty: String(m['specialty'] ?? ''), phone: String(m['phone'] ?? ''), place: String(m['place'] ?? ''), returnDays: n(m['returnDays']) };
    } catch { /* sem perfil: o portal mostra só "seu nutricionista" */ }

    // registra o acesso (o nutricionista vê "último acesso" na ficha)
    try { await db.from('acessos_paciente').update({ ultimo_acesso: new Date().toISOString() }).eq('paciente_id', access.paciente_id); } catch { /* não impede o acesso */ }

    return {
      ok: true,
      data: {
        patient: { name: String(p['nome'] ?? ''), sex: p['sexo'] === 'F' ? 'F' : 'M', birth: String(p['nascimento'] ?? ''), height: n(p['altura_cm']), goal: (p['objetivo'] as string) ?? null, returnDays: n(p['retorno_dias']), plan },
        nutri, assessments, photos, diets, share: { photos: sharePhotos, notes: shareNotes }, updatedAt, forms,
      },
    };
}
