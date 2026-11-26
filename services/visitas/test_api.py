"""HTTP acceptance contract, against SQL Server when configured."""
import os
import unittest
from contextlib import closing
from datetime import date
from unittest.mock import MagicMock, patch
from uuid import uuid4

from fastapi.testclient import TestClient

from app import app, identity

CHEVROLET = {"cod_empresa_bi": "10041", "filial_id": "chevrolet"}
BODY = {
    **CHEVROLET, "nome_cliente": "Oficina de homologação", "data_visita": "2026-11-24",
    "cnpj": "", "cidade": "Uberlândia", "segmento": "", "diesel": "",
    "responsaveis_compras": "", "funcao": "",
    "avaliacoes": {k: ["Observação", "Ação", "Responsável"] for k in ("Atendimento", "Entrega", "Preço", "Prazo")},
}
PATH = "/operacional/visitas/relatorios"
SESSAO = "/operacional/visitas/sessao"
VISITADORES = "/operacional/visitas/visitadores"
OFICINAS = "/operacional/visitas/oficinas"
CATALOGO_OFICINAS = {
    "competencia": "2026-11", "uf": "MG", "cidade": "Uberlândia",
    "fonte": "https://dados.gov.br/dados/conjuntos-dados/cadastro-nacional-da-pessoa-juridica---cnpj",
    "oficinas": [
        {"cnpj": "01234567000195", "nome_fantasia": "Mecânica São José", "razao_social": "São José Motores", "bairro": "Centro"},
        {"cnpj": "01234567000276", "nome_fantasia": "Mecânica São José", "razao_social": "São José Motores", "bairro": "Martins"},
        {"cnpj": "12ABC34501DE35", "nome_fantasia": "Oficina Alfa", "razao_social": "Alfa Serviços", "bairro": "Planalto"},
        {"cnpj": "01012345000128", "nome_fantasia": "Oficina Sol", "razao_social": "Pôr do Sol Veículos", "bairro": "Tabajaras"},
    ],
}


class PortalManagerTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.user_id = "5c20479e-084d-453a-ac9d-ca63907dbb24"
        self.master_id = "cb98de9f-8ea4-471e-91ca-1d12054ac03a"
        self.headers = {"Authorization": "Bearer header.payload.signature"}
        self.master_headers = {"Authorization": "Bearer header.master.signature"}
        self.role = "gerencial"
        self.profile = {"cod_empresa_bi": "1004", "filiais_permitidas": ["chevrolet"], "filial_id": "chevrolet"}
        self.version = "2026-11-24T17:00:00+00:00"
        self.approved = {"cod_empresa_bi": "1004", "chevrolet": True, "transmissao": False, "versao_comercial": self.version}

    def portal(self, path, token):
        actor = self.master_id if token == "header.master.signature" else self.user_id
        if path == "/auth/v1/user":
            return {"id": actor, "email": "gerente@visitas.example", "email_confirmed_at": "2026-11-24",
                    "app_metadata": {},
                    "user_metadata": {"cod_empresa_bi": "1004", "filiais_permitidas": ["chevrolet", "transmissao"]}}
        if path == f"/rest/v1/user_roles?user_id=eq.{self.master_id}&select=role":
            return [{"role": "master"}]
        if path == f"/rest/v1/user_roles?user_id=eq.{self.user_id}&select=role":
            return [{"role": self.role}]
        if path == f"/rest/v1/profiles?user_id=eq.{self.user_id}&select=cod_empresa_bi,filiais_permitidas,filial_id":
            return [self.profile]
        if path == f"/rest/v1/user_module_permissions?user_id=eq.{self.user_id}&select=modulo_comercial,updated_at":
            return [{"modulo_comercial": True, "updated_at": self.version}]
        raise AssertionError(path)

    def test_existing_portal_session_uses_server_approved_branches(self):
        with patch("auth.portal_get", self.portal), patch("auth.permissao_gerencia", return_value=self.approved):
            response = self.client.get("/operacional/visitas/sessao", headers=self.headers)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["id"], self.user_id)
            self.assertEqual(response.json()["filiais"], [CHEVROLET])
            other = self.client.get(PATH, params={"escopo": "gerencia", "cod_empresa_bi": "1004", "filial_id": "transmissao"}, headers=self.headers)
            self.assertEqual(other.status_code, 403)

    def test_oficinas_cruzam_cnpj_completo_e_separam_relatorios_sem_documento(self):
        with patch("auth.portal_get", self.portal), patch("auth.permissao_gerencia", return_value=self.approved), \
                patch("app.carregar_catalogo", return_value=CATALOGO_OFICINAS, create=True), patch("app.connect") as connect:
            cursor = connect.return_value.cursor.return_value
            cursor.fetchall.return_value = [
                (1, "01.234.567/0001-95", "São José", "Uberlândia", date(2026, 11, 2)),
                (2, "01234567000195", "São José", "", date(2026, 11, 20)),
                (3, "12.ABC.345/01DE-35", "Oficina Alfa", "Uberlândia - MG", date(2026, 11, 25)),
                (4, "", "Por do Sol Veículos", "Uberlandia/MG", date(2026, 11, 17)),
                (5, "99876543000134", "Oficina dos Relatórios", "Uberlândia - MG", date(2026, 11, 18)),
                (6, "", "Oficina sem documento", "Uberlândia", date(2026, 11, 5)),
                (7, "", "Outra cidade", "Uberaba - MG", date(2026, 11, 5)),
            ]
            response = self.client.get(OFICINAS, params=CHEVROLET, headers=self.headers)
            self.assertEqual(response.status_code, 200, response.text)
            self.assertIn("no-store", response.headers["Cache-Control"])
            data = response.json()
            self.assertEqual(data["total"], 6)
            self.assertEqual(data["catalogo"]["competencia"], "2026-11")
            rows = {row["cnpj"]: row for row in data["oficinas"]}
            self.assertEqual(rows["01234567000195"]["ultima_visita"], "2026-11-20")
            self.assertEqual(rows["01234567000276"]["status"], "sem_visita")
            self.assertEqual(rows["12ABC34501DE35"]["status"], "visitada")
            self.assertEqual(rows["01012345000128"]["status"], "a_conferir")
            self.assertIsNone(rows["01012345000128"]["ultima_visita"])
            self.assertEqual(rows["99876543000134"]["origem"], "historico")
            self.assertEqual(rows[None]["nome"], "Oficina sem documento")
            sql, params = cursor.execute.call_args.args
            self.assertIn("cod_empresa_bi IN ('1004', '10041')", sql)
            self.assertEqual(params, ("chevrolet",))

            sem_visita = self.client.get(OFICINAS, params={**CHEVROLET, "status": "sem_visita"}, headers=self.headers).json()
            self.assertEqual([row["cnpj"] for row in sem_visita["oficinas"]], ["01234567000276"])
            busca_nome = {**CHEVROLET, "busca": "mecanica sao jose", "limit": 1, "offset": 1}
            filtered = self.client.get(OFICINAS, params=busca_nome, headers=self.headers).json()
            self.assertEqual(filtered["total"], 2)
            self.assertEqual(filtered["oficinas"][0]["cnpj"], "01234567000276")
            busca_cnpj = {**CHEVROLET, "busca": "12.ABC.345/01de-35", "status": "visitada"}
            found = self.client.get(OFICINAS, params=busca_cnpj, headers=self.headers).json()
            self.assertEqual([row["nome"] for row in found["oficinas"]], ["Oficina Alfa"])

    def test_oficinas_mantem_pendencia_mesmo_quando_ha_visita_confirmada_com_o_mesmo_nome(self):
        with patch("auth.portal_get", self.portal), patch("auth.permissao_gerencia", return_value=self.approved), \
                patch("app.carregar_catalogo", return_value=CATALOGO_OFICINAS), patch("app.connect") as connect:
            connect.return_value.cursor.return_value.fetchall.return_value = [
                (1, "12.ABC.345/01DE-35", "Oficina Alfa", "Uberlândia", date(2026, 11, 20)),
                (2, "12.ABC.345/01DE-56", "Oficina Alfa", "Uberlândia", date(2026, 11, 21)),
                (3, "00.000.000/0000-00", "Oficina Sol", "Uberlândia", date(2026, 11, 19)),
            ]
            response = self.client.get(OFICINAS, params={**CHEVROLET, "status": "a_conferir"}, headers=self.headers)
            self.assertEqual(response.status_code, 200)
            self.assertCountEqual([(row["cnpj"], row["nome"]) for row in response.json()["oficinas"]], [
                (None, "Oficina Alfa"), ("01012345000128", "Oficina Sol"),
            ])

    def test_oficinas_exigem_gerencia_da_filial_e_catalogo_valido(self):
        with patch("auth.portal_get", self.portal), patch("auth.permissao_gerencia", return_value=self.approved), \
                patch("app.carregar_catalogo", return_value=CATALOGO_OFICINAS, create=True) as catalogo, \
                patch("app.connect") as connect:
            self.assertEqual(self.client.get(OFICINAS, params=CHEVROLET).status_code, 401)
            outra_filial = {"cod_empresa_bi": "1004", "filial_id": "transmissao"}
            self.assertEqual(self.client.get(OFICINAS, params=outra_filial, headers=self.headers).status_code, 403)
            self.assertEqual(self.client.get(OFICINAS, params={**CHEVROLET, "cidade": "Uberaba"},
                                             headers=self.headers).status_code, 422)
            catalogo.side_effect = OSError("arquivo ausente")
            self.assertEqual(self.client.get(OFICINAS, params=CHEVROLET, headers=self.headers).status_code, 503)
            connect.assert_not_called()

    def test_portal_user_without_role_or_approved_branch_is_denied(self):
        with patch("auth.portal_get", self.portal), patch("auth.permissao_gerencia", return_value=None):
            self.assertEqual(self.client.get("/operacional/visitas/sessao", headers=self.headers).status_code, 403)
        with patch("auth.portal_get", self.portal), patch("auth.permissao_gerencia", return_value=self.approved):
            self.role = "vendedor"
            self.assertEqual(self.client.get("/operacional/visitas/sessao", headers=self.headers).status_code, 403)

    def test_profile_cannot_expand_scope_and_permission_changes_invalidate_approval(self):
        self.profile["filiais_permitidas"] = ["chevrolet", "transmissao"]
        with patch("auth.portal_get", self.portal), patch("auth.permissao_gerencia", return_value=self.approved):
            self.assertEqual(self.client.get("/operacional/visitas/sessao", headers=self.headers).json()["filiais"], [CHEVROLET])
            self.version = "2026-11-24T17:01:00+00:00"
            self.assertEqual(self.client.get("/operacional/visitas/sessao", headers=self.headers).status_code, 403)

    def test_only_master_can_approve_current_commercial_permissions(self):
        path = "/operacional/visitas/gerencia/permissoes"
        payload = {"usuario_id": self.user_id, "cod_empresa_bi": "1004", "filiais": ["chevrolet"]}
        with patch("auth.portal_get", self.portal), patch("auth.salvar_permissao_gerencia") as save:
            self.assertEqual(self.client.post(path, json=payload).status_code, 401)
            self.assertEqual(self.client.post(path, headers=self.headers, json=payload).status_code, 403)
            self.assertEqual(self.client.post(path, headers=self.master_headers,
                                             json={**payload, "filiais": ["transmissao"]}).status_code, 409)
            save.assert_not_called()
            self.assertEqual(self.client.post(path, headers=self.master_headers, json=payload).status_code, 204)
            save.assert_called_once_with(self.user_id, "1004", {"chevrolet"}, self.version, self.master_id)

    @unittest.skipUnless(os.getenv("VISITAS_SQL_DATABASE") == "PelegriniVisitasHomolog", "SQL isolado requerido")
    def test_master_approval_persists_and_can_change_branches(self):
        self.user_id = str(uuid4())
        path = "/operacional/visitas/gerencia/permissoes"
        payload = {"usuario_id": self.user_id, "cod_empresa_bi": "1004"}
        with patch("auth.portal_get", self.portal):
            for branch in (CHEVROLET, {"cod_empresa_bi": "1004", "filial_id": "transmissao"}):
                self.profile["filiais_permitidas"] = [branch["filial_id"]]
                response = self.client.post(path, headers=self.master_headers,
                                            json={**payload, "filiais": self.profile["filiais_permitidas"]})
                self.assertEqual(response.status_code, 204, response.text)
                session = self.client.get("/operacional/visitas/sessao", headers=self.headers)
                self.assertEqual(session.json()["filiais"], [branch])
                reports = self.client.get(PATH, params={**branch, "escopo": "gerencia"}, headers=self.headers)
                self.assertEqual(reports.status_code, 200, reports.text)
            self.assertEqual(self.client.get(PATH, params={**CHEVROLET, "escopo": "gerencia"},
                                             headers=self.headers).status_code, 403)

    def test_master_keeps_access_to_both_branches(self):
        with patch("auth.portal_get", self.portal):
            response = self.client.get("/operacional/visitas/sessao", headers=self.master_headers)
        self.assertEqual(response.status_code, 200)
        self.assertCountEqual(response.json()["filiais"], [CHEVROLET, {"cod_empresa_bi": "1004", "filial_id": "transmissao"}])

    def test_visitador_administration_requires_master(self):
        payload = {"email": "visitador@example.test", "nome": "Visitador", "cod_empresa_bi": "10041",
                   "filiais": ["chevrolet"]}
        with patch("auth.portal_get", self.portal):
            self.assertEqual(self.client.get(VISITADORES).status_code, 401)
            self.assertEqual(self.client.post(VISITADORES, json=payload, headers=self.headers).status_code, 403)
            self.assertEqual(self.client.get(VISITADORES, headers=self.headers).status_code, 403)
            self.assertEqual(self.client.post(f"{VISITADORES}/{self.user_id}/senha", headers=self.headers).status_code, 403)
            self.assertEqual(self.client.post(VISITADORES, headers=self.master_headers,
                                              json={**payload, "filiais": ["transmissao"]}).status_code, 422)

    @unittest.skipUnless(os.getenv("VISITAS_SQL_DATABASE") == "PelegriniVisitasHomolog", "SQL isolado requerido")
    def test_first_login_and_recovery_keep_reports_scoped(self):
        client = TestClient(app, base_url="https://visitas.example.test")
        other = TestClient(app, base_url="https://visitas.example.test")
        account = {"email": f"visita-{uuid4().hex}@example.test", "nome": "Visitador de teste",
                   "cod_empresa_bi": "10041", "filiais": ["chevrolet"]}
        report = {**BODY, "nome_cliente": f"Oficina de teste {uuid4().hex}"}
        mine = {"escopo": "meus", "cliente": report["nome_cliente"]}
        manage = {**CHEVROLET, "escopo": "gerencia", "cliente": report["nome_cliente"]}
        with patch("auth.portal_get", self.portal), patch("auth.permissao_gerencia", return_value=self.approved):
            created = self.client.post(VISITADORES, headers=self.master_headers, json=account)
            self.assertEqual(created.status_code, 201)
            self.assertIn("no-store", created.headers["Cache-Control"])
            actor = created.json()
            password = actor["senha_temporaria"]
            credentials = {"email": account["email"], "senha": password}
            duplicate = self.client.post(VISITADORES, headers=self.master_headers,
                                         json={**account, "email": account["email"].upper()})
            self.assertEqual(duplicate.status_code, 409)
            listed = self.client.get(VISITADORES, headers=self.master_headers)
            self.assertEqual(listed.status_code, 200)
            record = next(row for row in listed.json()["visitadores"] if row["id"] == actor["id"])
            self.assertEqual(record["filiais"], ["chevrolet"])
            self.assertNotIn("senha_temporaria", record)

            self.assertIs(client.post(SESSAO, json=credentials).json()["troca_senha_pendente"], True)
            self.assertIs(other.post(SESSAO, json=credentials).json()["troca_senha_pendente"], True)
            self.assertEqual(client.get(VISITADORES).status_code, 401)
            self.assertEqual(client.post(PATH, json=report).status_code, 403)
            self.assertEqual(client.get(PATH, params=mine).status_code, 403)
            self.assertEqual(client.post(f"{SESSAO}/senha", json={"senha": password}).status_code, 422)
            changed = client.post(f"{SESSAO}/senha", json={"senha": f"Pessoal-{uuid4().hex}"})
            self.assertEqual(changed.status_code, 200)
            self.assertIs(changed.json()["troca_senha_pendente"], False)
            self.assertEqual(other.get(SESSAO).status_code, 401)
            self.assertEqual(other.post(SESSAO, json=credentials).status_code, 401)
            self.assertEqual(client.post(PATH, json={**report, "cod_empresa_bi": "1004",
                                                      "filial_id": "transmissao"}).status_code, 403)
            submitted = client.post(PATH, json=report)
            self.assertEqual(submitted.status_code, 201)
            expected = {"total": 1, "relatorios": [{**report, **submitted.json(), "visitador_nome": account["nome"]}]}
            self.assertEqual(client.get(PATH, params=mine).json(), expected)
            self.assertEqual(client.get(PATH, params=manage).status_code, 403)
            for headers in (self.headers, self.master_headers):
                self.assertEqual(self.client.get(PATH, params=manage, headers=headers).json(), expected)
                self.assertEqual(self.client.post(PATH, headers=headers, json=report).status_code, 403)

            self.profile["filiais_permitidas"] = ["transmissao"]
            self.approved.update(chevrolet=False, transmissao=True)
            self.assertEqual(self.client.get(PATH, params=manage, headers=self.headers).status_code, 403)

            another = {**account, "email": f"visita-{uuid4().hex}@example.test"}
            registered = self.client.post(VISITADORES, headers=self.master_headers, json=another)
            self.assertEqual(registered.status_code, 201)
            self.assertEqual(other.post(SESSAO, json={"email": another["email"],
                             "senha": registered.json()["senha_temporaria"]}).status_code, 200)
            self.assertEqual(other.post(f"{SESSAO}/senha", json={"senha": f"Pessoal-{uuid4().hex}"}).status_code, 200)
            self.assertEqual(other.get(PATH, params=mine).json(), {"total": 0, "relatorios": []})

            reset = self.client.post(f"{VISITADORES}/{actor['id']}/senha", headers=self.master_headers)
            self.assertEqual(reset.status_code, 200)
            self.assertEqual(client.get(SESSAO).status_code, 401)
            again = client.post(SESSAO, json={**credentials, "senha": reset.json()["senha_temporaria"]})
            self.assertIs(again.json()["troca_senha_pendente"], True)
            self.assertEqual(client.get(PATH, params=mine).status_code, 403)


