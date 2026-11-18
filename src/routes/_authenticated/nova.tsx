import { createFileRoute } from '@tanstack/react-router';
import { AssessmentApp } from '@/components/assessment-app';
import { pageHead } from '@/lib/page-head';
export const Route=createFileRoute('/_authenticated/nova')({head:()=>pageHead('Nova avaliação','Registre a avaliação física do paciente em sete etapas.'),component:AssessmentApp});
