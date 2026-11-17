import { createFileRoute } from '@tanstack/react-router';
import { AssessmentApp } from '@/components/assessment-app';
import { pageHead } from '@/lib/page-head';
export const Route=createFileRoute('/_authenticated/pessoa/$id/editar')({head:()=>pageHead('Editar pessoa','Atualize os dados da pessoa avaliada.'),component:AssessmentApp});
