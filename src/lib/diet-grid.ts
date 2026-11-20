/*
 * Leitor de plano alimentar montado como TABELA (Word/Canva/PDF de consultório):
 *
 *   CAFÉ DA MANHÃ: 8:00 / 8:30h – PRÉ TREINO            ← título da refeição (faixa acima do cabeçalho)
 *   PREPARAÇÃO | ALIMENTO | QUANTIDADES | MEDIDAS CASEIRAS   ← cabeçalho: diz onde fica cada coluna
 *   CARBOIDRATOS | Pão francês | 50g | -                   ← grupo (célula mesclada) + alimento
 *                |            OU                          ← linha "OU": troca do alimento de cima
 *                | Cuscuz (indicação de marca…) | 100g | -
 *                |            +                           ← linha "+": próximo grupo da refeição
 *   (OPÇÃO 1 – DIAS DE TREINO) WRAP | … OU … (OPÇÃO 2 …)  ← opções diferentes da mesma refeição
 *
 * Cada célula tem várias linhas de texto; as bordas da tabela (page.rules) mostram onde uma célula termina.
 * Sem bordas, as células são separadas pelas linhas "OU"/"+" e pelas quantidades.
 * Células que continuam na página seguinte são juntadas. Função pura (src/test/diet-grid.test.ts).
 */
import { MEAL_NAME, did, emptyDiet, fixWords, normTime, normTxt, type Diet, type DietFood, type DietMeal, type DietSub, type PdfItem, type PdfPage } from './diet-parse';

type Role = 'prep' | 'food' | 'qty' | 'measure' | 'other';
type Col = { role: Role; c: number };
type L = { s: string; y: number };
type Band = { kind: 'band'; pos: number; page: number; food: L[]; qty: L[]; measure: L[] };
type Ev = Band | { kind: 'sep'; pos: number; or: boolean } | { kind: 'meal'; pos: number; text: string } | { kind: 'loose'; pos: number; text: string };

const clean = (s: string) => String(s ?? '').replace(/\s+/g, ' ').trim();
const isDash = (s: string) => /^[-–—]+$/.test(clean(s));
const POS = (page: number, y: number) => page * 10000 + y;

function roleOf(s: string): Role | null {
  const n = normTxt(s).replace(/[:.]/g, '').trim();
  if (/^(alimentos?|itens?|item|opcoes de alimentos)$/.test(n)) return 'food';
  if (/^(quantidades?|qtd|qtde|quant|gramas|gramagem|peso|porcao|porcoes|gramas\/ml)$/.test(n)) return 'qty';
  if (/^(medidas?( caseiras?)?|caseiras?|medida usual)$/.test(n)) return 'measure';
  if (/^(preparacao|preparacoes|grupos?( alimentares?)?|categorias?|tipo|macronutrientes?|nutrientes?)$/.test(n)) return 'prep';
  if (/^(kcal|calorias|energia|observacao|observacoes|obs)$/.test(n)) return 'other';
  return null;
}

/* ---------- texto: maiúsculas → frase, erros comuns ---------- */
const TYPO: [RegExp, string][] = [
  [/\bfr[aâ]nces\b/gi, 'francês'], [/\bxicaras?\b/gi, 'xícara'], [/\bsui[ií]no\b/gi, 'suíno'], [/\bhight\b/gi, 'high'], [/\bairfyer\b/gi, 'airfryer'],
  [/\blactea\b/gi, 'láctea'], [/\ba[cç]ai\b/gi, 'açaí'], [/\bprote[ií]co\b/gi, 'proteico'], [/\bmo[ií]da\b/gi, 'moída'],
];
const typo = (s: string) => TYPO.reduce((t, [re, to]) => t.replace(re, to), s);
/** "PÃO FRANCÊS" → "Pão francês" (texto todo em maiúsculas vira frase; o resto fica como veio) */
function sc(s: string): string {
  let t = clean(fixWords(s));
  const letters = t.replace(/[^A-Za-zÀ-ÿ]/g, ''), up = letters.replace(/[^A-ZÀ-Þ]/g, '');
  if (letters.length >= 2 && up.length / letters.length > 0.6) t = t.toLowerCase();
  t = typo(t);
  return t.replace(/^[^A-Za-zÀ-ÿ0-9]*[a-zà-ÿ]/, (c) => c.toUpperCase());
}
const lc = (s: string) => typo(clean(s).toLowerCase());

