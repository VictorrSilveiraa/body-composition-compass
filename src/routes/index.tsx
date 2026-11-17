import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AssessmentApp } from '@/components/assessment-app';
import { AuthScreen } from '@/components/auth-screen';
import { pageHead } from '@/lib/page-head';
export const Route=createFileRoute('/')({head:()=>pageHead('Seu painel','Acompanhe avaliações físicas, composição corporal e sua evolução em cada consulta.'),component:Home});
function Home(){const [signed,setSigned]=useState<boolean|null>(null);useEffect(()=>{let alive=true;void supabase.auth.getUser().then(({data})=>{if(alive)setSigned(!!data.user);});return()=>{alive=false;};},[]);if(signed===null)return <main className="app"><div className="skeleton"/></main>;return signed?<AssessmentApp/>:<AuthScreen/>;}
