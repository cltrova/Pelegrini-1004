import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260825170223_comercial_motivos_perda_10041.sql',
);
const sql = readFileSync(migrationPath, 'utf8');
const normalizedSql = sql.replace(/\s+/g, ' ').trim().toLowerCase();
const legacyDataApiPrivileges = ['select', 'insert', 'update', 'delete'] as const;

function effectiveDataApiPrivileges() {
  const privileges = new Map([
    ['anon', new Set<string>(legacyDataApiPrivileges)],
    ['authenticated', new Set<string>(legacyDataApiPrivileges)],
  ]);
  const statements = normalizedSql.matchAll(
    /\b(grant|revoke)\s+(.+?)\s+on\s+table\s+public\.comercial_motivos_perda\s+(?:to|from)\s+(.+?);/g,
  );

  for (const [, action, privilegeList, roleList] of statements) {
    const statementPrivileges = privilegeList === 'all'
      ? legacyDataApiPrivileges
      : privilegeList.split(',').map((privilege) => privilege.trim());
    const roles = roleList.split(',').map((role) => role.trim());

    for (const role of roles) {
      const rolePrivileges = privileges.get(role);
      if (!rolePrivileges) continue;

      for (const privilege of statementPrivileges) {
        if (action === 'grant') rolePrivileges.add(privilege);
        else rolePrivileges.delete(privilege);
      }
    }
  }

  return privileges;
}

function policy(name: string) {
  const match = normalizedSql.match(new RegExp(
    `create policy "${name.toLowerCase()}" on public\\.comercial_motivos_perda .*?;`,
  ));
  expect(match, `missing policy: ${name}`).not.toBeNull();
  return match?.[0] ?? '';
}

function quotationIdCheckAccepts(value: string) {
  const expression = normalizedSql.match(
    /id_cotacao text not null check \((.*?)\), motivo text/,
  )?.[1].trim();

  expect(expression).toBe(
    "id_cotacao ~ '[^[:space:]]' and id_cotacao !~ '^[[:space:]]' and id_cotacao !~ '[[:space:]]$'",
  );

  const posixAsciiWhitespace = new Set([' ', '\t', '\n', '\r', '\f', '\v']);
  return [...value].some((character) => !posixAsciiWhitespace.has(character))
    && !posixAsciiWhitespace.has(value[0])
    && !posixAsciiWhitespace.has(value[value.length - 1]);
}

describe('comercial_motivos_perda migration contract', () => {
  it('reduces legacy Data API grants to the intended effective privileges', () => {
    const privileges = effectiveDataApiPrivileges();

    expect([...privileges.get('anon') ?? []].sort()).toEqual([]);
    expect([...privileges.get('authenticated') ?? []].sort()).toEqual([
      'insert',
      'select',
      'update',
    ]);
  });

  it('restricts rows to company 10041', () => {
    expect(normalizedSql).toContain(
      "cod_empresa_bi text not null check (cod_empresa_bi = '10041')",
    );
  });

  it('rejects all-whitespace and edge-padded quotation ids with PostgreSQL POSIX whitespace semantics', () => {
    expect([
      '\t',
      '\n',
      '\r\n',
      ' \t\n',
    ].map(quotationIdCheckAccepts)).toEqual([false, false, false, false]);
    expect([
      ' 9012',
      '\t9012',
      '\n9012',
      '9012 ',
      '9012\t',
      '9012\n',
      '\f9012',
      '9012\v',
    ].map(quotationIdCheckAccepts)).toEqual([
      false, false, false, false, false, false, false, false,
    ]);
    expect(quotationIdCheckAccepts('9012')).toBe(true);
    expect(quotationIdCheckAccepts('90 12')).toBe(true);
  });

  it('enables RLS with authenticated company and commercial-module policies', () => {
    expect(normalizedSql).toContain(
      'alter table public.comercial_motivos_perda enable row level security;',
    );

    const readPolicy = policy('Read loss reasons by company');
    expect(readPolicy).toContain('for select to authenticated');
    expect(readPolicy).toContain('cod_empresa_bi = public.get_user_empresa()');
    expect(readPolicy).toContain(
      'ump.user_id = (select auth.uid()) and ump.modulo_comercial',
    );

    const insertPolicy = policy('Insert loss reasons by company');
    expect(insertPolicy).toContain('for insert to authenticated with check');
    expect(insertPolicy).toContain('created_by = (select auth.uid())');
    expect(insertPolicy).toContain('cod_empresa_bi = public.get_user_empresa()');
    expect(insertPolicy).toContain(
      'ump.user_id = (select auth.uid()) and ump.modulo_comercial',
    );

    const updatePolicy = policy('Update loss reasons by company');
    expect(updatePolicy).toContain('for update to authenticated using');
    expect(updatePolicy).toContain('with check');
    expect(updatePolicy.match(/cod_empresa_bi = public\.get_user_empresa\(\)/g)).toHaveLength(2);
    expect(updatePolicy.match(
      /ump\.user_id = \(select auth\.uid\(\)\) and ump\.modulo_comercial/g,
    )).toHaveLength(2);
  });

  it('preserves creation ownership metadata and updates updated_at', () => {
    expect(normalizedSql).toContain('new.created_by = old.created_by;');
    expect(normalizedSql).toContain('new.created_at = old.created_at;');
    expect(normalizedSql).toContain(
      'create trigger trg_comercial_motivos_perda_preserve_creation_metadata before update on public.comercial_motivos_perda for each row execute function public.preserve_comercial_motivos_perda_creation_metadata();',
    );
    expect(normalizedSql).toContain(
      'create trigger trg_comercial_motivos_perda_updated_at before update on public.comercial_motivos_perda for each row execute function public.update_updated_at_column();',
    );
  });
});
