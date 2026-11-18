CREATE TABLE public.dietas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  paciente_id uuid NOT NULL,
  avaliacao_id uuid REFERENCES public.avaliacoes(id) ON DELETE SET NULL,
  titulo text NOT NULL DEFAULT 'Plano alimentar',
  prescrito_em date,
  dados jsonb NOT NULL,
  visivel_paciente boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dietas_paciente_owner_fkey FOREIGN KEY (paciente_id, owner_id) REFERENCES public.pacientes(id, owner_id) ON DELETE CASCADE
);

CREATE INDEX dietas_paciente_id_idx ON public.dietas (paciente_id);

CREATE OR REPLACE FUNCTION public.touch_diet_updated()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER dietas_touch_updated
BEFORE UPDATE ON public.dietas
FOR EACH ROW EXECUTE FUNCTION public.touch_diet_updated();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dietas TO authenticated;
GRANT ALL ON public.dietas TO service_role;

ALTER TABLE public.dietas ENABLE ROW LEVEL SECURITY;

CREATE POLICY own_diets ON public.dietas
FOR ALL TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());