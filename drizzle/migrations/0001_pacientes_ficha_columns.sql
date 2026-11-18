ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS objetivo text,
  ADD COLUMN IF NOT EXISTS observacoes text,
  ADD COLUMN IF NOT EXISTS retorno_dias integer,
  ADD COLUMN IF NOT EXISTS arquivado boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.pacientes.telefone IS 'Telefone de contato informado pelo nutricionista.';
COMMENT ON COLUMN public.pacientes.email IS 'E-mail de contato informado pelo nutricionista.';
COMMENT ON COLUMN public.pacientes.objetivo IS 'Objetivo do acompanhamento, em texto livre.';
COMMENT ON COLUMN public.pacientes.observacoes IS 'Observações gerais do nutricionista sobre a pessoa.';
COMMENT ON COLUMN public.pacientes.retorno_dias IS 'Dias sugeridos para o próximo retorno.';
COMMENT ON COLUMN public.pacientes.arquivado IS 'true quando a pessoa foi arquivada (fora da lista ativa).';