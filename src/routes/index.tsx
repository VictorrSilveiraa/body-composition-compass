import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppSkeleton, AssessmentApp, hasLiveApp } from '@/components/assessment-app';
import { AuthScreen } from '@/components/auth-screen';
import { pageHead } from '@/lib/page-head';
export const Route=createFileRoute('/')({head:()=>pageHead('Painel','Acompanhe seus pacientes: avaliações físicas, composição corporal e evolução a cada consulta.'),component:Home});
// getSession lê a sessão salva no aparelho (sem ida ao servidor): voltar ao início não pisca a tela.
// E escuta o login/saída: quem entra por esta mesma página vai direto para o painel, sem precisar recarregar.
function Home(){const [signed,setSigned]=useState<boolean|null>(()=>hasLiveApp()?true:null);useEffect(()=>{let alive=true;void supabase.auth.getSession().then(({data})=>{if(alive)setSigned(!!data.session);});const {data:sub}=supabase.auth.onAuthStateChange((_event,session)=>{if(alive)setSigned(!!session);});return()=>{alive=false;sub.subscription.unsubscribe();};},[]);if(signed===null)return <main className="app"><AppSkeleton/></main>;return signed?<AssessmentApp/>:<AuthScreen/>;}
