import { createFileRoute } from '@tanstack/react-router';
import { AuthScreen } from '@/components/auth-screen';
import { pageHead } from '@/lib/page-head';
export const Route=createFileRoute('/reset-password')({head:()=>pageHead('Redefinir senha','Acesse sua conta do Avaliação Física com segurança.'),component:()=> <AuthScreen recovery />});
