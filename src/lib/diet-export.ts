import { esc, fmtDate } from './calculos.js';
import { CAT_LABEL, dietStats, fmtAmount, foodCat, mealKind, qtyParts, shoppingList, type Diet, type DietSub, type FoodCat } from './diet-parse';
import { CAT_COLOR, KIND_COLOR, dayClock, dtIcon } from './diet-view';

/*
 * Plano alimentar para levar: PDF (pelo "Salvar como PDF" do navegador, como os relatórios de avaliação)
 * e imagem (PNG alta resolução, ótima para mandar no WhatsApp e salvar na galeria).
 */
/** logo/brand/color/contacts: marca do nutricionista (perfil > Marca e PDF); todos opcionais */
export type DietMeta = { patient: string; nutri: string; crn?: string; consult?: string; logo?: string; brand?: string; color?: { bg: string; ink: string } | null; contacts?: string };
const qtyText = (qty: string) => { const q = qtyParts(qty), a = fmtAmount(q); return [q.measure, a].filter(Boolean).join(' · ') || qty; };
const subHtml = (s: DietSub) => `${esc(s.name)}${s.detail ? ` (${esc(s.detail)})` : ''}${s.qty ? ` — ${qtyText(s.qty).split(' · ').map((p) => `<span class="dp-nw">${esc(p)}</span>`).join(' · ')}` : ''}`;
const subTxt = (s: DietSub) => `${s.name}${s.detail ? ` (${s.detail})` : ''}${s.qty ? ` — ${qtyText(s.qty)}` : ''}`;
export const dietFileName = (d: Diet, m: DietMeta, ext: string) => `plano-alimentar-${(m.patient || 'paciente').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}${d.prescribedAt ? '-' + d.prescribedAt : ''}.${ext}`;

