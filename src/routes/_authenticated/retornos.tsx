import { createFileRoute } from '@tanstack/react-router';
import { AssessmentApp } from '@/components/assessment-app';
import { pageHead } from '@/lib/page-head';
export const Route=createFileRoute('/_authenticated/retornos')({head:()=>pageHead('Retornos da semana','Pacientes com retorno atrasado ou nos próximos 7 dias, com mensagem pronta para o WhatsApp.'),component:AssessmentApp});
