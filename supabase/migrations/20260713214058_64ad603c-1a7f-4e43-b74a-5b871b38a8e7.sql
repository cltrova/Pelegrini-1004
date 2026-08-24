
-- Seed dfc_line_config para cod_empresa_bi = '1001' conforme mapeamento de validação DFC Dez/2025

-- 1. Resultado Líquido: pega da conta 2.3.5.01.01.00002 (Apuração de Resultado do Exercício)
INSERT INTO public.dfc_line_config (cod_empresa_bi, linha_id, descricao, secao, ordem, fonte, modo, grupo, contas, invert_sinal)
VALUES ('1001', 'resultado_liquido', 'Resultado Líquido do Exercício', 'Operacional', 2, 'contas', 'contas', NULL, ARRAY['2.3.5.01.01.00002'], false)
ON CONFLICT (cod_empresa_bi, linha_id) DO UPDATE SET
  fonte = EXCLUDED.fonte, modo = EXCLUDED.modo, grupo = EXCLUDED.grupo,
  contas = EXCLUDED.contas, invert_sinal = EXCLUDED.invert_sinal;

-- 2. Depreciação: inverter sinal
INSERT INTO public.dfc_line_config (cod_empresa_bi, linha_id, descricao, secao, ordem, fonte, modo, grupo, contas, invert_sinal)
VALUES ('1001', 'depreciacao', 'Depreciação e Amortização', 'Operacional', 5, 'banco', 'grupo', 'Depreciação e Amortização', ARRAY[]::text[], true)
ON CONFLICT (cod_empresa_bi, linha_id) DO UPDATE SET
  fonte = EXCLUDED.fonte, modo = EXCLUDED.modo, grupo = EXCLUDED.grupo,
  contas = EXCLUDED.contas, invert_sinal = EXCLUDED.invert_sinal;

-- 3. Reversão de Provisões: inverter sinal
INSERT INTO public.dfc_line_config (cod_empresa_bi, linha_id, descricao, secao, ordem, fonte, modo, grupo, contas, invert_sinal)
VALUES ('1001', 'reversao_provisoes', 'Reversão de Provisões', 'Operacional', 7, 'banco', 'grupo', 'Reversão de Provisões', ARRAY[]::text[], true)
ON CONFLICT (cod_empresa_bi, linha_id) DO UPDATE SET
  fonte = EXCLUDED.fonte, modo = EXCLUDED.modo, grupo = EXCLUDED.grupo,
  contas = EXCLUDED.contas, invert_sinal = EXCLUDED.invert_sinal;

-- 6. Contas a Receber: inverter sinal
INSERT INTO public.dfc_line_config (cod_empresa_bi, linha_id, descricao, secao, ordem, fonte, modo, grupo, contas, invert_sinal)
VALUES ('1001', 'contas_receber', 'Aumento/Redução em contas a receber', 'Operacional', 14, 'banco', 'grupo', 'Variação em Contas a Receber', ARRAY[]::text[], true)
ON CONFLICT (cod_empresa_bi, linha_id) DO UPDATE SET
  fonte = EXCLUDED.fonte, modo = EXCLUDED.modo, grupo = EXCLUDED.grupo,
  contas = EXCLUDED.contas, invert_sinal = EXCLUDED.invert_sinal;

-- 7. Créditos Tributários: grupo + Saldo Negativo IRPJ/CSLL, invertido
INSERT INTO public.dfc_line_config (cod_empresa_bi, linha_id, descricao, secao, ordem, fonte, modo, grupo, contas, invert_sinal)
VALUES ('1001', 'creditos_tributarios', 'Aumento/Redução em créditos tributários', 'Operacional', 15, 'banco', 'grupo_mais_contas', 'Variação em Creditos Tributarios', ARRAY['1.1.2.07.02.00001','1.1.2.07.02.00002'], true)
ON CONFLICT (cod_empresa_bi, linha_id) DO UPDATE SET
  fonte = EXCLUDED.fonte, modo = EXCLUDED.modo, grupo = EXCLUDED.grupo,
  contas = EXCLUDED.contas, invert_sinal = EXCLUDED.invert_sinal;

