import type { PdfPage } from './diet-parse';

/*
 * Lê o PDF no próprio navegador (nada é enviado para fora): extrai o texto com posição e
 * desenha miniaturas das páginas para a animação de leitura. O pdf.js só é baixado quando usado.
 */
export type PdfRead = { pages: PdfPage[]; thumbs: string[]; name: string; size: number };

export async function readPdf(file: File, maxThumbs = 4): Promise<PdfRead> {
  if (file.size > 25 * 1024 * 1024) throw new Error('O PDF é muito grande (máximo 25 MB).');
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (String.fromCharCode(...head) !== '%PDF-') throw new Error('Este arquivo não é um PDF.');
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  let doc;
  try { doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise; }
  catch (e) { throw new Error((e as { name?: string })?.name === 'PasswordException' ? 'Este PDF tem senha. Exporte de novo sem senha.' : 'Não foi possível abrir este PDF.'); }
  const pages: PdfPage[] = [], thumbs: string[] = [];
  const n = Math.min(doc.numPages, 40);
  for (let i = 1; i <= n; i++) {
    const page = await doc.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    await page.getOperatorList(); // carrega as fontes (para saber o que está em negrito)
    const tc = await page.getTextContent();
    const font = (f: string) => { try { return String((page.commonObjs.get(f) as { name?: string } | undefined)?.name ?? ''); } catch { return ''; } };
    const items = [];
    for (const t of tc.items) {
      if (!('str' in t) || !t.str.trim()) continue;
      const tr = t.transform as number[];
      items.push({ s: t.str, x: tr[4]!, y: vp.height - tr[5]!, w: t.width, h: t.height, bold: /bold|black|heavy|semibold/i.test(font(t.fontName)) || undefined, rot: Math.abs(tr[1]!) > 0.01 || undefined });
    }
    pages.push({ w: vp.width, h: vp.height, items });
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
