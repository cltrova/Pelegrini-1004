# Relatórios de Visitas a Oficinas

A API grava e consulta em `dbo.RelatoriosVisitas` no SQL Server interno. O portal envia o token da sessão atual no cabeçalho `Authorization: Bearer <token>`.

## Contrato HTTP

| Método | Rota | Resultado |
|---|---|---|
| POST | `/operacional/visitas/relatorios` | `201` com `{"id":"123"}` após o commit |
| GET | `/operacional/visitas/relatorios?escopo=meus` | `200` com os relatórios do visitador autenticado |
| GET | `/operacional/visitas/relatorios?escopo=gerencia&cod_empresa_bi=10041&filial_id=chevrolet` | `200` com relatórios da filial autorizada |

O POST recebe `Content-Type: application/json`. Exemplo de corpo:

```json
{
  "cod_empresa_bi": "10041",
  "filial_id": "chevrolet",
  "nome_cliente": "Oficina Exemplo",
  "data_visita": "2026-11-24",
  "cnpj": "",
  "cidade": "Uberlândia",
  "segmento": "Oficina",
  "diesel": "",
  "responsaveis_compras": "",
  "funcao": "",
  "avaliacoes": {
    "Atendimento": ["Solicitou retorno", "Agendar retorno", "Visitador"],
    "Entrega": ["", "", ""],
    "Preço": ["", "", ""],
    "Prazo": ["", "", ""]
  }
}
```

No GET, `cliente` e `visitador` procuram trechos do nome. `inicio` e `fim` são datas inclusivas em `AAAA-MM-DD`. `offset` começa em zero e `limit` vai de 1 a 100, com padrão de 20. `total` conta todos os registros após os filtros e antes da paginação.

```json
{
  "relatorios": [
    {
      "id": "123",
      "visitador_nome": "Visitador CCH",
      "cod_empresa_bi": "10041",
      "filial_id": "chevrolet",
      "nome_cliente": "Oficina Exemplo",
      "data_visita": "2026-11-24",
      "cnpj": "",
      "cidade": "Uberlândia",
      "segmento": "Oficina",
      "diesel": "",
      "responsaveis_compras": "",
      "funcao": "",
      "avaliacoes": {
        "Atendimento": ["Solicitou retorno", "Agendar retorno", "Visitador"],
        "Entrega": ["", "", ""],
        "Preço": ["", "", ""],
        "Prazo": ["", "", ""]
      }
    }
  ],
  "total": 1
}
```

### Sessão e acesso

- A API valida a sessão em `/auth/v1/user` no Supabase, obtém o UUID autenticado e consulta `user_roles` e `profiles` com o mesmo token. Identificador e nome do autor vêm dessa consulta.
- O perfil `visitador` grava apenas para uma filial autorizada e só lista seus próprios registros. O perfil `gerencial` precisa de acesso ao Comercial em `user_module_permissions` e à filial indicada em `profiles.filiais_permitidas`. Perfis sem a lista usam `profiles.filial_id`. O perfil `master` usa o escopo administrativo do portal.
- Para Casa do Chevrolet, envie `cod_empresa_bi: "10041"` e `filial_id: "chevrolet"`. Perfis legados de empresa `"1004"` podem acessar o escopo Chevrolet quando têm a filial `chevrolet` autorizada. A Casa da Transmissão usa `"1004"` e `"transmissao"`.
- A API devolve `401` para sessão ausente ou inválida, `403` para acesso negado, `422` para parâmetros inválidos e `503` se a validação de sessão ou a operação no banco falhar. As respostas têm `Cache-Control: private, no-store`.

## Homologação local

- Visitador — `http://127.0.0.1:4317/visitas`
- Comercial — `http://127.0.0.1:4317/comercial/visitas`
- OpenAPI — `http://127.0.0.1:4318/docs`

O ambiente local usa SQL Server com banco isolado e um provedor de sessão de teste com três perfis fictícios. A API faz as mesmas consultas HTTP de sessão, perfil e permissões que fará ao Supabase. Use o arquivo de acessos entregue à parte para autenticar na tela.

## Implantação após o aceite

1. Selecione o banco interno de visitas, execute `schema.sql` e dê ao usuário da API somente `SELECT` e `INSERT` nessa tabela. Use credenciais exclusivas para esse banco.
2. Configure `VISITAS_SQL_SERVER`, `VISITAS_SQL_PORT` (opcional), `VISITAS_SQL_DATABASE`, `VISITAS_SQL_USER`, `VISITAS_SQL_PASSWORD`, `VISITAS_SUPABASE_URL` e `VISITAS_SUPABASE_KEY` no servidor. A chave é a publicável do mesmo projeto do portal.
3. Aplique primeiro a migração do perfil `visitador` no Supabase e depois a proteção de empresa e filial do perfil. Se a tabela legada `public.relatorios_visitas` já tiver registros, verifique a transferência desses registros antes de mudar o portal para o SQL Server.
4. Instale `requirements.txt` e inicie com `python -m uvicorn app:app --host 127.0.0.1 --port 4318`, a partir de `services/visitas`. Encaminhe a rota exata `/operacional/visitas/relatorios` no proxy HTTPS do site para o serviço interno, preservando método, corpo, query e `Authorization`. No Vite, o proxy usa `VISITAS_API_TARGET`.
5. Teste com as contas de homologação do Supabase, confirme o mesmo ID no histórico e na gerência e valide o HTTP `403` para um gerente de outra filial consultando o escopo Chevrolet.
