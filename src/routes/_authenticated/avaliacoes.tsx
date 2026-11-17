import { createFileRoute } from '@tanstack/react-router';
import { AssessmentApp } from '@/components/assessment-app';
import { pageHead } from '@/lib/page-head';
export const Route=createFileRoute('/_authenticated/avaliacoes')({head:()=>pageHead('Avaliações','Histórico das suas avaliações físicas.'),component:AssessmentApp});
