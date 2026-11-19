GRANT INSERT ON public.respostas_paciente TO authenticated;

CREATE POLICY own_respostas_insert
  ON public.respostas_paciente
  FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id = paciente_id
        AND p.owner_id = auth.uid()
    )
  );