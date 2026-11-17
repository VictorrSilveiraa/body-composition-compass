import { createFileRoute } from '@tanstack/react-router';
import { AssessmentApp } from '@/components/assessment-app';
import { pageHead } from '@/lib/page-head';
export const Route=createFileRoute('/_authenticated/evolucao')({head:()=>pageHead('Evolução','Compare avaliações e acompanhe suas medidas.'),component:AssessmentApp});
