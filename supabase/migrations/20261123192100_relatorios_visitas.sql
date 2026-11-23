CREATE TABLE public.relatorios_visitas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cod_empresa_bi text NOT NULL,
  filial_id text NOT NULL,
  visitador_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  visitador_nome text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  data_visita date NOT NULL,
  nome_cliente text NOT NULL CHECK (char_length(btrim(nome_cliente)) BETWEEN 1 AND 200),
  cnpj text NOT NULL CHECK (char_length(cnpj) <= 24),
  cidade text NOT NULL CHECK (char_length(cidade) <= 200),
  segmento text NOT NULL CHECK (char_length(segmento) <= 200),
  diesel text NOT NULL CHECK (char_length(diesel) <= 200),
  responsaveis_compras text NOT NULL CHECK (char_length(responsaveis_compras) <= 200),
  funcao text NOT NULL CHECK (char_length(funcao) <= 200),
  avaliacoes jsonb NOT NULL CHECK (
    jsonb_typeof(avaliacoes) = 'object'
    AND avaliacoes ?& ARRAY['Atendimento', 'Entrega', 'Preço', 'Prazo']
    AND avaliacoes - ARRAY['Atendimento', 'Entrega', 'Preço', 'Prazo'] = '{}'::jsonb
    AND NOT jsonb_path_exists(avaliacoes, 'strict $.* ? (@.type() != "array")')
    AND NOT jsonb_path_exists(avaliacoes, 'strict $.* ? (@.size() != 3)')
    AND NOT jsonb_path_exists(avaliacoes, 'strict $.*[*] ? (@.type() != "string")')
    AND octet_length(avaliacoes::text) <= 160000
  ),
  CHECK (
    (cod_empresa_bi = '1004' AND filial_id IN ('chevrolet', 'transmissao'))
    OR (cod_empresa_bi = '10041' AND filial_id = 'chevrolet')
  )
);

CREATE INDEX relatorios_visitas_filial_data_idx
  ON public.relatorios_visitas (filial_id, data_visita DESC, criado_em DESC, id);
CREATE INDEX relatorios_visitas_visitador_data_idx
  ON public.relatorios_visitas (visitador_id, data_visita DESC, criado_em DESC, id);

ALTER TABLE public.relatorios_visitas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.relatorios_visitas FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.relatorios_visitas TO authenticated;
GRANT INSERT (
  cod_empresa_bi, filial_id, data_visita, nome_cliente, cnpj, cidade, segmento,
  diesel, responsaveis_compras, funcao, avaliacoes
) ON public.relatorios_visitas TO authenticated;

CREATE FUNCTION public.definir_autoria_relatorio_visita()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  SELECT COALESCE(NULLIF(btrim(p.nome), ''), p.email, 'Visitador')
    INTO NEW.visitador_nome
    FROM public.profiles p
    WHERE p.user_id = auth.uid();
  RETURN NEW;
END;
$$;

CREATE TRIGGER definir_autoria_relatorio_visita
  BEFORE INSERT ON public.relatorios_visitas
  FOR EACH ROW EXECUTE FUNCTION public.definir_autoria_relatorio_visita();

CREATE POLICY visitador_envia_relatorio ON public.relatorios_visitas
  FOR INSERT TO authenticated
  WITH CHECK (
    visitador_id = (SELECT auth.uid())
    AND (SELECT public.has_role(auth.uid(), 'visitador'))
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.cod_empresa_bi = relatorios_visitas.cod_empresa_bi
        AND relatorios_visitas.filial_id = ANY(COALESCE(p.filiais_permitidas, ARRAY[p.filial_id]))
        AND NOT p.must_change_password
    )
  );

CREATE POLICY visitador_le_proprios_relatorios ON public.relatorios_visitas
  FOR SELECT TO authenticated
  USING (
    visitador_id = (SELECT auth.uid())
    AND (SELECT public.has_role(auth.uid(), 'visitador'))
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid()) AND NOT p.must_change_password
    )
  );

CREATE POLICY gerencia_le_relatorios_da_filial ON public.relatorios_visitas
  FOR SELECT TO authenticated
  USING (
    NOT (SELECT public.has_role(auth.uid(), 'visitador'))
    AND (
      (SELECT public.has_role(auth.uid(), 'master'))
      OR (
        (SELECT public.has_role(auth.uid(), 'gerencial'))
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.user_id = (SELECT auth.uid()) AND NOT p.must_change_password
            AND relatorios_visitas.filial_id = ANY(COALESCE(p.filiais_permitidas, ARRAY[p.filial_id]))
            AND (
              p.cod_empresa_bi = relatorios_visitas.cod_empresa_bi
              OR (relatorios_visitas.filial_id = 'chevrolet' AND p.cod_empresa_bi IN ('1004', '10041'))
            )
        )
      )
    )
  );

-- Empresa e filiais do perfil passam a ser usadas para autorizar acesso aos relatórios.
CREATE FUNCTION public.proteger_escopo_relatorios_visitas()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF current_user <> 'authenticated' OR public.has_role(auth.uid(), 'master') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF (NEW.user_id, NEW.cod_empresa_bi, NEW.filial_id, NEW.filiais_permitidas)
       IS NOT DISTINCT FROM (OLD.user_id, OLD.cod_empresa_bi, OLD.filial_id, OLD.filiais_permitidas) THEN
      RETURN NEW;
    END IF;
    IF public.has_role(OLD.user_id, 'visitador') OR public.has_role(OLD.user_id, 'gerencial')
       OR public.has_role(OLD.user_id, 'master') THEN
      RAISE EXCEPTION 'Somente o master pode alterar a empresa ou as filiais deste perfil.' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF public.has_role(NEW.user_id, 'visitador') OR public.has_role(NEW.user_id, 'gerencial')
     OR public.has_role(NEW.user_id, 'master') THEN
    RAISE EXCEPTION 'Somente o master pode definir a empresa ou as filiais deste perfil.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER proteger_escopo_relatorios_visitas
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.proteger_escopo_relatorios_visitas();
