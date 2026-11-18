CREATE TABLE public.acessos_paciente (
  paciente_id uuid PRIMARY KEY,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  codigo text NOT NULL UNIQUE CHECK (codigo ~ '^[A-Z0-9]{8}$'),
  ativo boolean NOT NULL DEFAULT true,
  compartilhar_fotos boolean NOT NULL DEFAULT true,
  compartilhar_notas boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now(),
  ultimo_acesso timestamptz,
  CONSTRAINT acessos_paciente_paciente_id_owner_id_fkey FOREIGN KEY (paciente_id, owner_id) REFERENCES public.pacientes(id, owner_id) ON DELETE CASCADE
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.acessos_paciente TO authenticated;
GRANT ALL ON public.acessos_paciente TO service_role;
ALTER TABLE public.acessos_paciente ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_patient_access ON public.acessos_paciente FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());