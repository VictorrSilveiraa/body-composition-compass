/*
 * Perfil do nutricionista: identidade, contato, marca (logo, cor, assinatura), PDFs e preferências de trabalho.
 * Só dados e regras — sem tela. Usado pelo app (original-runtime.js), pelos PDFs (report.js, diet-export.ts),
 * pelo portal do paciente e pelo backup. Fica nos dados da própria conta (user_metadata.nutri); as imagens ficam
 * no armazenamento privado e aqui só guardamos o caminho (ver nutri-media.ts).
 */

export type Treat = '' | 'dra' | 'dr';
export type Mode = '' | 'presencial' | 'online' | 'ambos';
export type PdfPrefs = {
  /** cabeçalho dos PDFs: logo + nome da marca, só o logo, só o nome, ou o padrão do sistema */
  head: 'logo' | 'logoOnly' | 'name' | 'system';
  /** contatos (WhatsApp, Instagram, site) no rodapé */
  contacts: boolean;
  /** assinatura: imagem cadastrada, só a linha para assinar à mão, ou nada */
  sign: 'image' | 'line' | 'none';
  /** texto final do rodapé (vazio = aviso padrão) */
  note: string;
};
export type WorkPrefs = {
  /** protocolo de dobras da 1ª avaliação de um adulto */
  proto: string;
  /** medir cada dobra 3 vezes por padrão */
  multi: boolean;
  /** avisos "Confere?" durante a avaliação */
  check: boolean;
  /** gasto energético de quem ainda não tem um configurado */
  formula: string;
  activity: number;
  /** compartilhar com o paciente ao liberar o portal */
  sharePhotos: boolean;
  shareNotes: boolean;
};
export type NutriProfile = {
  name?: string; treat?: Treat; crn?: string; specialty?: string; specialties?: string[]; bio?: string;
  phone?: string; email?: string; instagram?: string; site?: string; booking?: string;
  mode?: Mode; place?: string; address?: string;
  clinic?: string; color?: string;
  photoPath?: string | null; logoPath?: string | null; signPath?: string | null;
  pdf?: Partial<PdfPrefs>; prefs?: Partial<WorkPrefs>;
  returnDays?: number; tourSeen?: boolean; returnMsg?: { late?: string; soon?: string };
};

export const SPECIALTIES = [
  'Clínica', 'Esportiva', 'Emagrecimento', 'Comportamental', 'Materno-infantil', 'Pediatria', 'Gerontologia',
  'Vegetariana e vegana', 'Funcional', 'Saúde da mulher', 'Diabetes', 'Doença renal', 'Oncologia', 'Gastroenterologia',
];
export const BIO_MAX = 280;

/* cores de marca: tons claros que combinam com o visual do sistema (fundo) + tom forte para linhas e ícones (ink) */
export const BRAND_COLORS: { k: string; l: string; bg: string; ink: string }[] = [
  { k: 'sol', l: 'Amarelo', bg: 'oklch(0.944 0.103 103)', ink: 'oklch(0.536 0.103 99)' },
  { k: 'folha', l: 'Verde', bg: 'oklch(0.919 0.065 128)', ink: 'oklch(0.55 0.129 134)' },
  { k: 'ceu', l: 'Azul', bg: 'oklch(0.902 0.039 213)', ink: 'oklch(0.502 0.069 215)' },
  { k: 'pessego', l: 'Pêssego', bg: 'oklch(0.9 0.06 52)', ink: 'oklch(0.56 0.12 45)' },
  { k: 'rosa', l: 'Rosa', bg: 'oklch(0.91 0.05 15)', ink: 'oklch(0.55 0.13 15)' },
  { k: 'lilas', l: 'Lilás', bg: 'oklch(0.91 0.045 300)', ink: 'oklch(0.52 0.12 300)' },
  { k: 'menta', l: 'Menta', bg: 'oklch(0.92 0.05 170)', ink: 'oklch(0.52 0.09 170)' },
  { k: 'grafite', l: 'Grafite', bg: 'oklch(0.9 0.005 106)', ink: 'oklch(0.3 0 0)' },
];
export const brandColor = (k?: string | null) => BRAND_COLORS.find((c) => c.k === k) ?? BRAND_COLORS[0]!;

export const DEFAULT_PDF: PdfPrefs = { head: 'logo', contacts: true, sign: 'line', note: '' };
export const DEFAULT_PREFS: WorkPrefs = { proto: 'jp7', multi: false, check: true, formula: 'auto', activity: 1.55, sharePhotos: true, shareNotes: false };
export const pdfPrefs = (n?: NutriProfile | null): PdfPrefs => ({ ...DEFAULT_PDF, ...(n?.pdf ?? {}) });
export const workPrefs = (n?: NutriProfile | null): WorkPrefs => ({ ...DEFAULT_PREFS, ...(n?.prefs ?? {}) });