/* ---------- PDF ---------- */
export function dietPrintHtml(d: Diet, m: DietMeta) {
  const s = dietStats(d), shop = d.hideShopping ? [] : shoppingList(d);
  const meals = d.meals.map((ml) => {
    const k = mealKind(ml.name, ml.time);
    return `<section class="dp-meal" style="--mc:${KIND_COLOR[k]}">
      <header>${ml.time ? `<span class="dp-time">${esc(ml.time)}</span>` : ''}<span class="dp-ico">${dtIcon(k)}</span><h2>${esc(ml.name)}</h2>${ml.variants.length > 1 ? `<span class="dp-tag">${ml.variants.length} opções · escolha uma</span>` : ''}</header>
      <div class="dp-vars ${ml.variants.length > 1 ? 'multi' : ''}">${ml.variants.map((v) => `<div class="dp-var">${ml.variants.length > 1 ? `<h3>${esc(v.label)}</h3>` : ''}
        <table>${v.foods.map((f) => `<tr><td><i style="background:${CAT_COLOR[foodCat(f.name)]}"></i><b>${esc(f.name)}</b>${f.detail ? `<small> ${esc(f.detail)}</small>` : ''}${f.subs.length ? `<div class="dp-subs">↔ ou ${f.subs.map(subHtml).join(' · ou ')}</div>` : ''}</td><td class="q">${esc(qtyText(f.qty))}</td></tr>`).join('')}</table>
        ${v.notes ? `<p class="dp-note"><b>Observação:</b> ${esc(v.notes)}</p>` : ''}</div>`).join('')}</div>
    </section>`;
  }).join('');
  const cats = (Object.keys(CAT_LABEL) as FoodCat[]);
  const groups = new Map<FoodCat, string[]>(); for (const it of shop) { const c = foodCat(it); groups.set(c, [...(groups.get(c) ?? []), it]); }
  const brandBar = m.logo || m.brand ? `<div class="dp-brand">${m.logo ? `<img src="${esc(m.logo)}" alt="">` : ''}${m.brand ? `<b>${esc(m.brand)}</b>` : ''}<span>${esc([m.nutri, m.crn].filter(Boolean).join(' · '))}</span></div>` : '';
  return `<div class="dp"${m.color ? ` style="--dp-accent:${m.color.bg};--dp-accent-ink:${m.color.ink}"` : ''}>
    ${brandBar}
    <header class="dp-head">
      <div><span class="dp-kicker">Plano alimentar</span><h1>${esc(d.title)}</h1>
        <p>${esc(m.patient)}${d.prescribedAt ? ` · prescrito em ${fmtDate(d.prescribedAt, { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}${m.consult ? ` · ${esc(m.consult)}` : ''}</p></div>
      <div class="dp-clock">${dayClock(d, undefined, 150)}</div>
    </header>
    <div class="dp-stats"><span><b>${s.meals}</b> refeições</span><span><b>${s.foods}</b> alimentos</span><span><b>${s.subs}</b> trocas</span>${s.options ? `<span><b>${s.options}</b> opções extras</span>` : ''}</div>
    <div class="dp-legend">${cats.filter((c) => d.meals.some((ml) => ml.variants.some((v) => v.foods.some((f) => foodCat(f.name) === c)))).map((c) => `<span><i style="background:${CAT_COLOR[c]}"></i>${CAT_LABEL[c]}</span>`).join('')}</div>
    ${meals}
    ${d.notes.trim() ? `<section class="dp-box"><h2>Orientações</h2><p>${esc(d.notes).replace(/\n/g, '<br>')}</p></section>` : ''}
    ${d.sections.map((x) => `<section class="dp-box"><h2>${esc(x.title)}</h2>${x.lines.map((l) => `<p>${esc(l)}</p>`).join('')}</section>`).join('')}
    ${shop.length ? `<section class="dp-shop"><h2>Lista de compras</h2><div class="dp-shop-g">${cats.filter((c) => groups.has(c)).map((c) => `<div><h3><i style="background:${CAT_COLOR[c]}"></i>${CAT_LABEL[c]}</h3>${groups.get(c)!.map((x) => `<p>☐ ${esc(x)}</p>`).join('')}</div>`).join('')}</div></section>` : ''}
    ${d.recipes.map((r) => `<section class="dp-box dp-recipe"><h2>Receita · ${esc(r.name)}</h2>${r.yield ? `<p class="dp-muted">Rende ${esc(r.yield)}</p>` : ''}<div class="dp-rc"><div><h3>Ingredientes</h3>${r.ingredients.map((x) => `<p>• ${esc(x)}</p>`).join('')}</div><div><h3>Modo de preparo</h3><ol>${r.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></div></div></section>`).join('')}
    <footer class="dp-foot"><span>${esc([m.nutri, m.crn].filter(Boolean).join(' · ') || d.prescriber)}${m.contacts ? `<br>${esc(m.contacts)}` : ''}</span><span>Gerado em ${fmtDate(new Date().toISOString().slice(0, 10), { day: '2-digit', month: '2-digit', year: 'numeric' })}</span></footer>
  </div>`;
}
export function exportDietPdf(d: Diet, m: DietMeta) {
  let root = document.getElementById('print-root');
  if (!root) { root = document.createElement('div'); root.id = 'print-root'; document.body.appendChild(root); }
  root.innerHTML = dietPrintHtml(d, m);
  const oldTitle = document.title;
  document.title = dietFileName(d, m, 'pdf').replace(/\.pdf$/, '');
  document.body.classList.add('printing-report');
  const done = () => { document.body.classList.remove('printing-report'); document.title = oldTitle; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  (document.fonts?.ready ?? Promise.resolve()).then(() => requestAnimationFrame(() => window.print()));
}

/* ---------- imagem ---------- */
const css = (v: string) => { if (!v.startsWith('var(')) return v; const n = v.slice(4, -1); return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#ddd'; };
function wrap(x: CanvasRenderingContext2D, text: string, max: number): string[] {
  const out: string[] = []; let line = '';
  for (const w of text.split(/\s+/)) { const t = line ? line + ' ' + w : w; if (x.measureText(t).width > max && line) { out.push(line); line = w; } else line = t; }
  if (line) out.push(line); return out;
}
export async function dietImage(d: Diet, m: DietMeta): Promise<Blob> {
  await (document.fonts?.ready ?? Promise.resolve());
  const W = 1080, pad = 64, inner = W - pad * 2, F = 'Urbanist, system-ui, sans-serif';
  const c = document.createElement('canvas'), x = c.getContext('2d')!;
  // 1ª passada mede, 2ª desenha
  const draw = (paint: boolean) => {
    let y = 0;
    const font = (w: number, s: number) => { x.font = `${w} ${s}px ${F}`; };
    const rr = (X: number, Y: number, w: number, h: number, r: number, fill: string) => { if (!paint) return; x.fillStyle = fill; x.beginPath(); x.roundRect(X, Y, w, h, r); x.fill(); };
    const txt = (s: string, X: number, Y: number, color = '#141414', align: CanvasTextAlign = 'left') => { if (!paint) return; x.fillStyle = color; x.textAlign = align; x.fillText(s, X, Y); };
    // topo
    rr(0, 0, W, 330, 0, css('var(--green)'));
    if (paint) { x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.arc(W - 90, 60, 170, 0, Math.PI * 2); x.fill(); x.beginPath(); x.arc(W - 250, 300, 90, 0, Math.PI * 2); x.fill(); }
    font(700, 26); txt('PLANO ALIMENTAR', pad, 92, css('var(--green-ink)'));
    font(700, 58); const tl = wrap(x, d.title, inner - 40); tl.slice(0, 2).forEach((l, i) => txt(l, pad, 160 + i * 64)); y = 160 + Math.min(2, tl.length) * 64;
    font(500, 30); txt([m.patient, d.prescribedAt ? fmtDate(d.prescribedAt, { day: '2-digit', month: 'short', year: 'numeric' }) : ''].filter(Boolean).join(' · '), pad, y + 6, '#3a3a3a');
    y = Math.max(y + 60, 330) + 40;
    for (const ml of d.meals) {
      const k = mealKind(ml.name, ml.time);
      for (const [vi, v] of ml.variants.entries()) {
        const y0 = y;
        // cabeçalho da refeição
        y += 34; font(700, 40); const head = `${ml.time ? ml.time + '  ' : ''}${ml.name}`;
        const lines: { t: string; q: string; sub: string[]; cc: string }[] = v.foods.map((f) => { font(500, 26); return { t: f.name + (f.detail ? ` (${f.detail})` : ''), q: qtyText(f.qty), sub: f.subs.length ? wrap(x, 'ou ' + f.subs.map(subTxt).join(' · ou '), inner - 120) : [], cc: CAT_COLOR[foodCat(f.name)] }; });
        let h = 34 + 50 + (ml.variants.length > 1 ? 40 : 0);
        for (const l of lines) { font(600, 31); const nl = wrap(x, l.t, inner - 380).length; h += Math.max(1, nl) * 38 + 14 + l.sub.length * 32 + (l.sub.length ? 6 : 0); }
        if (v.notes) { font(500, 26); h += wrap(x, v.notes, inner - 96).length * 34 + 36; }
        h += 22;
        rr(pad, y0, inner, h, 36, css('var(--card)'));
        rr(pad, y0, 14, h, 7, css(KIND_COLOR[k]));
        font(700, 40); txt(head, pad + 44, y0 + 62);
        let yy = y0 + 62;
        if (ml.variants.length > 1) { font(700, 24); yy += 40; txt(`${v.label.toUpperCase()}  ·  ${vi + 1} de ${ml.variants.length}`, pad + 44, yy, css('var(--blue-ink)')); }
        yy += 22;
        for (const l of lines) {
          yy += 38; if (paint) { x.fillStyle = l.cc; x.beginPath(); x.arc(pad + 54, yy - 10, 9, 0, Math.PI * 2); x.fill(); }
          font(600, 31); const nl = wrap(x, l.t, inner - 380); nl.forEach((s, i) => txt(s, pad + 80, yy + i * 38));
          font(700, 29); txt(l.q, W - pad - 34, yy, '#141414', 'right');
          yy += (nl.length - 1) * 38 + 14;
          font(500, 25); for (const s of l.sub) { yy += 32; txt(s, pad + 80, yy, '#6b6b66'); } if (l.sub.length) yy += 6;
        }
        if (v.notes) { font(500, 26); yy += 30; for (const s of wrap(x, v.notes, inner - 96)) { txt(s, pad + 44, yy, css('var(--yellow-ink)')); yy += 34; } }
        y = y0 + h + 26;
      }
    }
    y += 10; font(500, 24); txt(`${[m.nutri, m.crn].filter(Boolean).join(' · ') || d.prescriber}`, pad, y + 20, '#6b6b66'); txt('Plano alimentar', W - pad, y + 20, '#9a9a94', 'right');
    return y + 70;
  };
  c.width = W; c.height = 400;
  const H = draw(false);
  c.width = W; c.height = Math.min(16000, Math.ceil(H));
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, c.height);
  draw(true);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Falha ao gerar a imagem'))), 'image/png'));
}

/** baixa no computador ou abre o compartilhar do celular */
export async function shareOrDownload(blob: Blob, name: string, title: string) {
  const file = typeof File === 'function' ? new File([blob], name, { type: blob.type }) : null;
  if (file && navigator.canShare?.({ files: [file] }) && matchMedia('(pointer: coarse)').matches) {
    try { await navigator.share({ files: [file], title }); return 'shared'; } catch (e) { if ((e as { name?: string })?.name === 'AbortError') return 'cancel'; }
  }
  const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 1500); return 'downloaded';
}
