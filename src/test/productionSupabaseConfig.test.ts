import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import { assertProductionSupabaseConfig } from '../../scripts/validateSupabaseConfig';

const project = 'testprojectref';
const jwt = (role: string, ref = project) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role, ref })).toString('base64url')}.testsignature`;
const configuration = (key = jwt('anon')) => ({
  VITE_SUPABASE_URL: `https://${project}.supabase.co`,
  VITE_SUPABASE_PUBLISHABLE_KEY: key,
});

describe('configuração de autenticação no build de produção', () => {
  it('aceita chave pública e JWT anônimo do projeto configurado', () => {
    expect(() => assertProductionSupabaseConfig(configuration())).not.toThrow();
    expect(() => assertProductionSupabaseConfig(configuration('sb_publishable_testpublicvalue'))).not.toThrow();
  });

  it.each([
    {},
    { ...configuration(), VITE_SUPABASE_URL: '' },
    { ...configuration(), VITE_SUPABASE_PUBLISHABLE_KEY: '' },
    { ...configuration(), VITE_SUPABASE_URL: 'https://example.supabase.co' },
    { ...configuration(), VITE_SUPABASE_URL: 'https://localhost' },
    { ...configuration(), VITE_SUPABASE_URL: 'http://testprojectref.supabase.co' },
    configuration('local-preview-key'),
    configuration('sb_publishable_your_key_here'),
    configuration('sb_secret_testsecretvalue'),
    configuration(jwt('service_role')),
    configuration(jwt('anon', 'anotherproject')),
    configuration('eyJ.invalid.signature'),
    configuration(`notjson.${jwt('anon').split('.')[1]}.sig`),
    configuration(` ${jwt('anon')}`),
  ])('rejeita valores incorretos ou privilegiados sem expô-los (%#)', (env) => {
    expect(() => assertProductionSupabaseConfig(env)).toThrow(/VITE_SUPABASE/);
    try {
      assertProductionSupabaseConfig(env);
    } catch (error) {
      expect(String(error)).not.toContain('testsecretvalue');
      expect(String(error)).not.toContain('testsignature');
    }
  });
});
