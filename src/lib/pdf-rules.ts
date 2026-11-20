/*
 * Linhas horizontais desenhadas na página (bordas de tabela). Em PDFs de dieta montados como tabela
 * (Word, Canva…) são elas que dizem onde termina cada célula quando o texto quebra em várias linhas.
 * Função pura sobre a lista de operações do pdf.js (testável sem navegador).
 */
export type PdfRule = { x1: number; x2: number; y: number };

type Ops = Record<string, number>;
type M = [number, number, number, number, number, number];
const mul = (a: M, b: number[]): M => [
  a[0] * b[0]! + a[2] * b[1]!, a[1] * b[0]! + a[3] * b[1]!,
  a[0] * b[2]! + a[2] * b[3]!, a[1] * b[2]! + a[3] * b[3]!,
  a[0] * b[4]! + a[2] * b[5]! + a[4], a[1] * b[4]! + a[3] * b[5]! + a[5],
];

/** bordas horizontais (finas e com pelo menos 8pt de largura), em coordenadas da página com y de cima para baixo */
export function pageRules(fnArray: ArrayLike<number>, argsArray: ArrayLike<unknown>, ops: Ops, pageH: number): PdfRule[] {
  let m: M = [1, 0, 0, 1, 0, 0];
  const stack: M[] = [], out: PdfRule[] = [];
  const pt = (x: number, y: number) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]] as const;
  for (let i = 0; i < fnArray.length; i++) {
    const f = fnArray[i], a = argsArray[i] as unknown[] | null;
    if (f === ops['save']) stack.push(m);
    else if (f === ops['restore']) m = stack.pop() ?? m;
    else if (f === ops['transform'] && a) m = mul(m, a as number[]);
    else if (f === ops['paintFormXObjectBegin']) { stack.push(m); const fm = a?.[0] as number[] | null | undefined; if (fm && fm.length === 6) m = mul(m, Array.from(fm)); }
    else if (f === ops['paintFormXObjectEnd']) m = stack.pop() ?? m;
    else if (f === ops['constructPath'] && a) {
      // pdf.js 5: [operação de desenho, [dados do caminho], [xMin, yMin, xMax, yMax]]; caminho só de recorte não conta
      if (a[0] === ops['endPath']) continue;
      const mm = a[2] as ArrayLike<number> | null | undefined;
      if (!mm || mm.length < 4) continue;
      const p = pt(mm[0]!, mm[1]!), q = pt(mm[2]!, mm[3]!);
      const x1 = Math.min(p[0], q[0]), x2 = Math.max(p[0], q[0]), h = Math.abs(p[1] - q[1]);
      if (h <= 1.6 && x2 - x1 >= 8) out.push({ x1: r1(x1), x2: r1(x2), y: r1(pageH - (p[1] + q[1]) / 2) });
    }
  }
  // a mesma borda costuma vir repetida (célula de cima e de baixo): junta as iguais
  out.sort((a, b) => a.y - b.y || a.x1 - b.x1);
  const uniq: PdfRule[] = [];
  for (const r of out) { const u = uniq.find((x) => Math.abs(x.y - r.y) < 0.8 && r.x1 <= x.x2 + 1 && r.x2 >= x.x1 - 1); if (u) { u.x1 = Math.min(u.x1, r.x1); u.x2 = Math.max(u.x2, r.x2); } else uniq.push({ ...r }); }
  return uniq;
}
const r1 = (n: number) => Math.round(n * 10) / 10;
