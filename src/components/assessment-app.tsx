import { createElement, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useRouter, useRouterState, type AnyRoute } from '@tanstack/react-router';
import parse, { domToReact, Element, attributesToProps, type HTMLReactParserOptions, type DOMNode } from 'html-react-parser';
import { Button } from '@/components/ui/button';
import { AppTour, type TourSpec } from '@/components/app-tour';
import { PoseCamera, type CameraSpec } from '@/components/pose-camera';
import { PhotoViewer, type ViewerSpec } from '@/components/photo-viewer';
import { DoneSheet, type DoneSpec } from '@/components/done-sheet';
import { composeComparison, loadPhotos, photoStore } from '@/lib/photos';
import { getAccess, issueCode, updateAccess } from '@/lib/portal-access';
import { dietStore, loadDiets } from '@/lib/diets';
import { supabase } from '@/integrations/supabase/client';
import { cloudRepository, loadCloud, saveNutri, type Nutri } from '@/lib/cloud-data';
import { motivo } from '@/lib/motivo';
import { mountOriginal } from '@/lib/original-runtime.js';
import { pageReady, ripple, scan, withPageTransition } from '@/lib/motion';const kids = (node: Element) => (node.children.length ? domToReact(node.children as DOMNode[], parserOptions) : undefined);
const parserOptions: HTMLReactParserOptions = {
  replace(node) {
    if (!(node instanceof Element)) return undefined;
    if (node.name === 'button') {
      const attrs = attributesToProps(node.attribs);
      return <Button variant="original" {...attrs} disabled={'disabled' in node.attribs}>{kids(node)}</Button>;
    }
    // <select>: o React quer defaultValue em vez de "selected" na opção; a key troca junto com o valor escolhido
    if (node.name === 'select') {
      const chosen = node.children.find((c): c is Element => c instanceof Element && c.name === 'option' && 'selected' in c.attribs);
      const value = chosen?.attribs['value'];
      return createElement('select', { ...attributesToProps(node.attribs, 'select'), defaultValue: value, key: (node.attribs['data-ch'] ?? '') + ':' + value }, kids(node));
    }
    if (node.name === 'option' && 'selected' in node.attribs) {
      const { selected: _s, ...rest } = node.attribs;
      return createElement('option', attributesToProps(rest, 'option'), kids(node));
    }
    // data-key: força o React a recriar o bloco quando o conteúdo muda (ex.: etapa do assistente), para animar a entrada
    if (node.attribs['data-key']) {
      return createElement(node.name, { ...attributesToProps(node.attribs, node.name), key: node.attribs['data-key'] }, kids(node));
    }
    return undefined;
  },
};

type Sheet = { title: string; text: string; buttons: { label: string; sub?: string; cls?: string; icon?: string; fn?: () => void | Promise<void> }[] };
type Frame = { html: string; nav: string; key: string; dir: string };
type Runtime = ReturnType<typeof mountOriginal>;

/*
 * O app (estado, dados e ouvintes) vive fora do componente: trocar de página não recarrega nada
 * nem mostra tela de carregamento — o componente da rota nova só "pega" o app e desenha a tela.
 */
const bridge = {
  render: (_f: Frame) => {},
  sheet: (_s: Sheet) => {},
  toast: (_t: string) => {},
  navigate: (_to: string) => {},
  tour: (_t: TourSpec) => {},
  camera: (_c: CameraSpec) => {},
  viewer: (_v: ViewerSpec) => {},
  done: (_d: DoneSpec) => {},
  showDone: () => {},
};
let live: { runtime: Runtime; userId: string } | null = null;
// janela de conclusão pendente: fica guardada até ser fechada, para sobreviver à troca de página
// (ex.: salvar a avaliação sai do formulário e abre a avaliação — outra instância desta tela)
let doneQueued: { spec: DoneSpec; n: number } | null = null;
let doneSeq = 0;
let lastFrame: Frame | null = null;
let shownKey: string | null = null;
export const hasLiveApp = () => live !== null;
function dropLive() { live?.runtime.destroy(); live = null; lastFrame = null; shownKey = null; doneQueued = null; }

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function AppSkeleton() {
  return (
    <div className="sk-wrap" aria-busy="true" aria-label="Carregando">
      <div className="sk-top"><span className="sk sk-c" /><span className="sk-col"><span className="sk sk-l" style={{ width: 54 }} /><span className="sk sk-l" style={{ width: 96 }} /></span><span className="grow" /><span className="sk sk-c" /><span className="sk sk-c" /></div>
      <span className="sk sk-l sk-h" style={{ width: '82%' }} />
      <span className="sk sk-l sk-h" style={{ width: '56%', marginBottom: 22 }} />
      <div className="sk sk-hero" />
      <div className="sk-grid"><div className="sk sk-card" /><div className="sk sk-card" /></div>
      <div className="sk sk-row" /><div className="sk sk-row" />
    </div>
  );
}

