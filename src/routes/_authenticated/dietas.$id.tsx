import { createFileRoute } from '@tanstack/react-router';
import { AssessmentApp } from '@/components/assessment-app';
import { pageHead } from '@/lib/page-head';
export const Route=createFileRoute('/_authenticated/dietas/$id')({head:()=>pageHead('Plano alimentar','Refeições, opções, substituições e lista de compras do paciente.'),component:AssessmentApp});
