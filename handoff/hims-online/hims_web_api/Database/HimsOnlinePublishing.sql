/* Online-only publication bookkeeping. HIMS_WEB remains read-only. */
USE [HIMS_ONLINE];
GO
IF OBJECT_ID(N'dbo.ResultPublications',N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ResultPublications (
        SourceTable varchar(32) NOT NULL,
        ExaminationId int NOT NULL,
        ResultId int NOT NULL,
        Revision varbinary(32) NOT NULL,
        PublishedAtUtc datetime2(3) NOT NULL CONSTRAINT DF_ResultPublications_Published DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_ResultPublications PRIMARY KEY (SourceTable,ExaminationId),
        CONSTRAINT UQ_ResultPublications_Result UNIQUE (ResultId),
        CONSTRAINT FK_ResultPublications_Result FOREIGN KEY(ResultId) REFERENCES dbo.RESULTS(ID),
        CONSTRAINT CK_ResultPublications_Source CHECK(SourceTable IN ('Laboratory','Radiology','EchocardiographicStudy')),
        CONSTRAINT CK_ResultPublications_Revision CHECK(DATALENGTH(Revision)=32)
    );
END;
GO
CREATE OR ALTER VIEW dbo.vw_ResultCandidates
AS
WITH SavedResults AS (
    SELECT 'Laboratory' AS SourceTable,m.Id AS ExaminationId,m.CaseId,m.ExaminationNo,m.DatePerform,
           CONVERT(nvarchar(50),ISNULL(m.ReqPhysicianId,0)) AS DoctorCode,
           HASHBYTES('SHA2_256',CONCAT((SELECT m.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),(SELECT lr.* FROM HIMS_WEB.dbo.LaboratoryResult lr WHERE lr.LabResultMainId=m.Id AND lr.DeletedDate IS NULL ORDER BY lr.Id FOR JSON PATH))) AS ContentRevision
    FROM HIMS_WEB.dbo.Laboratory m
    WHERE m.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(m.DeletedBy)),N'') IS NULL
    UNION ALL
    SELECT 'Radiology' AS SourceTable,m.Id AS ExaminationId,m.CaseId,m.ExaminationNo,m.DatePerform,
           CONVERT(nvarchar(50),ISNULL(m.ReqPhysicianId,0)) AS DoctorCode,
           HASHBYTES('SHA2_256',CONCAT((SELECT m.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),N'')) AS ContentRevision
    FROM HIMS_WEB.dbo.Radiology m
    WHERE m.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(m.DeletedBy)),N'') IS NULL
    UNION ALL
    SELECT 'EchocardiographicStudy' AS SourceTable,m.Id AS ExaminationId,m.CaseId,m.ExaminationNo,m.DatePerform,
           CONVERT(nvarchar(50),ISNULL(m.ReqPhysicianId,0)) AS DoctorCode,
           HASHBYTES('SHA2_256',CONCAT((SELECT m.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),CONCAT((SELECT z.* FROM HIMS_WEB.dbo.EchocardiographicDetails z WHERE z.ResultMainId=m.Id AND z.DeletedDate IS NULL ORDER BY z.Id FOR JSON PATH),(SELECT z.* FROM HIMS_WEB.dbo.EchocardiographicDoppler z WHERE z.ResultMainId=m.Id AND z.DeletedDate IS NULL ORDER BY z.Id FOR JSON PATH),(SELECT z.* FROM HIMS_WEB.dbo.EchocardiographicPxResponse z WHERE z.ResultMainId=m.Id AND z.DeletedDate IS NULL ORDER BY z.Id FOR JSON PATH)))) AS ContentRevision
    FROM HIMS_WEB.dbo.EchocardiographicStudy m
    WHERE m.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(m.DeletedBy)),N'') IS NULL
), LinkedExams AS (
    SELECT d.ExaminationTableName AS SourceTable,d.ExaminationId,
           MIN(cm.CaseId) AS MinCaseId,MAX(cm.CaseId) AS MaxCaseId,
           MAX(d.ValidatedDate) AS ValidatedDate,
           COUNT_BIG(*) AS ExaminationCount,
           STRING_AGG(CONVERT(nvarchar(max),i.Description),N'; ') WITHIN GROUP(ORDER BY d.Id) AS Description,
           HASHBYTES('SHA2_256',STRING_AGG(CONVERT(nvarchar(max),CONCAT(d.Id,N':',d.ItemId,N':',CONVERT(nvarchar(30),d.ValidatedDate,126),N':',i.Description)),N'|') WITHIN GROUP(ORDER BY d.Id)) AS ValidationRevision,
           MIN(CASE WHEN ISNULL(d.Cancelled,0)=0 AND ISNULL(d.Qty,0)>ISNULL(d.RetQty,0) THEN 1 ELSE 0 END) AS AllActive,
           MIN(CASE WHEN d.ValidatedDate>'19000101' AND NULLIF(LTRIM(RTRIM(d.ValidatedBy)),N'') IS NOT NULL THEN 1 ELSE 0 END) AS AllValidated
    FROM HIMS_WEB.dbo.ChargesDetails d
    JOIN HIMS_WEB.dbo.ChargesMain cm ON cm.Id=d.ChargesMainId
    JOIN HIMS_WEB.dbo.Items i ON i.Id=d.ItemId
    WHERE d.ExaminationId>0 AND d.ExaminationTableName IN ('Laboratory','Radiology','EchocardiographicStudy')
    GROUP BY d.ExaminationTableName,d.ExaminationId
)
SELECT s.SourceTable,s.ExaminationId,c.PatientId,p.PatientNo,p.Name AS PatientName,
       s.DoctorCode,doctor.Name AS Doctor,s.ExaminationNo,s.DatePerform AS ExaminationDate,
       CASE WHEN s.SourceTable='Laboratory' THEN 'LAB'
            WHEN s.SourceTable='EchocardiographicStudy' THEN 'HST' ELSE LEFT(s.ExaminationNo,3) END AS DepartmentCode,
       e.Description,e.ValidatedDate,e.ExaminationCount,
       HASHBYTES('SHA2_256',CONCAT(CONVERT(varchar(64),s.ContentRevision,2),CONVERT(varchar(64),e.ValidationRevision,2),
           (SELECT p.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),(SELECT c.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER))) AS Revision
FROM SavedResults s
JOIN LinkedExams e ON e.SourceTable=s.SourceTable AND e.ExaminationId=s.ExaminationId AND e.AllValidated=1 AND e.AllActive=1
    AND e.MinCaseId=s.CaseId AND e.MaxCaseId=s.CaseId
JOIN HIMS_WEB.dbo.Cases c ON c.CaseId=s.CaseId
JOIN HIMS_WEB.dbo.PatientInformation p ON p.Id=c.PatientId
LEFT JOIN HIMS_WEB.dbo.Doctors doctor ON doctor.Id=TRY_CONVERT(int,s.DoctorCode) AND doctor.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(doctor.DeletedBy)),N'') IS NULL
WHERE c.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(c.DeletedBy)),N'') IS NULL
  AND p.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(p.DeletedBy)),N'') IS NULL;
GO