export function AssessmentApp() {
  const host = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState<Frame | null>(() => (live ? lastFrame : null));
  const [sheet, setSheet] = useState<Sheet | null>(null), [sheetOut, setSheetOut] = useState(false);
  const [toast, setToast] = useState(''), [toastOut, setToastOut] = useState(false);
  const [error, setError] = useState('');
  const [tour, setTour] = useState<TourSpec | null>(null);
  const [camera, setCamera] = useState<CameraSpec | null>(null);
  const [viewer, setViewer] = useState<ViewerSpec | null>(null);
  const [done, setDone] = useState<{ spec: DoneSpec; n: number } | null>(null);
  const navigate = useNavigate(), queryClient = useQueryClient();
  const path = useRouterState({ select: (s) => s.location.pathname });
  // enquanto a próxima página carrega, esta tela não deve desenhar a página nova (senão anima duas vezes)
  const pending = useRouterState({ select: (s) => s.status === 'pending' });
  const router = useRouter();
  const pathRef = useRef(path); pathRef.current = path;

  // liga este componente ao app (antes da pintura, para nunca mostrar a tela anterior)
  useIsoLayoutEffect(() => {
    bridge.render = setFrame;
    bridge.sheet = (s) => { setSheetOut(false); setSheet(s); };
    bridge.toast = (t) => { setToastOut(false); setToast(t); };
    bridge.navigate = (to) => withPageTransition(() => { void navigate({ to }); });
    bridge.tour = setTour;
    bridge.camera = setCamera;
    bridge.viewer = setViewer;
    // abre depois da transição de página (senão a barra de navegação fica por cima durante a animação)
    bridge.done = (d) => {
      doneQueued = { spec: { onError: (e) => bridge.toast(motivo(e, 'Não foi possível concluir. Tente novamente.')), ...d }, n: ++doneSeq };
      window.setTimeout(() => bridge.showDone(), 420);
    };
    bridge.showDone = () => { if (doneQueued) setDone(doneQueued); };
    // a página anterior pediu a janela e saiu antes de mostrá-la: esta tela mostra
    if (doneQueued) window.setTimeout(() => bridge.showDone(), 420);
    if (live && host.current) live.runtime.attach(host.current, pathRef.current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const { data } = await supabase.auth.getSession();
        const user = data.session?.user;
        if (!user) { dropLive(); await navigate({ to: '/login' }); return; }
        if (live) { if (live.userId === user.id) return; dropLive(); setFrame(null); }
        // fotos carregam junto (se falharem, o app abre normalmente sem elas)
        const [loaded, pics, diets] = await Promise.all([
          queryClient.fetchQuery({ queryKey: ['assessment-data', user.id], queryFn: () => loadCloud(user.id), staleTime: 0 }),
          loadPhotos(user.id).catch(() => ({ cloud: false, metas: [] })),
          loadDiets(user.id).catch(() => ({ cloud: false, list: [] })),
        ]);
        if (cancelled || !host.current || live) return;
        const repo = cloudRepository(user.id, loaded.db, loaded.fichaCloud);
        const runtime = mountOriginal({
          app: host.current, path: pathRef.current, userId: user.id, email: user.email, db: loaded.db, draft: loaded.draft, ...repo,
          fichaCloud: loaded.fichaCloud, nutri: (user.user_metadata?.['nutri'] as Nutri | undefined) ?? {}, saveNutri,
          render: (html: string, nav: string, key: string, dir: string) => { lastFrame = { html, nav, key, dir }; bridge.render(lastFrame); },
          sheet: (s: Sheet) => bridge.sheet(s),
          toast: (t: string) => bridge.toast(t),
          navigate: (to: string) => bridge.navigate(to),
          tour: (t: TourSpec) => bridge.tour(t),
          photos: photoStore(user.id, pics.cloud, pics.metas), composeComparison,
          portalAccess: { get: getAccess, issue: issueCode, update: updateAccess },
          diets: dietStore(user.id, diets.cloud, diets.list),
          camera: (c: CameraSpec) => bridge.camera(c),
          viewer: (v: ViewerSpec) => bridge.viewer(v),
          done: (d: DoneSpec) => bridge.done(d),
          logout: async () => { dropLive(); await queryClient.cancelQueries(); queryClient.clear(); await supabase.auth.signOut(); await navigate({ to: '/login', replace: true }); },
        });
        live = { runtime, userId: user.id };
      } catch (e) {
        if (!cancelled) setError(motivo(e, 'Não foi possível carregar seus dados.'));
      }
    }
    void init();
    return () => { cancelled = true; };
  }, [queryClient]);

  useEffect(() => { if (!pending) live?.runtime.syncPath(path); }, [path, pending]);

  // baixa antes o código de todas as páginas: a primeira visita a cada tela já abre na hora
  useEffect(() => {
    const t = window.setTimeout(() => {
      for (const route of Object.values(router.routesById) as AnyRoute[]) {
        try { void router.loadRouteChunk(route)?.catch(() => {}); } catch { /* ignora */ }
      }
    }, 600);
    return () => clearTimeout(t);
  }, [router]);

  // tela nova: volta ao topo e prepara as animações de entrada
  useIsoLayoutEffect(() => {
    if (!frame || !host.current) return;
    const fresh = shownKey !== frame.key;
    if (fresh && shownKey !== null) window.scrollTo(0, 0);
    shownKey = frame.key;
    scan(host.current, { fresh });
    if (fresh) pageReady();
  }, [frame]);

  // onda de toque em qualquer botão (inclusive no painel de confirmação)
  useEffect(() => {
    document.addEventListener('pointerdown', ripple, { passive: true });
    return () => document.removeEventListener('pointerdown', ripple);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const out = setTimeout(() => setToastOut(true), 3200);
    const gone = setTimeout(() => { setToast(''); setToastOut(false); }, 3480);
    return () => { clearTimeout(out); clearTimeout(gone); };
  }, [toast]);

  const closeSheet = () => { setSheetOut(true); setTimeout(() => { setSheet(null); setSheetOut(false); }, 220); };

  return (
    <>
      <div className={'app' + (frame?.nav ? ' has-nav' : '')} ref={host}>
        {error ? (
          <div className="empty"><h3>{error}</h3><Button variant="original" className="btn primary" onClick={() => window.location.reload()}>Tentar novamente</Button></div>
        ) : frame ? (
          <>
            <div className="view" key={frame.key} data-dir={frame.dir}>{parse(frame.html, parserOptions)}</div>
            {parse(frame.nav, parserOptions)}
          </>
        ) : (
          <AppSkeleton />
        )}
      </div>
      <input type="file" id="importFile" accept=".json,application/json" hidden />
      {sheet && (
        <div className={'scrim' + (sheetOut ? ' out' : '')} onClick={closeSheet}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label={sheet.title} onClick={(e) => e.stopPropagation()}>
            <h3>{sheet.title}</h3><p>{sheet.text}</p>
            <div className="btns">
              {sheet.buttons.map((b, i) => (
                <Button variant="original" key={i} className={'btn ' + (b.cls ?? 'ghost')} onClick={async () => {
                  closeSheet();
                  try { await b.fn?.(); } catch (e) { bridge.toast(motivo(e, 'Não foi possível salvar. Tente novamente.')); }
                }}>{b.icon ? parse(b.icon) : null}{b.sub ? <span className="sb-txt"><b>{b.label}</b><small>{b.sub}</small></span> : b.label}</Button>
              ))}
            </div>
          </div>
        </div>
      )}
      {toast && <div className={'toast' + (toastOut ? ' out' : '')} role="status">{toast}</div>}
      {tour && <AppTour spec={tour} onEnd={() => setTour(null)} />}
      {camera && <PoseCamera spec={camera} onEnd={() => setCamera(null)} />}
      {viewer && <PhotoViewer spec={viewer} onEnd={() => setViewer(null)} />}
      {done && <DoneSheet key={done.n} spec={done.spec} onEnd={() => { if (doneQueued?.n === done.n) doneQueued = null; setDone(null); }} />}
    </>
  );
}
