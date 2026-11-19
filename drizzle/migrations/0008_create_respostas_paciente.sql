CREATE TABLE public.respostas_paciente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('pre_consulta', 'anamnese')),
  dados jsonb NOT NULL,
  lida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX respostas_paciente_owner_created_idx ON public.respostas_paciente (owner_id, created_at DESC);
CREATE INDEX respostas_paciente_paciente_created_idx ON public.respostas_paciente (paciente_id, created_at DESC);

GRANT SELECT, UPDATE, DELETE ON public.respostas_paciente TO authenticated;
GRANT ALL ON public.respostas_paciente TO service_role;

ALTER TABLE public.respostas_paciente ENABLE ROW LEVEL SECURITY;

CREATE POLICY own_respostas_select ON public.respostas_paciente
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY own_respostas_update ON public.respostas_paciente
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY own_respostas_delete ON public.respostas_paciente
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

COMMENT ON TABLE public.respostas_paciente IS 'Respostas de pré-consulta e anamnese enviadas pelo paciente no portal; gravadas apenas pela função de servidor (service role).';