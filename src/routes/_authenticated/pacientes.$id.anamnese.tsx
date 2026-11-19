import { createFileRoute } from '@tanstack/react-router';
import { AssessmentApp } from '@/components/assessment-app';
import { pageHead } from '@/lib/page-head';
export const Route=createFileRoute('/_authenticated/pacientes/$id/anamnese')({head:()=>pageHead('Anamnese','Saúde, medicamentos, alergias, rotina, sono, intestino, treino, histórico de peso e exames do paciente.'),component:AssessmentApp});