/* ---------- linhas de texto de um conjunto de pedaços (mesma altura = mesma linha) ---------- */
function rowsOf(items: PdfItem[]): { y: number; h: number; cells: { s: string; x: number; x2: number }[]; items: PdfItem[] }[] {
  const rows: PdfItem[][] = [];
  for (const it of [...items].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const r = rows.find((x) => Math.abs(x[0]!.y - it.y) <= Math.max(2, it.h * 0.35));
    if (r) r.push(it); else rows.push([it]);
  }
  return rows.map((r) => {
    r.sort((a, b) => a.x - b.x);
    const cells: { s: string; x: number; x2: number }[] = [];
    for (const it of r) {
      const last = cells.at(-1), gap = last ? it.x - last.x2 : Infinity, sz = Math.max(4, it.h || 8);
      if (last && gap < sz * 1.6) { last.s = last.s + (gap > sz * 0.15 && !/\s$/.test(last.s) && !/^\s/.test(it.s) ? ' ' : '') + it.s; last.x2 = Math.max(last.x2, it.x + it.w); }
      else cells.push({ s: it.s, x: it.x, x2: it.x + it.w });
    }
    for (const c of cells) c.s = clean(c.s);
    return { y: r[0]!.y, h: Math.max(...r.map((i) => i.h || 8)), cells, items: r };
  });
}
const linesOf = (items: PdfItem[]): L[] => rowsOf(items).map((r) => ({ s: clean(r.cells.map((c) => c.s).join(' ')), y: r.y })).filter((l) => l.s);

/** título de refeição? (horário ou nome de refeição) */
const looksMeal = (s: string) => { const t = clean(s); return /\d{1,2}\s*[:h]\s*\d{2}|\b\d{1,2}\s*h\b/i.test(t) || MEAL_NAME.test(t) || /^refei[cç][aã]o\b/i.test(t); };

/* =========================================================
   1. páginas → sequência de eventos (refeição, célula, separador, texto solto)
   ========================================================= */
