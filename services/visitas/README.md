# Relatórios de Visitas a Oficinas

A API grava e consulta em `dbo.RelatoriosVisitas` no SQL Server interno. O portal usa a sessão própria de Visitas, enviada pelo navegador em cookie.

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

- O endpoint `POST /operacional/visitas/sessao` recebe `{"email":"visitador@empresa.com.br","senha":"..."}`. A API verifica a senha e inicia uma sessão de oito horas em cookie `HttpOnly` e `SameSite=Strict`, com `Secure` no ambiente HTTPS. A listagem de sessão é `GET /operacional/visitas/sessao` e a saída é `DELETE /operacional/visitas/sessao`.
- A API consulta o perfil e as filiais autorizadas diretamente no banco de Visitas. O visitador grava apenas na filial autorizada e consulta o próprio histórico. O gerente consulta as filiais autorizadas na tela `/comercial/visitas`. O usuário não informa o autor ao gravar.
- Para a Casa do Chevrolet, envie `cod_empresa_bi: "10041"` e `filial_id: "chevrolet"`. A Casa da Transmissão usa `"1004"` e `"transmissao"`.
- A API devolve `401` para sessão ausente ou inválida, `403` para acesso negado, `422` para parâmetros inválidos e `503` para falha de banco. As respostas usam `Cache-Control: private, no-store`.

## Homologação local

- Visitador — `http://127.0.0.1:4317/visitas`
- Comercial — `http://127.0.0.1:4317/comercial/visitas`
- OpenAPI — `http://127.0.0.1:4318/docs`

O ambiente local usa SQL Server com banco isolado e três perfis fictícios. Use o arquivo de acessos entregue à parte. A variável `VISITAS_HTTP_LOCAL=1` habilita o cookie em HTTP na interface de loopback durante o teste.

## Implantação após o aceite

1. Execute `schema.sql` e `auth_schema.sql` no banco interno de Visitas. A conta da API precisa de `SELECT, INSERT` em `RelatoriosVisitas`, `SELECT` em `VisitasUsuarios` e `VisitasFiliais`, `UPDATE` apenas nas colunas `VisitasUsuarios.falhas` e `VisitasUsuarios.bloqueado_ate`, e `SELECT, INSERT, DELETE` em `VisitasSessoes`.
2. Configure `VISITAS_SQL_SERVER`, `VISITAS_SQL_PORT` (opcional), `VISITAS_SQL_DATABASE`, `VISITAS_SQL_USER` e `VISITAS_SQL_PASSWORD` para o serviço.
3. Com a conexão administrativa do banco de Visitas, execute `python administrar.py --email email@empresa.com.br --nome "Nome do visitador" --perfil visitador --empresa 10041 --filial chevrolet`. A senha é solicitada no terminal. Use `--perfil gerencial` para gerência. Para atualizar uma conta, repita o comando com o mesmo e-mail e as filiais que devem ficar autorizadas.
4. Instale `requirements.txt` e inicie com `python -m uvicorn app:app --host 127.0.0.1 --port 4318` a partir de `services/visitas`. Encaminhe `/operacional/visitas/sessao` e `/operacional/visitas/relatorios` no proxy HTTPS do site, preservando cookies, método, corpo e parâmetros. No Vite, o proxy usa `VISITAS_API_TARGET`.
5. Teste com perfis autorizados. Confira o mesmo ID no histórico e na gerência e o HTTP `403` para um gerente da Transmissão consultando o escopo da Chevrolet.

No Windows do Pelegrini, o pacote usa o SQL Server Native Client 11.0. O instalador valida a conexão criptografada no endereço local do servidor e testa o retorno de texto Unicode e data antes de iniciar os serviços de Visitas.
