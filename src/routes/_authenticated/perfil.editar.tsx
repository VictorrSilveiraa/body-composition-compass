import { createFileRoute } from '@tanstack/react-router';
import { AssessmentApp } from '@/components/assessment-app';
import { pageHead } from '@/lib/page-head';
export const Route=createFileRoute('/_authenticated/perfil/editar')({head:()=>pageHead('Editar perfil','Nome, CRN, especialidade e preferências de atendimento.'),component:AssessmentApp});
