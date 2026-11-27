import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createDailyCommercialInsights, getDailyInsightSlot, readGeneratedInsights } from './daily-commercial-insights.ts';
import { loadCommercialAnalysisInput } from './daily-commercial-source.ts';
import type { CommercialInsight, InsightsBranch } from './daily-insight-types.ts';

const insight: CommercialInsight = { tipo: 'info', titulo: 'Carteira do mês', descricao: 'Confira as vendas do período.' };
const log = { info() {}, warn() {} };

test('agenda as análises às 7h de Brasília e usa dados até ontem', () => {
  assert.equal(getDailyInsightSlot(new Date('2026-11-27T09:59:59Z')), null);
  assert.deepEqual(getDailyInsightSlot(new Date('2026-11-27T10:00:00Z')), {
    dia: '2026-11-27', periodo: { inicio: '2026-11-01', fim: '2026-11-26' },
  });
  assert.deepEqual(getDailyInsightSlot(new Date('2026-12-01T10:00:00Z')), {
    dia: '2026-12-01', periodo: { inicio: '2026-11-01', fim: '2026-11-30' },
  });
});

test('persiste a geração por filial e a reaproveita após reiniciar o serviço', async (t) => {
  const dataDir = await mkdtemp(join(tmpdir(), 'pelegrini-insights-'));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const calls: InsightsBranch[] = [];
  const options = { dataDir, log, generate: async (branch: InsightsBranch) => { calls.push(branch); return [insight]; } };
  const first = createDailyCommercialInsights(options);
  const now = new Date('2026-11-27T10:00:00Z');
  assert.equal(await first.read('transmissao'), null);
  await Promise.all([first.runDue(now), first.runDue(now)]);
  const restarted = createDailyCommercialInsights(options);
  await restarted.runDue(now);

  assert.deepEqual(calls, ['transmissao', 'chevrolet']);
  assert.deepEqual(await restarted.read('chevrolet'), { ...getDailyInsightSlot(now), insights: [insight] });
});

test('mantém o último resultado e repete apenas o processamento da filial que falhou', async (t) => {
  const dataDir = await mkdtemp(join(tmpdir(), 'pelegrini-insights-'));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  let failure = false;
  const calls: InsightsBranch[] = [];
  const service = createDailyCommercialInsights({
    dataDir, log,
    async generate(branch) {
      calls.push(branch);
      if (failure && branch === 'transmissao') throw new Error('RSYS indisponível');
      return [insight];
    },
  });
  await service.runDue(new Date('2026-11-26T10:00:00Z'));
  calls.length = 0;
  failure = true;
  await service.runDue(new Date('2026-11-27T10:00:00Z'));
  await service.runDue(new Date('2026-11-27T10:01:00Z'));
  assert.equal((await service.read('transmissao'))?.dia, '2026-11-26');
  assert.equal((await service.read('chevrolet'))?.dia, '2026-11-27');
  failure = false;
  await service.runDue(new Date('2026-11-27T10:30:00Z'));
  assert.deepEqual(calls, ['transmissao', 'chevrolet', 'transmissao']);
  assert.equal((await service.read('transmissao'))?.dia, '2026-11-27');
});

test('envia à IA somente as metas e os totais agregados da filial correta', async () => {
  const periodo = { inicio: '2026-11-01', fim: '2026-11-26' };
  const env = { PELEGRINI_RSYS_URL: 'https://rsys.example.test/pelegrini' };
  const row = {
    CodEmpresa_bi: 10041, Vendedor: 47, NomeVendedor: 'VENDEDOR QA', ObjetivoMensal: 2000,
    FaturadoAteHoje: 1000, AFaturar: 125, ObjetivoAteHoje: 1500, contato: 'dado ignorado',
  };
  const input = await loadCommercialAnalysisInput('chevrolet', periodo, env, async (request) => {
    const url = new URL(String(request));
    assert.equal(url.pathname, '/pelegrini/comercial/comissoes_ch');
    assert.equal(url.searchParams.get('cod_empresa_bi'), '10041');
    assert.equal(url.searchParams.get('data_fim'), periodo.fim);
    return Response.json([row]);
  });
  assert.equal(input.kpis.totalFaturado, 1000);
  assert.deepEqual(input.vendedores, [{
    nome: 'VENDEDOR QA', metaMensal: 2000, faturamentoMesAtual: 1000, valorPendente: 125,
    percentualMetaFaturado: 50, metaEsperada: 1500,
  }]);

  await assert.rejects(loadCommercialAnalysisInput('transmissao', periodo, env, async () => Response.json([row])), /Filial divergente/);
  await assert.rejects(readGeneratedInsights(Response.json({ insights: [], error: 'provedor indisponível' })), /recomendações válidas/);
});
