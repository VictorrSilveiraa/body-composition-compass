/*
 * Estúdio de imagens: monta, num canvas, as fotos de acompanhamento em formatos para redes sociais
 * (Stories, Feed, Quadrado, Paisagem), com vários arranjos, cores, textos, resultados e privacidade.
 * Só desenho: a tela (src/components/photo-studio.tsx) escolhe as fotos e as opções.
 */
export type FormatKey = 'story' | 'feed' | 'square' | 'wide';
export const FORMATS: Record<FormatKey, { l: string; r: string; w: number; h: number; d: string }> = {
  story: { l: 'Stories e Reels', r: '9:16', w: 1080, h: 1920, d: 'Tela cheia do celular' },
  feed: { l: 'Feed', r: '4:5', w: 1080, h: 1350, d: 'O maior post do feed' },
  square: { l: 'Quadrado', r: '1:1', w: 1080, h: 1080, d: 'Post e carrossel' },
  wide: { l: 'Paisagem', r: '16:9', w: 1920, h: 1080, d: 'YouTube e apresentações' },
};
export const FORMAT_KEYS = Object.keys(FORMATS) as FormatKey[];

export type LayoutKey = 'side' | 'stack' | 'split' | 'single' | 'timeline' | 'grid';
export const LAYOUTS: { k: LayoutKey; l: string; d: string; two: boolean }[] = [
  { k: 'side', l: 'Lado a lado', d: 'Antes e depois, um ao lado do outro', two: true },
  { k: 'stack', l: 'Em cima e embaixo', d: 'Antes em cima, depois embaixo', two: true },
  { k: 'split', l: 'Corte diagonal', d: 'As duas fotos na mesma moldura', two: true },
  { k: 'single', l: 'Uma foto', d: 'Só a foto escolhida, com os resultados', two: false },
  { k: 'timeline', l: 'Linha do tempo', d: 'Até 4 datas na mesma pose', two: true },
  { k: 'grid', l: 'Todas as poses', d: 'Antes e depois de cada pose', two: true },
];

export type ThemeKey = 'light' | 'white' | 'dark' | 'green' | 'blue' | 'peach' | 'sand';
export type Theme = { l: string; bg: string; fg: string; sub: string; card: string; accent: string };
export const THEMES: Record<ThemeKey, Theme> = {
  light: { l: 'Gelo', bg: '#f1f0ec', fg: '#1b1b19', sub: '#6d6d68', card: '#ffffff', accent: '#e9f5d4' },
  white: { l: 'Branco', bg: '#ffffff', fg: '#1b1b19', sub: '#6d6d68', card: '#f3f2ee', accent: '#e9f5d4' },
  dark: { l: 'Grafite', bg: '#151515', fg: '#ffffff', sub: '#a7a7a1', card: '#262626', accent: '#3a4a26' },
  green: { l: 'Verde', bg: '#dcefc7', fg: '#1c2a10', sub: '#4d6a32', card: '#f5fbee', accent: '#c4e39d' },
  blue: { l: 'Azul', bg: '#cfe7ee', fg: '#0f262d', sub: '#3d6772', card: '#f0fafc', accent: '#a9d6e2' },
  peach: { l: 'Pêssego', bg: '#f7d6c2', fg: '#3a1c0e', sub: '#8a5843', card: '#fff4ed', accent: '#f0b896' },
  sand: { l: 'Areia', bg: '#ece5d8', fg: '#2a241b', sub: '#786d5b', card: '#fbf8f2', accent: '#ddd0b6' },
};
export const THEME_KEYS = Object.keys(THEMES) as ThemeKey[];

export type StatKey = 'weight' | 'bf' | 'lean' | 'waist';
export type FaceMode = 'none' | 'blur' | 'crop';
export type Design = {
  format: FormatKey; hd: boolean; layout: LayoutKey; theme: ThemeKey;
  bleed: boolean; // fotos até a borda (sem moldura); os textos ficam por cima, com sombra
  title: string; showTitle: boolean; showName: boolean; showRange: boolean; showLabels: boolean; showDates: boolean;
  stats: StatKey[]; signature: string; showSign: boolean;
  face: FaceMode; faceH: number; // fração do alto da foto escondida (desfocada ou cortada)
  zoom: number; shiftY: number; // 1 a 1,6 · −1 (sobe) a 1 (desce)
  fit: 'cover' | 'contain'; // preencher a moldura (corta as sobras) ou mostrar a foto inteira
};
export const DEFAULT_DESIGN: Design = {
  format: 'feed', hd: false, layout: 'side', theme: 'light', bleed: false,
  title: 'Antes e depois', showTitle: true, showName: false, showRange: true, showLabels: true, showDates: true,
  stats: ['weight', 'bf'], signature: '', showSign: true, face: 'none', faceH: 0.22, zoom: 1, shiftY: 0, fit: 'cover',
};

