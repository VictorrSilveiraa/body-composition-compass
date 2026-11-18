/*
 * Plano alimentar: formato salvo no app + leitor do PDF exportado pelo WebDiet.
 *
 * O PDF chega como texto com posição (x, y) por página. O leitor:
 *  1. descarta marca-d'água (texto inclinado), cabeçalho/rodapé repetidos e o QR code;
 *  2. junta os pedaços em linhas e as linhas em "células" (a tabela alimento | quantidade);
 *  3. reconhece refeições ("09:30 - Café da manhã"), substituições, observações,
 *     lista de compras, receitas e qualquer outra seção (guardada como texto, nada se perde).
 * Funções puras: testadas sem navegador (src/test/diet-parse.test.ts).
 */

export type PdfItem = { s: string; x: number; y: number; w: number; h: number; bold?: boolean | undefined; rot?: boolean | undefined };
export type PdfPage = { w: number; h: number; items: PdfItem[] };

/** alimento (ou opção de troca): nome, detalhe entre parênteses e quantidade como veio do PDF */
export type DietSub = { name: string; detail?: string; qty: string };
export type DietFood = DietSub & { id: string; subs: DietSub[] };
export type DietVariant = { id: string; label: string; foods: DietFood[]; notes: string };
export type DietMeal = { id: string; time: string | null; name: string; variants: DietVariant[] };
export type DietRecipe = { id: string; name: string; yield: string; ingredients: string[]; steps: string[] };
export type DietSection = { id: string; title: string; lines: string[] };
export type Diet = {
  v: 1;
  title: string;
  subtitle: string;
  patientName: string;
  prescribedAt: string | null; // AAAA-MM-DD
  prescriber: string;
  meals: DietMeal[];
  shopping: string[];
  recipes: DietRecipe[];
  sections: DietSection[];
  /** orientações gerais escritas pelo nutricionista no app */
  notes: string;
  source: 'webdiet' | 'pdf' | 'manual';
};

