import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  aggregateProdutosPorMarca, aggregateTopProdutos, getProdutoUniqueKey, isLinhaResumoTotaisProduto,
  isVendaSemPedidoValido1004, normalizeProduto, produtoMatchesVendedorEmpresa, produtoPertenceEscopoPelegrini1004,
} from '../../src/hooks/useComercialProdutos';
import type { ProdutoItem } from '../../src/types/comercialProdutos';

const token = readFileSync(join(process.env.CREDENTIALS_DIRECTORY!, 'relatorios-token'), 'utf8').trim();
const endpoint = 'http://127.0.0.1:8328/interno/relatorios/produtos';
const camposMarca = ['faturamento', 'custo', 'lucro', 'margem', 'quantidade', 'produtos', 'participacao'] as const;

async function ler<T>(params: Record<string, string>) {
  const response = await fetch(`${endpoint}?${new URLSearchParams(params)}`, {
    headers: { Authorization: `Bearer ${token}`, 'Accept-Encoding': 'gzip' },
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(response.status, 200, 'O serviço de relatórios está indisponível');
  const origem = Date.parse(String(response.headers.get('X-Data-As-Of')));
  assert.ok(Date.now() >= origem && Date.now() - origem < 60_000, 'Leitura vencida');
  return response.json() as Promise<T & { versao: string }>;
}

function numero(atual: number | null, esperado: number | null, mensagem: string) {
  if (atual === null || esperado === null) assert.equal(atual, esperado, mensagem);
  else assert.ok(Math.abs(atual - esperado) < 0.0001, mensagem);
}

async function verificar(empresa: string, inicio: string, fim: string, vendedores: string[][]) {
  const recorte = { cod_empresa_bi: empresa, inicio, fim };
  type Pagina = { total: number; linhas: Record<string, unknown>[] };
  const primeira = await ler<Pagina>({ ...recorte, limit: '100' });
  const consultas = { ...recorte, versao: primeira.versao, limit: '100' };
  const raw = [...primeira.linhas];
  for (let offset = raw.length; offset < primeira.total; offset += 100) {
    raw.push(...(await ler<Pagina>({ ...consultas, offset: String(offset) })).linhas);
  }
  assert.equal(raw.length, primeira.total, 'Cobertura da projeção de Produtos');
  const catalogo: ProdutoItem[] = raw.map(item => normalizeProduto({
    ...item,
    CodEmpresa_bi: item.codempresa_bi,
    ValorVenda: item.valorvenda,
    ValorDevolucao: item.valordevolucao,
    ValorLiquidoFinal: item.valorliquidofinal,
    ValorDescontoItem: item.valordescontoitem,
  }, empresa))
    .filter(item => produtoPertenceEscopoPelegrini1004(item, { codEmpresa: empresa, isContextoChevrolet10041Ativo: empresa === '10041' }))
    .sort((a,b) => (a.data_faturamento || '').localeCompare(b.data_faturamento || '')
      || Number(a.cod_produto) - Number(b.cod_produto));

  for (const selecionados of vendedores) {
    const itens = new Map<string, ProdutoItem>();
    for (const produto of catalogo) {
      if (isLinhaResumoTotaisProduto(produto) || isVendaSemPedidoValido1004(produto) ||
        (selecionados.length && !selecionados.some(v => produtoMatchesVendedorEmpresa(produto, v, empresa)))) continue;
      const id = getProdutoUniqueKey(produto);
      if (!itens.has(id)) itens.set(id, produto);
    }
    const filtrados = [...itens.values()];
    const solicitacao = { ...consultas, vendedores: JSON.stringify(selecionados) };
    const marcas = aggregateProdutosPorMarca(filtrados);
    const ranking = aggregateTopProdutos(filtrados, 'receitas');
    const codigosVendidos = new Set(ranking.map(item => String(item.cod_produto)));
    const semGiro = new Set(catalogo.map(item => String(item.cod_produto)).filter(id => !codigosVendidos.has(id))).size;
    const [novaVisao, novoRanking, receita, devolucao] = await Promise.all([
      ler<{ porMarca: typeof marcas; totalSkus: number; semGiro: number }>({ ...solicitacao, painel:'marcas' }),
      ler<{ produtos: typeof ranking; total: number; somaReceita: number }>({ ...solicitacao, painel:'top', limit:'50' }),
      ler<Pagina>({ ...solicitacao, painel:'resumo', tipo:'2', limit:'50' }),
      ler<Pagina>({ ...solicitacao, painel:'resumo', tipo:'1', limit:'50' }),
    ]);

    assert.equal(novaVisao.porMarca.length, marcas.length, 'Quantidade de marcas');
    for (const marca of marcas) {
      const linha = novaVisao.porMarca.find(r => r.marca === marca.marca);
      assert.ok(linha, 'Marca ausente');
      for (const campo of camposMarca) numero(linha[campo], marca[campo], campo + ' por marca');
    }
    assert.equal(novaVisao.totalSkus, ranking.length, 'SKUs vendidos');
    assert.equal(novoRanking.total, ranking.length, 'Total do ranking');
    assert.equal(novaVisao.semGiro, semGiro, 'SKUs sem giro');
    numero(novoRanking.somaReceita, ranking.reduce((total, item) => total + item.faturamento, 0), 'Receita do ranking');
    for (const produto of novoRanking.produtos) {
      const item = ranking.find(item => String(item.cod_produto) === String(produto.cod_produto));
      assert.ok(item, 'O ranking contém um produto ausente da projeção');
      numero(produto.faturamento, item.faturamento, 'Receita por produto');
      numero(produto.quantidade, item.quantidade, 'Quantidade por produto');
      assert.equal(produto.pedidos, item.pedidos, 'Contagem por produto');
    }
    assert.equal(receita.total, filtrados.filter(p => p.tipo === 'PEDIDO').length, 'NF receitas');
    assert.equal(devolucao.total, filtrados.filter(p => p.tipo === 'DEVOLUCAO').length, 'NF devoluções');
    console.log(JSON.stringify({ empresa, inicio, fim, vendedores: selecionados, linhas: raw.length,
      marcas: marcas.length, skus: ranking.length, vendas: receita.total, devolucoes: devolucao.total, status: 'MATCH' }));
  }
}

await verificar('1004', '2026-11-24','2026-11-26', [[], ['63']]);
await verificar('10041', '2026-11-24','2026-11-26', [[], ['47'], ['34']]);
