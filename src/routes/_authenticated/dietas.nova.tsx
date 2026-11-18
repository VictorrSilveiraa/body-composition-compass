import { createFileRoute } from '@tanstack/react-router';
import { AssessmentApp } from '@/components/assessment-app';
import { pageHead } from '@/lib/page-head';
export const Route=createFileRoute('/_authenticated/dietas/nova')({head:()=>pageHead('Importar plano alimentar','Envie o PDF da dieta exportado do WebDiet e revise antes de publicar.'),component:AssessmentApp});
