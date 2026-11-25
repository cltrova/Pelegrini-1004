-- Aplique no banco próprio de Visitas, após schema.sql. Compatível com SQL Server 2012.
IF OBJECT_ID(N'dbo.VisitasUsuarios', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.VisitasUsuarios (
        id varchar(36) NOT NULL CONSTRAINT PK_VisitasUsuarios PRIMARY KEY,
        email nvarchar(254) NOT NULL CONSTRAINT UQ_VisitasUsuarios_Email UNIQUE,
        nome nvarchar(200) NOT NULL,
        perfil varchar(12) NOT NULL CONSTRAINT CK_VisitasUsuarios_Perfil CHECK (perfil IN ('visitador','gerencial')),
        cod_empresa_bi varchar(5) NOT NULL CONSTRAINT CK_VisitasUsuarios_Empresa CHECK (cod_empresa_bi IN ('1004','10041')),
        senha_hash varchar(100) NOT NULL,
        ativo bit NOT NULL DEFAULT 1,
        falhas int NOT NULL DEFAULT 0,
        bloqueado_ate datetime2(0) NULL
    );
END;

IF COL_LENGTH(N'dbo.VisitasUsuarios', N'troca_senha_pendente') IS NULL
BEGIN
    ALTER TABLE dbo.VisitasUsuarios ADD troca_senha_pendente bit NOT NULL
        CONSTRAINT DF_VisitasUsuarios_TrocaSenha DEFAULT (0);
END;

IF OBJECT_ID(N'dbo.VisitasFiliais', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.VisitasFiliais (
        usuario_id varchar(36) NOT NULL REFERENCES dbo.VisitasUsuarios(id),
        filial_id varchar(20) NOT NULL CONSTRAINT CK_VisitasFiliais_Filial CHECK (filial_id IN ('chevrolet','transmissao')),
        CONSTRAINT PK_VisitasFiliais PRIMARY KEY (usuario_id, filial_id)
    );
END;

IF OBJECT_ID(N'dbo.VisitasSessoes', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.VisitasSessoes (
        token_hash char(64) NOT NULL CONSTRAINT PK_VisitasSessoes PRIMARY KEY,
        usuario_id varchar(36) NOT NULL REFERENCES dbo.VisitasUsuarios(id),
        expira_em datetime2(0) NOT NULL
    );
    CREATE INDEX IX_VisitasSessoes_Expiracao ON dbo.VisitasSessoes(expira_em);
END;

IF OBJECT_ID(N'dbo.VisitasGerenciaPortal', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.VisitasGerenciaPortal (
        usuario_id varchar(36) NOT NULL CONSTRAINT PK_VisitasGerenciaPortal PRIMARY KEY,
        cod_empresa_bi varchar(5) NOT NULL,
        chevrolet bit NOT NULL,
        transmissao bit NOT NULL,
        versao_comercial varchar(64) NOT NULL,
        aprovado_por varchar(36) NOT NULL,
        aprovado_em datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_VisitasGerenciaPortal_Filiais CHECK (
            (cod_empresa_bi = '1004' AND (chevrolet = 1 OR transmissao = 1))
            OR (cod_empresa_bi = '10041' AND chevrolet = 1 AND transmissao = 0)
        )
    );
END;
