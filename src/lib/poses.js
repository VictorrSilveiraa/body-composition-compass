/*
 * Poses das fotos de acompanhamento e as silhuetas-guia (viewBox 300×400 = quadro 3:4).
 * As mesmas linhas de referência (topo da cabeça, pés e eixo central) aparecem na câmera,
 * nos espaços vazios e no comparativo — é isso que mantém o enquadramento igual entre consultas.
 */
export const POSES = [
  { k: 'front', l: 'Frente', hint: 'De frente, braços levemente afastados do corpo, pés na largura do quadril.' },
  { k: 'back', l: 'Costas', hint: 'De costas, mesma posição da foto de frente.' },
  { k: 'right', l: 'Lado direito', hint: 'Lado direito voltado para a câmera, braços ao longo do corpo.' },
  { k: 'left', l: 'Lado esquerdo', hint: 'Lado esquerdo voltado para a câmera, braços ao longo do corpo.' },
];
export const POSE_KEYS = POSES.map((p) => p.k);
export const poseLabel = (k) => POSES.find((p) => p.k === k)?.l || '';
export const poseHint = (k) => POSES.find((p) => p.k === k)?.hint || '';

// linhas de referência no quadro (em unidades do viewBox)
export const GUIDE = { head: 22, feet: 386, center: 150 };

const f = (n) => Math.round(n * 10) / 10;
// metade direita da silhueta de frente (de cima, no centro da cabeça, até o meio entre as pernas): curvas cúbicas
const HALF = [
  [150, 22],
  [163, 22, 172, 33, 172, 49], [172, 62, 166, 72, 160, 76],
  [160, 80, 160, 84, 161, 87], [168, 92, 182, 94, 192, 97], [202, 100, 207, 108, 208, 118],
  [212, 140, 218, 158, 222, 172], [226, 190, 232, 208, 236, 224],
  [240, 236, 242, 250, 236, 256], [231, 260, 226, 254, 224, 246],
  [220, 230, 214, 210, 210, 192], [206, 176, 200, 150, 192, 132],
  [190, 150, 186, 172, 184, 190], [184, 206, 190, 216, 191, 232],
  [192, 262, 188, 286, 185, 306], [184, 318, 188, 334, 186, 348], [184, 358, 180, 366, 179, 371],
  [182, 377, 193, 381, 191, 385], [180, 387, 166, 387, 162, 385],
  [161, 375, 162, 366, 161, 356], [158, 336, 160, 320, 158, 304], [156, 282, 154, 262, 150, 250],
];
function frontPath() {
  const [start, ...segs] = HALF;
  let d = `M${start[0]},${start[1]}`;
  for (const s of segs) d += ` C${s.map(f).join(',')}`;
  // espelha a metade direita, percorrendo de volta (do meio das pernas até o topo da cabeça)
  const pts = [start, ...segs.map((s) => s.slice(4))];
  for (let i = segs.length - 1; i >= 0; i--) {
    const s = segs[i], p0 = pts[i], m = (x) => f(300 - x);
    d += ` C${m(s[2])},${f(s[3])},${m(s[0])},${f(s[1])},${m(p0[0])},${f(p0[1])}`;
  }
  return d + ' Z';
}
const FRONT = frontPath();
// perfil voltado para a direita da foto (lado direito do corpo virado para a câmera)
const SIDE = 'M146,22 C162,22 172,33 172,47 C172,53 176,57 177,61 C175,63 173,65 172,67 C172,73 168,77 162,78 L161,88 C170,96 176,104 178,118 C182,136 182,150 178,166 C176,180 178,196 180,208 C182,222 180,236 176,248 C176,272 172,296 170,310 C170,330 166,350 164,368 C170,376 187,379 187,386 L140,386 C140,376 142,370 142,362 C138,344 134,328 136,310 C134,294 128,270 126,250 C120,240 118,226 122,214 C126,200 128,184 126,168 C122,150 120,128 124,112 C126,100 134,94 140,90 C138,82 132,74 130,62 C128,40 134,22 146,22 Z';
const SIDE_ARM = 'M150,104 C158,104 161,120 161,140 L163,196 C163,212 161,226 157,232 C151,236 147,226 147,214 L145,150 C143,124 143,104 150,104 Z';

/** SVG da silhueta. guides: mostra as linhas de referência; cls: classe extra */
export function poseSvg(k, { guides = false, cls = '' } = {}) {
  const side = k === 'right' || k === 'left';
  const flip = k === 'left' ? ' transform="matrix(-1 0 0 1 300 0)"' : '';
  const body = side
    ? `<g${flip}><path class="ps-body" d="${SIDE}"/><path class="ps-arm" d="${SIDE_ARM}"/></g>`
    : `<path class="ps-body" d="${FRONT}"/>${k === 'back' ? '<path class="ps-detail" d="M150,104 V236"/>' : '<path class="ps-detail" d="M141,58 h4 M155,58 h4"/>'}`;
  const g = guides
    ? `<g class="ps-guides"><path d="M24,${GUIDE.head} H276"/><path d="M24,${GUIDE.feet} H276"/><path class="ps-axis" d="M150,8 V396"/></g>`
    : '';
  return `<svg class="pose-svg ${cls}" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${g}${body}</svg>`;
}
