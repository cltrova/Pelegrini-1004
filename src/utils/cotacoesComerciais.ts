import type {
  CotacaoComercial,
  CotacaoOrigem,
  CotacaoStatus,
  CotacoesFiltros,
  CotacoesKpis,
  MotivoPerdaCodigo,
} from '@/types/cotacoesComerciais';

export class CotacaoInvalidaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CotacaoInvalidaError';
  }
}

type RawCotacao = Record<string, unknown>;

export interface MotivoPerdaPersistido {
  motivo: string;
  observacao?: string | null;
}

export interface MotivoPerdaConsolidado {
  codigo: MotivoPerdaCodigo | null;
  label: string;
  observacao: string;
}

export type MotivosPerdaMapa = ReadonlyMap<string, MotivoPerdaPersistido>;
export type CotacaoPrioridadeNivel = 'quente' | 'atencao' | 'frio';

export interface CotacaoPrioridade {
  score: number;
  nivel: CotacaoPrioridadeNivel;
  label: string;
  descricao: string;
}

export interface RadarFaixaIdade {
  label: string;
  quantidade: number;
  valor: number;
}

export interface CotacoesRadarGestor {
  valorPrincipal: number;
  valorCritico: number;
  quantidadeCritica: number;
  potencialRecuperavel: number;
  melhorOportunidade: CotacaoComercial | null;
  faixasIdade: RadarFaixaIdade[];
}

export interface CotacoesAcaoGestor {
  titulo: string;
  descricao: string;
  cotacaoId?: string;
}

export const MOTIVO_PERDA_LABELS: Record<MotivoPerdaCodigo, string> = {
  preco: 'Preço',
  prazo_entrega: 'Prazo de entrega',
  condicao_pagamento: 'Condição de pagamento',
  concorrencia: 'Concorrência',
  indisponibilidade_produto: 'Indisponibilidade de produto',
  cliente_desistiu: 'Cliente desistiu',
  cotacao_vencida: 'Cotação vencida',
  outro: 'Outro',
};

const EMPTY_MOTIVOS = new Map<string, MotivoPerdaPersistido>();

const STATUS: Record<string, CotacaoStatus> = {
  aberta: 'aberta',
  aberto: 'aberta',
  cancelada: 'cancelada',
  cancelado: 'cancelada',
  recusada: 'recusada',
  recusado: 'recusada',
  vencida: 'vencida',
  vencido: 'vencida',
};

