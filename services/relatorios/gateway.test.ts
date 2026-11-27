import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { test, type TestContext } from 'node:test';
import { createReportsGateway } from './gateway.ts';

const shared = 'internal-test-token-established-for-relatorios';
const jwt = 'Bearer test.portal.session';
const userId = '4e3e9d04-bf4d-4cc4-830c-7f28e6c2ad76';
const env = { PORTAL_AUTH_URL: 'https://example.test', PORTAL_PUBLIC_KEY: 'test-public-key' };
async function listen(t: TestContext, server: Server) {
  t.after(() => new Promise<void>((resolve) => {
    server.close(() => resolve());
    server.closeAllConnections();
  }));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return (server.address() as AddressInfo).port;
}

function portal(role: string, moduloUsuario = true, moduloEmpresa = true) {
  return (async (input) => {
    const path = new URL(String(input)).pathname;
    if (path === '/auth/v1/user') return Response.json({ id: userId, email: 'test@example.test', email_confirmed_at: 'a-date' });
    if (path === '/rest/v1/user_roles') return Response.json([{ role }]);
    if (path === '/rest/v1/profiles') return Response.json([{ cod_empresa_bi: 10041, filiais_permitidas: ['chevrolet'] }]);
    if (path === '/rest/v1/user_module_permissions') return Response.json([{ modulo_comercial: moduloUsuario }]);
    if (path === '/rest/v1/empresas') return Response.json([{ modulo_comercial: moduloEmpresa }]);
    return new Response(null, { status: 404 });
  }) satisfies typeof fetch;
}

test('valida o gerente e a filial antes de encaminhar a consulta com seu próprio segredo', async (t) => {
    const hits: (string | undefined)[][] = [];
    const db = await listen(t, createServer((req, res) => {
      hits.push([req.url, req.headers.authorization]);
      res.setHeader('X-Data-As-Of', new Date().toISOString());
      res.setHeader('X-Data-Version', 'version');
      res.end(JSON.stringify({ total: 1 }));
    }));
    const port = await listen(t, createReportsGateway(shared, db, env, portal('gerencial')));
    const url = `http://127.0.0.1:${port}/api/comercial/preparado/produtos`;
    assert.equal((await fetch(`${url}?cod_empresa_bi=10041`)).status, 401);
    assert.equal((await fetch(`${url}?cod_empresa_bi=1004`, { headers: { authorization: jwt } })).status, 403);
    assert.deepEqual(hits, []);
    const response = await fetch(`${url}?cod_empresa_bi=10041&limit=1`, { headers: { authorization: jwt } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('X-Data-Version'), 'version');
    assert.deepEqual(await response.json(), { total: 1 });
    assert.deepEqual(hits, [['/interno/relatorios/produtos?cod_empresa_bi=10041&limit=1', `Bearer ${shared}`]]);
});

test('aplica o módulo Comercial do usuário e da empresa, e rejeita dados vencidos', async (t) => {
    const db = await listen(t, createServer((_req, res) => {
      res.setHeader('X-Data-As-Of', new Date(Date.now() - 60_100).toISOString());
      res.end(JSON.stringify({ total: 1 }));
    }));
    const seller = await listen(t, createReportsGateway(shared, db, env, portal('vendedor', false)));
    const sellerAllowed = await listen(t, createReportsGateway(shared, db, env, portal('vendedor')));
    const moduleDisabled = await listen(t, createReportsGateway(shared, db, env, portal('gerencial', true, false)));
    const master = await listen(t, createReportsGateway(shared, db, env, portal('master')));
    const read = (port: number) => fetch(`http://127.0.0.1:${port}/api/comercial/preparado/produtos?cod_empresa_bi=10041`,
      { headers: { authorization: jwt } });
    assert.equal((await read(seller)).status, 403);
    assert.equal((await read(moduleDisabled)).status, 403);
    assert.equal((await read(sellerAllowed)).status, 503);
    assert.equal((await read(master)).status, 503);
});
