import { createFileRoute } from '@tanstack/react-router';
import { AssessmentApp } from '@/components/assessment-app';
import { pageHead } from '@/lib/page-head';
export const Route=createFileRoute('/_authenticated/pacientes/$id')({head:()=>pageHead('Ficha do paciente','Dados, contato, resultados atuais e avaliações do paciente.'),component:AssessmentApp});
