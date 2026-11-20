import type { PdfPage } from './diet-parse';
import { pageRules } from './pdf-rules';

/*
 * Lê o PDF no próprio navegador (nada é enviado para fora): extrai o texto com posição e
 * desenha miniaturas das páginas para a animação de leitura. O pdf.js só é baixado quando usado.
 */
export type PdfRead = { pages: PdfPage[]; thumbs: string[]; name: string; size: number };

/** recursos novos do JavaScript que o pdf.js pode usar e o Safari do iPhone ainda não tem */
function polyfill() {
  for (const C of [Map, WeakMap] as unknown as { prototype: Record<string, unknown> }[]) {
    const p = C.prototype as { has(k: unknown): boolean; get(k: unknown): unknown; set(k: unknown, v: unknown): unknown } & Record<string, unknown>;
    if (typeof p['getOrInsert'] !== 'function') Object.defineProperty(p, 'getOrInsert', { configurable: true, writable: true, value(this: typeof p, k: unknown, v: unknown) { if (!this.has(k)) this.set(k, v); return this.get(k); } });
    if (typeof p['getOrInsertComputed'] !== 'function') Object.defineProperty(p, 'getOrInsertComputed', { configurable: true, writable: true, value(this: typeof p, k: unknown, fn: (k: unknown) => unknown) { if (!this.has(k)) this.set(k, fn(k)); return this.get(k); } });
  }
  const P = Promise as unknown as Record<string, unknown>;
  if (typeof P['withResolvers'] !== 'function') P['withResolvers'] = function () { let resolve!: (v: unknown) => void, reject!: (e: unknown) => void; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
}

export async function readPdf(file: File, maxThumbs = 4): Promise<PdfRead> {
  if (file.size > 25 * 1024 * 1024) throw new Error('O PDF é muito grande (máximo 25 MB).');
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (String.fromCharCode(...head) !== '%PDF-') throw new Error('Este arquivo não é um PDF.');
  polyfill();
  // edição "legacy" (compatível com Safari/iPhone mais antigos) e leitura na própria página, sem worker separado:
  // assim o remendo acima vale também para a parte que lê o arquivo
  const worker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
  (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = worker;
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  let doc;
  try { doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise; }
  catch (e) { throw new Error((e as { name?: string })?.name === 'PasswordException' ? 'Este PDF tem senha. Exporte de novo sem senha.' : 'Não foi possível abrir este PDF.'); }
  const pages: PdfPage[] = [], thumbs: string[] = [];
  const n = Math.min(doc.numPages, 40);
  for (let i = 1; i <= n; i++) {
    const page = await doc.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    const ol = await page.getOperatorList(); // carrega as fontes (para saber o que está em negrito) e as bordas de tabela
    const tc = await page.getTextContent();
    const font = (f: string) => { try { return String((page.commonObjs.get(f) as { name?: string } | undefined)?.name ?? ''); } catch { return ''; } };
    const items = [];
    for (const t of tc.items) {
      if (!('str' in t) || !t.str.trim()) continue;
      const tr = t.transform as number[];
      items.push({ s: t.str, x: tr[4]!, y: vp.height - tr[5]!, w: t.width, h: t.height, bold: /bold|black|heavy|semibold/i.test(font(t.fontName)) || undefined, rot: Math.abs(tr[1]!) > 0.01 || undefined });
    }
    let rules: NonNullable<PdfPage['rules']> = [];
    try { rules = pageRules(ol.fnArray, ol.argsArray, pdfjs.OPS as unknown as Record<string, number>, vp.height); } catch { /* sem bordas: o leitor usa só o texto */ }
    pages.push(rules.length ? { w: vp.width, h: vp.height, items, rules } : { w: vp.width, h: vp.height, items });
    if (i <= maxThumbs) {
      try {
        const s = 260 / vp.width, v2 = page.getViewport({ scale: s });
        const c = document.createElement('canvas'); c.width = Math.round(v2.width); c.height = Math.round(v2.height);
        await page.render({ canvas: c, canvasContext: c.getContext('2d')!, viewport: v2 }).promise;
        thumbs.push(c.toDataURL('image/jpeg', 0.72));
      } catch { /* miniatura é só enfeite */ }
    }
    page.cleanup();
  }
  void doc.destroy();
  return { pages, thumbs, name: file.name, size: file.size };
}
