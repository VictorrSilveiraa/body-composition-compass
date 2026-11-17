import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import parse, { domToReact, Element, attributesToProps, type HTMLReactParserOptions } from 'html-react-parser';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { cloudRepository, loadCloud } from '@/lib/cloud-data';
import { motivo } from '@/lib/motivo';
import { mountOriginal } from '@/lib/original-runtime.js';

const parserOptions:HTMLReactParserOptions={replace(node){if(node instanceof Element && node.name==='button'){const attrs=attributesToProps(node.attribs);return <Button variant="original" {...attrs} disabled={'disabled' in node.attribs}>{domToReact(node.children as Parameters<typeof domToReact>[0],parserOptions)}</Button>;}return undefined;}};
type Sheet={title:string;text:string;buttons:{label:string;cls?:string;fn?:()=>void|Promise<void>}[]};
export function AssessmentApp(){
 const host=useRef<HTMLDivElement>(null),runtime=useRef<ReturnType<typeof mountOriginal>|null>(null);
 const [html,setHtml]=useState(''),[sheet,setSheet]=useState<Sheet|null>(null),[toast,setToast]=useState(''),[error,setError]=useState('');
 const navigate=useNavigate(),queryClient=useQueryClient();const path=useRouterState({select:s=>s.location.pathname});const initialPath=useRef(path);
 useEffect(()=>{let cancelled=false;
  async function init(){try{const {data,error:authError}=await supabase.auth.getUser();if(authError||!data.user){await navigate({to:'/login'});return;}const user=data.user;
   const loaded=await queryClient.fetchQuery({queryKey:['assessment-data',user.id],queryFn:()=>loadCloud(user.id),staleTime:0});if(cancelled||!host.current)return;
   const repo=cloudRepository(user.id,loaded.db);
   runtime.current=mountOriginal({app:host.current,path:initialPath.current,userId:user.id,email:user.email,db:loaded.db,draft:loaded.draft,...repo,render:setHtml,sheet:setSheet,toast:setToast,navigate:(to:string)=>navigate({to}),logout:async()=>{runtime.current?.destroy();runtime.current=null;await queryClient.cancelQueries();queryClient.clear();await supabase.auth.signOut();await navigate({to:'/login',replace:true});}});
  }catch(e){if(!cancelled)setError(motivo(e,'Não foi possível carregar seus dados.'));}}
  void init();return()=>{cancelled=true;runtime.current?.destroy();runtime.current=null;};
 },[queryClient]);
 useEffect(()=>{runtime.current?.syncPath(path);},[path]);
 useEffect(()=>{if(!toast)return;const timeout=setTimeout(()=>setToast(''),3500);return()=>clearTimeout(timeout);},[toast]);
 return <><div className="app" ref={host}>{error?<div className="empty"><h3>{error}</h3><Button variant="original" className="btn primary" onClick={()=>window.location.reload()}>Tentar novamente</Button></div>:html?parse(html,parserOptions):<><div className="skeleton"/><div className="skeleton"/><div className="skeleton"/></>}</div><input type="file" id="importFile" accept=".json,application/json" hidden/>{sheet&&<div className="scrim" onClick={()=>setSheet(null)}><div className="sheet" role="dialog" aria-modal="true" aria-label={sheet.title} onClick={e=>e.stopPropagation()}><h3>{sheet.title}</h3><p>{sheet.text}</p><div className="btns">{sheet.buttons.map((b,i)=><Button variant="original" key={i} className={'btn '+(b.cls??'ghost')} onClick={async()=>{setSheet(null);try{await b.fn?.();}catch(e){setToast(motivo(e,'Não foi possível salvar. Tente novamente.'));}}}>{b.label}</Button>)}</div></div></div>}{toast&&<div className="toast" role="status">{toast}</div>}</>;
}