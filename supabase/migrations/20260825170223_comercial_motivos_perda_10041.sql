create table public.comercial_motivos_perda (
  id uuid primary key default gen_random_uuid(),
  cod_empresa_bi text not null check (cod_empresa_bi = '10041'),
  id_cotacao text not null check (
    id_cotacao ~ '[^[:space:]]'
    and id_cotacao !~ '^[[:space:]]'
    and id_cotacao !~ '[[:space:]]$'
  ),
  motivo text not null check (motivo in (
    'preco', 'prazo_entrega', 'condicao_pagamento', 'concorrencia',
    'indisponibilidade_produto', 'cliente_desistiu', 'cotacao_vencida', 'outro'
  )),
  observacao text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cod_empresa_bi, id_cotacao),
  check (motivo <> 'outro' or nullif(btrim(observacao), '') is not null)
);

revoke all on table public.comercial_motivos_perda from anon, authenticated;
grant select, insert, update on table public.comercial_motivos_perda to authenticated;

alter table public.comercial_motivos_perda enable row level security;

alter table public.empresas
  add column if not exists endpoint_path_comercial_cotacoes_abertas_ch text,
  add column if not exists endpoint_path_comercial_vendas_perdidas_ch text;

create policy "Read loss reasons by company"
on public.comercial_motivos_perda for select to authenticated
using (
  public.is_master_user()
  or (
    cod_empresa_bi = public.get_user_empresa()
    and exists (
      select 1 from public.user_module_permissions ump
      where ump.user_id = (select auth.uid()) and ump.modulo_comercial
    )
  )
);

create policy "Insert loss reasons by company"
on public.comercial_motivos_perda for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (
    public.is_master_user()
    or (
      cod_empresa_bi = public.get_user_empresa()
      and exists (
        select 1 from public.user_module_permissions ump
        where ump.user_id = (select auth.uid()) and ump.modulo_comercial
      )
    )
  )
);

create policy "Update loss reasons by company"
on public.comercial_motivos_perda for update to authenticated
using (
  public.is_master_user()
  or (
    cod_empresa_bi = public.get_user_empresa()
    and exists (
      select 1 from public.user_module_permissions ump
      where ump.user_id = (select auth.uid()) and ump.modulo_comercial
    )
  )
)
with check (
  public.is_master_user()
  or (
    cod_empresa_bi = public.get_user_empresa()
    and exists (
      select 1 from public.user_module_permissions ump
      where ump.user_id = (select auth.uid()) and ump.modulo_comercial
    )
  )
);

create or replace function public.preserve_comercial_motivos_perda_creation_metadata()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.created_by = old.created_by;
  new.created_at = old.created_at;
  return new;
end;
$$;

create trigger trg_comercial_motivos_perda_preserve_creation_metadata
before update on public.comercial_motivos_perda
for each row execute function public.preserve_comercial_motivos_perda_creation_metadata();

create trigger trg_comercial_motivos_perda_updated_at
before update on public.comercial_motivos_perda
for each row execute function public.update_updated_at_column();
