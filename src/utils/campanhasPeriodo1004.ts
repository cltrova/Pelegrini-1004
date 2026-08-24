type CampanhaPeriodo1004 = {
  cod_empresa_bi?: string | null;
  nome?: string | null;
  data_inicio: string;
  data_fim: string;
  marcas?: Array<string | { marca?: string | null }> | null;
};

function normalizarTexto(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

function dateKey(value: unknown) {
  const s = String(value ?? '');
  const match = s.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : '';
}

function parseDateLocal(value: string, endOfDay = false) {
  const [y, m, d] = dateKey(value).split('-').map(Number);
  const date = Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)
    ? new Date(y, m - 1, d)
    : new Date(value);
  if (endOfDay) date.setHours(23, 59, 59, 999);
  return date;
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function marcasTexto(campanha: Pick<CampanhaPeriodo1004, 'marcas'>) {
  return (campanha.marcas || [])
    .map((m) => (typeof m === 'string' ? m : m?.marca))
    .map(normalizarTexto)
    .join(' ');
}

export function isCampanhaHistoricaMwmEaton1004(
  campanha: Pick<CampanhaPeriodo1004, 'cod_empresa_bi' | 'nome' | 'data_fim' | 'marcas'>,
) {
  const codEmpresa = String(campanha.cod_empresa_bi ?? '').trim();
  if (codEmpresa !== '1004') return false;

  const nome = normalizarTexto(campanha.nome);
  const marcas = marcasTexto(campanha);
  const hasMwm = nome.includes('MWM') || marcas.includes('MWM');
  const hasEaton = nome.includes('EATON') || marcas.includes('EATON');
  const fim = dateKey(campanha.data_fim);
  return hasMwm && hasEaton && !!fim && fim <= '2026-06-30';
}

export function periodoBuscaCampanha1004(campanha: CampanhaPeriodo1004) {
  if (!isCampanhaHistoricaMwmEaton1004(campanha)) {
    return { inicio: campanha.data_inicio, fim: campanha.data_fim };
  }

  const fim = parseDateLocal(campanha.data_fim, true);
  const fimMes = new Date(fim.getFullYear(), fim.getMonth() + 1, 0);
  return { inicio: campanha.data_inicio, fim: toIsoDate(fimMes) };
}

export function fimConsolidadoCampanha1004(
  campanha: Pick<CampanhaPeriodo1004, 'cod_empresa_bi'>,
  fim: Date,
  hoje = new Date(),
) {
  if (String(campanha.cod_empresa_bi ?? '').trim() !== '1004') return fim;

  const hojeInicio = startOfDay(hoje);
  const fimInicio = startOfDay(fim);
  if (fimInicio < hojeInicio) return fim;

  const ontem = new Date(hojeInicio);
  ontem.setDate(ontem.getDate() - 1);
  return endOfDay(ontem);
}

export function mesesCampanha1004(campanha: CampanhaPeriodo1004) {
  const periodo = periodoBuscaCampanha1004(campanha);
  const ini = parseDateLocal(periodo.inicio);
  const fim = parseDateLocal(periodo.fim, true);
  const hoje = new Date();
  const meses: Array<{ key: string; label: string; inicio: Date; fim: Date; status: 'fechado' | 'ativo' | 'futuro' }> = [];
  const cursor = new Date(ini.getFullYear(), ini.getMonth(), 1);

  while (cursor <= fim) {
    const primeiroDoMes = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const ultimoDoMes = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
    const mInicio = new Date(Math.max(primeiroDoMes.getTime(), ini.getTime()));
    const mFim = new Date(Math.min(ultimoDoMes.getTime(), fim.getTime()));
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    const label = cursor.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '').replace(' de ', '/');
    let status: 'fechado' | 'ativo' | 'futuro';
    if (hoje < mInicio) status = 'futuro';
    else if (hoje > mFim) status = 'fechado';
    else status = 'ativo';
    meses.push({ key, label, inicio: mInicio, fim: mFim, status });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return meses.filter((m) => m.inicio.getMonth() !== 3);
}
