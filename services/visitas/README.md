# Relatórios de Visitas a Oficinas

A API grava e consulta em `dbo.RelatoriosVisitas` no SQL Server interno. As telas de Visitas usam a mesma sessão do portal Pelegrini.

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

- O portal envia `Authorization: Bearer <token da sessão principal>` na consulta de sessão e nas chamadas de relatórios. A API valida o token no serviço de identidade do Pelegrini. Esse serviço consulta as permissões e filiais da conta autenticada. Uma requisição com token inválido recebe `401`.
- O Master cadastra o perfil **Visitador** em **Configurações → Usuários** e libera pelo menos uma filial. O visitador envia relatórios para uma filial autorizada e consulta o próprio histórico. Master e Gerencial com acesso ao Comercial consultam os relatórios da filial ativa em **Comercial → Relatórios de visitas**. A API obtém a autoria da sessão.
- Durante a atualização, os endpoints `POST` e `DELETE /operacional/visitas/sessao` continuam atendendo ao portal anterior pelo cookie `pelegrini_visitas`.
- Para a Casa do Chevrolet, envie `cod_empresa_bi: "10041"` e `filial_id: "chevrolet"`. A Casa da Transmissão usa `"1004"` e `"transmissao"`.
- A API devolve `401` para sessão ausente ou inválida, `403` para acesso negado, `422` para parâmetros inválidos e `503` para falha de banco. As respostas usam `Cache-Control: private, no-store`.

## Homologação local

- Visitador — `http://127.0.0.1:4317/visitas`
- Comercial — `http://127.0.0.1:4317/comercial/visitas`
- OpenAPI — `http://127.0.0.1:4318/docs`

Use um banco SQL Server isolado para o teste completo. A suíte de API pode ser executada com `python -m unittest -v` em `services/visitas` com `httpx` e os pacotes de `requirements.txt`. Com `VISITAS_SQL_DATABASE=PelegriniVisitasHomolog`, ela também grava um relatório de teste no banco isolado.

## Implantação após o aceite

1. Aplique `20261124150000_visitas_perfil_visitador.sql` e depois `20261124150100_visitas_identidade_pelegrini.sql` no projeto de identidade do portal, em transações separadas. Publique as funções atualizadas `create-user`, `delete-user` e `reset-user-password`.
2. No serviço de Visitas do RSYS, mantenha `VISITAS_PORTAL_AUTH_HOST` e `VISITAS_PORTAL_ANON_KEY` com o domínio de autenticação e a chave pública do portal. A conexão existente com o SQL Server e o esquema de relatórios já implantado atendem à atualização.
3. Atualize o serviço de Visitas e confira que os proxies preservam `Authorization`, método, corpo e parâmetros. No Vite, o proxy usa `VISITAS_API_TARGET`.
4. Valide uma conta Visitador com a senha já definida, um responsável Gerencial com acesso ao Comercial na mesma filial e um Gerencial de outra filial. Confira o mesmo ID após o envio, no histórico e na gerência, e o HTTP `403` ao consultar a outra filial.
5. Publique o portal depois de validar a API com a sessão principal do Pelegrini.

No Windows do Pelegrini, o pacote usa o SQL Server Native Client 11.0. O instalador valida a conexão criptografada no endereço local do servidor e testa o retorno de texto Unicode e data antes de iniciar os serviços de Visitas.
