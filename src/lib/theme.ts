/*
 * Tema claro/escuro do app e do portal do paciente.
 * A escolha fica no aparelho (localStorage 'avf.theme'): 'light', 'dark' ou 'auto' (segue o sistema).
 * A classe .dark no <html> liga os tokens escuros de src/styles.css; o script THEME_BOOT roda no <head>
 * antes da página pintar, para nunca piscar o tema errado.
 */
export type ThemePref = 'light' | 'dark' | 'auto';
const KEY = 'avf.theme';
// cor da barra do navegador/celular em cada tema (= --surface)
const BAR = { light: '#ffffff', dark: '#121311' };

const mq = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null);

export function themePref(): ThemePref {
  try { const v = localStorage.getItem(KEY); if (v === 'light' || v === 'dark' || v === 'auto') return v; } catch { /* sem armazenamento */ }
  return 'auto';
}
const resolve = (p: ThemePref) => (p === 'auto' ? (mq()?.matches ? 'dark' : 'light') : p);
export const isDark = () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

function paint(mode: 'light' | 'dark') {
  const h = document.documentElement;
  h.classList.toggle('dark', mode === 'dark');
  h.style.colorScheme = mode;
  let m = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!m) { m = document.createElement('meta'); m.name = 'theme-color'; document.head.appendChild(m); }
  m.content = BAR[mode];
  window.dispatchEvent(new CustomEvent('avf-theme', { detail: mode }));
}

/**
 * Troca o tema. Com `from` (ponto do clique), o tema novo se abre num círculo a partir dali;
 * sem suporte a View Transitions ou com "reduzir movimento", troca direto.
 */
export function setTheme(p: ThemePref, from?: { x: number; y: number }) {
  try { localStorage.setItem(KEY, p); } catch { /* sem armazenamento: vale só nesta visita */ }
  const mode = resolve(p);
  if (mode === (isDark() ? 'dark' : 'light')) { paint(mode); return; }
  const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!doc.startViewTransition || still || document.visibilityState !== 'visible') { paint(mode); return; }
  const h = document.documentElement;
  h.classList.add('theme-vt');
  const t = doc.startViewTransition(() => paint(mode));
  const x = from?.x ?? innerWidth / 2, y = from?.y ?? innerHeight / 2;
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  t.ready.then(() => {
    h.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: 560, easing: 'cubic-bezier(.22,1,.36,1)', pseudoElement: '::view-transition-new(root)' });
  }).catch(() => {});
  window.setTimeout(() => h.classList.remove('theme-vt'), 700);
}

export function toggleTheme(from?: { x: number; y: number }) { setTheme(isDark() ? 'light' : 'dark', from); }

/** acompanha o sistema quando a escolha é "automático" (chamar uma vez) */
let watching = false;
export function watchTheme() {
  if (watching || typeof window === 'undefined') return;
  watching = true;
  paint(resolve(themePref()));
  mq()?.addEventListener?.('change', () => { if (themePref() === 'auto') paint(resolve('auto')); });
  // outra aba trocou o tema
  window.addEventListener('storage', (e) => { if (e.key === KEY) paint(resolve(themePref())); });
}

/** roda no <head>, antes da primeira pintura */
export const THEME_BOOT = `(function(){try{var p=localStorage.getItem('${KEY}');var d=p==='dark'||((!p||p==='auto')&&matchMedia('(prefers-color-scheme: dark)').matches);var h=document.documentElement;if(d)h.classList.add('dark');h.style.colorScheme=d?'dark':'light';}catch(e){}})();`;
