/*
 * TELA DE CARREGAMENTO DA MARCA
 *  · vai pronta no HTML da página (aparece no primeiro instante, antes do código carregar)
 *  · quem ainda está carregando dados "segura" a tela (holdSplash); ela só sai quando ninguém mais segura
 *    e a página já montou — assim é UMA só animação do início ao fim, sem trocar de tela no meio
 *  · depois da abertura, o mesmo desenho aparece nos carregamentos de verdade (componente BrandLoader)
 */
const DEFAULT_WORDS = ['Medindo dobras…', 'Calculando composição…', 'Preparando sua evolução…'];

/** desenho da tela (o mesmo no HTML inicial e no componente) */
export function splashHtml(words: string[] = DEFAULT_WORDS) {
  const w = words.slice(0, 3);
  return `<div class="bl-bg" aria-hidden="true"><i></i><i></i><i></i></div>
  <div class="bl-core" aria-hidden="true">
    <svg class="bl-rings" viewBox="0 0 120 120"><circle class="bl-r r1" cx="60" cy="60" r="54"/><circle class="bl-r r2" cx="60" cy="60" r="44"/><circle class="bl-r r3" cx="60" cy="60" r="34"/></svg>
    <span class="bl-mark"><svg viewBox="0 0 24 24"><path d="M3 12h4l2.5-6 4 12 2.5-6H21"/></svg></span>
  </div>
  <div class="bl-name" aria-hidden="true">Avaliação Física</div>
  <div class="bl-tape" aria-hidden="true"><div class="bl-ticks"></div><span class="bl-needle"></span></div>
  <div class="bl-words" aria-hidden="true" style="--n:${w.length}">${w.map((t, i) => `<span style="--i:${i}">${t}</span>`).join('')}</div>`;
}

let holds = 0, mounted = false, gone = false, timer = 0;
const el = () => (typeof document === 'undefined' ? null : document.getElementById('boot'));
function maybeHide() {
  if (gone || !mounted || holds > 0) return;
  clearTimeout(timer);
  timer = window.setTimeout(() => {
    if (holds > 0) return;
    const b = el(); gone = true;
    if (!b) return;
    b.classList.add('out');
    window.setTimeout(() => b.classList.add('done'), 520);
  }, 80);
}
/** a página montou: a tela de abertura pode sair (se ninguém estiver carregando) */
export function appMounted() { mounted = true; maybeHide(); }
/** a tela de abertura ainda está na tela? (então quem carrega só a segura, sem desenhar outra por cima) */
export const splashVisible = () => !gone && !!el();
/** segura a tela de abertura enquanto carrega; devolve a função que solta */
export function holdSplash() {
  holds++;
  let done = false;
  return () => { if (done) return; done = true; holds = Math.max(0, holds - 1); maybeHide(); };
}
