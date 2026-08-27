import { describe, expect, it } from 'vitest';
import {
  calcularCotacaoPrioridade,
  calcularCotacoesKpis,
  calcularRadarGestor,
  consolidarMotivoPerda,
  filtrarCotacoes,
  gerarAcoesGestor,
  motivoMaisFrequente,
  normalizarCotacao,
} from './cotacoesComerciais';

describe('normalizarCotacao', () => {
  it('normaliza uma cotacao aberta do contrato Chevrolet 10041', () => {
    const row = normalizarCotacao({
      CodCotacao: '9012', DataCotacao: '2026-08-01', DataValidade: '2026-08-15',
      CodCliente: '88', NomeCliente: 'OFICINA CENTRAL', CodVendedor: '59',
      NomeVendedor: 'ERLAN C.CH', ValorTotal: '12.345,67', Status: 'ABERTA',
    }, 'abertas', new Date('2026-08-20T12:00:00-03:00'));

    expect(row).toMatchObject({
      idCotacao: '9012', numeroCotacao: '9012', codCliente: '88',
      nomeCliente: 'OFICINA CENTRAL', codVendedor: '59', valor: 12_345.67,
      status: 'aberta', diasEmAberto: 19,
    });
  });

  it.each([
    ['CANCELADA', 'cancelada'], ['RECUSADA', 'recusada'], ['VENCIDA', 'vencida'],
  ])('classifica %s como %s', (entrada, esperado) => {
    expect(normalizarCotacao({ CodCotacao: '1', DataCotacao: '2026-08-01', Status: entrada }, 'perdidas', new Date('2026-08-20')).status).toBe(esperado);
  });

  it('rejeita status incompatível com a origem e não deixa dias negativos', () => {
    expect(() => normalizarCotacao({ CodCotacao: '1', DataCotacao: '2026-08-21', Status: 'ABERTA' }, 'perdidas', new Date('2026-08-20'))).toThrow('Status de cotacao invalido');
    expect(normalizarCotacao({ CodCotacao: '2', DataCotacao: '2026-08-21', Status: 'ABERTA' }, 'abertas', new Date('2026-08-20')).diasEmAberto).toBe(0);
  });

  it.each(['2026-02-31', '31/02/2026'])('rejeita a data de calendario invalida %s', (dataCotacao) => {
    expect(() => normalizarCotacao({
      CodCotacao: '3',
      DataCotacao: dataCotacao,
      Status: 'ABERTA',
    }, 'abertas', new Date('2026-08-20'))).toThrow('Data de cotacao invalida');
  });

  it.each([undefined, '', ' \t\n '])('rejeita identificador de cotacao ausente ou vazio: %j', (CodCotacao) => {
    expect(() => normalizarCotacao({
      CodCotacao,
      DataCotacao: '2026-08-01',
      Status: 'ABERTA',
    }, 'abertas', new Date('2026-08-20'))).toThrow('Identificador de cotacao ausente');
  });
});

const rows = [
  normalizarCotacao({
    CodCotacao: '9012', DataCotacao: '2026-08-01', CodCliente: '88', NomeCliente: 'OFICINA CENTRAL',
    CodVendedor: '59', ValorTotal: '12.345,67', Status: 'ABERTA',
  }, 'abertas', new Date('2026-08-20')),
  normalizarCotacao({
    CodCotacao: '9013', DataCotacao: '2026-08-10', CodCliente: '99', NomeCliente: 'AUTO PECAS',
    CodVendedor: '60', ValorTotal: '3.000,00', Status: 'ABERTA',
  }, 'abertas', new Date('2026-08-20')),
];

describe('filtrarCotacoes', () => {
  it('filters by search, seller and aging without mutating rows', () => {
    const result = filtrarCotacoes(rows, {
      busca: 'oficina', vendedores: ['59'], clientes: [], status: [], motivos: [], diasMin: 10, diasMax: null,
    });
    expect(result.map((row) => row.idCotacao)).toEqual(['9012']);
    expect(rows).toHaveLength(2);
  });

  it('filters by canonical loss reason', () => {
    const lost = normalizarCotacao({ CodCotacao: '9014', DataCotacao: '2026-08-01', MotivoPerda: 'Preço', Status: 'RECUSADA' }, 'perdidas', new Date('2026-08-20'));
    const other = normalizarCotacao({ CodCotacao: '9015', DataCotacao: '2026-08-01', MotivoPerda: 'Prazo de entrega', Status: 'RECUSADA' }, 'perdidas', new Date('2026-08-20'));
    expect(filtrarCotacoes([lost, other], {
      busca: '', vendedores: [], clientes: [], status: [], motivos: ['preco'], diasMin: null, diasMax: null,
    }).map((row) => row.idCotacao)).toEqual(['9014']);
  });

  it('uses a persisted reason before the ERP fallback in consolidation, filtering, and KPIs', () => {
    const precoErp = normalizarCotacao({
      CodCotacao: '9014', DataCotacao: '2026-08-01', MotivoPerda: 'Preço', Status: 'RECUSADA',
    }, 'perdidas', new Date('2026-08-20'));
    const prazoErp = normalizarCotacao({
      CodCotacao: '9015', DataCotacao: '2026-08-01', MotivoPerda: 'Prazo de entrega', Status: 'RECUSADA',
    }, 'perdidas', new Date('2026-08-20'));
    const outroPrazoErp = { ...prazoErp, idCotacao: '9016', numeroCotacao: '9016' };
    const motivos = new Map([[
      '9014',
      { motivo: 'concorrencia' as const, observacao: 'Fechou com outro fornecedor.' },
    ]]);

    expect(consolidarMotivoPerda(precoErp, motivos)).toEqual({
      codigo: 'concorrencia',
      label: 'Concorrência',
      observacao: 'Fechou com outro fornecedor.',
    });
    expect(consolidarMotivoPerda(prazoErp, motivos)).toEqual({
      codigo: 'prazo_entrega',
      label: 'Prazo de entrega',
      observacao: '',
    });

    const filtros = {
      busca: '', vendedores: [], clientes: [], status: [], motivos: ['concorrencia' as const], diasMin: null, diasMax: null,
    };
    expect(filtrarCotacoes([precoErp, prazoErp], filtros, motivos).map((row) => row.idCotacao)).toEqual(['9014']);
    expect(filtrarCotacoes([precoErp, prazoErp], {
      ...filtros,
      motivos: ['preco'],
    }, motivos)).toEqual([]);
    expect(motivoMaisFrequente([precoErp, prazoErp, outroPrazoErp], motivos)).toBe('Prazo de entrega');
  });

  it('ignores an invalid persisted reason and falls back to the ERP reason', () => {
    const row = normalizarCotacao({
      CodCotacao: '9014', DataCotacao: '2026-08-01', MotivoPerda: 'Prazo de entrega', Status: 'RECUSADA',
    }, 'perdidas', new Date('2026-08-20'));
    const motivos = new Map([['9014', { motivo: 'valor_legado', observacao: 'Registro invalido.' }]]);

    expect(consolidarMotivoPerda(row, motivos)).toEqual({
      codigo: 'prazo_entrega',
      label: 'Prazo de entrega',
      observacao: '',
    });
  });
});

