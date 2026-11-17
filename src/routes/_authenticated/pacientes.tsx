import { createFileRoute } from '@tanstack/react-router';
import { AssessmentApp } from '@/components/assessment-app';
import { pageHead } from '@/lib/page-head';
export const Route=createFileRoute('/_authenticated/pacientes')({head:()=>pageHead('Pacientes','Lista de pacientes com busca, filtros por retorno e situação de cada acompanhamento.'),component:AssessmentApp});
