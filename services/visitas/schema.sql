-- Execute no banco interno de visitas selecionado pelo administrador.
IF OBJECT_ID(N'dbo.RelatoriosVisitas', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.RelatoriosVisitas (
        id bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_RelatoriosVisitas PRIMARY KEY,
        cod_empresa_bi varchar(5) NOT NULL,
        filial_id varchar(20) NOT NULL,
        visitador_id varchar(36) NOT NULL,
        visitador_nome nvarchar(200) NOT NULL,
        nome_cliente nvarchar(200) NOT NULL,
        data_visita date NOT NULL,
        cnpj nvarchar(24) NOT NULL,
        cidade nvarchar(200) NOT NULL,
        segmento nvarchar(200) NOT NULL,
        diesel nvarchar(200) NOT NULL,
        responsaveis_compras nvarchar(200) NOT NULL,
        funcao nvarchar(200) NOT NULL,
        avaliacoes nvarchar(max) NOT NULL CONSTRAINT CK_RelatoriosVisitas_Avaliacoes CHECK (ISJSON(avaliacoes) = 1),
        CONSTRAINT CK_RelatoriosVisitas_Filial CHECK (
            (cod_empresa_bi = '1004' AND filial_id IN ('transmissao', 'chevrolet'))
            OR (cod_empresa_bi = '10041' AND filial_id = 'chevrolet')
        )
    );
    CREATE INDEX IX_RelatoriosVisitas_Autor ON dbo.RelatoriosVisitas (visitador_id, data_visita DESC, id DESC);
    CREATE INDEX IX_RelatoriosVisitas_Filial ON dbo.RelatoriosVisitas (filial_id, data_visita DESC, id DESC);
END;
