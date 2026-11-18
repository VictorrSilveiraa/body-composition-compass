CREATE TABLE public.fotos_avaliacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  avaliacao_id uuid NOT NULL REFERENCES public.avaliacoes(id) ON DELETE CASCADE,
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  pose text NOT NULL CHECK (pose IN ('frente', 'costas', 'lado_direito', 'lado_esquerdo')),
  caminho text NOT NULL,
  largura integer,
  altura integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fotos_avaliacao TO authenticated;
GRANT ALL ON public.fotos_avaliacao TO service_role;
ALTER TABLE public.fotos_avaliacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_photos ON public.fotos_avaliacao FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE INDEX fotos_avaliacao_avaliacao_id_idx ON public.fotos_avaliacao (avaliacao_id);
CREATE INDEX fotos_avaliacao_paciente_id_idx ON public.fotos_avaliacao (paciente_id);
CREATE POLICY fotos_avaliacoes_select ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'fotos-avaliacoes' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY fotos_avaliacoes_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'fotos-avaliacoes' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY fotos_avaliacoes_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'fotos-avaliacoes' AND (storage.foldername(name))[1] = auth.uid()::text) WITH CHECK (bucket_id = 'fotos-avaliacoes' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY fotos_avaliacoes_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'fotos-avaliacoes' AND (storage.foldername(name))[1] = auth.uid()::text);
ALTER TABLE public.rascunhos DROP CONSTRAINT rascunhos_passo_check;
ALTER TABLE public.rascunhos ADD CONSTRAINT rascunhos_passo_check CHECK (passo BETWEEN 0 AND 7);