describe('calcularCotacoesKpis', () => {
  it('calculates totals from filtered rows', () => {
    expect(calcularCotacoesKpis(rows, new Map())).toMatchObject({
      quantidade: 2, valorTotal: 15_345.67, ticketMedio: 7_672.835,
    });
  });
});

describe('inteligencia gestora de cotacoes', () => {
  const abertas = [
    normalizarCotacao({
      CodCotacao: '9301', DataCotacao: '2026-08-01', DataValidade: '2026-08-10',
      CodCliente: '88', NomeCliente: 'OFICINA CENTRAL', CodVendedor: '59',
      NomeVendedor: 'ERLAN C.CH', ValorTotal: '50.000,00', Status: 'ABERTA',
    }, 'abertas', new Date('2026-08-20')),
    normalizarCotacao({
      CodCotacao: '9302', DataCotacao: '2026-08-18', DataValidade: '2026-08-28',
      CodCliente: '99', NomeCliente: 'AUTO PECAS', CodVendedor: '60',
      NomeVendedor: 'ANA SILVA', ValorTotal: '3.000,00', Status: 'ABERTA',
    }, 'abertas', new Date('2026-08-20')),
  ];
  const perdidas = [
    normalizarCotacao({
      CodCotacao: '9401', DataCotacao: '2026-08-01', CodCliente: '88',
      NomeCliente: 'OFICINA CENTRAL', CodVendedor: '59', NomeVendedor: 'ERLAN C.CH',
      ValorTotal: '40.000,00', Status: 'RECUSADA', MotivoPerda: 'Preço',
    }, 'perdidas', new Date('2026-08-20')),
    normalizarCotacao({
      CodCotacao: '9402', DataCotacao: '2026-08-08', CodCliente: '99',
      NomeCliente: 'AUTO PECAS', CodVendedor: '59', NomeVendedor: 'ERLAN C.CH',
      ValorTotal: '4.000,00', Status: 'CANCELADA', MotivoPerda: 'Prazo de entrega',
    }, 'perdidas', new Date('2026-08-20')),
  ];

  it('calcula score de prioridade para o gestor agir primeiro', () => {
    expect(calcularCotacaoPrioridade(abertas[0], 'abertas')).toMatchObject({
      nivel: 'quente',
      label: 'Quente',
      score: 100,
    });
    expect(calcularCotacaoPrioridade(abertas[1], 'abertas')).toMatchObject({
      nivel: 'frio',
      label: 'Frio',
    });
  });

  it('monta radar com dinheiro parado, vencidas, recuperaveis e faixas de idade', () => {
    expect(calcularRadarGestor(abertas, 'abertas')).toMatchObject({
      valorPrincipal: 53_000,
      valorCritico: 50_000,
      quantidadeCritica: 1,
      potencialRecuperavel: 53_000,
      melhorOportunidade: expect.objectContaining({ idCotacao: '9301' }),
      faixasIdade: [
        { label: '0-3 dias', quantidade: 1, valor: 3_000 },
        { label: '4-7 dias', quantidade: 0, valor: 0 },
        { label: '8-15 dias', quantidade: 0, valor: 0 },
        { label: '15+ dias', quantidade: 1, valor: 50_000 },
      ],
    });
  });

  it('gera acoes claras para o dia do gestor nas vendas perdidas', () => {
    const motivos = new Map([
      ['9401', { motivo: 'preco', observacao: 'Concorrente com desconto.' }],
      ['9402', { motivo: 'prazo_entrega', observacao: null }],
    ]);

    expect(calcularRadarGestor(perdidas, 'perdidas', motivos)).toMatchObject({
      valorPrincipal: 44_000,
      potencialRecuperavel: 40_000,
      quantidadeCritica: 1,
      melhorOportunidade: expect.objectContaining({ idCotacao: '9401' }),
    });
    expect(gerarAcoesGestor(perdidas, 'perdidas', motivos)).toEqual([
      expect.objectContaining({ titulo: 'Tentar recuperar OFICINA CENTRAL', cotacaoId: '9401' }),
      expect.objectContaining({ titulo: 'Atacar causa raiz: Preço' }),
      expect.objectContaining({ titulo: 'Conversar com ERLAN C.CH' }),
    ]);
  });
});