-- 8. Despesas Antecipadas: inverter
INSERT INTO public.dfc_line_config (cod_empresa_bi, linha_id, descricao, secao, ordem, fonte, modo, grupo, contas, invert_sinal)
VALUES ('1001', 'despesas_antecipadas', 'Aumento/Redução em despesas antecipadas', 'Operacional', 16, 'banco', 'grupo', 'Variação em Despesas Antecipadas', ARRAY[]::text[], true)
ON CONFLICT (cod_empresa_bi, linha_id) DO UPDATE SET
  fonte = EXCLUDED.fonte, modo = EXCLUDED.modo, grupo = EXCLUDED.grupo,
  contas = EXCLUDED.contas, invert_sinal = EXCLUDED.invert_sinal;

-- 9. Adiantamentos Concedidos: grupo + Créditos por Garantias, invertido
INSERT INTO public.dfc_line_config (cod_empresa_bi, linha_id, descricao, secao, ordem, fonte, modo, grupo, contas, invert_sinal)
VALUES ('1001', 'adiantamentos_concedidos', 'Aumento/Redução em adiantamentos concedidos', 'Operacional', 17, 'banco', 'grupo_mais_contas', 'Variação em Adiantamentos Concedidos', ARRAY['1.1.2.05.01.00001'], true)
ON CONFLICT (cod_empresa_bi, linha_id) DO UPDATE SET
  fonte = EXCLUDED.fonte, modo = EXCLUDED.modo, grupo = EXCLUDED.grupo,
  contas = EXCLUDED.contas, invert_sinal = EXCLUDED.invert_sinal;

-- 10. Outros Créditos: apenas Conta Corrente/Caixa Matriz-Filiais, invertido
INSERT INTO public.dfc_line_config (cod_empresa_bi, linha_id, descricao, secao, ordem, fonte, modo, grupo, contas, invert_sinal)
VALUES ('1001', 'outros_creditos', 'Aumento/Redução em outros créditos', 'Operacional', 18, 'contas', 'contas', NULL, ARRAY['1.1.2.03.01.00002','1.1.2.03.01.00003'], true)
ON CONFLICT (cod_empresa_bi, linha_id) DO UPDATE SET
  fonte = EXCLUDED.fonte, modo = EXCLUDED.modo, grupo = EXCLUDED.grupo,
  contas = EXCLUDED.contas, invert_sinal = EXCLUDED.invert_sinal;

-- 11. Créditos Transitórios: inverter
INSERT INTO public.dfc_line_config (cod_empresa_bi, linha_id, descricao, secao, ordem, fonte, modo, grupo, contas, invert_sinal)
VALUES ('1001', 'creditos_transitorios', 'Aumento/Redução em créditos transitórios', 'Operacional', 19, 'banco', 'grupo', 'Variação em Creditos Transitorios', ARRAY[]::text[], true)
ON CONFLICT (cod_empresa_bi, linha_id) DO UPDATE SET
  fonte = EXCLUDED.fonte, modo = EXCLUDED.modo, grupo = EXCLUDED.grupo,
  contas = EXCLUDED.contas, invert_sinal = EXCLUDED.invert_sinal;

-- 12. Estoques: inverter
INSERT INTO public.dfc_line_config (cod_empresa_bi, linha_id, descricao, secao, ordem, fonte, modo, grupo, contas, invert_sinal)
VALUES ('1001', 'estoques', 'Aumento/Redução em estoques', 'Operacional', 20, 'banco', 'grupo', 'Variação em Estoques', ARRAY[]::text[], true)
ON CONFLICT (cod_empresa_bi, linha_id) DO UPDATE SET
  fonte = EXCLUDED.fonte, modo = EXCLUDED.modo, grupo = EXCLUDED.grupo,
  contas = EXCLUDED.contas, invert_sinal = EXCLUDED.invert_sinal;

