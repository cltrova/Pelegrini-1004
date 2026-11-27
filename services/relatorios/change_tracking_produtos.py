"""Check or enable Change Tracking for the twelve approved Produtos dependencies."""
from produtos_rsys import DATABASES, KEYS, validar_versao


def conferir(cursor, empresa):
    cursor.execute('''SELECT DB_NAME(), D.snapshot_isolation_state_desc,
                            HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','ALTER'),
                            C.is_auto_cleanup_on, C.retention_period, C.retention_period_units
                     FROM sys.databases D LEFT JOIN sys.change_tracking_databases C ON C.database_id=D.database_id
                     WHERE D.database_id=DB_ID()''')
    banco, isolamento, alterar, cleanup, retencao, unidade = cursor.fetchone()
    if banco != DATABASES[empresa] or isolamento != 'ON' or not alterar:
        raise ValueError('Banco, permissão ou isolamento não correspondem ao escopo aprovado')
    if cleanup is not None and (cleanup, retencao, unidade) != (True, 2, 3):
        raise ValueError('A origem já usa uma política de Change Tracking diferente')

    cursor.execute('''SELECT T.name, C.name, CT.is_track_columns_updated_on,
                            HAS_PERMS_BY_NAME('dbo.'+T.name,'OBJECT','ALTER'),
                            HAS_PERMS_BY_NAME('dbo.'+T.name,'OBJECT','VIEW CHANGE TRACKING')
        FROM sys.tables T JOIN sys.schemas S ON S.schema_id=T.schema_id
        JOIN sys.indexes I ON I.object_id=T.object_id AND I.is_primary_key=1
        JOIN sys.index_columns IC ON IC.object_id=I.object_id AND IC.index_id=I.index_id AND IC.key_ordinal>0
        JOIN sys.columns C ON C.object_id=IC.object_id AND C.column_id=IC.column_id
        LEFT JOIN sys.change_tracking_tables CT ON CT.object_id=T.object_id
        WHERE S.name='dbo' AND T.name IN %s''', (tuple(KEYS),))
    metadados = {tabela: set() for tabela in KEYS}
    ligadas = set()
    for tabela, coluna, tracking, permite_alterar, permite_ler in cursor.fetchall():
        if not permite_alterar or not permite_ler or tracking:
            raise ValueError(f'Permissões ou configuração inesperadas em dbo.{tabela}')
        metadados[tabela].add(coluna)
        if tracking is not None:
            ligadas.add(tabela)
    if any(metadados[tabela] != set(colunas) for tabela, colunas in KEYS.items()):
        raise ValueError('As chaves primárias do RSYS mudaram')
    return cleanup is not None, ligadas


def configurar(cursor, empresa, *, aplicar=False):
    cursor.execute('SET NOCOUNT ON; SET DEADLOCK_PRIORITY LOW; SET LOCK_TIMEOUT 1500;')
    ativo, tabelas = conferir(cursor, empresa)
    alteradas = []
    if aplicar:
        # Autocommit releases each schema lock before attempting the next table.
        if not ativo:
            cursor.execute(f'ALTER DATABASE [{DATABASES[empresa]}] SET CHANGE_TRACKING = ON '
                           '(CHANGE_RETENTION = 2 DAYS, AUTO_CLEANUP = ON)')
        for tabela in KEYS:
            if tabela not in tabelas:
                cursor.execute(f'ALTER TABLE dbo.[{tabela}] ENABLE CHANGE_TRACKING '
                               'WITH (TRACK_COLUMNS_UPDATED = OFF)')
                alteradas.append(tabela)
        ativo, tabelas = conferir(cursor, empresa)
        cursor.execute('SELECT CHANGE_TRACKING_CURRENT_VERSION()')
        watermark, = cursor.fetchone()
        validar_versao(cursor, watermark, watermark)
    else:
        watermark = None
    return {'empresa': empresa, 'ativo': ativo, 'tabelas': sorted(tabelas),
            'ativadas': alteradas, 'versao': watermark}