export type Shot = { img: ImageBitmap | null; label: string; date: string };
export type SceneStat = { k: StatKey; v: string; l: string };
export type Scene = { name: string; shots: Shot[]; range: string; stats: SceneStat[]; grid?: number /* todas as poses: quantas (fotos = antes de cada pose, depois de cada pose) */ };

type R = { x: number; y: number; w: number; h: number };
const FONT = 'Urbanist, system-ui, -apple-system, sans-serif';

/** fonte carregada antes de desenhar (senão o canvas usa a do sistema na primeira vez) */
export async function studioFonts() {
  try { await Promise.all(['400', '500', '600', '700'].map((w) => document.fonts?.load(`${w} 40px Urbanist`))); } catch { /* segue com a do sistema */ }
}

/* grade com células mais próximas de 3:4 (proporção das fotos) */
function bestGrid(n: number, r: R, gap: number) {
  const opts: [number, number][] = [];
  for (let cols = 1; cols <= n; cols++) { const rows = Math.ceil(n / cols); if ((cols - 1) * rows < n) opts.push([cols, rows]); }
  let best = opts[0]!, score = Infinity;
  for (const [c, rw] of opts) {
    const cw = (r.w - gap * (c - 1)) / c, ch = (r.h - gap * (rw - 1)) / rw;
    const s = Math.abs(Math.log((cw / ch) / 0.75)) + (c * rw - n) * 0.35; // célula vazia pesa
    if (s < score) { score = s; best = [c, rw]; }
  }
  return best;
}
function cellsOf(r: R, cols: number, rows: number, gap: number, n: number): R[] {
  const cw = (r.w - gap * (cols - 1)) / cols, ch = (r.h - gap * (rows - 1)) / rows, out: R[] = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols), inRow = Math.min(cols, n - row * cols), off = (cols - inRow) * (cw + gap) / 2; // última linha incompleta fica centralizada
    out.push({ x: r.x + off + (i % cols) * (cw + gap), y: r.y + row * (ch + gap), w: cw, h: ch });
  }
  return out;
}

