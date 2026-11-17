import { createFileRoute } from '@tanstack/react-router';
import { AssessmentApp } from '@/components/assessment-app';
import { pageHead } from '@/lib/page-head';
export const Route=createFileRoute('/_authenticated/perfil')({head:()=>pageHead('Perfil','Gerencie pessoas avaliadas e seus dados.'),component:AssessmentApp});