class OdbcTest(unittest.TestCase):
    def test_windows_connection_uses_encryption_and_bound_queries(self):
        from database import connect

        driver = MagicMock()
        native = driver.connect.return_value
        cursor = native.cursor.return_value
        cursor.description = [("id",), ("nome",)]
        cursor.fetchone.side_effect = [(123, "Oficina São José"), None]
        cursor.fetchall.return_value = [(456, "Oficina União")]
        config = {
            "VISITAS_SQL_SERVER": "127.0.0.1",
            "VISITAS_SQL_DATABASE": "PelegriniVisitasHomolog",
            "VISITAS_SQL_USER": "test-user",
            "VISITAS_SQL_PASSWORD": "test;password}",
        }

        with patch("database.pyodbc", driver), patch.dict(os.environ, config):
            with closing(connect()) as db, db.cursor(as_dict=True) as c:
                c.execute("SELECT id,nome FROM dbo.VisitasUsuarios WHERE nome=%s", ("Oficina São José",))
                self.assertEqual(c.fetchone(), {"id": 123, "nome": "Oficina São José"})
                self.assertIsNone(c.fetchone())
                self.assertEqual(c.fetchall(), [{"id": 456, "nome": "Oficina União"}])
                db.commit()

        conn_string, = driver.connect.call_args.args
        self.assertIn("DRIVER={SQL Server Native Client 11.0};", conn_string)
        self.assertIn("Encrypt=yes;", conn_string)
        self.assertIn("PWD={test;password}}};", conn_string)
        self.assertFalse(driver.connect.call_args.kwargs["autocommit"])
        cursor.execute.assert_called_once_with("SELECT id,nome FROM dbo.VisitasUsuarios WHERE nome=?", ("Oficina São José",))
        cursor.close.assert_called_once()
        native.commit.assert_called_once()
        native.close.assert_called_once()


