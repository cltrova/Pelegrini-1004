# Relatórios de Visitas a Oficinas

A API grava e consulta em `dbo.RelatoriosVisitas` no SQL Server interno. O visitador usa a sessão de Visitas em cookie. A gerência abre `/comercial/visitas` com a sessão que já usa no Comercial.

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
- O visitador grava na filial autorizada e consulta o próprio histórico. A API identifica o autor pela sessão.
- A gerência envia o token da sessão do Comercial em `Authorization: Bearer <token>`. A API verifica a identidade, o perfil e a permissão vigente do Comercial. Gerentes consultam as filiais que constam nas permissões do portal e na liberação registrada pelo Master no SQL de Visitas. O Master tem acesso às duas filiais.
- Ao salvar um gerente no Comercial, o portal registra a liberação no SQL de Visitas. Para contas existentes, o Master pode usar **Confirmar acesso a Visitas** na edição do usuário. A API recebe `POST /operacional/visitas/gerencia/permissoes` com `usuario_id`, `cod_empresa_bi` e `filiais`. Ela exige a sessão de um Master e confirma que as filiais correspondem à seleção salva. A resposta é `204`.
- Para a Casa do Chevrolet, envie `cod_empresa_bi: "10041"` e `filial_id: "chevrolet"`. A Casa da Transmissão usa `"1004"` e `"transmissao"`.
- A API devolve `401` para sessão ausente ou inválida, `403` para acesso negado, `422` para parâmetros inválidos e `503` para falha de banco. As respostas usam `Cache-Control: private, no-store`.

### Cadastro de visitadores

Em **Configurações → Usuários → Novo Usuário**, o Master seleciona **Visitador** e informa nome, e-mail, empresa e filiais. A conta fica no SQL interno. O visitador usa o login principal do Pelegrini, define a própria senha no primeiro acesso e segue para `/visitas`. Uma sessão de Visitas volta a essa tela ao abrir outro endereço do portal.

| Método | Rota | Resultado |
|---|---|---|
| GET | `/operacional/visitas/visitadores` | `200` com `{"visitadores":[...]}` para o Master |
| POST | `/operacional/visitas/visitadores` | `201` com `id` e `senha_temporaria` para o Master |
| POST | `/operacional/visitas/visitadores/{id}/senha` | `200` com `id` e nova `senha_temporaria` para o Master |
| POST | `/operacional/visitas/sessao/senha` | `200` com a sessão após a troca da senha inicial |

O cadastro recebe `nome`, `email`, `cod_empresa_bi` e `filiais`. O e-mail é único em Visitas. O Master usa o token do Comercial. A redefinição encerra as sessões do visitador. Enquanto `troca_senha_pendente` estiver ativo, o visitador pode consultar a própria sessão, sair ou enviar `{"senha":"..."}` para definir uma senha de 12 a 256 caracteres. A troca cria um novo cookie e invalida os anteriores.

## Homologação local

- Entrada do visitador — `http://127.0.0.1:4317/`
- Comercial — `http://127.0.0.1:4317/comercial/visitas`
- OpenAPI — `http://127.0.0.1:4318/docs`

O ambiente local usa SQL Server com banco isolado e três perfis fictícios. Use o arquivo de acessos entregue à parte. A variável `VISITAS_HTTP_LOCAL=1` habilita o cookie em HTTP na interface de loopback durante o teste.

## Implantação após o aceite

1. Execute `schema.sql` e `auth_schema.sql` no banco interno de Visitas. A conta da API precisa de `SELECT, INSERT` em `RelatoriosVisitas`, `VisitasUsuarios` e `VisitasFiliais`, `UPDATE` nas colunas `VisitasUsuarios.falhas`, `bloqueado_ate`, `senha_hash` e `troca_senha_pendente`, `SELECT, INSERT, DELETE` em `VisitasSessoes` e `SELECT, INSERT, UPDATE` em `VisitasGerenciaPortal`.
2. Configure `VISITAS_SQL_SERVER`, `VISITAS_SQL_PORT` (opcional), `VISITAS_SQL_DATABASE`, `VISITAS_SQL_USER` e `VISITAS_SQL_PASSWORD` para o serviço. Para a gerência, configure `VISITAS_PORTAL_AUTH_HOST` e `VISITAS_PORTAL_ANON_KEY` com o domínio de autenticação e a chave pública que o portal já usa.
3. Cadastre os visitadores pelo formulário do Master. A gerência usa a conta do Comercial com as permissões configuradas no portal.
4. Instale `requirements.txt` e inicie com `python -m uvicorn app:app --host 127.0.0.1 --port 4318` a partir de `services/visitas`. Use os proxies do repositório para as rotas HTTPS de Visitas. No Vite, o proxy usa `VISITAS_API_TARGET`.
5. Teste com perfis autorizados. Confira o mesmo ID no histórico e na gerência e o HTTP `403` para um gerente da Transmissão consultando o escopo da Chevrolet.

No Windows do Pelegrini, o pacote usa o SQL Server Native Client 11.0. O instalador valida a conexão criptografada no endereço local do servidor e testa o retorno de texto Unicode e data antes de iniciar os serviços de Visitas.