-- 13. Fornecedores: inverter
INSERT INTO public.dfc_line_config (cod_empresa_bi, linha_id, descricao, secao, ordem, fonte, modo, grupo, contas, invert_sinal)
VALUES ('1001', 'fornecedores', 'Aumento/Redução em fornecedores', 'Operacional', 22, 'banco', 'grupo', 'Variação em Fornecedores', ARRAY[]::text[], true)
ON CONFLICT (cod_empresa_bi, linha_id) DO UPDATE SET
  fonte = EXCLUDED.fonte, modo = EXCLUDED.modo, grupo = EXCLUDED.grupo,
  contas = EXCLUDED.contas, invert_sinal = EXCLUDED.invert_sinal;

-- 14. Adiantamentos de Clientes: inverter
INSERT INTO public.dfc_line_config (cod_empresa_bi, linha_id, descricao, secao, ordem, fonte, modo, grupo, contas, invert_sinal)
VALUES ('1001', 'adiantamentos_clientes', 'Aumento/Redução em adiantamentos de clientes', 'Operacional', 23, 'banco', 'grupo', 'Variação em Adiantamentos Clientes', ARRAY[]::text[], true)
ON CONFLICT (cod_empresa_bi, linha_id) DO UPDATE SET
  fonte = EXCLUDED.fonte, modo = EXCLUDED.modo, grupo = EXCLUDED.grupo,
  contas = EXCLUDED.contas, invert_sinal = EXCLUDED.invert_sinal;

-- 15. Obrigações Trabalhistas: inverter
INSERT INTO public.dfc_line_config (cod_empresa_bi, linha_id, descricao, secao, ordem, fonte, modo, grupo, contas, invert_sinal)
VALUES ('1001', 'obrigacoes_trabalhistas', 'Aumento/Redução em obrigações trabalhistas', 'Operacional', 24, 'banco', 'grupo', 'Variação em Obrigações Trabalhistas e Previdenciarias', ARRAY[]::text[], true)
ON CONFLICT (cod_empresa_bi, linha_id) DO UPDATE SET
  fonte = EXCLUDED.fonte, modo = EXCLUDED.modo, grupo = EXCLUDED.grupo,
  contas = EXCLUDED.contas, invert_sinal = EXCLUDED.invert_sinal;

-- 16. Obrigações Tributárias: inverter
INSERT INTO public.dfc_line_config (cod_empresa_bi, linha_id, descricao, secao, ordem, fonte, modo, grupo, contas, invert_sinal)
VALUES ('1001', 'obrigacoes_tributarias', 'Aumento/Redução em obrigações tributárias', 'Operacional', 25, 'banco', 'grupo', 'Variação em Obrigações Tributarias', ARRAY[]::text[], true)
ON CONFLICT (cod_empresa_bi, linha_id) DO UPDATE SET
  fonte = EXCLUDED.fonte, modo = EXCLUDED.modo, grupo = EXCLUDED.grupo,
  contas = EXCLUDED.contas, invert_sinal = EXCLUDED.invert_sinal;

-- 18. Outras Obrigações: inverter
INSERT INTO public.dfc_line_config (cod_empresa_bi, linha_id, descricao, secao, ordem, fonte, modo, grupo, contas, invert_sinal)
VALUES ('1001', 'outras_obrigacoes', 'Aumento/Redução em outras Obrigações', 'Operacional', 27, 'banco', 'grupo', 'Variação em Outras Obrigações', ARRAY[]::text[], true)
ON CONFLICT (cod_empresa_bi, linha_id) DO UPDATE SET
  fonte = EXCLUDED.fonte, modo = EXCLUDED.modo, grupo = EXCLUDED.grupo,
  contas = EXCLUDED.contas, invert_sinal = EXCLUDED.invert_sinal;
