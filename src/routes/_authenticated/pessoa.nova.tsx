import { createFileRoute } from '@tanstack/react-router';
import { AssessmentApp } from '@/components/assessment-app';
import { pageHead } from '@/lib/page-head';
export const Route=createFileRoute('/_authenticated/pessoa/nova')({head:()=>pageHead('Novo paciente','Cadastre um paciente com dados, contato e objetivo.'),component:AssessmentApp});
