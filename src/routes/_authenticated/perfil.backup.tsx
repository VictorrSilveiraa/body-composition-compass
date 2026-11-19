import { createFileRoute } from '@tanstack/react-router';
import { AssessmentApp } from '@/components/assessment-app';
import { pageHead } from '@/lib/page-head';
export const Route=createFileRoute('/_authenticated/perfil/backup')({head:()=>pageHead('Backup','Exporte e importe pacientes, avaliações, metas, planos alimentares e fotos escolhendo o que levar.'),component:AssessmentApp});
