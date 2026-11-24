-- Os relatórios são persistidos no SQL Server interno.
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
