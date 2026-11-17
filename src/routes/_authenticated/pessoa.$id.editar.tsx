import { createFileRoute } from '@tanstack/react-router';
import { AssessmentApp } from '@/components/assessment-app';
import { pageHead } from '@/lib/page-head';
export const Route=createFileRoute('/_authenticated/pessoa/$id/editar')({head:()=>pageHead('Editar paciente','Atualize dados, contato, objetivo e observações do paciente.'),component:AssessmentApp});
