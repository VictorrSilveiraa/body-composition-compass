import { createFileRoute, redirect, Outlet } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
// getSession é local (não vai ao servidor a cada clique); os dados continuam protegidos pelo RLS do banco.
export const Route=createFileRoute('/_authenticated')({ssr:false,beforeLoad:async()=>{const {data}=await supabase.auth.getSession();if(!data.session)throw redirect({to:'/auth'});},component:Outlet});
