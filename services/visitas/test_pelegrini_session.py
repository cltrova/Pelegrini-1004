"""Contrato da API com a sessão principal do Pelegrini."""
import json
import unittest
from datetime import date
from unittest.mock import MagicMock, patch

from fastapi import HTTPException
from fastapi.testclient import TestClient

from app import app
from test_api import BODY, CHEVROLET, PATH


SESSION_PATH = "/operacional/visitas/sessao"
USER_ID = "225ca065-b924-4b0a-b95e-b1f04c152cce"
HEADERS = {"Authorization": "Bearer conta.portal.teste"}


class PelegriniSessionTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.addCleanup(self.client.close)
        config = patch.dict("os.environ", {
            "VISITAS_PORTAL_AUTH_HOST": "contas.supabase.co",
            "VISITAS_PORTAL_ANON_KEY": "publishable-example",
        })
        config.start()
        self.addCleanup(config.stop)

    def perfil(self, roles, company="1004", branches=None, commercial=False, must_change=False):
        return {
            "id": USER_ID, "nome": "Pessoa Teste", "roles": roles,
            "empresa": company, "filial_padrao": "chevrolet", "filiais": branches,
            "comercial": commercial, "must_change_password": must_change,
        }

    def provider(self, payload, headers=HEADERS):
        def connection(host, *, timeout):
            self.assertEqual(host, "contas.supabase.co")
            conn = MagicMock()

            def request(method, path, *, body, headers: dict):
                self.assertEqual(headers["Authorization"], expected["Authorization"])
                self.assertEqual(headers["apikey"], "publishable-example")
                if path == "/auth/v1/user":
                    self.assertEqual(method, "GET")
                    result = {"id": payload["id"], "email": "teste@example.test", "email_confirmed_at": "2026-11-24"}
                else:
                    self.assertEqual(path, "/rest/v1/rpc/visitas_identidade")
                    self.assertEqual(method, "POST")
                    self.assertEqual(body, b"{}")
                    result = payload
                response = conn.getresponse.return_value
                response.status = 200
                response.read.return_value = json.dumps(result).encode()

            conn.request.side_effect = request
            return conn

        expected = headers
        return patch("auth.http.client.HTTPSConnection", side_effect=connection)

    def test_portal_visitador_uses_same_identity_and_only_assigned_branch(self):
        with self.provider(self.perfil(["visitador"])):
            response = self.client.get(SESSION_PATH, headers=HEADERS)
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(response.json(), {
                "id": USER_ID, "nome": "Pessoa Teste", "perfil": "visitador", "filiais": [CHEVROLET],
            })
            self.assertEqual(response.headers["Cache-Control"], "private, no-store")
            self.assertIn("Authorization", response.headers["Vary"])
            self.assertEqual(self.client.post(PATH, json={
                **BODY, "filial_id": "transmissao", "cod_empresa_bi": "1004",
            }, headers=HEADERS).status_code, 403)
            self.assertEqual(self.client.get(
                PATH, params={**CHEVROLET, "escopo": "gerencia"}, headers=HEADERS
            ).status_code, 403)

    def test_portal_master_and_commercial_manager_use_manager_scope(self):
        for profile, branches in (
            (self.perfil(["master"], company=None), [CHEVROLET, {"cod_empresa_bi": "1004", "filial_id": "transmissao"}]),
            (self.perfil(["gerencial"], company="10041", branches=["chevrolet", "transmissao"], commercial=True), [CHEVROLET]),
        ):
            with self.subTest(profile=profile), self.provider(profile), patch("app.connect") as connect:
                connect.return_value.cursor.return_value.fetchone.return_value = (0,)
                session = self.client.get(SESSION_PATH, headers=HEADERS)
                self.assertEqual(session.status_code, 200, session.text)
                self.assertEqual(session.json()["perfil"], "gerencial")
                self.assertEqual(session.json()["filiais"], branches)
                response = self.client.get(PATH, params={**CHEVROLET, "escopo": "gerencia"}, headers=HEADERS)
                self.assertEqual(response.json(), {"relatorios": [], "total": 0})
                self.assertEqual(self.client.post(PATH, json=BODY, headers=HEADERS).status_code, 403)

    def test_existing_access_rules_are_enforced_from_portal(self):
        for profile in (
            self.perfil(["vendedor"], commercial=True),
            self.perfil(["gerencial"], commercial=False),
            self.perfil(["visitador"], branches=[]),
            self.perfil(["visitador"], must_change=True),
        ):
            with self.subTest(profile=profile), self.provider(profile):
                self.assertEqual(self.client.get(SESSION_PATH, headers=HEADERS).status_code, 403)

    def test_expired_portal_token_does_not_fall_back_to_visitas_cookie(self):
        error = HTTPException(401, "Sessão expirada.")
        with patch("auth.portal_request", side_effect=error), patch("auth.connect") as connect:
            response = self.client.get(
                SESSION_PATH, headers={**HEADERS, "Cookie": f"pelegrini_visitas={'a' * 43}"},
            )
            self.assertEqual(response.status_code, 401)
            connect.assert_not_called()

    def test_same_report_id_in_portal_visitor_history_and_manager_list(self):
        from app import COLUNAS

        with self.provider(self.perfil(["visitador"])), patch("app.connect") as connect:
            connection = connect.return_value
            cursor = connection.cursor.return_value
            cursor.fetchone.return_value = (123,)
            sent = self.client.post(PATH, json=BODY, headers=HEADERS)
            self.assertEqual(sent.status_code, 201, sent.text)
            self.assertEqual(sent.json(), {"id": "123"})
            values = cursor.execute.call_args.args[1]
            self.assertEqual(values[:2], (USER_ID, "Pessoa Teste"))
            connection.commit.assert_called_once()

            record = dict(zip(COLUNAS, values[2:]))
            record["data_visita"] = date.fromisoformat(record["data_visita"])
            cursor.fetchone.return_value = (1,)
            cursor.fetchall.return_value = [(123, "Pessoa Teste", *(record[key] for key in COLUNAS))]
            mine = self.client.get(PATH, params={"escopo": "meus"}, headers=HEADERS)
            self.assertIn("visitador_id = %s", cursor.execute.call_args.args[0])
            self.assertEqual(cursor.execute.call_args.args[1][0], USER_ID)

        manager = {**self.perfil(["gerencial"], commercial=True), "id": "6e643341-d380-4f38-af18-70a18b984bb7"}
        manager_headers = {"Authorization": "Bearer gerencia.portal.teste"}
        with self.provider(manager, manager_headers), patch("app.connect", return_value=connection):
            management = self.client.get(PATH, params={"escopo": "gerencia", **CHEVROLET}, headers=manager_headers)
            self.assertEqual(management.status_code, 200, management.text)
            self.assertIn("filial_id = %s", cursor.execute.call_args.args[0])
            self.assertEqual(cursor.execute.call_args.args[1][0], "chevrolet")
            self.assertEqual(management.json(), mine.json())
            self.assertEqual(management.json()["relatorios"][0]["id"], "123")
