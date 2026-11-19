/*
 * Código de acesso do paciente ao portal (somente leitura).
 * 8 caracteres de um alfabeto sem letras/números parecidos (sem 0/O, 1/I/L, U) → 30^8 ≈ 656 bilhões de combinações.
 * Exibido como "K7QM-3HXA"; guardado sem o traço, em maiúsculas.
 */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
export const CODE_LENGTH = 8;

/** gera um código novo com aleatoriedade criptográfica */
export function newCode(): string {
  const out: string[] = [];
  const buf = new Uint32Array(CODE_LENGTH * 2);
  while (out.length < CODE_LENGTH) {
    crypto.getRandomValues(buf);
    for (const v of buf) {
      // rejeita o resto para não favorecer nenhuma letra
      const lim = Math.floor(0x1_0000_0000 / CODE_ALPHABET.length) * CODE_ALPHABET.length;
      if (v < lim) out.push(CODE_ALPHABET[v % CODE_ALPHABET.length]!);
      if (out.length === CODE_LENGTH) break;
    }
  }
  return out.join('');
}

/** normaliza o que a pessoa digitou: maiúsculas, sem espaços nem traços */
export function normCode(input: string): string {
  return String(input ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** é um código possível (tamanho e alfabeto certos)? */
export function isCode(code: string): boolean {
  return code.length === CODE_LENGTH && [...code].every((c) => CODE_ALPHABET.includes(c));
}

/** "K7QM3HXA" → "K7QM-3HXA" (também formata enquanto digita) */
export function fmtCode(code: string): string {
  const c = normCode(code).slice(0, CODE_LENGTH);
  return c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

/* ---------- dados que o portal recebe (somente o necessário) ---------- */
export type PortalAssessment = {
  id: string; date: string; weight: number; height: number | null; protocol: string; multi: boolean;
  circ: Record<string, number>; folds: Record<string, (number | null)[] | number | null>;
  extra: { bf?: number | undefined; muscle?: number | undefined; visceral?: number | undefined; water?: number | undefined; evaluator?: string | undefined; notes?: string | undefined };
};
export type PortalPhoto = { assessmentId: string; pose: 'front' | 'back' | 'right' | 'left'; url: string; w: number; h: number };
/** plano alimentar visível para o paciente (o mais recente primeiro) */
export type PortalDiet = { id: string; title: string; prescribedAt: string | null; assessmentId: string | null; data: import('./diet-parse').Diet; updatedAt: string | null };
export type PortalData = {
  patient: { name: string; sex: 'F' | 'M'; birth: string; height: number | null; goal: string | null; returnDays: number | null;
    /** metas e (só se o nutricionista liberar) a energia diária */
    plan?: { goals: import('./plano').Goal[]; energy: import('./plano').EnergyCfg | null } | null };
  nutri: { name: string; crn: string; specialty: string; phone: string; place: string; returnDays: number | null };
  assessments: PortalAssessment[];
  photos: PortalPhoto[];
  diets: PortalDiet[];
  share: { photos: boolean; notes: boolean };
  updatedAt: string | null;
};
export type PortalResult = { ok: true; data: PortalData } | { ok: false; reason: 'invalid' | 'unavailable' };