let seq = 0;
export const did = (p = 'd') => `${p}${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const normTxt = (s: string) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const clean = (s: string) => String(s ?? '').replace(/\s+/g, ' ').trim();

/* ---------- correções de digitação comuns nos PDFs ---------- */
const FIX: [RegExp, string][] = [
  [/\bop[cç][aã]o\b/gi, 'Opção'], [/\bop[cç][oõ]es\b/gi, 'Opções'], [/\bavia[cç]ao\b/gi, 'Aviação'], [/\bemgalagem\b/gi, 'Embalagem'],
  [/\brefei[cç]ao\b/gi, 'Refeição'], [/\bcolacao\b/gi, 'Colação'],
];
export const fixWords = (s: string) => FIX.reduce((t, [re, to]) => t.replace(re, (m) => (m[0] === m[0]!.toUpperCase() ? to : to.toLowerCase())), clean(s));

/* ---------- quantidade: "1 Unidade(s) média(s) (135g)" → medida caseira + gramas ---------- */
export type QtyParts = { measure: string; amount: number | null; unit: 'g' | 'ml' | null };
export function qtyParts(qty: string): QtyParts {
  let s = clean(fixWords(qty));
  const num = (v: string) => Number(v.replace(',', '.'));
  const only = s.match(/^(\d+(?:[.,]\d+)?)\s*(g|gr|gramas?|ml|mL)$/i);
  if (only) return { measure: '', amount: num(only[1]!), unit: /ml/i.test(only[2]!) ? 'ml' : 'g' };
  let amount: number | null = null, unit: QtyParts['unit'] = null;
  const par = s.match(/\((\d+(?:[.,]\d+)?)\s*(g|gr|ml)\)\s*$/i);
  if (par) { amount = num(par[1]!); unit = /ml/i.test(par[2]!) ? 'ml' : 'g'; s = s.slice(0, par.index).trim(); }
  // "(s)" vira singular ou plural conforme o número do começo
  const n = Number((s.match(/^(\d+(?:[.,]\d+)?)/)?.[1] ?? '1').replace(',', '.'));
  const many = n > 1;
  s = s.replace(/([A-Za-zÀ-ÿ]+)\((s|es)\)/g, (_m, w: string, suf: string) => (many ? w + suf : w));
  s = s.replace(/^(\d+(?:[.,]\d+)?)\s+/, '$1 ').replace(/(?<=\d )([A-ZÀ-Ý][^\s]*)/, (w) => w.toLowerCase());
  s = s.replace(/\b(De|Da|Do|Sopa|Chá|Sobremesa|Média|Pequena|Grande|Cheia|Rasa)\b/g, (w) => w.toLowerCase());
  return { measure: s, amount, unit };
}
export const fmtAmount = (p: QtyParts) => (p.amount == null ? '' : `${String(p.amount).replace('.', ',')} ${p.unit}`);

/** "Pão francês (Pão de sal, pão carequinha)" → nome + detalhe */
export function splitName(raw: string): { name: string; detail?: string } {
  const s = fixWords(raw);
  const m = s.match(/^(.+?)\s*\(([^()]+)\)\s*$/);
  if (m && m[1]!.length >= 2) return { name: m[1]!.trim(), detail: m[2]!.trim() };
  return { name: s };
}

/* ---------- grupos de alimentos (cor e ícone na tela; ajuda o paciente a entender as trocas) ---------- */
export type FoodCat = 'carbo' | 'prot' | 'leite' | 'fruta' | 'veg' | 'gord' | 'legum' | 'doce' | 'bebida' | 'supl' | 'outro';
export const CAT_LABEL: Record<FoodCat, string> = {
  carbo: 'Carboidratos', prot: 'Proteínas', leite: 'Laticínios', fruta: 'Frutas', veg: 'Verduras e legumes', gord: 'Gorduras boas',
  legum: 'Leguminosas', doce: 'Doces', bebida: 'Bebidas', supl: 'Suplementos', outro: 'Outros',
};
const CAT_WORDS: [FoodCat, string[]][] = [
  ['supl', ['whey', 'creatina', 'albumina', 'suplemento', 'hipercalorico', 'bcaa', 'colageno', 'multivitaminico', 'omega 3', 'caseina']],
  ['doce', ['doce de leite', 'chocolate', 'brigadeiro', 'mel ', 'geleia', 'acucar', 'bolo', 'sorvete', 'goiabada', 'pacoca', 'rapadura', 'cacau']],
  ['leite', ['iogurte', 'yopro', 'leite', 'queijo', 'requeijao', 'ricota', 'cottage', 'coalhada', 'kefir', 'mucarela', 'mussarela', 'skyr', 'petit suisse']],
  ['legum', ['feijao', 'lentilha', 'grao de bico', 'grao-de-bico', 'ervilha', 'soja', 'edamame']],
  ['gord', ['azeite', 'castanha', 'amendoim', 'manteiga', 'oleo', 'nozes', 'noz ', 'amendoa', 'chia', 'linhaca', 'abacate', 'coco', 'gergelim', 'pasta de amendoim', 'macadamia', 'pistache']],
  ['carbo', ['pao', 'arroz', 'macarrao', 'massa', 'batata', 'mandioca', 'aipim', 'macaxeira', 'aveia', 'tapioca', 'cuscuz', 'granola', 'biscoito', 'bolacha', 'torrada', 'milho', 'farinha', 'inhame', 'cara ', 'quinoa', 'wrap', 'rap10', 'panqueca', 'crepioca', 'cereal', 'polenta', 'nhoque', 'pipoca', 'beiju', 'sucrilhos']],
  ['prot', ['frango', 'carne', 'patinho', 'peito', 'ovo', 'clara', 'peixe', 'tilapia', 'atum', 'salmao', 'sardinha', 'presunto', 'peru', 'alcatra', 'acem', 'musculo', 'file', 'hamburguer', 'lombo', 'porco', 'suino', 'costela', 'figado', 'camarao', 'merluza', 'pescada', 'coxa', 'sobrecoxa', 'bife', 'moida', 'moido', 'tofu', 'frango desfiado', 'linguica', 'picanha', 'maminha', 'fraldinha', 'contrafile', 'cupim']],
  ['fruta', ['banana', 'maca', 'mamao', 'melao', 'laranja', 'tangerina', 'mexerica', 'ponka', 'abacaxi', 'uva', 'morango', 'manga', 'pera', 'kiwi', 'melancia', 'goiaba', 'acai', 'ameixa', 'pessego', 'caqui', 'limao', 'maracuja', 'frutas vermelhas', 'mirtilo', 'framboesa', 'carambola', 'jabuticaba', 'pitaya', 'fruta']],
  ['veg', ['alface', 'tomate', 'cenoura', 'brocolis', 'legume', 'salada', 'abobrinha', 'couve', 'espinafre', 'pepino', 'beterraba', 'repolho', 'rucula', 'agriao', 'chuchu', 'vagem', 'berinjela', 'abobora', 'cebola', 'pimentao', 'quiabo', 'jilo', 'verdura', 'folhas', 'acelga', 'palmito', 'cogumelo']],
  ['bebida', ['cafe', 'cha ', 'suco', 'agua', 'refrigerante', 'isotonico', 'cha-']],
];
export function foodCat(name: string): FoodCat {
  const n = ' ' + normTxt(name).replace(/[()/,-]/g, ' ') + ' ';
  // a primeira palavra decide antes (ex.: "Pão de hambúrguer" é pão, não carne)
  const head = ' ' + n.trim().split(' ')[0] + ' ';
  for (const probe of [head, n]) for (const [cat, words] of CAT_WORDS) if (words.some((w) => probe.includes(w.endsWith(' ') ? ' ' + w : ' ' + w))) return cat;
  return 'outro';
}

/* ---------- tipo de refeição (ícone e cor) ---------- */
export type MealKind = 'cafe' | 'lanche' | 'almoco' | 'jantar' | 'ceia' | 'treino' | 'outra';
export function mealKind(name: string, time: string | null): MealKind {
  const n = normTxt(name);
  if (/treino|workout/.test(n)) return 'treino';
  if (/cafe|desjejum|breakfast/.test(n)) return 'cafe';
  if (/almoco|lunch/.test(n)) return 'almoco';
  if (/jantar|janta|dinner/.test(n)) return 'jantar';
  if (/ceia/.test(n)) return 'ceia';
  if (/lanche|colacao|merenda|snack/.test(n)) return 'lanche';
  const h = time ? Number(time.slice(0, 2)) : NaN;
  if (h < 10) return 'cafe'; if (h < 14) return 'almoco'; if (h < 18) return 'lanche'; if (h < 21) return 'jantar'; if (h >= 21) return 'ceia';
  return 'outra';
}
export const minutesOf = (t: string | null) => (t && /^\d{1,2}:\d{2}$/.test(t) ? Number(t.split(':')[0]) * 60 + Number(t.split(':')[1]) : null);
export const normTime = (t: string) => { const m = String(t ?? '').trim().match(/^(\d{1,2})\s*[:hH]\s*(\d{2})?/); if (!m) return null; const h = Math.min(23, Number(m[1])), mi = Math.min(59, Number(m[2] ?? 0)); return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`; };

