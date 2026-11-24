"""Provisiona uma conta de Visitas pela conexão administrativa do SQL Server."""
import argparse
from contextlib import closing
from getpass import getpass
from uuid import uuid4

from auth import chave_filial, senha_hash
from database import connect


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--email", required=True)
    parser.add_argument("--nome", required=True)
    parser.add_argument("--perfil", choices=["visitador", "gerencial"], required=True)
    parser.add_argument("--empresa", choices=["1004", "10041"], required=True)
    parser.add_argument("--filial", action="append", choices=["transmissao", "chevrolet"], required=True)
    args = parser.parse_args()
    email, nome, branches = args.email.strip().lower(), args.nome.strip(), set(args.filial)
    if "@" not in email or len(email)>254 or not nome or len(nome)>200:
        parser.error("Informe e-mail e nome válidos.")
    if any(not chave_filial(args.empresa, unit) for unit in branches):
        parser.error("Filial incompatível com a empresa.")
    password = getpass("Senha da conta (mínimo de 12 caracteres): ")
    if not 12<=len(password)<=256 or password!=getpass("Confirme a senha: "):
        parser.error("Senha não atende ao tamanho mínimo ou a confirmação diverge.")
    hashed = senha_hash(password)
    with closing(connect()) as db, db.cursor() as cursor:
        cursor.execute("SELECT id FROM dbo.VisitasUsuarios WITH (UPDLOCK,HOLDLOCK) WHERE email=%s", (email,))
        row = cursor.fetchone()
        if row:
            identifier, = row
            cursor.execute("""UPDATE dbo.VisitasUsuarios SET nome=%s,perfil=%s,cod_empresa_bi=%s,senha_hash=%s,
                ativo=1,falhas=0,bloqueado_ate=NULL WHERE id=%s""", (nome,args.perfil,args.empresa,hashed,identifier))
            cursor.execute("DELETE FROM dbo.VisitasSessoes WHERE usuario_id=%s", (identifier,))
            cursor.execute("DELETE FROM dbo.VisitasFiliais WHERE usuario_id=%s", (identifier,))
        else:
            identifier = str(uuid4())
            cursor.execute("""INSERT INTO dbo.VisitasUsuarios (id,email,nome,perfil,cod_empresa_bi,senha_hash)
                            VALUES (%s,%s,%s,%s,%s,%s)""", (identifier,email,nome,args.perfil,args.empresa,hashed))
        cursor.executemany("INSERT INTO dbo.VisitasFiliais (usuario_id,filial_id) VALUES (%s,%s)",
                           [(identifier,branch) for branch in sorted(branches)])
        db.commit()
    print("Conta de Visitas configurada.")


if __name__=="__main__":
    main()
