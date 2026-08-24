type QueryInvalidator = {
  invalidateQueries: (filters: { queryKey: unknown[] }) => unknown;
};

const COMERCIAL_QUERY_KEYS = [
  ['comercial', 'raw'],
  ['comercial-produtos'],
  ['comercial-receita-comissao-1004'],
] as const;

export function invalidarConsultasComerciais(queryClient: QueryInvalidator) {
  for (const queryKey of COMERCIAL_QUERY_KEYS) {
    queryClient.invalidateQueries({ queryKey: [...queryKey] });
  }
}
