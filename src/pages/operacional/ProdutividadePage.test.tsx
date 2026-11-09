import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buscarProdutividade } from './ProdutividadePage';
import { buildOperacionalMenuItems } from '@/components/layout/operacionalSidebarItems';
import type { Empresa } from '@/hooks/useEmpresaConfig';
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'test-session' } } }) } } }));
const empresa = { cod_empresa_bi: '10041', usar_vps_intermediaria: true, vps_base_url: 'http://187.77.203.16', vps_cliente_identificador: 'pelegrini' } as Empresa;
const resposta = {cod_empresa_bi:10041,cod_empresas:[2],resumo:{},por_dia_responsavel:[{cod_empresa_bi:10041,cod_empresa:2}]};
beforeEach(() => vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify(resposta),{status:200}))));
describe('produtividade Chevrolet', () => {
 it('consulta o período e filial pelo proxy com a sessão', async () => {await buscarProdutividade(empresa,'2026-11-03','2026-11-07','2'); const [url,options]=vi.mocked(fetch).mock.calls[0]; const path=new URL(String(url),'https://local.test').searchParams.get('path'); expect(path).toContain('cod_empresa_bi=10041'); expect(path).toContain('cod_empresa=2'); expect(path).toContain('data_ini=2026-11-03');expect(options?.headers).toMatchObject({Authorization:'Bearer test-session'});});
 it('rejeita dados de outra empresa mesmo se o servidor responder 200', async () => {vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({...resposta,por_dia_responsavel:[{cod_empresa_bi:10041,cod_empresa:80}]}),{status:200}));await expect(buscarProdutividade(empresa,'2026-11-03','2026-11-07','')).rejects.toThrow('Casa Chevrolet');});
 it('mostra a navegação apenas no contexto Chevrolet', () => {expect(buildOperacionalMenuItems('1004','chevrolet').some(x=>x.path==='/operacional/produtividade')).toBe(true);expect(buildOperacionalMenuItems('10041','chevrolet').some(x=>x.path==='/operacional/produtividade')).toBe(true);expect(buildOperacionalMenuItems('1004','transmissao').some(x=>x.path==='/operacional/produtividade')).toBe(false);});
});
