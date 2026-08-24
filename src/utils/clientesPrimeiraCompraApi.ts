import type { ClientePerformance } from '@/types/comercial';

const CODIGO_CLIENTE_ALIASES = [
  'cod_cliente',
  'CodCliente',
  'codigo_cliente',
  'CodigoCliente',
  'cliente_codigo',
  'ClienteCodigo',
  'Cliente_Codigo',
];

const PRIMEIRA_COMPRA_ALIASES = [
  'primeira_compra',
  'primeira_compra_periodo',
  'PrimeiraCompra',
  'primeiraCompra',
  'data_primeira_compra',
  'DataPrimeiraCompra',
  'Data_Primeira_Compra',
  'dt_primeira_compra',
  'DtPrimeiraCompra',
  'primeira_compra_cliente',
  'PrimeiraCompraCliente',
  'data_primeira_compra_cliente',
  'DataPrimeiraCompraCliente',
];

const CADASTRO_CLIENTE_ALIASES = [
  'data_cadastro_cliente',
  'DataCadastroCliente',
  'Data_Cadastro_Cliente',
  'dt_cadastro_cliente',
  'dtCadastroCliente',
  'data_cadastro',
  'DataCadastro',
  'Data_Cadastro',
  'dt_cadastro',
  'DtCadastro',
  'cadastro_cliente',
  'CadastroCliente',
];

function pick(row: Record<string, unknown>, aliases: string[]) {
  for (const alias of aliases) {
    const value = row[alias];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return undefined;
}

function toDateKey(value: unknown): string | undefined {
  const data = String(value ?? '').trim().substring(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : undefined;
}

export function montarMapaPrimeiraCompraApi(rows: Array<Record<string, unknown>>) {
  const mapa = new Map<string, string>();

  rows.forEach((row) => {
    const codigo = String(pick(row, CODIGO_CLIENTE_ALIASES) ?? '').trim();
    if (!codigo) return;

    const data = toDateKey(
      pick(row, PRIMEIRA_COMPRA_ALIASES) ??
      pick(row, CADASTRO_CLIENTE_ALIASES),
    );
    if (!data) return;

    const atual = mapa.get(codigo);
    if (!atual || data < atual) {
      mapa.set(codigo, data);
    }
  });

  return mapa;
}

export function aplicarPrimeiraCompraClientesApi(
  clientes: ClientePerformance[],
  rows: Array<Record<string, unknown>>,
): ClientePerformance[] {
  const primeirasCompras = montarMapaPrimeiraCompraApi(rows);
  if (primeirasCompras.size === 0) return clientes;

  return clientes.map((cliente) => {
    const primeiraCompra = primeirasCompras.get(String(cliente.codigo).trim());
    return primeiraCompra ? { ...cliente, primeiraCompra } : cliente;
  });
}
