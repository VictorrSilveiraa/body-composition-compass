import { createFileRoute } from '@tanstack/react-router';
import { AssessmentApp } from '@/components/assessment-app';
import { pageHead } from '@/lib/page-head';
export const Route=createFileRoute('/_authenticated/avaliacoes/$id/editar')({head:()=>pageHead('Editar avaliação','Atualize as medidas da avaliação física do paciente.'),component:AssessmentApp});