/* ---------- números do plano ---------- */
export function dietStats(d: Diet) {
  const foods = d.meals.flatMap((m) => m.variants.flatMap((v) => v.foods));
  const cats: Partial<Record<FoodCat, number>> = {};
  for (const m of d.meals) { const v = m.variants[0]; if (!v) continue; for (const f of v.foods) { const c = foodCat(f.name); cats[c] = (cats[c] ?? 0) + 1; } }
  return {
    meals: d.meals.length,
    options: d.meals.reduce((s, m) => s + Math.max(0, m.variants.length - 1), 0),
    foods: foods.length,
    subs: foods.reduce((s, f) => s + f.subs.length, 0),
    recipes: d.recipes.length,
    shopping: d.shopping.length,
    cats,
  };
}

/** lista de compras: a do PDF ou, se não houver, montada com todos os alimentos e trocas */
export function shoppingList(d: Diet): string[] {
  if (d.shopping.length) return d.shopping;
  const seen = new Map<string, string>();
  for (const m of d.meals) for (const v of m.variants) for (const f of v.foods) for (const x of [f, ...f.subs]) { const k = normTxt(x.name); if (k && !seen.has(k)) seen.set(k, x.name); }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/** a refeição de agora (ou a próxima) pelo horário */
export function currentMeal(d: Diet, nowMin: number): { meal: DietMeal; state: 'now' | 'next' } | null {
  const timed = d.meals.filter((m) => minutesOf(m.time) != null).sort((a, b) => minutesOf(a.time)! - minutesOf(b.time)!);
  if (!timed.length) return null;
  for (const m of timed) { const t = minutesOf(m.time)!; if (nowMin >= t - 20 && nowMin <= t + 40) return { meal: m, state: 'now' }; }
  const nx = timed.find((m) => minutesOf(m.time)! > nowMin) ?? timed[0]!;
  return { meal: nx, state: 'next' };
}

/* =========================================================
   LEITOR DO PDF
   ========================================================= */
type Cell = { s: string; x: number; x2: number; bold: boolean };
type Line = { page: number; y: number; cells: Cell[]; text: string; bold: boolean; center: number; pageW: number };

const RE_MEAL = /^(\d{1,2}\s*[:hH]\s*\d{2})\s*(?:[-–—]|\|)?\s*(.+)$/;
const RE_SUBS = /^[•·\-*]?\s*op[cç][oõ]es\s+de\s+substitui[cç][aã]o\s+(?:para|de|do|da)\s+(.+?)\s*:?\s*$/i;
const RE_SUBS_LOOSE = /^[•·\-*]?\s*(?:substitui[cç][oõ]es|substitutos|trocas?)\s*(?:para|de|do|da)?\s*(.*?)\s*:?\s*$/i;
const RE_NOTES = /^(observa[cç][oõ]es|obs\.?|orienta[cç][oõ]es)\s*:\s*(.*)$/i;
const RE_FOOTER = /^(p[aá]gina\s+\d+\s*\/\s*\d+|acesse o|conte[uú]do completo|da sua consulta|feito por estudante|gerado (por|em)|webdiet)/i;

function buildLines(pages: PdfPage[]): Line[] {
  // cabeçalho/rodapé: o mesmo texto, na mesma altura, em várias páginas
  const rep = new Map<string, number>();
  if (pages.length > 1) for (const p of pages) for (const k of new Set(p.items.map((i) => clean(i.s) + '@' + Math.round(i.y)))) rep.set(k, (rep.get(k) ?? 0) + 1);
  const minRep = Math.max(2, Math.ceil(pages.length * 0.6));
  const lines: Line[] = [];
  pages.forEach((p, pi) => {
    const keep = p.items.filter((i) => {
      const s = clean(i.s);
      if (!s || i.rot) return false;
      if (pages.length > 1 && (rep.get(s + '@' + Math.round(i.y)) ?? 0) >= minRep && (i.y < p.h * 0.14 || i.y > p.h * 0.84)) return false;
      if (i.y > p.h * 0.9 && RE_FOOTER.test(s)) return false;
      return true;
    }).sort((a, b) => a.y - b.y || a.x - b.x);
    const rows: PdfItem[][] = [];
    for (const it of keep) {
      const row = rows.find((r) => Math.abs(r[0]!.y - it.y) <= Math.max(2, it.h * 0.35));
      if (row) row.push(it); else rows.push([it]);
    }
    for (const r of rows) {
      r.sort((a, b) => a.x - b.x);
      const cells: Cell[] = [];
      for (const it of r) {
        const last = cells.at(-1), gap = last ? it.x - last.x2 : Infinity;
        const sz = Math.max(4, it.h || 8);
        if (last && gap < sz * 1.6) { last.s = clean(last.s + (gap > sz * 0.15 || /\s$/.test(last.s) ? ' ' : '') + it.s); last.x2 = Math.max(last.x2, it.x + it.w); last.bold = last.bold && !!it.bold; }
        else cells.push({ s: clean(it.s), x: it.x, x2: it.x + it.w, bold: !!it.bold });
      }
      const x1 = Math.min(...cells.map((c) => c.x)), x2 = Math.max(...cells.map((c) => c.x2));
      lines.push({ page: pi, y: r[0]!.y, cells, text: clean(cells.map((c) => c.s).join(' ')), bold: cells.every((c) => c.bold), center: (x1 + x2) / 2, pageW: p.w });
    }
  });
  return lines;
}

function metaFrom(pages: PdfPage[]) {
  let patientName = '', prescribedAt: string | null = null, prescriber = '';
  const all = pages.flatMap((p) => p.items.map((i) => ({ ...i, s: clean(i.s), ph: p.h, pw: p.w })));
  for (const i of all) {
    const pm = i.s.match(/paciente[:\s]+([^|]+?)\s*(?:\||$)/i); if (pm && !patientName) patientName = clean(pm[1]!);
    const dm = i.s.match(/prescri(?:to|ção|cao)[^0-9]*(\d{2})\/(\d{2})\/(\d{4})/i); if (dm && !prescribedAt) prescribedAt = `${dm[3]}-${dm[2]}-${dm[1]}`;
  }
  // assinatura: texto repetido no rodapé, à direita (ex.: "Nutricionista Ana Souza — CRN 3-1234")
  if (pages.length) {
    const p0 = pages[0]!;
    const right = p0.items.filter((i) => i.y > p0.h * 0.88 && i.x > p0.w * 0.55 && !i.rot).sort((a, b) => a.y - b.y).map((i) => clean(i.s));
    prescriber = clean(right.join(' ')).replace(/^(aluno\(a\)|aluna|aluno|nutricionista|nutri\.?)\s+/i, '');
  }
  return { patientName, prescribedAt, prescriber };
}

export function emptyDiet(): Diet {
  return { v: 1, title: 'Plano alimentar', subtitle: '', patientName: '', prescribedAt: null, prescriber: '', meals: [], shopping: [], recipes: [], sections: [], notes: '', source: 'manual' };
}

export function parseDiet(pages: PdfPage[]): Diet {
  const lines = buildLines(pages);
  const meta = metaFrom(pages);
  const d: Diet = { ...emptyDiet(), ...meta, source: 'pdf' };
  type RawMeal = { time: string | null; base: string; label: string; foods: DietFood[]; notes: string[] };
  const raw: RawMeal[] = [];
  let meal: RawMeal | null = null;
  let mode: 'foods' | 'subs' | 'notes' | 'shopping' | 'recipe' | 'section' | 'intro' = 'intro';
  let subsFor = '', recipe: DietRecipe | null = null, recipePart: 'ing' | 'steps' | '' = '', section: DietSection | null = null;
  let lastFoodY = -99, lastFoodPage = -1, titleSet = false;
  const isCentered = (l: Line) => Math.abs(l.center - l.pageW / 2) < l.pageW * 0.08 && l.cells.length === 1;
  const sectionTitles = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!, t = l.text, nt = normTxt(t), next = lines[i + 1];

    // ----- títulos de seção -----
    const mm = t.match(RE_MEAL);
    if (mm && (l.bold || isCentered(l) || l.cells.length === 1) && !/^\d{1,2}[:h]\d{2}\s*-\s*\d/.test(t)) {
      const time = normTime(mm[1]!), rest = fixWords(mm[2]!);
      const lab = rest.match(/^(.*?)\s*[([]\s*((?:op[cç][aã]o|alternativa|varia[cç][aã]o)\s*[^)\]]*)[)\]]\s*$/i) ?? rest.match(/^(.*?)\s+[-–]\s+((?:op[cç][aã]o|alternativa)\s*\S*)\s*$/i);
      meal = { time, base: clean(lab ? lab[1]! : rest), label: lab ? fixWords(lab[2]!).replace(/^./, (c) => c.toUpperCase()) : '', foods: [], notes: [] };
      raw.push(meal); mode = 'foods'; subsFor = ''; recipe = null; section = null; continue;
    }
    if (nt === 'lista de compras') { mode = 'shopping'; meal = null; sectionTitles.add(nt); continue; }
    if (next && /^receita(s)?( culinaria)?$/.test(normTxt(next.text)) && isCentered(l)) {
      recipe = { id: did('r'), name: fixWords(t), yield: '', ingredients: [], steps: [] }; d.recipes.push(recipe);
      mode = 'recipe'; recipePart = ''; meal = null; i++; continue;
    }
    if (mode === 'intro' && isCentered(l)) {
      if (!titleSet) { d.title = fixWords(t); titleSet = true; } else if (!d.subtitle) d.subtitle = fixWords(t);
      continue;
    }
    // título centralizado e em negrito que não é refeição: nova seção de texto (orientações, metas, suplementos…)
    if (l.bold && isCentered(l) && !RE_SUBS.test(t) && !RE_NOTES.test(t)) {
      if (mode === 'recipe' && recipe && !recipe.ingredients.length) continue;
      section = { id: did('s'), title: fixWords(t), lines: [] }; d.sections.push(section); mode = 'section'; meal = null; recipe = null; continue;
    }

    // ----- conteúdo -----
    if (mode === 'shopping') {
      if (normTxt(t) === normTxt(d.title) || (l.page === lines[i - 1]?.page && isCentered(l) && !/^[◯○●•□☐-]/.test(t))) continue;
      const item = fixWords(t.replace(/^[◯○●•□☐▢\-*]\s*/, ''));
      if (item) d.shopping.push(item.charAt(0).toUpperCase() + item.slice(1));
      continue;
    }
    if (mode === 'recipe' && recipe) {
      const ym = t.match(/^rendimento\s*:?\s*(.*)$/i); if (ym) { recipe.yield = clean(ym[1]!).replace(/\.$/, ''); continue; }
      if (/^ingredientes\s*:?$/i.test(t)) { recipePart = 'ing'; continue; }
      if (/^(forma|modo) de preparo\s*:?$|^preparo\s*:?$/i.test(t)) { recipePart = 'steps'; continue; }
      if (recipePart === 'ing') recipe.ingredients.push(fixWords(t));
      else if (recipePart === 'steps') { const st = t.replace(/^\d+\s*[.)-]\s*/, ''); if (/^\d+\s*[.)-]/.test(t) || !recipe.steps.length) recipe.steps.push(st); else recipe.steps[recipe.steps.length - 1] += ' ' + st; }
      continue;
    }
    if (mode === 'section' && section) { section.lines.push(fixWords(t)); continue; }
    if (!meal) { if (mode === 'intro' && t) { section ??= (() => { const s = { id: did('s'), title: 'Orientações', lines: [] as string[] }; d.sections.push(s); return s; })(); section.lines.push(fixWords(t)); } continue; }

    const sm = t.match(RE_SUBS) ?? (l.bold ? t.match(RE_SUBS_LOOSE) : null);
    if (sm) { subsFor = clean(sm[1] ?? ''); mode = 'subs'; continue; }
    const nm = t.match(RE_NOTES);
    if (nm) { mode = 'notes'; if (nm[2]) meal.notes.push(fixWords(nm[2])); continue; }

    if (mode === 'subs' && !(l.cells.length >= 2 && !/ - ou - | ou /i.test(t) && !/ - /.test(l.cells[0]!.s))) {
      const target = meal.foods.find((f) => normTxt(f.name + (f.detail ? ` (${f.detail})` : '')) === normTxt(subsFor) || normTxt(f.name) === normTxt(subsFor))
        ?? meal.foods.find((f) => normTxt(subsFor).startsWith(normTxt(f.name))) ?? meal.foods.at(-1);
      for (const alt of t.split(/\s+[-–]\s*ou\s*[-–]\s+|\s+[-–]\s*ou\s+|\s+ou\s+[-–]\s+/i)) {
        const a = clean(alt); if (!a) continue;
        const am = a.match(/^(.+?)\s+[-–]\s+(\d.*|\(?\d.*|[\d½¼¾].*|.*\d\s*(?:g|ml)\)?)$/i);
        const nameRaw = am ? am[1]! : a, qty = am ? am[2]! : '';
        target?.subs.push({ ...splitName(nameRaw), qty: clean(qty) });
      }
      continue;
    }
    if (mode === 'notes') { meal.notes.push(fixWords(t)); continue; }

    // linha da tabela: alimento | quantidade
    if (l.cells.length >= 2) {
      const qty = l.cells.slice(1).map((c) => c.s).find((s) => /\d/.test(s)) ?? l.cells[1]!.s;
      meal.foods.push({ id: did('f'), ...splitName(l.cells[0]!.s), qty: clean(qty), subs: [] });
      lastFoodY = l.y; lastFoodPage = l.page; mode = 'foods'; continue;
    }
    // nome longo que quebrou em duas linhas
    const prev = meal.foods.at(-1);
    if (prev && l.page === lastFoodPage && l.y - lastFoodY < 13) { const full = splitName(`${prev.name}${prev.detail ? ` (${prev.detail})` : ''} ${t}`); prev.name = full.name; if (full.detail) prev.detail = full.detail; else delete prev.detail; lastFoodY = l.y; continue; }
    // alimento sem quantidade separada: tenta "Nome - 200g" / "Nome 200g"
    const q = t.match(/^(.+?)\s+[-–]\s+(.+)$/) ?? t.match(/^(.+?)\s+(\d+(?:[.,]\d+)?\s*(?:g|ml|unidades?|colher(?:es)?|fatias?|x[ií]caras?).*)$/i);
    meal.foods.push({ id: did('f'), ...splitName(q ? q[1]! : t), qty: q ? clean(q[2]!) : '', subs: [] });
    lastFoodY = l.y; lastFoodPage = l.page;
  }

  // ----- refeições com o mesmo horário e nome viram opções de uma só refeição -----
  const meals: DietMeal[] = [];
  for (const r of raw) {
    const key = `${r.time ?? ''}|${normTxt(r.base)}`;
    let m = meals.find((x) => `${x.time ?? ''}|${normTxt(x.name)}` === key);
    if (!m) { m = { id: did('m'), time: r.time, name: r.base, variants: [] }; meals.push(m); }
    m.variants.push({ id: did('v'), label: r.label, foods: r.foods, notes: r.notes.join('\n') });
  }
  for (const m of meals) {
    if (m.variants.length > 1) m.variants.forEach((v, i) => { if (!v.label) v.label = i === 0 ? 'Principal' : `Opção ${i + 1}`; });
  }
  meals.sort((a, b) => (minutesOf(a.time) ?? 1e9) - (minutesOf(b.time) ?? 1e9));
  d.meals = meals;
  d.title = fixWords(d.title || 'Plano alimentar');
  if (/webdiet/i.test(JSON.stringify(pages.slice(0, 1))) || pages.some((p) => p.items.some((i) => /op[cç][oõ]es de substitui/i.test(i.s)))) d.source = 'webdiet';
  return d;
}

/** confere se o arquivo parece um plano alimentar (para avisar quando o PDF é outra coisa ou é imagem escaneada) */
export function dietProblems(d: Diet, pages: PdfPage[]): string[] {
  const out: string[] = [];
  const chars = pages.reduce((s, p) => s + p.items.reduce((a, i) => a + i.s.length, 0), 0);
  if (chars < 40) out.push('scan');
  else if (!d.meals.length) out.push('nomeals');
  return out;
}
