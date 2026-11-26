import unittest
from datetime import date
from unittest.mock import Mock
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

from fastapi.testclient import TestClient

from oficinas import carregar_catalogo
from oficinas_gateway import PaginaHistorico, app


class OficinasGatewayTest(unittest.TestCase):
    rota = "/operacional/visitas/oficinas"
    escopo = {"cod_empresa_bi": "10041", "filial_id": "chevrolet"}
    headers = {"Authorization": "Bearer sessao-teste"}

    def setUp(self):
        self.client = TestClient(app)
        self.oficina = carregar_catalogo()["oficinas"][0]

    def relatorio(self, id_, *, cnpj="", filial="chevrolet"):
        return {"id": str(id_), "cnpj": cnpj, "nome_cliente": "Outra oficina",
                "cidade": "Uberlândia", "filial_id": filial, "cod_empresa_bi": "1004",
                "data_visita": date(2026, 11, 24).isoformat()}

    def test_recusa_pedido_sem_sessao_sem_consultar_historico(self):
        with patch("oficinas_gateway.consultar_pagina") as consultar:
            resposta = self.client.get(self.rota, params=self.escopo)
        self.assertEqual(resposta.status_code, 401)
        self.assertEqual(resposta.headers["Cache-Control"], "private, no-store")
        consultar.assert_not_called()

    def test_cruza_todas_as_paginas_com_a_sessao_original(self):
        paginas = [
            PaginaHistorico.model_validate({"total": 101, "relatorios": [self.relatorio(id_) for id_ in range(101, 1, -1)]}),
            PaginaHistorico.model_validate({"total": 101, "relatorios": [self.relatorio(1, cnpj=self.oficina["cnpj"])]}),
        ]
        with patch("oficinas_gateway.consultar_pagina", side_effect=paginas) as consultar:
            resposta = self.client.get(self.rota, headers=self.headers, params={**self.escopo,
                                        "busca": self.oficina["cnpj"], "status": "visitada"})
        self.assertEqual(resposta.status_code, 200)
        resultado = resposta.json()
        self.assertEqual(resultado["total"], 1)
        self.assertEqual(resultado["oficinas"][0]["status"], "visitada")
        self.assertEqual(resultado["oficinas"][0]["ultima_visita"], "2026-11-24")
        self.assertEqual([call.args[3] for call in consultar.call_args_list], [0, 100])
        self.assertTrue(all(call.args[:3] == ("10041", "chevrolet", "Bearer sessao-teste")
                            for call in consultar.call_args_list))

    def test_historico_incompleto_nao_resulta_em_sem_visita(self):
        pagina = PaginaHistorico.model_validate({"total": 1, "relatorios": []})
        with patch("oficinas_gateway.consultar_pagina", return_value=pagina) as consultar:
            resposta = self.client.get(self.rota, headers=self.headers, params=self.escopo)
        self.assertEqual(resposta.status_code, 503)
        self.assertEqual(consultar.call_count, 2)

    def test_repassa_a_autorizacao_e_respeita_o_bloqueio_do_rsys(self):
        with patch("oficinas_gateway.HTTPConnection") as transporte:
            conexao = transporte.return_value
            conexao.getresponse.return_value = Mock(status=403)
            resposta = self.client.get(self.rota, headers=self.headers, params=self.escopo)
        self.assertEqual(resposta.status_code, 403)
        self.assertNotIn("oficinas", resposta.json())
        self.assertEqual(transporte.call_args.args, ("127.0.0.1", 15005))
        metodo, url = conexao.request.call_args.args
        consulta = urlsplit(url)
        self.assertEqual(metodo, "GET")
        self.assertEqual(consulta.path, "/operacional/visitas/relatorios")
        self.assertEqual(parse_qs(consulta.query), {"escopo": ["gerencia"], "cod_empresa_bi": ["10041"],
                                                   "filial_id": ["chevrolet"], "offset": ["0"], "limit": ["100"]})
        self.assertEqual(conexao.request.call_args.kwargs["headers"]["Authorization"], self.headers["Authorization"])

    def test_dado_de_outra_filial_nao_e_exposto(self):
        pagina = PaginaHistorico.model_validate({"total": 1, "relatorios": [self.relatorio(1, filial="transmissao")]})
        with patch("oficinas_gateway.consultar_pagina", return_value=pagina):
            resposta = self.client.get(self.rota, headers=self.headers, params=self.escopo)
        self.assertEqual(resposta.status_code, 503)


if __name__ == "__main__":
    unittest.main()
