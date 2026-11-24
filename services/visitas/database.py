"""Conexão ao SQL Server e compatibilidade do cursor ODBC do Windows."""
import os

from fastapi import HTTPException

if os.name == "nt":
    import pyodbc

    pyodbc.pooling = False
    DatabaseError = pyodbc.Error
else:
    import pymssql

    pyodbc = None
    DatabaseError = pymssql.Error


class OdbcCursor:
    def __init__(self, cursor, as_dict):
        self.cursor = cursor
        self.as_dict = as_dict

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.cursor.close()

    def execute(self, statement, params=()):
        self.cursor.execute(statement.replace("%s", "?"), params)

    def executemany(self, statement, params):
        self.cursor.executemany(statement.replace("%s", "?"), params)

    def row(self, values):
        if values is None or not self.as_dict:
            return values
        return {column[0]: value for column, value in zip(self.cursor.description, values)}

    def fetchone(self):
        return self.row(self.cursor.fetchone())

    def fetchall(self):
        return [self.row(row) for row in self.cursor.fetchall()]


class OdbcConnection:
    def __init__(self, connection):
        self.connection = connection

    def cursor(self, *, as_dict=False):
        return OdbcCursor(self.connection.cursor(), as_dict)

    def commit(self):
        self.connection.commit()

    def close(self):
        self.connection.close()


def odbc_value(value):
    return "{" + value.replace("}", "}}") + "}"


def connect():
    try:
        server = os.environ["VISITAS_SQL_SERVER"]
        port = os.getenv("VISITAS_SQL_PORT", "1433")
        database = os.environ["VISITAS_SQL_DATABASE"]
        user = os.environ["VISITAS_SQL_USER"]
        password = os.environ["VISITAS_SQL_PASSWORD"]
    except KeyError as exc:
        raise HTTPException(503, "Banco de visitas indisponível.") from exc

    if pyodbc is None:
        return pymssql.connect(server=server, port=port, database=database, user=user, password=password,
                               login_timeout=5, timeout=15, encryption="require")

    # O pacote Windows roda no próprio host do SQL Server, cuja interface é verificada na instalação.
    connection_string = (
        "DRIVER={SQL Server Native Client 11.0};"
        f"SERVER={odbc_value(f'tcp:{server},{port}')};DATABASE={odbc_value(database)};"
        f"UID={odbc_value(user)};PWD={odbc_value(password)};Encrypt=yes;TrustServerCertificate=yes;"
    )
    connection = pyodbc.connect(connection_string, timeout=5, autocommit=False)
    connection.timeout = 15
    return OdbcConnection(connection)