type Stats = { bordered: number; rows: number; withQty: number };
function events(pages: PdfPage[]): { evs: Ev[]; found: boolean; st: Stats } {
  const st: Stats = { bordered: 0, rows: 0, withQty: 0 };
  const evs: Ev[] = [];
  let cols: Col[] | null = null, inTable = false;
  // cabeçalho/rodapé repetido nas páginas (logo, contato) não é conteúdo
  const rep = new Map<string, number>();
  if (pages.length > 2) for (const p of pages) for (const k of new Set(p.items.map((i) => clean(i.s) + '@' + Math.round(i.y)))) rep.set(k, (rep.get(k) ?? 0) + 1);
  const minRep = Math.max(3, Math.ceil(pages.length * 0.6));

  pages.forEach((p, pi) => {
    const items = p.items.filter((i) => clean(i.s) && !i.rot && !((rep.get(clean(i.s) + '@' + Math.round(i.y)) ?? 0) >= minRep && (i.y < p.h * 0.14 || i.y > p.h * 0.86)));
    const rows = rowsOf(items);
    const used = new Set<PdfItem>();
    // cabeçalhos da tabela nesta página (e o título de refeição logo acima de cada um)
    const heads: { y: number; cols: Col[]; title: string | null; titleY: number }[] = [];
    rows.forEach((r, ri) => {
      const roles = r.cells.map((c) => roleOf(c.s));
      if (!roles.includes('food') || !(roles.includes('qty') || roles.includes('measure'))) return;
      const hc: Col[] = r.cells.flatMap((c, i) => (roles[i] ? [{ role: roles[i]!, c: (c.x + c.x2) / 2 }] : []));
      r.items.forEach((i) => used.add(i));
      const above = rows.slice(0, ri).reverse().find((x) => r.y - x.y < r.h * 4.5 && !x.items.some((i) => used.has(i)));
      let title: string | null = null, titleY = r.y;
      if (above && looksMeal(above.cells.map((c) => c.s).join(' '))) { title = clean(above.cells.map((c) => c.s).join(' ')); titleY = above.y; above.items.forEach((i) => used.add(i)); }
      heads.push({ y: r.y, cols: hc, title, titleY });
    });
    if (!cols && !heads.length) { for (const r of rows) evs.push({ kind: 'loose', pos: POS(pi, r.y), text: clean(r.cells.map((c) => c.s).join(' ')) }); return; }

    // partes da página: [início, cabeçalho1), [cabeçalho1, cabeçalho2)… cada uma com as colunas do seu cabeçalho
    const cuts = [{ y: -Infinity, cols, title: null as string | null, titleY: -Infinity }, ...heads.map((h) => ({ y: h.titleY - 0.5, cols: h.cols as Col[] | null, title: h.title, titleY: h.titleY }))];
    cuts.forEach((cut, ci) => {
      const end = cuts[ci + 1]?.y ?? Infinity;
      if (cut.title != null) { evs.push({ kind: 'meal', pos: POS(pi, cut.titleY), text: cut.title }); inTable = true; }
      else if (ci > 0 && !inTable) { evs.push({ kind: 'meal', pos: POS(pi, cut.titleY), text: '' }); inTable = true; }
      if (ci > 0) { cols = cut.cols; inTable = true; }
      const part = items.filter((i) => !used.has(i) && i.y > cut.y && i.y <= end);
      if (!part.length) return;
      if (!cols || !inTable) { for (const l of linesOf(part)) evs.push({ kind: 'loose', pos: POS(pi, l.y), text: l.s }); return; }
      tablePart(evs, p, pi, part, cols, st);
    });
  });
  return { evs, found: evs.some((e) => e.kind === 'band'), st };
}

