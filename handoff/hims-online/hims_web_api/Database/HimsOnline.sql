/* HIMS_ONLINE catalog, based on MLMCV11_ONLINE.
   Creates objects only in HIMS_ONLINE; HIMS_WEB is read-only.
   PDFs are stored privately by the API, not inside this table. */
USE [master];
GO
IF DB_ID(N'HIMS_WEB') IS NULL
    THROW 51000, 'HIMS_WEB must exist on this server before HIMS_ONLINE is created.', 1;
IF DB_ID(N'HIMS_ONLINE') IS NULL
    EXEC(N'CREATE DATABASE [HIMS_ONLINE] COLLATE SQL_Latin1_General_CP1_CI_AS');
GO
USE [HIMS_ONLINE];
GO
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
IF OBJECT_ID(N'dbo.RESULTS', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.RESULTS
    (
        ID int IDENTITY(1,1) NOT NULL CONSTRAINT PK_RESULTS PRIMARY KEY CLUSTERED,
        CODE nvarchar(50) NOT NULL,
        PATIENTNO nvarchar(50) NOT NULL,
        PATIENTNAME nvarchar(250) NOT NULL,
        EXAMINATION nvarchar(250) NOT NULL,
        FILENAME nvarchar(50) NOT NULL,
        RESULTDATE smalldatetime NOT NULL CONSTRAINT DF_RESULTS_RESULTDATE DEFAULT (GETDATE())
    );
    CREATE INDEX CODE ON dbo.RESULTS(CODE);
    CREATE INDEX PATIENTNO ON dbo.RESULTS(PATIENTNO);
    CREATE INDEX PATIENTNAME ON dbo.RESULTS(PATIENTNAME);
    CREATE INDEX EXAMINATION ON dbo.RESULTS(EXAMINATION);
    CREATE INDEX FILENAME ON dbo.RESULTS(FILENAME);
END;
GO
CREATE OR ALTER VIEW dbo.vw_Doctors
AS
    SELECT CONVERT(nvarchar(50), Id) AS CODE,
           Lastname AS LastName,
           Firstname AS FirstName,
           Middlename AS MiddleName,
           Suffix
    FROM HIMS_WEB.dbo.Doctors
    WHERE DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(DeletedBy)), N'') IS NULL;
GO
CREATE OR ALTER VIEW dbo.vw_Patients
AS
    SELECT PatientNo AS PATIENTNO,
           Lastname AS LASTNAME,
           Firstname AS FIRSTNAME,
           Middlename AS MIDDLENAME,
           /* HIMS_WEB has no patient TIN field. Do not substitute another identifier. */
           CAST(NULL AS nvarchar(50)) AS TINNO
    FROM HIMS_WEB.dbo.PatientInformation
    WHERE DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(DeletedBy)), N'') IS NULL;
GO
