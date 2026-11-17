import { createFileRoute } from '@tanstack/react-router';
import { AssessmentApp } from '@/components/assessment-app';
import { pageHead } from '@/lib/page-head';
export const Route=createFileRoute('/_authenticated/pessoa/nova')({head:()=>pageHead('Nova pessoa','Cadastre a pessoa que será avaliada.'),component:AssessmentApp});
