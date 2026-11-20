import { useLayoutEffect, useMemo, useState } from 'react';
import { holdSplash, splashHtml, splashVisible } from '@/lib/boot-splash';

/*
 * Carregando (com a cara do site). Enquanto a tela de abertura ainda estiver aparecendo, só a "segura"
 * (é uma animação só, do primeiro instante até o conteúdo); depois disso, desenha a mesma tela por cima,
 * mas só se a espera passar de 200 ms (carregamento rápido não pisca).
 */
export function BrandLoader({ words, label = 'Carregando' }: { words?: string[]; label?: string }) {
  const [boot] = useState(() => typeof window !== 'undefined' && splashVisible());
  const [show, setShow] = useState(false);
  const html = useMemo(() => splashHtml(words), [words]);
  useLayoutEffect(() => {
    if (boot) return holdSplash();
    const t = window.setTimeout(() => setShow(true), 200);
    return () => clearTimeout(t);
  }, [boot]);
  if (boot || !show) return <div className="bl-hold" role="status" aria-label={label} />;
  return <div className="bl in-app" role="status" aria-live="polite" aria-label={label} dangerouslySetInnerHTML={{ __html: html }} />;
}
