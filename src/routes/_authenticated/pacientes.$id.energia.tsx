import { createFileRoute } from '@tanstack/react-router';
import { AssessmentApp } from '@/components/assessment-app';
import { pageHead } from '@/lib/page-head';
export const Route=createFileRoute('/_authenticated/pacientes/$id/energia')({head:()=>pageHead('Gasto energético','Metabolismo basal, gasto total, meta calórica e macronutrientes do paciente.'),component:AssessmentApp});