/** uma parte de tabela (mesmas colunas): bordas → células; texto fora da tabela vira texto solto */
function tablePart(evs: Ev[], p: PdfPage, pi: number, part: PdfItem[], cols: Col[], st: Stats) {
  const colOf = (it: PdfItem): Role => { const c = it.x + it.w / 2; let best = cols[0]!; for (const k of cols) if (Math.abs(k.c - c) < Math.abs(best.c - c)) best = k; return best.role; };
  const food = cols.find((c) => c.role === 'food')!;
  const sorted = [...cols].sort((a, b) => a.c - b.c), fi = sorted.indexOf(food);
  const fx1 = fi > 0 ? (sorted[fi - 1]!.c + food.c) / 2 : food.c - 60, fx2 = fi < sorted.length - 1 ? (sorted[fi + 1]!.c + food.c) / 2 : food.c + 60, fw = fx2 - fx1;
  // bordas que atravessam a coluna do alimento (um sublinhado curto não conta)
  const ys = (p.rules ?? []).filter((r) => r.x1 <= fx1 + fw * 0.25 && r.x2 >= fx2 - fw * 0.25).map((r) => r.y).sort((a, b) => a - b)
    .filter((y, i, a) => i === 0 || y - a[i - 1]! > 1.5);
  const yMin = Math.min(...part.map((i) => i.y)), yMax = Math.max(...part.map((i) => i.y));
  const inner = ys.filter((y) => y >= yMin - 40 && y <= yMax + 40);
  const top = inner.length >= 2 ? inner[0]! : -Infinity, bottom = inner.length >= 2 ? inner.at(-1)! : Infinity;
  const mid = (i: PdfItem) => i.y - (i.h || 8) * 0.3;
  const table = part.filter((i) => mid(i) > top - 2 && mid(i) <= bottom + 2), loose = part.filter((i) => !table.includes(i));
  for (const l of linesOf(loose.filter((i) => i.y < (top === -Infinity ? 0 : top)))) evs.push({ kind: 'loose', pos: POS(pi, l.y), text: l.s });

  // coluna "preparação": texto do grupo, com posição (o grupo é decidido depois)
  const prep = table.filter((i) => colOf(i) === 'prep');
  for (const l of linesOf(prep)) evs.push({ kind: 'loose', pos: POS(pi, l.y), text: '\u0000prep\u0000' + l.s });
  const body = table.filter((i) => colOf(i) !== 'prep' && colOf(i) !== 'other');
  const mk = (its: PdfItem[], y: number): Band => ({ kind: 'band', pos: POS(pi, y), page: pi, food: linesOf(its.filter((i) => colOf(i) === 'food')), qty: linesOf(its.filter((i) => colOf(i) === 'qty')), measure: linesOf(its.filter((i) => colOf(i) === 'measure')) });
  const push = (b: Band) => {
    const all = [...b.food, ...b.qty, ...b.measure];
    if (!all.length) return;
    const n = normTxt(all.map((l) => l.s).join(' '));
    if (n === 'ou' || n === '+' || n === 'e' || n === 'ou entao') evs.push({ kind: 'sep', pos: b.pos, or: n !== '+' && n !== 'e' });
    else evs.push(b);
  };
  if (inner.length >= 2) {
    st.bordered++;
    for (let k = 0; k < inner.length - 1; k++) push(mk(body.filter((i) => mid(i) > inner[k]! && mid(i) <= inner[k + 1]!), inner[k]!));
  } else {
    // sem bordas: separa nas linhas "OU"/"+" e, dentro de cada pedaço, pelas quantidades
    let cur: PdfItem[] = [];
    const flush = () => {
      if (!cur.length) return;
      const anchors = linesOf(cur.filter((i) => colOf(i) === 'qty')).map((l) => l.y);
      const cutsY = anchors.slice(1).map((y, k) => (anchors[k]! + y) / 2);
      const bounds = [-Infinity, ...cutsY, Infinity];
      for (let k = 0; k < bounds.length - 1; k++) { const its = cur.filter((i) => i.y > bounds[k]! && i.y <= bounds[k + 1]!); if (its.length) push(mk(its, Math.min(...its.map((i) => i.y)) - 1)); }
      cur = [];
    };
    for (const r of rowsOf(body)) {
      const n = normTxt(r.cells.map((c) => c.s).join(' '));
      // para conferir se é mesmo tabela: a linha tem algo nas colunas de quantidade/medida?
      if (n !== 'ou' && n !== '+') { st.rows++; if (r.items.some((i) => (colOf(i) === 'qty' || colOf(i) === 'measure') && !isDash(i.s))) st.withQty++; }
      if (n === 'ou' || n === '+') { flush(); evs.push({ kind: 'sep', pos: POS(pi, r.y), or: n === 'ou' }); } else cur.push(...r.items);
    }
    flush();
  }
  for (const l of linesOf(loose.filter((i) => i.y >= (top === -Infinity ? 0 : top)))) evs.push({ kind: 'loose', pos: POS(pi, l.y), text: l.s });
}

/* =========================================================
   2. células → alimentos
   ========================================================= */
