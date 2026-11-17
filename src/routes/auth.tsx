import { createFileRoute } from '@tanstack/react-router';
import { AuthScreen } from '@/components/auth-screen';
import { pageHead } from '@/lib/page-head';
export const Route=createFileRoute('/auth')({head:()=>pageHead('Acesso à conta','Acesse sua conta do Avaliação Física com segurança.'),component:()=> <AuthScreen />});
