"""HTTP acceptance contract, against SQL Server when configured."""
import os
import unittest

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


if __name__ == "__main__":
    unittest.main()