const CATS = new Set(['aves', 'ovos', 'queijos', 'frutos do mar', 'suino', 'suinos', 'suiino', 'peixes', 'carnes', 'laticinios', 'molhos', 'frutas', 'verduras', 'legumes', 'cereais', 'paes', 'oleaginosas', 'bebidas', 'graos', 'proteinas', 'carboidratos', 'gorduras', 'suplementos']);
/** linhas de uma célula → nome + detalhe ("Cuscuz de milho" + "Indicação de marca: Mano Velho") */
function nameDetail(lines: string[]): { name: string; detail?: string } {
  const ls = lines.map(clean).filter(Boolean);
  const details: string[] = [];
  if (ls.length > 1) {
    const h = normTxt(ls[0]!).replace(/:\s*$/, '');
    if (CATS.has(h)) ls.shift();
    else if (/:\s*$/.test(ls[0]!)) { const head = ls.shift()!.replace(/:\s*$/, ''); details.push(ls.join(' ')); ls.splice(0, ls.length, head); }
  }
  let t = clean(ls.join(' '));
  t = t.replace(/\(([^()]*)\)/g, (_m, d: string) => { if (clean(d)) details.push(d); return ' '; });
  t = clean(t.replace(/[()]/g, ' ')).replace(/^[-–—•]\s*/, '');
  // instrução no meio do nome ("… ACRESCENTAR 1 COLHER …") vai para o detalhe, inteira
  const how = t.match(/^(.+?)\s+((?:acrescentar|adicionar|colocar|pode|usar|evitar)\b.*)$/i);
  if (how) { t = how[1]!; details.push(how[2]!); }
  const dash = t.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (dash) { t = dash[1]!; details.unshift(dash[2]!); }
  const name = sc(t.replace(/[\s,;:/-]+$/, ''));
  const detail = details.map((d) => sc(d.replace(/^[\s:–—-]+|[\s,;:–—-]+$/g, ''))).filter(Boolean).join(' · ');
  return detail ? { name, detail } : { name };
}
const full = (a: { name: string; detail?: string | undefined }) => (a.detail ? `${a.name} (${a.detail})` : a.name);
/** "100g" + "2 unidades" → "2 unidades (100g)" */
function qtyOf(q: L[], m: L[]): string {
  const qs = lc(q.map((l) => l.s).filter((s) => !isDash(s)).join(' ')), ms = lc(m.map((l) => l.s).filter((s) => !isDash(s)).join(' '));
  if (qs && ms) return /^\d+(?:[.,]\d+)?\s*(?:g|ml)$/.test(qs) ? `${ms} (${qs.replace(/\s+/g, '')})` : `${qs} · ${ms}`;
  return qs || ms;
}
/** divide as linhas de uma célula nas linhas que são só "OU" */
const splitOr = (ls: string[]) => ls.reduce<string[][]>((acc, s) => { if (normTxt(s) === 'ou') acc.push([]); else acc.at(-1)!.push(s); return acc; }, [[]]).filter((x) => x.length);
/** "TANGERINA (1) OU ABACAXI (150g) OU …": cada fruta com a sua quantidade */
function inlineAlts(text: string): DietSub[] | null {
  const parts = clean(text).split(/\s+ou\s+/i);
  if (parts.length < 2) return null;
  const out: DietSub[] = [];
  for (const p of parts) {
    const m = p.match(/^(.+?)\s*\(\s*(\d+(?:[.,]\d+)?)\s*(g|gr|ml|kg|unid\w*)?\s*\)$/i);
    if (!m) return null;
    const n = Number(m[2]!.replace(',', '.'));
    out.push({ name: sc(m[1]!), qty: m[3] ? `${m[2]}${/^unid/i.test(m[3]) ? ` ${m[3].toLowerCase()}` : m[3].toLowerCase().replace('gr', 'g')}` : `${m[2]} ${n > 1 ? 'unidades' : 'unidade'}` });
  }
  return out;
}
const food = (a: { name: string; detail?: string | undefined }, qty: string, subs: DietSub[] = []): DietFood => ({ id: did('f'), name: a.name, ...(a.detail ? { detail: a.detail } : {}), qty, subs });
const sub = (a: { name: string; detail?: string | undefined }, qty: string): DietSub => ({ name: a.name, ...(a.detail ? { detail: a.detail } : {}), qty });

