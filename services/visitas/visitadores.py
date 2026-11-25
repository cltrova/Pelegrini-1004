"""Cadastro interno de visitadores autorizado pelo Master do Comercial."""
import secrets
from contextlib import closing
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from auth import Empresa, Filial, PortalMaster, chave_filial, durante_hash, senha_hash
from database import DatabaseError, connect

router = APIRouter(prefix="/operacional/visitas/visitadores")


class VisitadorCadastro(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    nome: str = Field(min_length=1, max_length=200)
    email: str = Field(max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    cod_empresa_bi: Empresa
    filiais: list[Filial] = Field(min_length=1, max_length=2)


class VisitadorCadastrado(BaseModel):
    id: str
    nome: str
    email: str
    cod_empresa_bi: Empresa
    filiais: list[Filial]


class Visitadores(BaseModel):
    visitadores: list[VisitadorCadastrado]


class CredencialTemporaria(BaseModel):
    id: str
    senha_temporaria: str


@router.get("", response_model=Visitadores)
def listar_visitadores(_master: PortalMaster):
    try:
        with closing(connect()) as db, db.cursor(as_dict=True) as cursor:
            cursor.execute("""
                SELECT u.id,u.nome,u.email,u.cod_empresa_bi,f.filial_id
                FROM dbo.VisitasUsuarios u LEFT JOIN dbo.VisitasFiliais f ON f.usuario_id=u.id
                WHERE u.perfil='visitador' AND u.ativo=1
                ORDER BY u.nome,u.id,f.filial_id
            """)
            usuarios = {}
            for row in cursor.fetchall():
                branch = row.pop("filial_id")
                entry = usuarios.setdefault(row["id"], {**row, "filiais": []})
                if chave_filial(row["cod_empresa_bi"], branch):
                    entry["filiais"].append(branch)
    except DatabaseError:
        raise HTTPException(503, "Não foi possível listar os visitadores.") from None
    return {"visitadores": list(usuarios.values())}


@router.post("", response_model=CredencialTemporaria, status_code=201)
def cadastrar_visitador(payload: VisitadorCadastro, _master: PortalMaster):
    branches = set(payload.filiais)
    if len(branches) != len(payload.filiais) or any(not chave_filial(payload.cod_empresa_bi, branch) for branch in branches):
        raise HTTPException(422, "Selecione as filiais permitidas para a empresa.")

    email = payload.email.lower()
    user_id = str(uuid4())
    temporary = secrets.token_urlsafe(18)
    try:
        with durante_hash(), closing(connect()) as db, db.cursor() as cursor:
            cursor.execute("SELECT id FROM dbo.VisitasUsuarios WITH (UPDLOCK,HOLDLOCK) WHERE email=%s", (email,))
            if cursor.fetchone():
                raise HTTPException(409, "Já existe uma conta de Visitas com este e-mail.")
            cursor.execute("""
                INSERT INTO dbo.VisitasUsuarios (id,email,nome,perfil,cod_empresa_bi,senha_hash,troca_senha_pendente)
                VALUES (%s,%s,%s,'visitador',%s,%s,1)
            """, (user_id, email, payload.nome, payload.cod_empresa_bi, senha_hash(temporary)))
            cursor.executemany("INSERT INTO dbo.VisitasFiliais (usuario_id,filial_id) VALUES (%s,%s)",
                               [(user_id, branch) for branch in sorted(branches)])
            db.commit()
    except DatabaseError:
        raise HTTPException(503, "Não foi possível confirmar o cadastro. Confira a lista de visitadores antes de tentar de novo.") from None
    return {"id": user_id, "senha_temporaria": temporary}


@router.post("/{usuario_id}/senha", response_model=CredencialTemporaria)
def redefinir_senha(usuario_id: UUID, _master: PortalMaster):
    user_id = str(usuario_id)
    temporary = secrets.token_urlsafe(18)
    try:
        with durante_hash(), closing(connect()) as db, db.cursor() as cursor:
            cursor.execute("""
                SELECT id FROM dbo.VisitasUsuarios WITH (UPDLOCK,ROWLOCK)
                WHERE id=%s AND perfil='visitador' AND ativo=1
            """, (user_id,))
            if not cursor.fetchone():
                raise HTTPException(404, "Visitador ativo não encontrado.")
            cursor.execute("""
                UPDATE dbo.VisitasUsuarios SET senha_hash=%s,troca_senha_pendente=1,falhas=0,bloqueado_ate=NULL
                WHERE id=%s
            """, (senha_hash(temporary), user_id))
            cursor.execute("DELETE FROM dbo.VisitasSessoes WHERE usuario_id=%s", (user_id,))
            db.commit()
    except DatabaseError:
        raise HTTPException(503, "Não foi possível confirmar a redefinição de senha.") from None
    return {"id": user_id, "senha_temporaria": temporary}