const t = (s: unknown) => String(s ?? '').trim();

/* ---------- CRN: guardado como "3-12345"; exibido como "CRN-3 12345" ---------- */
export function crnParts(crn?: string | null): { reg: string; num: string } {
  const c = t(crn).replace(/^crn[\s:-]*/i, '');
  const m = c.match(/^(\d{1,2})\s*[-/ ]\s*([\dA-Za-z/.-]+)$/);
  if (m) return { reg: String(+m[1]!), num: m[2]! };
  return { reg: '', num: c };
}
export const crnJoin = (reg: string, num: string) => { const r = t(reg), n = t(num).replace(/^crn[\s:-]*/i, ''); return n ? (r ? `${r}-${n}` : n) : ''; };
export function crnLabel(crn?: string | null): string {
  const { reg, num } = crnParts(crn);
  if (!num) return '';
  return reg ? `CRN-${reg} ${num}` : `CRN ${num}`;
}
export const CRN_REGIONS = Array.from({ length: 11 }, (_, i) => String(i + 1));

/* ---------- nome com tratamento ---------- */
export const TREATS: { k: Treat; l: string }[] = [{ k: 'dra', l: 'Dra.' }, { k: 'dr', l: 'Dr.' }, { k: '', l: 'Sem título' }];
export const treatLabel = (k?: Treat | string | null) => (k === 'dra' ? 'Dra.' : k === 'dr' ? 'Dr.' : '');
/** separa o tratamento digitado junto do nome ("Dra. Helena" → dra + "Helena") */
export function splitTreat(name?: string | null): { treat: Treat | null; rest: string } {
  const m = t(name).match(/^(dra|dr)\.?\s+(.+)$/i);
  return m ? { treat: m[1]!.toLowerCase() === 'dra' ? 'dra' : 'dr', rest: m[2]!.trim() } : { treat: null, rest: t(name) };
}
/** "Dra. Helena Duarte" (sem tratamento: só o nome) */
export const displayName = (n?: NutriProfile | null) => { const { treat, rest } = splitTreat(n?.name); return rest ? [treatLabel(n?.treat || treat), rest].filter(Boolean).join(' ') : ''; };
/** como chamar no dia a dia: "Dra. Helena" */
export const shortName = (n?: NutriProfile | null) => { const { treat, rest } = splitTreat(n?.name), first = rest.split(/\s+/)[0] ?? ''; return first ? [treatLabel(n?.treat || treat), first].filter(Boolean).join(' ') : ''; };
/** linha de assinatura: "Dra. Helena Duarte · CRN-3 12345" */
export const signLine = (n?: NutriProfile | null) => [displayName(n), crnLabel(n?.crn)].filter(Boolean).join(' · ');

/* ---------- especialidades (lista) e o texto antigo "specialty" ---------- */
export function specialtiesOf(n?: NutriProfile | null): string[] {
  if (Array.isArray(n?.specialties)) return n!.specialties!.map(t).filter(Boolean);
  return t(n?.specialty).split(/\s*[·,;/]\s*/).map(t).filter(Boolean);
}
export const specialtyText = (list: string[]) => list.length ? 'Nutrição ' + (list.length === 1 ? list[0]!.toLowerCase() : list.slice(0, -1).map((s) => s.toLowerCase()).join(', ') + ' e ' + list.at(-1)!.toLowerCase()) : '';