function rowFoods(b: Band): DietFood[] {
  const alts = splitOr(b.food.map((l) => l.s)).map(nameDetail).filter((a) => a.name);
  if (!alts.length) return [];
  const mText = clean(b.measure.map((l) => l.s).join(' '));
  // "ESCOLHER: 4 OVOS OU 3 OVOS + 30g DE QUEIJO OU …"
  if (/^escolha|^escolher/i.test(mText)) {
    const ls = b.measure.map((l) => l.s.replace(/^escolh(?:a|er)\s*:?\s*/i, '')).filter((s) => clean(s));
    const opts = splitOr(ls).map((o) => lc(o.join(' ')).replace(/\s*\+\s*/g, ' + '));
    if (opts.length > 1) {
      const others = alts.slice(1).map(full).join(' · ');
      return [food(alts[0]!, opts[0]!, opts.slice(1).map((o) => sub({ name: sc(o), ...(others ? { detail: others } : {}) }, '')))];
    }
    const parts = (opts[0] ?? '').split(/\s+\+\s+/);
    if (alts.length > 1 && parts.length === alts.length) return alts.map((a, i) => food(a, parts[i]!.match(/^(\d+(?:[.,]\d+)?\s*(?:g|ml|kg))\b/i)?.[1]?.replace(/\s+/g, '') ?? parts[i]!));
    return [food(alts[0]!, opts[0] ?? '', alts.slice(1).map((a) => sub(a, '')))];
  }
  const qty = qtyOf(b.qty, b.measure);
  if (alts.length > 1) return [food(alts[0]!, qty, alts.slice(1).map((a) => sub(a, qty)))];
  const inl = inlineAlts(b.food.map((l) => l.s).join(' '));
  if (inl) return [food(inl[0]!, inl[0]!.qty, inl.slice(1))];
  return [food(alts[0]!, qty)];
}
/** um grupo (entre "+"): pedaços separados por "OU" viram trocas do primeiro alimento */
function groupFoods(segs: Band[][]): DietFood[] {
  const segFoods = segs.map((s) => s.flatMap(rowFoods)).filter((f) => f.length);
  const main = segFoods[0] ?? [];
  if (!main.length) return [];
  for (const fs of segFoods.slice(1)) {
    if (fs.length === 1) main[0]!.subs.push(sub(fs[0]!, fs[0]!.qty), ...fs[0]!.subs);
    else main[0]!.subs.push({ name: fs.map((f) => f.name).join(' + '), qty: fs.map((f) => f.qty).filter(Boolean).join(' + ') });
  }
  return main;
}

/* ---------- título da refeição: "CAFÉ DA MANHÃ: 8:00 / 8:30h – PRÉ TREINO" ---------- */
function mealHead(text: string, n: number): { name: string; time: string | null; note: string } {
  const t = clean(text), times = [...t.matchAll(/(\d{1,2})\s*(?::|h)\s*(\d{2})/gi)];
  const first = times[0], last = times.at(-1);
  let name = first ? t.slice(0, first.index) : t, extra = last ? t.slice(last.index! + last[0].length) : '';
  extra = extra.replace(/^\s*h\b/i, '').replace(/^[\s:/|–—-]+/, '');
  if (!first) { const m = name.match(/^(.+?)\s+[-–—|]\s+(.+)$/); if (m) { name = m[1]!; extra = m[2]!; } }
  name = sc(name.replace(/(?:\s*[-–—:|/]\s*|\s+[àa]s?)+$/i, '').replace(/\bh$/i, ''));
  const tm = (m: RegExpMatchArray) => normTime(`${m[1]}:${m[2]}`)!;
  const note = [extra ? sc(extra) : '', times.length >= 2 ? `Horário: entre ${tm(first!)} e ${tm(last!)}` : ''].filter(Boolean).join('\n');
  return { name: name || `Refeição ${n}`, time: first ? tm(first) : null, note };
}

