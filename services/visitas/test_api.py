"""HTTP acceptance contract, against SQL Server when configured."""
import os
import unittest
from contextlib import closing
from unittest.mock import MagicMock, patch

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


class PortalManagerTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.user_id = "5c20479e-084d-453a-ac9d-ca63907dbb24"
        self.headers = {"Authorization": "Bearer header.payload.signature"}
        self.role = "gerencial"
        self.metadata = {"cod_empresa_bi": "10041", "filiais_permitidas": ["chevrolet"]}

    def portal(self, path, _token):
        if path == "/auth/v1/user":
            return {"id": self.user_id, "email": "gerente@visitas.example", "email_confirmed_at": "2026-11-24",
                    "app_metadata": self.metadata,
                    "user_metadata": {"cod_empresa_bi": "1004", "filiais_permitidas": ["chevrolet", "transmissao"]}}
        if path == f"/rest/v1/user_roles?user_id=eq.{self.user_id}&select=role":
            return [{"role": self.role}]
        if path == f"/rest/v1/user_module_permissions?user_id=eq.{self.user_id}&select=modulo_comercial":
            return [{"modulo_comercial": True}]
        raise AssertionError(path)

    def test_existing_portal_session_uses_server_approved_branches(self):
        with patch("auth.portal_get", self.portal):
            response = self.client.get("/operacional/visitas/sessao", headers=self.headers)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["id"], self.user_id)
            self.assertEqual(response.json()["filiais"], [CHEVROLET])
            other = self.client.get(PATH, params={"escopo": "gerencia", "cod_empresa_bi": "1004", "filial_id": "transmissao"}, headers=self.headers)
            self.assertEqual(other.status_code, 403)

    def test_portal_user_without_role_or_approved_branch_is_denied(self):
        with patch("auth.portal_get", self.portal):
            self.metadata = {}
            self.assertEqual(self.client.get("/operacional/visitas/sessao", headers=self.headers).status_code, 403)
            self.metadata = {"cod_empresa_bi": "10041", "filiais_permitidas": ["chevrolet"]}
            self.role = "vendedor"
            self.assertEqual(self.client.get("/operacional/visitas/sessao", headers=self.headers).status_code, 403)

    def test_master_keeps_access_to_both_branches(self):
        self.role = "master"
        self.metadata = {}
        with patch("auth.portal_get", self.portal):
            response = self.client.get("/operacional/visitas/sessao", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertCountEqual(response.json()["filiais"], [CHEVROLET, {"cod_empresa_bi": "1004", "filial_id": "transmissao"}])


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
        from uuid import uuid4

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