function chaveNormalizada(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

function pick(raw: RawCotacao, ...keys: string[]): unknown {
  const entries = Object.entries(raw);
  for (const key of keys) {
    const wanted = chaveNormalizada(key);
    const found = entries.find(([rawKey]) => chaveNormalizada(rawKey) === wanted);
    if (found && found[1] !== null && found[1] !== undefined && found[1] !== '') return found[1];
  }
  return undefined;
}

function texto(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim();
}

function numeroBrasileiro(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const input = texto(value).replace(/R\$\s?/gi, '').replace(/\s/g, '');
  if (!input) return 0;
  const normalized = input.includes(',')
    ? input.replace(/\./g, '').replace(',', '.')
    : input.replace(/\.(?=\d{3}(?:\D|$))/g, '');
  const parsed = Number(normalized.replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function dataIso(value: unknown): string | null {
  const input = texto(value);
  if (!input) return null;
  const br = input.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return dataIsoPartes(Number(br[3]), Number(br[2]), Number(br[1]));
  const iso = input.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) {
    const [ano, mes, dia] = iso[1].split('-').map(Number);
    return dataIsoPartes(ano, mes, dia);
  }
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function dataIsoPartes(ano: number, mes: number, dia: number): string | null {
  const parsed = new Date(Date.UTC(ano, mes - 1, dia));
  if (
    parsed.getUTCFullYear() !== ano
    || parsed.getUTCMonth() !== mes - 1
    || parsed.getUTCDate() !== dia
  ) return null;
  return `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function diasEntre(inicio: string | null, fim: Date): number {
  if (!inicio) return 0;
  const [ano, mes, dia] = inicio.split('-').map(Number);
  const inicioUtc = Date.UTC(ano, mes - 1, dia);
  const fimUtc = Date.UTC(fim.getFullYear(), fim.getMonth(), fim.getDate());
  return Math.max(0, Math.floor((fimUtc - inicioUtc) / 86_400_000));
}

function statusCanonico(value: unknown): CotacaoStatus | null {
  return STATUS[chaveNormalizada(texto(value))] ?? null;
}

function motivoCanonico(value: string | null): MotivoPerdaCodigo | null {
  const motivo = chaveNormalizada(value ?? '');
  if (!motivo) return null;
  if (motivo.includes('preco')) return 'preco';
  if (motivo.includes('prazo') || motivo.includes('entrega')) return 'prazo_entrega';
  if (motivo.includes('pagamento') || motivo.includes('condicao')) return 'condicao_pagamento';
  if (motivo.includes('concorr') || motivo.includes('compet')) return 'concorrencia';
  if (motivo.includes('indispon') || motivo.includes('produto')) return 'indisponibilidade_produto';
  if (motivo.includes('desist')) return 'cliente_desistiu';
  if (motivo.includes('venc')) return 'cotacao_vencida';
  return 'outro';
}

function motivoPersistidoCanonico(value: string): MotivoPerdaCodigo | null {
  return Object.prototype.hasOwnProperty.call(MOTIVO_PERDA_LABELS, value)
    ? value as MotivoPerdaCodigo
    : null;
}

export function consolidarMotivoPerda(
  row: CotacaoComercial,
  motivos: MotivosPerdaMapa = EMPTY_MOTIVOS,
): MotivoPerdaConsolidado {
  const motivoPersistido = motivos.get(row.idCotacao.trim());
  const codigoPersistido = motivoPersistido
    ? motivoPersistidoCanonico(motivoPersistido.motivo)
    : null;
  if (motivoPersistido && codigoPersistido) {
    return {
      codigo: codigoPersistido,
      label: MOTIVO_PERDA_LABELS[codigoPersistido],
      observacao: String(motivoPersistido.observacao ?? '').trim(),
    };
  }

  const motivoErp = String(row.motivoErp ?? '').trim();
  return {
    codigo: motivoCanonico(motivoErp),
    label: motivoErp || 'Não registrado',
    observacao: '',
  };
}

export function normalizarCotacao(raw: RawCotacao, origem: CotacaoOrigem, hoje: Date): CotacaoComercial {
  const dataCotacaoRaw = pick(raw, 'DataCotacao', 'Data', 'DataCriacao');
  const dataCotacaoNormalizada = dataIso(dataCotacaoRaw);
  if (texto(dataCotacaoRaw) && !dataCotacaoNormalizada) {
    throw new CotacaoInvalidaError(`Data de cotacao invalida: ${texto(dataCotacaoRaw)}`);
  }
  const dataCotacao = dataCotacaoNormalizada ?? '';
  const status = statusCanonico(pick(raw, 'Status', 'Situacao'));
  const aceitos: CotacaoStatus[] = origem === 'abertas' ? ['aberta'] : ['cancelada', 'recusada', 'vencida'];
  if (!status || !aceitos.includes(status)) {
    throw new CotacaoInvalidaError(`Status de cotacao invalido para origem ${origem}: ${texto(pick(raw, 'Status', 'Situacao'))}`);
  }

  const idCotacao = texto(pick(raw, 'CodCotacao', 'IdCotacao', 'NumeroCotacao', 'Numero'));
  if (!idCotacao) {
    throw new CotacaoInvalidaError('Identificador de cotacao ausente');
  }
  const dataValidadeRaw = pick(raw, 'DataValidade', 'Validade');
  const dataValidade = dataIso(dataValidadeRaw);
  if (texto(dataValidadeRaw) && !dataValidade) {
    throw new CotacaoInvalidaError(`Data de validade invalida: ${texto(dataValidadeRaw)}`);
  }
  return {
    idCotacao,
    numeroCotacao: texto(pick(raw, 'NumeroCotacao', 'CodCotacao', 'Numero')) || idCotacao,
    dataCotacao,
    dataValidade,
    codCliente: texto(pick(raw, 'CodCliente', 'CodigoCliente', 'ClienteCodigo')),
    nomeCliente: texto(pick(raw, 'NomeCliente', 'Cliente', 'RazaoSocial')),
    codVendedor: texto(pick(raw, 'CodVendedor', 'CodigoVendedor', 'VendedorCodigo')),
    nomeVendedor: texto(pick(raw, 'NomeVendedor', 'Vendedor')),
    valor: numeroBrasileiro(pick(raw, 'ValorTotal', 'Valor', 'Total')),
    status,
    motivoErp: texto(pick(raw, 'MotivoErp', 'Motivo', 'MotivoPerda')) || null,
    diasEmAberto: diasEntre(dataCotacao, hoje),
    raw,
  };
}

function contemBusca(row: CotacaoComercial, busca: string): boolean {
  const termo = chaveNormalizada(busca);
  if (!termo) return true;
  return [row.idCotacao, row.numeroCotacao, row.nomeCliente, row.nomeVendedor]
    .some((value) => chaveNormalizada(value).includes(termo));
}

export function filtrarCotacoes(
  rows: readonly CotacaoComercial[],
  filtros: CotacoesFiltros,
  motivos: MotivosPerdaMapa = EMPTY_MOTIVOS,
): CotacaoComercial[] {
  return rows.filter((row) => {
    const motivo = filtros.motivos.length ? consolidarMotivoPerda(row, motivos).codigo : null;
    return contemBusca(row, filtros.busca)
      && (!filtros.vendedores.length || filtros.vendedores.includes(row.codVendedor))
      && (!filtros.clientes.length || filtros.clientes.includes(row.codCliente))
      && (!filtros.status.length || filtros.status.includes(row.status))
      && (!filtros.motivos.length || (motivo !== null && filtros.motivos.includes(motivo)))
      && (filtros.diasMin === null || row.diasEmAberto >= filtros.diasMin)
      && (filtros.diasMax === null || row.diasEmAberto <= filtros.diasMax);
  });
}

export function motivoMaisFrequente(
  rows: readonly CotacaoComercial[],
  motivos: MotivosPerdaMapa = EMPTY_MOTIVOS,
): string | null {
  const counts = new Map<MotivoPerdaCodigo, { count: number; label: string }>();
  let maisFrequente: { count: number; label: string } | null = null;

  rows.forEach((row) => {
    const motivo = consolidarMotivoPerda(row, motivos);
    if (!motivo.codigo) return;
    const current = counts.get(motivo.codigo);
    const next = { count: (current?.count ?? 0) + 1, label: current?.label ?? motivo.label };
    counts.set(motivo.codigo, next);
    if (!maisFrequente || next.count > maisFrequente.count) maisFrequente = next;
  });

  return maisFrequente?.label ?? null;
}

export function calcularCotacoesKpis(rows: readonly CotacaoComercial[], motivos: MotivosPerdaMapa): CotacoesKpis {
  const quantidade = rows.length;
  const valorTotal = rows.reduce((total, row) => total + row.valor, 0);
  void motivos;
  return { quantidade, valorTotal, ticketMedio: quantidade ? valorTotal / quantidade : 0 };
}

export function calcularCotacaoPrioridade(row: CotacaoComercial, origem: CotacaoOrigem): CotacaoPrioridade {
  const pontosValor = row.valor >= 30_000 ? 35 : row.valor >= 10_000 ? 24 : row.valor >= 3_000 ? 12 : 4;
  const pontosIdade = row.diasEmAberto >= 15 ? 35 : row.diasEmAberto >= 8 ? 24 : row.diasEmAberto >= 4 ? 14 : 4;
  const pontosStatus = origem === 'abertas'
    ? row.dataValidade && row.dataValidade < new Date().toISOString().slice(0, 10) ? 20 : 8
    : row.status === 'recusada' ? 18 : row.status === 'vencida' ? 14 : 8;
  const score = Math.min(100, Math.round(pontosValor + pontosIdade + pontosStatus + 10));
  const nivel: CotacaoPrioridadeNivel = score >= 75 ? 'quente' : score >= 45 ? 'atencao' : 'frio';

  return {
    score,
    nivel,
    label: nivel === 'quente' ? 'Quente' : nivel === 'atencao' ? 'Atenção' : 'Frio',
    descricao: nivel === 'quente'
      ? 'Agir hoje'
      : nivel === 'atencao'
        ? 'Monitorar de perto'
        : 'Baixa urgência',
  };
}

function faixaIdade(row: CotacaoComercial): string {
  if (row.diasEmAberto <= 3) return '0-3 dias';
  if (row.diasEmAberto <= 7) return '4-7 dias';
  if (row.diasEmAberto <= 15) return '8-15 dias';
  return '15+ dias';
}

export function calcularRadarGestor(
  rows: readonly CotacaoComercial[],
  origem: CotacaoOrigem,
  motivos: MotivosPerdaMapa = EMPTY_MOTIVOS,
): CotacoesRadarGestor {
  const faixas = ['0-3 dias', '4-7 dias', '8-15 dias', '15+ dias'].map((label) => ({ label, quantidade: 0, valor: 0 }));
  let melhorOportunidade: CotacaoComercial | null = null;
  let melhorScore = -1;
  let valorCritico = 0;
  let quantidadeCritica = 0;
  let potencialRecuperavel = 0;

  rows.forEach((row) => {
    const faixa = faixas.find((item) => item.label === faixaIdade(row));
    if (faixa) {
      faixa.quantidade += 1;
      faixa.valor += row.valor;
    }

    const prioridade = calcularCotacaoPrioridade(row, origem);
    if (prioridade.nivel === 'quente') {
      quantidadeCritica += 1;
      valorCritico += row.valor;
    }

    const motivo = consolidarMotivoPerda(row, motivos).codigo;
    const recuperavel = origem === 'abertas'
      || motivo === 'preco'
      || motivo === 'condicao_pagamento'
      || motivo === 'concorrencia';
    if (recuperavel) potencialRecuperavel += row.valor;

    const scoreComValor = prioridade.score + Math.min(30, row.valor / 2_000);
    if (scoreComValor > melhorScore) {
      melhorScore = scoreComValor;
      melhorOportunidade = row;
    }
  });

  return {
    valorPrincipal: rows.reduce((total, row) => total + row.valor, 0),
    valorCritico,
    quantidadeCritica,
    potencialRecuperavel,
    melhorOportunidade,
    faixasIdade: faixas,
  };
}

export function gerarAcoesGestor(
  rows: readonly CotacaoComercial[],
  origem: CotacaoOrigem,
  motivos: MotivosPerdaMapa = EMPTY_MOTIVOS,
): CotacoesAcaoGestor[] {
  const radar = calcularRadarGestor(rows, origem, motivos);
  const acoes: CotacoesAcaoGestor[] = [];

  if (radar.melhorOportunidade) {
    const row = radar.melhorOportunidade;
    acoes.push({
      titulo: origem === 'abertas'
        ? `Priorizar ${row.nomeCliente || `cotação ${row.numeroCotacao}`}`
        : `Tentar recuperar ${row.nomeCliente || `cotação ${row.numeroCotacao}`}`,
      descricao: `${row.numeroCotacao} concentra valor relevante e ${row.diasEmAberto} dia(s) de histórico.`,
      cotacaoId: row.idCotacao,
    });
  }

  const motivo = motivoMaisFrequente(rows, motivos);
  if (origem === 'perdidas' && motivo) {
    acoes.push({
      titulo: `Atacar causa raiz: ${motivo}`,
      descricao: 'Cruze o motivo com vendedor e cliente antes da próxima negociação.',
    });
  }

  const vendedores = new Map<string, { nome: string; valor: number; quantidade: number }>();
  rows.forEach((row) => {
    const key = row.codVendedor || row.nomeVendedor;
    if (!key) return;
    const current = vendedores.get(key) ?? { nome: row.nomeVendedor || key, valor: 0, quantidade: 0 };
    current.valor += row.valor;
    current.quantidade += 1;
    vendedores.set(key, current);
  });
  const vendedorCritico = Array.from(vendedores.values()).sort((left, right) => (
    right.valor - left.valor || right.quantidade - left.quantidade
  ))[0];
  if (vendedorCritico) {
    acoes.push({
      titulo: `Conversar com ${vendedorCritico.nome}`,
      descricao: `${vendedorCritico.quantidade} cotação(ões) somam atenção gerencial no período.`,
    });
  }

  return acoes.slice(0, 3);
}
