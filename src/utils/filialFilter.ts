import { getFilialPorId, empresaPossuiFiliais } from '@/config/filiaisEmpresa';

function normalize(s: unknown): string {
  if (s === null || s === undefined) return '';
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

/**
 * Filtra registros pelo campo "Filial" quando a empresa ativa possui
 * filiais distintas configuradas (ex.: 1004). Para empresas sem essa
 * configuração, retorna o array original sem custo extra.
 *
 * @param records  Registros já normalizados (devem expor `filial_nome` ou `filial_codigo`).
 * @param codEmpresa  Empresa ativa.
 * @param filialAtiva  Id da filial selecionada no contexto.
 * @param fieldKeys  Possíveis chaves no objeto que carregam o nome da filial.
 */
export function filtrarPorFilial<T extends Record<string, unknown>>(
  records: T[],
  codEmpresa: string | null | undefined,
  filialAtiva: string | null | undefined,
  fieldKeys: string[] = ['filial_nome', 'Filial', 'filial', 'NomeFilial', 'empresa', 'Empresa'],
): T[] {
  if (!records || records.length === 0) return records;
  if (!empresaPossuiFiliais(codEmpresa)) return records;
  const filial = getFilialPorId(codEmpresa, filialAtiva);
  if (!filial) return records;

  const matches = filial.matchFilial.map(normalize);
  const codEmpresaNorm = String(codEmpresa ?? '').trim();
  const filialAtivaNorm = String(filialAtiva ?? '').trim();

  return records.filter(rec => {
    const codBi = String(rec.cod_empresa_bi ?? rec.CodEmpresa_bi ?? '').trim();
    if (codEmpresaNorm === '10041' && codBi) return codBi === '10041';
    if (codEmpresaNorm === '1004' && filialAtivaNorm === 'transmissao' && codBi) return codBi === '1004';
    if (codEmpresaNorm === '1004' && filialAtivaNorm === 'chevrolet' && codBi) return codBi === '10041';

    for (const key of fieldKeys) {
      const value = rec[key];
      if (value === undefined || value === null || value === '') continue;
      const norm = normalize(value);
      if (matches.some(m => norm === m || norm.includes(m))) return true;
    }
    return false;
  });
}

/**
 * Retorna a equipe padrão (lista de fragmentos de nome em UPPER, sem acentos)
 * configurada para a filial ativa, ou null quando não há equipe definida.
 */
export function getEquipePadrao(
  codEmpresa: string | null | undefined,
  filialAtiva: string | null | undefined,
): string[] | null {
  const filial = getFilialPorId(codEmpresa, filialAtiva);
  if (!filial?.equipePadrao || filial.equipePadrao.length === 0) return null;
  return filial.equipePadrao.map(normalize);
}

/**
 * Filtra registros pela equipe padrão da filial ativa (apenas vendedores
 * configurados aparecem). Retorna o array original se não houver equipe.
 */
export function filtrarPorEquipePadrao<T extends Record<string, unknown>>(
  records: T[],
  codEmpresa: string | null | undefined,
  filialAtiva: string | null | undefined,
  fieldKeys: string[] = [
    'vendedor_nome',
    'vendedor',
    'Vendedor',
    'VendedorNome',
    'nome_interno',
    'nome_externo',
    'vendedor_interno',
    'vendedor_externo',
    'vendedor_chevrolet',
    'vendedor_cch',
    'vendedor_comissao',
    'vendedor_meta',
    'NomeInterno',
    'NomeExterno',
    'VendedorInterno',
    'VendedorExterno',
    'VendedorChevrolet',
    'VendedorCCH',
    'VendedorComissao',
    'NomeVendedorChevrolet',
    'NomeVendedorCCH',
    'NomeVendedorComissao',
    'VendedorMeta',
    'NomeVendedorMeta',
  ],
): T[] {
  if (!records || records.length === 0) return records;
  const equipe = getEquipePadrao(codEmpresa, filialAtiva);
  if (!equipe) return records;

  return records.filter(rec => {
    for (const key of fieldKeys) {
      const value = rec[key];
      if (value === undefined || value === null || value === '') continue;
      const norm = normalize(value);
      if (equipe.some(name => norm.includes(name))) return true;
    }
    return false;
  });
}

/** Verifica se um nome pertence à equipe padrão da filial ativa. */
export function nomePertenceEquipe(
  nome: string | null | undefined,
  codEmpresa: string | null | undefined,
  filialAtiva: string | null | undefined,
): boolean {
  const equipe = getEquipePadrao(codEmpresa, filialAtiva);
  if (!equipe) return true;
  if (!nome) return false;
  const norm = normalize(nome);
  return equipe.some(name => norm.includes(name));
}
