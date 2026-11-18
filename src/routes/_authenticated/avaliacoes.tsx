import { createFileRoute } from '@tanstack/react-router';
import { AssessmentApp } from '@/components/assessment-app';
import { pageHead } from '@/lib/page-head';
export const Route=createFileRoute('/_authenticated/avaliacoes')({head:()=>pageHead('Avaliações','Histórico das avaliações físicas de cada paciente.'),component:AssessmentApp});
