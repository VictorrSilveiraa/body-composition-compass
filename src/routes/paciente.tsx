import { createFileRoute } from '@tanstack/react-router';
import { PatientPortal } from '@/components/patient-portal';
import { pageHead } from '@/lib/page-head';
// Portal do paciente: entrada pelo código de acesso, somente leitura (não usa a conta do nutricionista).
export const Route=createFileRoute('/paciente')({ssr:false,head:()=>pageHead('Portal do paciente','Acompanhe suas avaliações físicas, medidas e evolução com o código enviado pelo seu nutricionista.'),component:()=> <PatientPortal />});
