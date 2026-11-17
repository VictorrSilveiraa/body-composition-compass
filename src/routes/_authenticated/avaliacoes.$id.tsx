import { createFileRoute } from '@tanstack/react-router';
import { AssessmentApp } from '@/components/assessment-app';
import { pageHead } from '@/lib/page-head';
export const Route=createFileRoute('/_authenticated/avaliacoes/$id')({head:()=>pageHead('Detalhe da avaliação','Medidas, composição corporal e resultados da avaliação.'),component:AssessmentApp});
