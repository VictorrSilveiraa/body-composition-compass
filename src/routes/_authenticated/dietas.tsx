import { createFileRoute } from '@tanstack/react-router';
import { AssessmentApp } from '@/components/assessment-app';
import { pageHead } from '@/lib/page-head';
export const Route=createFileRoute('/_authenticated/dietas')({head:()=>pageHead('Plano alimentar','Planos alimentares de cada paciente, importados do PDF do WebDiet.'),component:AssessmentApp});