class ApiTest(unittest.TestCase):
    def setUp(self):
        from app import Identity

        self.client = TestClient(app)
        self.user = Identity("visitador-1", "Visitador de teste", {"visitador"}, "10041", {"chevrolet"})
        app.dependency_overrides[identity] = lambda: self.user

    def tearDown(self):
        app.dependency_overrides.clear()

    def test_visitador_cannot_read_management(self):
        self.assertEqual(self.client.get(PATH, params={**CHEVROLET, "escopo": "gerencia"}).status_code, 403)

    def test_manager_from_other_branch_cannot_read(self):
        from app import Identity

        self.user = Identity("gerente-2", "Outra filial", {"gerencial"}, "1004", {"transmissao"}, commercial=True)
        self.assertEqual(self.client.get(PATH, params={**CHEVROLET, "escopo": "gerencia"}).status_code, 403)

    def test_visitor_cannot_set_author_or_write_other_branch(self):
        self.assertEqual(self.client.post(PATH, json={**BODY, "visitador_nome": "Outro"}).status_code, 422)
        self.assertEqual(self.client.post(PATH, json={**BODY, "cod_empresa_bi": "1004", "filial_id": "transmissao"}).status_code, 403)
        invalid = {**BODY, "avaliacoes": {**BODY["avaliacoes"], "Prazo": ["incompleto"]}}
        self.assertEqual(self.client.post(PATH, json=invalid).status_code, 422)

    @unittest.skipUnless(os.getenv("VISITAS_SQL_DATABASE") == "PelegriniVisitasHomolog", "SQL isolado requerido")
    def test_commit_history_pagination_and_manager_scope(self):
        from app import Identity
        name = f"Oficina teste {uuid4().hex}"
        payload = {**BODY, "nome_cliente": name}
        res = self.client.post(PATH, json=payload)
        self.assertEqual(res.status_code, 201, res.text)
        report_id = res.json()["id"]
        mine = self.client.get(PATH, params={"escopo": "meus", "cliente": name}).json()
        expected = {"total": 1, "relatorios": [{**payload, "id": report_id, "visitador_nome": self.user.name}]}
        self.assertEqual(mine, expected)

        visitor = self.user
        self.user = Identity("visitador-outra", "Outro visitador", {"visitador"}, "10041", {"chevrolet"})
        self.assertEqual(self.client.get(PATH, params={"escopo": "meus", "cliente": name}).json(), {"total": 0, "relatorios": []})
        self.user = Identity("gerente-1", "Gerente", {"gerencial"}, "1004", {"chevrolet"}, commercial=True)
        params = {**CHEVROLET, "escopo": "gerencia", "cliente": name, "visitador": visitor.name, "inicio": "2026-11-24", "fim": "2026-11-24"}
        self.assertEqual(self.client.get(PATH, params=params).json(), expected)
        self.assertEqual(self.client.get(PATH, params={**params, "limit": 1, "offset": 1}).json(), {"total": 1, "relatorios": []})
        self.assertEqual(self.client.get(PATH, params={**params, "visitador": "inexistente"}).json(), {"total": 0, "relatorios": []})

    def test_missing_session(self):
        app.dependency_overrides.clear()
        self.assertEqual(self.client.get(PATH, params={"escopo": "meus"}).status_code, 401)
        self.assertEqual(self.client.get("/operacional/visitas/sessao").status_code, 401)


if __name__ == "__main__":
    unittest.main()
