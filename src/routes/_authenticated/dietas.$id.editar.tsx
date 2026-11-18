import { createFileRoute } from '@tanstack/react-router';
import { AssessmentApp } from '@/components/assessment-app';
import { pageHead } from '@/lib/page-head';
export const Route=createFileRoute('/_authenticated/dietas/$id/editar')({head:()=>pageHead('Editar plano alimentar','Revise refeições, quantidades e substituições do plano.'),component:AssessmentApp});
