/*
 * Ferramentas de imagem do perfil (navegador, canvas): recorte da foto, logo sem fundo branco e assinatura.
 * Tudo acontece no aparelho; só o resultado final é enviado.
 */

export function loadImg(src: Blob | string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    const url = typeof src === 'string' ? src : URL.createObjectURL(src);
    img.onload = () => { if (typeof src !== 'string') URL.revokeObjectURL(url); res(img); };
    img.onerror = () => { if (typeof src !== 'string') URL.revokeObjectURL(url); rej(new Error('Não foi possível abrir esta imagem. Use JPG, PNG ou WEBP.')); };
    if (typeof src === 'string' && /^https?:/.test(src)) img.crossOrigin = 'anonymous';
    img.src = url;
  });
}
const canvasOf = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
const toBlob = (c: HTMLCanvasElement, type = 'image/png', q = 0.9) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Não foi possível gerar a imagem'))), type, q));
const fit = (w: number, h: number, max: number) => { const k = Math.min(1, max / Math.max(w, h)); return [w * k, h * k] as const; };

/** a imagem tem fundo branco (os 4 cantos claros e opacos)? — sugere tirar o fundo do logo */
export function hasWhiteBg(img: HTMLImageElement): boolean {
  const [w, h] = fit(img.naturalWidth, img.naturalHeight, 200), c = canvasOf(w, h), x = c.getContext('2d', { willReadFrequently: true })!;
  x.drawImage(img, 0, 0, c.width, c.height);
  const pts = [[1, 1], [c.width - 2, 1], [1, c.height - 2], [c.width - 2, c.height - 2]];
  return pts.every(([px, py]) => { const d = x.getImageData(px!, py!, 1, 1).data; return d[3]! > 240 && d[0]! > 232 && d[1]! > 232 && d[2]! > 232; });
}

/** deixa transparente o que é branco/quase branco, com borda suave (não serrilha o contorno) */
function knockWhite(c: HTMLCanvasElement, from = 215, to = 248) {
  const x = c.getContext('2d', { willReadFrequently: true })!, im = x.getImageData(0, 0, c.width, c.height), d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const m = Math.min(d[i]!, d[i + 1]!, d[i + 2]!);
    if (m >= to) d[i + 3] = 0;
    else if (m > from) d[i + 3] = Math.round(d[i + 3]! * (to - m) / (to - from));
  }
  x.putImageData(im, 0, 0);
}
/** corta as margens vazias (transparentes), deixando um respiro */
function trim(c: HTMLCanvasElement, pad = 6): HTMLCanvasElement {
  const x = c.getContext('2d', { willReadFrequently: true })!, { data } = x.getImageData(0, 0, c.width, c.height);
  let t = c.height, l = c.width, r = -1, b = -1;
  for (let y = 0; y < c.height; y++) for (let xx = 0; xx < c.width; xx++) if (data[(y * c.width + xx) * 4 + 3]! > 10) { if (y < t) t = y; if (y > b) b = y; if (xx < l) l = xx; if (xx > r) r = xx; }
  if (r < 0) return c;
  l = Math.max(0, l - pad); t = Math.max(0, t - pad); r = Math.min(c.width - 1, r + pad); b = Math.min(c.height - 1, b + pad);
  const o = canvasOf(r - l + 1, b - t + 1); o.getContext('2d')!.drawImage(c, l, t, o.width, o.height, 0, 0, o.width, o.height);
  return o;
}

/* ---------- foto de perfil: recorte quadrado (zoom e posição escolhidos na tela) ---------- */
export type Crop = { zoom: number; x: number; y: number }; // x,y = deslocamento em fração do quadro (−0,5 a 0,5)
/** escala da imagem para cobrir o quadro de lado S, já com o zoom */
export const coverScale = (img: { naturalWidth: number; naturalHeight: number }, S: number, zoom: number) => Math.max(S / img.naturalWidth, S / img.naturalHeight) * zoom;
/** limita o deslocamento para a imagem sempre cobrir o quadro (sem bordas vazias) */
export function clampCrop(img: { naturalWidth: number; naturalHeight: number }, c: Crop): Crop {
  const k = coverScale(img, 1, c.zoom), mx = Math.max(0, (img.naturalWidth * k - 1) / 2), my = Math.max(0, (img.naturalHeight * k - 1) / 2);
  return { zoom: c.zoom, x: Math.max(-mx, Math.min(mx, c.x)), y: Math.max(-my, Math.min(my, c.y)) };
}
export async function photoBlob(img: HTMLImageElement, crop: Crop, size = 512): Promise<Blob> {
  const c = canvasOf(size, size), x = c.getContext('2d')!, k = coverScale(img, size, crop.zoom);
  const w = img.naturalWidth * k, h = img.naturalHeight * k;
  x.fillStyle = '#fff'; x.fillRect(0, 0, size, size);
  x.imageSmoothingQuality = 'high';
  x.drawImage(img, (size - w) / 2 + crop.x * size, (size - h) / 2 + crop.y * size, w, h);
  return toBlob(c, 'image/jpeg', 0.9);
}

/* ---------- logo: tamanho controlado, fundo branco opcionalmente removido, margens cortadas ---------- */
export async function logoBlob(img: HTMLImageElement, removeWhite: boolean): Promise<Blob> {
  const [w, h] = fit(img.naturalWidth, img.naturalHeight, 900), c = canvasOf(w, h), x = c.getContext('2d')!;
  x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, c.width, c.height);
  if (removeWhite) knockWhite(c);
  return toBlob(trim(c, 4));
}

/* ---------- assinatura: desenhada (canvas) ou foto do papel (fundo branco sai) ---------- */
export async function signBlob(src: HTMLCanvasElement | HTMLImageElement, fromPaper: boolean): Promise<Blob> {
  let c: HTMLCanvasElement;
  if (src instanceof HTMLCanvasElement) c = src;
  else {
    const [w, h] = fit(src.naturalWidth, src.naturalHeight, 1200); c = canvasOf(w, h);
    c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height);
  }
  const copy = canvasOf(c.width, c.height); copy.getContext('2d')!.drawImage(c, 0, 0);
  if (fromPaper) knockWhite(copy, 150, 200);
  const t = trim(copy, 8), [w, h] = fit(t.width, t.height, 700), o = canvasOf(w, h);
  o.getContext('2d')!.drawImage(t, 0, 0, o.width, o.height);
  return toBlob(o);
}
/** o desenho tem traço suficiente para ser uma assinatura? */
export function inkAmount(c: HTMLCanvasElement): number {
  const { data } = c.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, c.width, c.height);
  let n = 0; for (let i = 3; i < data.length; i += 16) if (data[i]! > 40) n++;
  return n / (data.length / 16);
}
