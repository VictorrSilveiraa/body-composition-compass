import { createFileRoute } from '@tanstack/react-router';
import { AssessmentApp } from '@/components/assessment-app';
import { pageHead } from '@/lib/page-head';
export const Route=createFileRoute('/_authenticated/perfil')({head:()=>pageHead('Perfil profissional','Seus dados de nutricionista, indicadores dos pacientes e backup.'),component:AssessmentApp});