export function drawStudio(c: HTMLCanvasElement, d: Design, s: Scene, scale = d.hd ? 2 : 1) {
  const F = FORMATS[d.format], W = F.w * scale, H = F.h * scale, T = THEMES[d.theme];
  if (c.width !== W) c.width = W;
  if (c.height !== H) c.height = H;
  const x = c.getContext('2d')!;
  const u = Math.min(W, H) / 1080;
  const font = (w: number, px: number) => `${w} ${Math.round(px * u)}px ${FONT}`;
  const wide = d.format === 'wide';
  x.textBaseline = 'alphabetic';
  x.fillStyle = T.bg; x.fillRect(0, 0, W, H);

  const pad = d.bleed ? 0 : Math.round((wide ? 64 : 60) * u), inner = W - pad * 2;
  const onPhoto = d.bleed; // textos sobre a foto: branco com sombra
  const fg = onPhoto ? '#ffffff' : T.fg, sub = onPhoto ? 'rgba(255,255,255,.85)' : T.sub;
  const align: CanvasTextAlign = wide ? 'left' : 'center';
  const tx = (wide ? Math.round(64 * u) : W / 2);

  /* ---------- medidas do cabeçalho e do rodapé ---------- */
  const title = d.showTitle ? d.title.trim() : '';
  const subLine = [d.showName ? s.name : '', d.showRange ? s.range : ''].filter(Boolean).join('  ·  ');
  let titlePx = wide ? 66 : 70;
  x.font = font(700, titlePx);
  while (title && titlePx > 38 && x.measureText(title).width > W - 128 * u) { titlePx -= 2; x.font = font(700, titlePx); }
  const headH = (title ? titlePx * 1.15 : 0) + (subLine ? 46 : 0);
  const stats = s.stats.filter((t) => d.stats.includes(t.k));
  const statH = stats.length ? (wide ? 132 : 150) : 0;
  const sign = d.showSign ? d.signature.trim() : '';
  const signH = sign ? 58 : 0;
  const top = headH ? (headH + 74) * u : 0, bottom = (statH ? statH + 34 : 0) * u + signH * u + (statH || signH ? 30 * u : 0);

  /* ---------- área das fotos ---------- */
  const area: R = d.bleed ? { x: 0, y: 0, w: W, h: H } : { x: pad, y: pad + top, w: inner, h: H - pad * 2 - top - bottom };
  const gap = d.bleed ? Math.round(6 * u) : Math.round(18 * u);
  const radius = d.bleed ? 0 : 34 * u;
  const shots = s.shots;

  const photo = (img: ImageBitmap | null, r: R, rad = radius, clip?: (ctx: CanvasRenderingContext2D) => void) => {
    x.save();
    x.beginPath(); if (clip) clip(x); else x.roundRect(r.x, r.y, r.w, r.h, rad); x.clip();
    x.fillStyle = onPhoto ? '#2a2a2a' : T.card; x.fillRect(r.x, r.y, r.w, r.h);
    if (img) {
      let sy = 0, sh = img.height; const sw = img.width;
      if (d.face === 'crop') { const cut = sh * d.faceH; sy = cut; sh -= cut; }
      const k = (d.fit === 'contain' ? Math.min(r.w / sw, r.h / sh) : Math.max(r.w / sw, r.h / sh)) * d.zoom, dw = sw * k, dh = sh * k;
      const dx = r.x + (r.w - dw) / 2, free = dh - r.h;
      // ao cortar, prefere a parte de cima do corpo (a posição vertical ajusta)
      const dy = r.y - free * (free > 0 ? Math.min(1, Math.max(0, 0.35 + d.shiftY * 0.65)) : 0.5);
      x.drawImage(img, 0, sy, sw, sh, dx, dy, dw, dh);
      if (d.face === 'blur') {
        // desfoque que funciona em qualquer navegador: reduz muito e amplia de volta, só no alto da foto,
        // com a borda de baixo suave (sem linha reta cortando o rosto)
        const bandH = sh * d.faceH, srcH = Math.min(sh, bandH + sh * 0.07);
        const bw = Math.max(6, Math.round(sw / 30)), bh = Math.max(3, Math.round(srcH / 30));
        const t = document.createElement('canvas'); t.width = bw; t.height = bh;
        const tc = t.getContext('2d')!; tc.imageSmoothingEnabled = true; tc.imageSmoothingQuality = 'high';
        tc.drawImage(img, 0, sy, sw, srcH, 0, 0, bw, bh);
        const o = document.createElement('canvas'); o.width = Math.max(1, Math.round(dw)); o.height = Math.max(1, Math.round(srcH * k));
        const oc = o.getContext('2d')!; oc.imageSmoothingEnabled = true; oc.imageSmoothingQuality = 'high';
        oc.drawImage(t, 0, 0, o.width, o.height);
        oc.globalCompositeOperation = 'destination-in';
        const g = oc.createLinearGradient(0, 0, 0, o.height); g.addColorStop(0, '#000'); g.addColorStop(bandH / srcH, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)');
        oc.fillStyle = g; oc.fillRect(0, 0, o.width, o.height);
        x.drawImage(o, dx, dy, dw, srcH * k);
      }
    }
    x.restore();
  };
  /* rótulo da foto: diminui, quebra em 2 linhas ou corta com reticências para nunca sair da foto */
  let pillMax = 99; // o mesmo tamanho de letra em todos os rótulos da imagem
  const pill = (r: R, shot: Shot, side: 'l' | 'r' = 'l', measure = false): number => {
    let a = d.showLabels ? shot.label : '', b = d.showDates ? shot.date : '';
    if (!a && !b) return 99;
    const m = (r.w < 300 * u ? 12 : 22) * u, padX = 16 * u, maxW = r.w - 2 * m;
    const width = (px: number, two: boolean) => {
      x.font = font(700, px); const wa = a ? x.measureText(a).width : 0;
      x.font = font(500, px); const wb = b ? x.measureText(two || !a ? b : '  ' + b).width : 0;
      return (two ? Math.max(wa, wb) : wa + wb) + padX * 2;
    };
    let px = Math.min(pillMax, r.w < 300 * u ? 24 : 30), two = false;
    while (px > 17 && width(px, false) > maxW && (!a || !b || width(px, true) > maxW)) px -= 1;
    if (measure) return px;
    if (width(px, false) > maxW && a && b) two = true;
    if (width(px, two) > maxW) { x.font = font(700, px); a = a ? fit(x, a, maxW - padX * 2) : a; x.font = font(500, px); b = b ? fit(x, b, maxW - padX * 2) : b; }
    x.font = font(700, px); const wa = a ? x.measureText(a).width : 0;
    const wTot = Math.min(maxW, width(px, two)), hTot = px * (two ? 2.75 : 1.75) * u;
    const px0 = side === 'l' ? r.x + m : r.x + r.w - m - wTot, py0 = r.y + r.h - m - hTot;
    x.fillStyle = 'rgba(255,255,255,.93)'; x.beginPath(); x.roundRect(px0, py0, wTot, hTot, Math.min(hTot / 2, 24 * u)); x.fill();
    x.textAlign = 'left'; x.fillStyle = '#151515';
    if (two) {
      x.font = font(700, px); x.fillText(a, px0 + padX, py0 + px * 1.2 * u);
      x.font = font(500, px); x.fillStyle = '#55554f'; x.fillText(b, px0 + padX, py0 + px * 2.3 * u);
    } else {
      const base = py0 + hTot / 2 + px * 0.36 * u;
      x.font = font(700, px); x.fillText(a, px0 + padX, base);
      x.font = font(500, px); x.fillStyle = '#55554f'; x.fillText((a ? '  ' : '') + b, px0 + padX + wa, base);
    }
    return px;
  };
  /* foto em pé não cabe numa moldura deitada sem cortar a cabeça e as pernas: limita a moldura a 4:5 e centraliza */
  const portrait = (r: R): R => (d.fit === 'cover' && !d.bleed && r.w / r.h > 0.8 ? { x: r.x + (r.w - r.h * 0.8) / 2, y: r.y, w: r.h * 0.8, h: r.h } : r);
  const group = (cells: R[]): R[] => {
    // grupo inteiro estreitado: as molduras ficam juntas no centro em vez de espalhadas
    if (d.fit !== 'cover' || d.bleed || !cells.length || cells[0]!.w / cells[0]!.h <= 0.8) return cells;
    const nw = cells[0]!.h * 0.8, rows = new Map<number, R[]>();
    for (const c of cells) rows.set(Math.round(c.y), [...(rows.get(Math.round(c.y)) ?? []), c]);
    const out: R[] = [];
    for (const row of rows.values()) { const tw = row.length * nw + (row.length - 1) * gap, x0 = area.x + (area.w - tw) / 2; row.forEach((c, i) => out.push({ x: x0 + i * (nw + gap), y: c.y, w: nw, h: c.h })); }
    return out;
  };

  /* ---------- arranjos ---------- */
  const L = d.layout;
  if (L === 'split' && shots.length >= 2) {
    const r = area, a = shots[0]!, b = shots[shots.length - 1]!, t1 = r.x + r.w * 0.58, t2 = r.x + r.w * 0.42;
    const rr = (ctx: CanvasRenderingContext2D) => ctx.roundRect(r.x, r.y, r.w, r.h, radius);
    photo(b.img, r, radius, rr);
    photo(a.img, r, radius, (ctx) => { ctx.moveTo(r.x, r.y); ctx.lineTo(t1, r.y); ctx.lineTo(t2, r.y + r.h); ctx.lineTo(r.x, r.y + r.h); ctx.closePath(); });
    x.save(); x.beginPath(); x.roundRect(r.x, r.y, r.w, r.h, radius); x.clip();
    x.strokeStyle = '#ffffff'; x.lineWidth = 8 * u; x.beginPath(); x.moveTo(t1, r.y - 10); x.lineTo(t2, r.y + r.h + 10); x.stroke(); x.restore();
    const lim = d.bleed ? { h: r.h - bottom - 10 * u } : {};
    pill({ ...r, w: r.w / 2, ...lim }, a, 'l');
    pill({ ...r, ...lim }, b, 'r');
  } else {
    let list = shots, cells: R[];
    if (L === 'single') { list = shots.slice(-1); cells = [portrait(area)]; }
    else if (L === 'side') cells = group(cellsOf(area, Math.min(2, list.length), 1, gap, list.length));
    else if (L === 'stack') cells = cellsOf(area, 1, list.length, gap, list.length);
    else if (L === 'grid' && s.grid) {
      // todas as poses: em pares (antes|depois lado a lado) ou em 2 linhas (antes em cima, depois embaixo) — o que deixar as fotos mais em pé
      const n = s.grid, A = list.slice(0, n), B = list.slice(n);
      const pairs = A.flatMap((sh, i) => [sh, B[i]!]);
      const opts: { cols: number; rows: number; order: Shot[] }[] = [{ cols: n, rows: 2, order: [...A, ...B] }];
      for (let per = 1; per <= n; per++) if (n % per === 0 || per === n) opts.push({ cols: per * 2, rows: Math.ceil(n / per), order: pairs });
      let best = opts[0]!, sc = Infinity;
      for (const o of opts) { const cw = (area.w - gap * (o.cols - 1)) / o.cols, ch = (area.h - gap * (o.rows - 1)) / o.rows, v = Math.abs(Math.log(Math.min(cw / ch, 1.6) / 0.72)) + (cw < 150 * u ? 2 : 0); if (v < sc) { sc = v; best = o; } }
      list = best.order; cells = group(cellsOf(area, best.cols, best.rows, gap, list.length));
    } else { const [cols, rows] = bestGrid(list.length, area, gap); cells = group(cellsOf(area, cols, rows, gap, list.length)); }
    pillMax = Math.min(99, ...list.map((sh, i) => pill(cells[i]!, sh, 'l', true)));
    list.forEach((sh, i) => {
      const r = cells[i]!; photo(sh.img, r);
      // com foto até a borda, o rótulo não pode ficar embaixo dos resultados
      const safe = d.bleed && r.y + r.h > H - bottom - 20 * u ? { ...r, h: Math.max(r.h * 0.4, H - bottom - 20 * u - r.y) } : r;
      pill(safe, sh);
    });
  }

  /* ---------- sombra para texto sobre a foto ---------- */
  if (onPhoto) {
    if (headH) { const g = x.createLinearGradient(0, 0, 0, top + 120 * u); g.addColorStop(0, 'rgba(0,0,0,.62)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, W, top + 120 * u); }
    if (bottom) { const y0 = H - bottom - 140 * u, g = x.createLinearGradient(0, y0, 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.68)'); x.fillStyle = g; x.fillRect(0, y0, W, H - y0); }
  }

  /* ---------- cabeçalho ---------- */
  let y = (d.bleed ? 70 : 0) * u + pad;
  x.textAlign = align;
  if (title) { y += titlePx * 0.95 * u; x.font = font(700, titlePx); x.fillStyle = fg; x.fillText(title, tx, y); y += titlePx * 0.2 * u; }
  if (subLine) { y += 40 * u; x.font = font(500, 30); x.fillStyle = sub; x.fillText(fit(x, subLine, W - 128 * u), tx, y); }

  /* ---------- resultados e assinatura ---------- */
  let yb = H - pad - (d.bleed ? 46 * u : 0);
  if (sign) { x.textAlign = align; x.font = font(600, 28); x.fillStyle = sub; x.fillText(fit(x, sign, W - 128 * u), tx, yb - 8 * u); yb -= signH * u; }
  if (stats.length) {
    const sh = statH * u, sgap = 16 * u, sx0 = d.bleed ? 48 * u : pad, sw = ((d.bleed ? W - 96 * u : inner) - sgap * (stats.length - 1)) / stats.length, sy = yb - sh - (sign ? 4 * u : 0);
    stats.forEach((st, i) => {
      const r = { x: sx0 + i * (sw + sgap), y: sy, w: sw, h: sh };
      x.fillStyle = onPhoto ? 'rgba(255,255,255,.94)' : T.card; x.beginPath(); x.roundRect(r.x, r.y, r.w, r.h, 30 * u); x.fill();
      x.textAlign = 'center';
      let vp = wide ? 50 : 54; x.font = font(700, vp);
      while (vp > 28 && x.measureText(st.v).width > r.w - 28 * u) { vp -= 2; x.font = font(700, vp); }
      x.fillStyle = onPhoto ? '#151515' : T.fg; x.fillText(st.v, r.x + r.w / 2, r.y + r.h * 0.52);
      x.font = font(500, stats.length > 3 ? 24 : 27); x.fillStyle = onPhoto ? '#5d5d58' : T.sub; x.fillText(fit(x, st.l, r.w - 24 * u), r.x + r.w / 2, r.y + r.h * 0.8);
    });
  }
}
/** corta o texto com reticências quando não cabe */
function fit(x: CanvasRenderingContext2D, t: string, max: number) {
  if (x.measureText(t).width <= max) return t;
  let s = t; while (s.length > 1 && x.measureText(s + '…').width > max) s = s.slice(0, -1);
  return s.trimEnd() + '…';
}

export async function studioBlob(d: Design, s: Scene, type: 'image/jpeg' | 'image/png') {
  await studioFonts();
  const c = document.createElement('canvas'); drawStudio(c, d, s);
  return new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Não foi possível gerar a imagem'))), type, 0.93));
}