/* ---------- coluna "preparação": nome do grupo, observações e opções ---------- */
const RE_OPT = /^\(?\s*op[cç][aã]o\s*(\d+|[a-e])\b\s*[-–—:]?\s*/i;
function prepInfo(text: string): { note: string; optLabel: string | null } {
  let t = clean(text), optLabel: string | null = null;
  const om = t.match(/^\(\s*(op[cç][aã]o\s*(?:\d+|[a-e])\b[^)]*)\)/i) ?? t.match(/^(op[cç][aã]o\s*(?:\d+|[a-e])\b[^(]*?)(?=\s+[A-ZÀ-Ý]{3,}\s*$|$)/i);
  if (om) { const desc = clean(om[1]!.replace(RE_OPT, '')); optLabel = desc && desc.length <= 32 ? sc(desc) : sc(om[1]!.match(/op[cç][aã]o\s*(?:\d+|[a-e])/i)![0]); t = clean(t.slice(om.index! + om[0].length)); }
  const parens: string[] = [];
  const label = clean(t.replace(/\(([^()]*)\)/g, (_m, d: string) => { parens.push(d); return ' '; }).replace(/[()]/g, ' '));
  let note = '';
  if (parens.length) note = `${label ? sc(label) + ': ' : ''}${parens.map((x) => lc(x)).join(' · ')}`;
  else if (optLabel && label) note = sc(label);
  return { note, optLabel };
}

/* =========================================================
   3. eventos → plano
   ========================================================= */
export function parseGrid(pages: PdfPage[]): Diet | null {
  const { evs, found, st } = events(pages);
  if (!found) return null;
  // sem bordas, só é tabela se quase toda linha tem quantidade (senão é texto livre com um cabeçalho, para o leitor comum)
  if (!st.bordered && st.rows && st.withQty / st.rows < 0.7) return null;
  // célula cortada pela quebra de página: o pedaço sem quantidade se junta ao outro
  for (let i = evs.length - 1; i > 0; i--) {
    const b = evs[i]!;
    if (b.kind !== 'band') continue;
    let j = i - 1;
    while (j >= 0 && evs[j]!.kind === 'loose' && (evs[j] as { text: string }).text.startsWith('\u0000prep')) j--;
    const a = evs[j];
    if (!a || a.kind !== 'band' || a.page === b.page) continue;
    if (b.page !== a.page + 1 || evs.slice(j + 1, i).some((e) => e.kind !== 'loose') || evs.some((e) => e.kind === 'band' && e.page === a.page && e.pos > a.pos) || evs.some((e) => e.kind === 'band' && e.page === b.page && e.pos < b.pos)) continue;
    const empty = (x: Band) => !x.qty.some((l) => !isDash(l.s)) && !x.measure.some((l) => !isDash(l.s));
    if (!empty(a) && !empty(b)) continue;
    a.food.push(...b.food); a.qty.push(...b.qty); a.measure.push(...b.measure);
    evs.splice(i, 1);
  }

  const d: Diet = { ...emptyDiet(), source: 'pdf' };
  type Acc = { head: string; items: (Band | { kind: 'sep'; pos: number; or: boolean })[]; prep: L[] };
  const accs: Acc[] = [];
  const intro: string[] = [], after: string[] = [];
  for (const e of evs) {
    if (e.kind === 'meal') { accs.push({ head: e.text, items: [], prep: [] }); continue; }
    const cur = accs.at(-1);
    if (e.kind === 'loose') {
      if (e.text.startsWith('\u0000prep\u0000')) { cur?.prep.push({ s: e.text.slice(6), y: e.pos }); continue; }
      (cur ? after : intro).push(e.text);
      continue;
    }
    if (!cur) accs.push({ head: '', items: [e], prep: [] }); else cur.items.push(e);
  }

  accs.forEach((acc, ai) => {
    const h = mealHead(acc.head, ai + 1);
    // grupos (entre "+") com seus pedaços (entre "OU") e o texto da coluna preparação
    type Group = { start: number; end: number; segs: Band[][]; ors: number[]; prep: L[] };
    const groups: Group[] = [{ start: -Infinity, end: Infinity, segs: [[]], ors: [], prep: [] }];
    for (const it of acc.items) {
      const g = groups.at(-1)!;
      if (it.kind === 'sep' && !it.or) { g.end = it.pos; groups.push({ start: it.pos, end: Infinity, segs: [[]], ors: [], prep: [] }); }
      else if (it.kind === 'sep') { g.ors.push(it.pos); g.segs.push([]); }
      else g.segs.at(-1)!.push(it);
    }
    for (const g of groups) g.segs = g.segs.filter((s) => s.length);
    for (const l of acc.prep) (groups.find((g) => l.y > g.start && l.y < g.end) ?? groups.at(-1)!).prep.push(l);

    // opções da refeição: "(OPÇÃO 1 – …)" na coluna preparação, ou uma tabela só com blocos alternativos
    type Part = { label: string | null; foods: DietFood[]; notes: string[] };
    const common: { foods: DietFood[]; notes: string[]; before: boolean }[] = [];
    let variants: Part[] | null = null;
    groups.forEach((g) => {
      const chunks: { y: number; lines: string[] }[] = [];
      for (const l of g.prep) { if (RE_OPT.test(l.s) || !chunks.length) chunks.push({ y: l.y, lines: [l.s] }); else chunks.at(-1)!.lines.push(l.s); }
      const optChunks = chunks.filter((c) => RE_OPT.test(c.lines[0]!));
      let parts: Band[][][] | null = null, infos = chunks.map((c) => prepInfo(c.lines.join(' ')));
      if (!variants && optChunks.length >= 2 && g.segs.length >= 2) {
        // cada opção começa no "OU" logo antes do seu rótulo
        const cutsAt = optChunks.slice(1).map((c) => g.ors.filter((y) => y < c.y).at(-1) ?? null);
        if (cutsAt.every((y) => y != null)) {
          const b = [-Infinity, ...(cutsAt as number[]), Infinity];
          parts = b.slice(0, -1).map((y0, k) => g.segs.filter((s) => s[0]!.pos > y0 && s[0]!.pos < b[k + 1]!));
          infos = optChunks.map((c) => prepInfo(c.lines.join(' ')));
        }
      } else if (!variants && groups.length === 1 && g.segs.length >= 2 && g.segs.some((s) => s.length > 1)) {
        parts = g.segs.map((s) => [s]);
        infos = parts.map((_p, k) => (k === 0 ? (infos[0] ?? { note: '', optLabel: null }) : { note: '', optLabel: null }));
      }
      if (parts && parts.every((p) => p.length)) {
        variants = parts.map((p, k) => ({ label: infos[k]?.optLabel ?? null, foods: groupFoods(p), notes: infos[k]?.note ? [infos[k]!.note] : [] }));
        return;
      }
      common.push({ foods: groupFoods(g.segs), notes: infos.map((x) => x.note).filter(Boolean), before: !variants });
    });
    const vs: Part[] = (variants as Part[] | null) ?? [{ label: null, foods: [], notes: [] }];
    const meal: DietMeal = {
      id: did('m'), time: h.time, name: h.name,
      variants: vs.map((v, k) => {
        const pre = common.filter((c) => c.before), post = common.filter((c) => !c.before);
        // alimentos comuns a todas as opções: cópias com ids próprios
        const copy = (fs: DietFood[]) => (k === 0 ? fs : fs.map((f) => ({ ...f, id: did('f'), subs: f.subs.map((s) => ({ ...s })) })));
        return {
          id: did('v'), label: vs.length > 1 ? (v.label ?? `Opção ${k + 1}`) : '',
          foods: [...pre.flatMap((c) => copy(c.foods)), ...v.foods, ...post.flatMap((c) => copy(c.foods))],
          notes: [h.note, ...pre.flatMap((c) => c.notes), ...v.notes, ...post.flatMap((c) => c.notes)].filter(Boolean).join('\n'),
        };
      }),
    };
    if (meal.variants.some((v) => v.foods.length)) d.meals.push(meal);
  });

  const t = intro.find((s) => !/^(?:paciente|nome|data|crn|nutricionista|telefone|e-?mail|@)/i.test(s));
  if (t) d.title = sc(t);
  const rest = [...intro.filter((s) => s !== t && !/^(?:paciente|nome|data|crn|nutricionista|telefone|e-?mail|@)/i.test(s)), ...after].map((s) => fixWords(s));
  if (rest.length) d.sections.push({ id: did('s'), title: 'Orientações', lines: rest });
  return d.meals.length ? d : null;
}