/* ---------- contatos ---------- */
export const igHandle = (s?: string | null) => { const v = t(s).replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/[/?#].*$/, '').replace(/^@/, ''); return /^[A-Za-z0-9._]{1,30}$/.test(v) ? v : ''; };
export const igUrl = (s?: string | null) => { const h = igHandle(s); return h ? `https://instagram.com/${h}` : ''; };
export function webUrl(s?: string | null): string {
  const v = t(s); if (!v) return '';
  const u = /^https?:\/\//i.test(v) ? v : 'https://' + v;
  try { const x = new URL(u); return /\./.test(x.hostname) && /^https?:$/.test(x.protocol) ? x.toString().replace(/\/$/, '') : ''; } catch { return ''; }
}
export const webLabel = (s?: string | null) => webUrl(s).replace(/^https?:\/\/(www\.)?/i, '');
export const emailOk = (s?: string | null) => !t(s) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t(s));
export const waUrl = (phone?: string | null) => { const d = t(phone).replace(/\D/g, ''); return d.length >= 10 ? 'https://wa.me/' + (d.length <= 11 ? '55' + d : d) : ''; };
export const MODES: { k: Mode; l: string }[] = [{ k: 'presencial', l: 'Presencial' }, { k: 'online', l: 'Online' }, { k: 'ambos', l: 'Presencial e online' }];
/** "Consultório Vida · Online" — onde atende, numa linha */
export function placeLine(n?: NutriProfile | null): string {
  const place = t(n?.place), mode = n?.mode;
  if (mode === 'online') return place ? `${place} · online` : 'Atendimento online';
  if (mode === 'ambos') return place ? `${place} · também online` : 'Presencial e online';
  return place;
}

/* ---------- validação antes de salvar ---------- */
export function validate(n: NutriProfile): string | null {
  if (!t(n.name)) return 'Informe seu nome';
  const digits = t(n.phone).replace(/\D/g, '');
  if (digits && digits.length < 10) return 'WhatsApp incompleto: use DDD + número';
  if (!emailOk(n.email)) return 'E-mail de contato inválido';
  if (t(n.instagram) && !igHandle(n.instagram)) return 'Instagram inválido: use só o @ (ex.: @nutri.helena)';
  if (t(n.site) && !webUrl(n.site)) return 'Endereço do site inválido';
  if (t(n.booking) && !webUrl(n.booking)) return 'Link de agendamento inválido';
  const { num } = crnParts(n.crn);
  if (num && !/\d{3,}/.test(num)) return 'Número do CRN incompleto';
  if (t(n.bio).length > BIO_MAX) return `A apresentação passa de ${BIO_MAX} caracteres`;
  return null;
}

/** limpa o perfil antes de salvar: tira espaços, normaliza Instagram/site, recalcula o texto de especialidades */
export function cleanNutri(n: NutriProfile): NutriProfile {
  const sp = specialtiesOf(n);
  const out: NutriProfile = {
    ...n, name: t(n.name), crn: t(n.crn), bio: t(n.bio).slice(0, BIO_MAX), phone: t(n.phone), email: t(n.email),
    instagram: igHandle(n.instagram) ? '@' + igHandle(n.instagram) : '', site: webUrl(n.site) ? webLabel(n.site) : '', booking: webUrl(n.booking),
    place: t(n.place), address: t(n.address), clinic: t(n.clinic), specialties: sp, specialty: sp.join(' · '),
  };
  if (out.pdf) out.pdf = { ...out.pdf, note: t(out.pdf.note).slice(0, 220) };
  return out;
}

/* ---------- perfil completo? (lista do que falta, com a aba onde se resolve) ---------- */
export type Tab = 'perfil' | 'contato' | 'marca' | 'prefs';
export function checklist(n?: NutriProfile | null): { k: string; l: string; done: boolean; tab: Tab; why: string }[] {
  return [
    { k: 'name', l: 'Nome', done: !!t(n?.name), tab: 'perfil', why: 'Aparece como avaliador(a) e nos PDFs' },
    { k: 'crn', l: 'CRN', done: !!crnParts(n?.crn).num, tab: 'perfil', why: 'Registro profissional nos documentos' },
    { k: 'photo', l: 'Foto', done: !!n?.photoPath, tab: 'perfil', why: 'O paciente reconhece você no portal' },
    { k: 'spec', l: 'Especialidades', done: specialtiesOf(n).length > 0, tab: 'perfil', why: 'Mostra no que você é referência' },
    { k: 'phone', l: 'WhatsApp', done: t(n?.phone).replace(/\D/g, '').length >= 10, tab: 'contato', why: 'Botão de conversa no portal e retornos' },
    { k: 'place', l: 'Atendimento', done: !!(t(n?.place) || n?.mode), tab: 'contato', why: 'Onde e como você atende' },
    { k: 'logo', l: 'Logo', done: !!n?.logoPath, tab: 'marca', why: 'Sua marca no topo dos PDFs' },
    { k: 'sign', l: 'Assinatura', done: !!n?.signPath, tab: 'marca', why: 'PDFs saem assinados' },
  ];
}
export const completeness = (n?: NutriProfile | null) => { const c = checklist(n); return Math.round(c.filter((x) => x.done).length / c.length * 100); };

/** chaves que vão no backup (imagens ficam de fora: são arquivos da conta) */
export const NUTRI_BACKUP_KEYS = ['name', 'treat', 'crn', 'specialty', 'specialties', 'bio', 'phone', 'email', 'instagram', 'site', 'booking', 'mode', 'place', 'address', 'clinic', 'color', 'pdf', 'prefs', 'returnDays', 'returnMsg'] as const;
