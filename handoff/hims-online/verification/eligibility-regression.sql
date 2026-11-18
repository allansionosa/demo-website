SET NOCOUNT ON;
DECLARE @Laboratory TABLE(Id int,CaseId int,ExaminationNo nvarchar(50),DatePerform datetime,ReqPhysicianId int,DeletedDate datetime,DeletedBy nvarchar(50),Content nvarchar(100));
DECLARE @Radiology TABLE(Id int,CaseId int,ExaminationNo nvarchar(50),DatePerform datetime,ReqPhysicianId int,DeletedDate datetime,DeletedBy nvarchar(50),Content nvarchar(100));
DECLARE @EchocardiographicStudy TABLE(Id int,CaseId int,ExaminationNo nvarchar(50),DatePerform datetime,ReqPhysicianId int,DeletedDate datetime,DeletedBy nvarchar(50),Content nvarchar(100));
DECLARE @LaboratoryResult TABLE(Id int,LabResultMainId int,DeletedDate datetime,Result nvarchar(50));
DECLARE @EchocardiographicDetails TABLE(Id int,ResultMainId int,DeletedDate datetime);
DECLARE @EchocardiographicDoppler TABLE(Id int,ResultMainId int,DeletedDate datetime);
DECLARE @EchocardiographicPxResponse TABLE(Id int,ResultMainId int,DeletedDate datetime);
DECLARE @Cases TABLE(CaseId int,PatientId int,DeletedDate datetime,DeletedBy nvarchar(50));
DECLARE @PatientInformation TABLE(Id int,PatientNo nvarchar(50),Name nvarchar(100),DeletedDate datetime,DeletedBy nvarchar(50));
DECLARE @Doctors TABLE(Id int,Name nvarchar(100),DeletedDate datetime,DeletedBy nvarchar(50));
DECLARE @Items TABLE(Id int,Description nvarchar(100));
DECLARE @ChargesMain TABLE(Id int,CaseId int);
DECLARE @ChargesDetails TABLE(Id int,ItemId int,ChargesMainId int,ExaminationTableName nvarchar(50),ExaminationId int,ValidatedDate datetime,ValidatedBy nvarchar(50),Cancelled bit,Qty decimal(10,2),RetQty decimal(10,2));
DECLARE @Rows TABLE(SourceTable varchar(32),ExaminationId int,PatientId int,PatientNo nvarchar(50),PatientName nvarchar(250),DoctorCode nvarchar(50),Doctor nvarchar(255),ExaminationNo nvarchar(50),ExaminationDate datetime,DepartmentCode varchar(3),Description nvarchar(max),ValidatedDate datetime,ExaminationCount bigint,Revision varbinary(32));
INSERT @Cases VALUES(1,7,NULL,NULL);
INSERT @PatientInformation VALUES(7,N'SYN-7',N'Synthetic patient',NULL,NULL);
INSERT @Doctors VALUES(1,N'Synthetic doctor',NULL,NULL);
INSERT @Items VALUES(1,N'Synthetic exam A'),(2,N'Synthetic exam B');
INSERT @ChargesMain VALUES(1,1);
INSERT @Laboratory VALUES(1,1,N'LAB-SYN','20261113',1,NULL,NULL,N'Synthetic result');
INSERT @LaboratoryResult VALUES(1,1,NULL,N'1');
INSERT @ChargesDetails VALUES(10,1,1,N'Laboratory',1,'20261113',N'Synthetic',0,1,0),(11,2,1,N'Laboratory',1,NULL,NULL,0,1,0);


DELETE @Rows;
WITH SavedResults AS (
    SELECT 'Laboratory' AS SourceTable,m.Id AS ExaminationId,m.CaseId,m.ExaminationNo,m.DatePerform,
           CONVERT(nvarchar(50),ISNULL(m.ReqPhysicianId,0)) AS DoctorCode,
           HASHBYTES('SHA2_256',CONCAT((SELECT m.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),(SELECT lr.* FROM @LaboratoryResult lr WHERE lr.LabResultMainId=m.Id AND lr.DeletedDate IS NULL ORDER BY lr.Id FOR JSON PATH))) AS ContentRevision
    FROM @Laboratory m
    WHERE m.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(m.DeletedBy)),N'') IS NULL
    UNION ALL
    SELECT 'Radiology' AS SourceTable,m.Id AS ExaminationId,m.CaseId,m.ExaminationNo,m.DatePerform,
           CONVERT(nvarchar(50),ISNULL(m.ReqPhysicianId,0)) AS DoctorCode,
           HASHBYTES('SHA2_256',CONCAT((SELECT m.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),N'')) AS ContentRevision
    FROM @Radiology m
    WHERE m.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(m.DeletedBy)),N'') IS NULL
    UNION ALL
    SELECT 'EchocardiographicStudy' AS SourceTable,m.Id AS ExaminationId,m.CaseId,m.ExaminationNo,m.DatePerform,
           CONVERT(nvarchar(50),ISNULL(m.ReqPhysicianId,0)) AS DoctorCode,
           HASHBYTES('SHA2_256',CONCAT((SELECT m.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),CONCAT((SELECT z.* FROM @EchocardiographicDetails z WHERE z.ResultMainId=m.Id AND z.DeletedDate IS NULL ORDER BY z.Id FOR JSON PATH),(SELECT z.* FROM @EchocardiographicDoppler z WHERE z.ResultMainId=m.Id AND z.DeletedDate IS NULL ORDER BY z.Id FOR JSON PATH),(SELECT z.* FROM @EchocardiographicPxResponse z WHERE z.ResultMainId=m.Id AND z.DeletedDate IS NULL ORDER BY z.Id FOR JSON PATH)))) AS ContentRevision
    FROM @EchocardiographicStudy m
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
    FROM @ChargesDetails d
    JOIN @ChargesMain cm ON cm.Id=d.ChargesMainId
    JOIN @Items i ON i.Id=d.ItemId
    WHERE d.ExaminationId>0 AND d.ExaminationTableName IN ('Laboratory','Radiology','EchocardiographicStudy')
    GROUP BY d.ExaminationTableName,d.ExaminationId
)
INSERT INTO @Rows
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
JOIN @Cases c ON c.CaseId=s.CaseId
JOIN @PatientInformation p ON p.Id=c.PatientId
LEFT JOIN @Doctors doctor ON doctor.Id=TRY_CONVERT(int,s.DoctorCode) AND doctor.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(doctor.DeletedBy)),N'') IS NULL
WHERE c.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(c.DeletedBy)),N'') IS NULL
  AND p.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(p.DeletedBy)),N'') IS NULL;
IF NOT ((SELECT COUNT(*) FROM @Rows)=0) THROW 51000,'Shared PDF waits for all linked examinations',1;
PRINT 'PASS Shared PDF waits for all linked examinations';

UPDATE @ChargesDetails SET ValidatedDate='20261113',ValidatedBy=N'Synthetic' WHERE Id=11;
DELETE @Rows;
WITH SavedResults AS (
    SELECT 'Laboratory' AS SourceTable,m.Id AS ExaminationId,m.CaseId,m.ExaminationNo,m.DatePerform,
           CONVERT(nvarchar(50),ISNULL(m.ReqPhysicianId,0)) AS DoctorCode,
           HASHBYTES('SHA2_256',CONCAT((SELECT m.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),(SELECT lr.* FROM @LaboratoryResult lr WHERE lr.LabResultMainId=m.Id AND lr.DeletedDate IS NULL ORDER BY lr.Id FOR JSON PATH))) AS ContentRevision
    FROM @Laboratory m
    WHERE m.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(m.DeletedBy)),N'') IS NULL
    UNION ALL
    SELECT 'Radiology' AS SourceTable,m.Id AS ExaminationId,m.CaseId,m.ExaminationNo,m.DatePerform,
           CONVERT(nvarchar(50),ISNULL(m.ReqPhysicianId,0)) AS DoctorCode,
           HASHBYTES('SHA2_256',CONCAT((SELECT m.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),N'')) AS ContentRevision
    FROM @Radiology m
    WHERE m.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(m.DeletedBy)),N'') IS NULL
    UNION ALL
    SELECT 'EchocardiographicStudy' AS SourceTable,m.Id AS ExaminationId,m.CaseId,m.ExaminationNo,m.DatePerform,
           CONVERT(nvarchar(50),ISNULL(m.ReqPhysicianId,0)) AS DoctorCode,
           HASHBYTES('SHA2_256',CONCAT((SELECT m.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),CONCAT((SELECT z.* FROM @EchocardiographicDetails z WHERE z.ResultMainId=m.Id AND z.DeletedDate IS NULL ORDER BY z.Id FOR JSON PATH),(SELECT z.* FROM @EchocardiographicDoppler z WHERE z.ResultMainId=m.Id AND z.DeletedDate IS NULL ORDER BY z.Id FOR JSON PATH),(SELECT z.* FROM @EchocardiographicPxResponse z WHERE z.ResultMainId=m.Id AND z.DeletedDate IS NULL ORDER BY z.Id FOR JSON PATH)))) AS ContentRevision
    FROM @EchocardiographicStudy m
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
    FROM @ChargesDetails d
    JOIN @ChargesMain cm ON cm.Id=d.ChargesMainId
    JOIN @Items i ON i.Id=d.ItemId
    WHERE d.ExaminationId>0 AND d.ExaminationTableName IN ('Laboratory','Radiology','EchocardiographicStudy')
    GROUP BY d.ExaminationTableName,d.ExaminationId
)
INSERT INTO @Rows
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
JOIN @Cases c ON c.CaseId=s.CaseId
JOIN @PatientInformation p ON p.Id=c.PatientId
LEFT JOIN @Doctors doctor ON doctor.Id=TRY_CONVERT(int,s.DoctorCode) AND doctor.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(doctor.DeletedBy)),N'') IS NULL
WHERE c.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(c.DeletedBy)),N'') IS NULL
  AND p.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(p.DeletedBy)),N'') IS NULL;
IF NOT ((SELECT COUNT(*) FROM @Rows)=1 AND (SELECT ExaminationCount FROM @Rows)=2) THROW 51000,'Fully validated shared result is eligible',1;
PRINT 'PASS Fully validated shared result is eligible';
DECLARE @previous varbinary(32)=(SELECT Revision FROM @Rows);

UPDATE @LaboratoryResult SET Result=N'2';
DELETE @Rows;
WITH SavedResults AS (
    SELECT 'Laboratory' AS SourceTable,m.Id AS ExaminationId,m.CaseId,m.ExaminationNo,m.DatePerform,
           CONVERT(nvarchar(50),ISNULL(m.ReqPhysicianId,0)) AS DoctorCode,
           HASHBYTES('SHA2_256',CONCAT((SELECT m.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),(SELECT lr.* FROM @LaboratoryResult lr WHERE lr.LabResultMainId=m.Id AND lr.DeletedDate IS NULL ORDER BY lr.Id FOR JSON PATH))) AS ContentRevision
    FROM @Laboratory m
    WHERE m.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(m.DeletedBy)),N'') IS NULL
    UNION ALL
    SELECT 'Radiology' AS SourceTable,m.Id AS ExaminationId,m.CaseId,m.ExaminationNo,m.DatePerform,
           CONVERT(nvarchar(50),ISNULL(m.ReqPhysicianId,0)) AS DoctorCode,
           HASHBYTES('SHA2_256',CONCAT((SELECT m.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),N'')) AS ContentRevision
    FROM @Radiology m
    WHERE m.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(m.DeletedBy)),N'') IS NULL
    UNION ALL
    SELECT 'EchocardiographicStudy' AS SourceTable,m.Id AS ExaminationId,m.CaseId,m.ExaminationNo,m.DatePerform,
           CONVERT(nvarchar(50),ISNULL(m.ReqPhysicianId,0)) AS DoctorCode,
           HASHBYTES('SHA2_256',CONCAT((SELECT m.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),CONCAT((SELECT z.* FROM @EchocardiographicDetails z WHERE z.ResultMainId=m.Id AND z.DeletedDate IS NULL ORDER BY z.Id FOR JSON PATH),(SELECT z.* FROM @EchocardiographicDoppler z WHERE z.ResultMainId=m.Id AND z.DeletedDate IS NULL ORDER BY z.Id FOR JSON PATH),(SELECT z.* FROM @EchocardiographicPxResponse z WHERE z.ResultMainId=m.Id AND z.DeletedDate IS NULL ORDER BY z.Id FOR JSON PATH)))) AS ContentRevision
    FROM @EchocardiographicStudy m
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
    FROM @ChargesDetails d
    JOIN @ChargesMain cm ON cm.Id=d.ChargesMainId
    JOIN @Items i ON i.Id=d.ItemId
    WHERE d.ExaminationId>0 AND d.ExaminationTableName IN ('Laboratory','Radiology','EchocardiographicStudy')
    GROUP BY d.ExaminationTableName,d.ExaminationId
)
INSERT INTO @Rows
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
JOIN @Cases c ON c.CaseId=s.CaseId
JOIN @PatientInformation p ON p.Id=c.PatientId
LEFT JOIN @Doctors doctor ON doctor.Id=TRY_CONVERT(int,s.DoctorCode) AND doctor.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(doctor.DeletedBy)),N'') IS NULL
WHERE c.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(c.DeletedBy)),N'') IS NULL
  AND p.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(p.DeletedBy)),N'') IS NULL;
IF NOT ((SELECT Revision FROM @Rows)<>@previous) THROW 51000,'Content edits invalidate the published revision',1;
PRINT 'PASS Content edits invalidate the published revision';

UPDATE @ChargesDetails SET ValidatedDate=NULL WHERE Id=10;
DELETE @Rows;
WITH SavedResults AS (
    SELECT 'Laboratory' AS SourceTable,m.Id AS ExaminationId,m.CaseId,m.ExaminationNo,m.DatePerform,
           CONVERT(nvarchar(50),ISNULL(m.ReqPhysicianId,0)) AS DoctorCode,
           HASHBYTES('SHA2_256',CONCAT((SELECT m.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),(SELECT lr.* FROM @LaboratoryResult lr WHERE lr.LabResultMainId=m.Id AND lr.DeletedDate IS NULL ORDER BY lr.Id FOR JSON PATH))) AS ContentRevision
    FROM @Laboratory m
    WHERE m.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(m.DeletedBy)),N'') IS NULL
    UNION ALL
    SELECT 'Radiology' AS SourceTable,m.Id AS ExaminationId,m.CaseId,m.ExaminationNo,m.DatePerform,
           CONVERT(nvarchar(50),ISNULL(m.ReqPhysicianId,0)) AS DoctorCode,
           HASHBYTES('SHA2_256',CONCAT((SELECT m.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),N'')) AS ContentRevision
    FROM @Radiology m
    WHERE m.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(m.DeletedBy)),N'') IS NULL
    UNION ALL
    SELECT 'EchocardiographicStudy' AS SourceTable,m.Id AS ExaminationId,m.CaseId,m.ExaminationNo,m.DatePerform,
           CONVERT(nvarchar(50),ISNULL(m.ReqPhysicianId,0)) AS DoctorCode,
           HASHBYTES('SHA2_256',CONCAT((SELECT m.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),CONCAT((SELECT z.* FROM @EchocardiographicDetails z WHERE z.ResultMainId=m.Id AND z.DeletedDate IS NULL ORDER BY z.Id FOR JSON PATH),(SELECT z.* FROM @EchocardiographicDoppler z WHERE z.ResultMainId=m.Id AND z.DeletedDate IS NULL ORDER BY z.Id FOR JSON PATH),(SELECT z.* FROM @EchocardiographicPxResponse z WHERE z.ResultMainId=m.Id AND z.DeletedDate IS NULL ORDER BY z.Id FOR JSON PATH)))) AS ContentRevision
    FROM @EchocardiographicStudy m
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
    FROM @ChargesDetails d
    JOIN @ChargesMain cm ON cm.Id=d.ChargesMainId
    JOIN @Items i ON i.Id=d.ItemId
    WHERE d.ExaminationId>0 AND d.ExaminationTableName IN ('Laboratory','Radiology','EchocardiographicStudy')
    GROUP BY d.ExaminationTableName,d.ExaminationId
)
INSERT INTO @Rows
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
JOIN @Cases c ON c.CaseId=s.CaseId
JOIN @PatientInformation p ON p.Id=c.PatientId
LEFT JOIN @Doctors doctor ON doctor.Id=TRY_CONVERT(int,s.DoctorCode) AND doctor.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(doctor.DeletedBy)),N'') IS NULL
WHERE c.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(c.DeletedBy)),N'') IS NULL
  AND p.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(p.DeletedBy)),N'') IS NULL;
IF NOT ((SELECT COUNT(*) FROM @Rows)=0) THROW 51000,'Unvalidation withdraws a shared report',1;
PRINT 'PASS Unvalidation withdraws a shared report';

UPDATE @ChargesDetails SET ValidatedDate='20261113',Cancelled=1 WHERE Id=10;
DELETE @Rows;
WITH SavedResults AS (
    SELECT 'Laboratory' AS SourceTable,m.Id AS ExaminationId,m.CaseId,m.ExaminationNo,m.DatePerform,
           CONVERT(nvarchar(50),ISNULL(m.ReqPhysicianId,0)) AS DoctorCode,
           HASHBYTES('SHA2_256',CONCAT((SELECT m.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),(SELECT lr.* FROM @LaboratoryResult lr WHERE lr.LabResultMainId=m.Id AND lr.DeletedDate IS NULL ORDER BY lr.Id FOR JSON PATH))) AS ContentRevision
    FROM @Laboratory m
    WHERE m.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(m.DeletedBy)),N'') IS NULL
    UNION ALL
    SELECT 'Radiology' AS SourceTable,m.Id AS ExaminationId,m.CaseId,m.ExaminationNo,m.DatePerform,
           CONVERT(nvarchar(50),ISNULL(m.ReqPhysicianId,0)) AS DoctorCode,
           HASHBYTES('SHA2_256',CONCAT((SELECT m.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),N'')) AS ContentRevision
    FROM @Radiology m
    WHERE m.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(m.DeletedBy)),N'') IS NULL
    UNION ALL
    SELECT 'EchocardiographicStudy' AS SourceTable,m.Id AS ExaminationId,m.CaseId,m.ExaminationNo,m.DatePerform,
           CONVERT(nvarchar(50),ISNULL(m.ReqPhysicianId,0)) AS DoctorCode,
           HASHBYTES('SHA2_256',CONCAT((SELECT m.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),CONCAT((SELECT z.* FROM @EchocardiographicDetails z WHERE z.ResultMainId=m.Id AND z.DeletedDate IS NULL ORDER BY z.Id FOR JSON PATH),(SELECT z.* FROM @EchocardiographicDoppler z WHERE z.ResultMainId=m.Id AND z.DeletedDate IS NULL ORDER BY z.Id FOR JSON PATH),(SELECT z.* FROM @EchocardiographicPxResponse z WHERE z.ResultMainId=m.Id AND z.DeletedDate IS NULL ORDER BY z.Id FOR JSON PATH)))) AS ContentRevision
    FROM @EchocardiographicStudy m
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
    FROM @ChargesDetails d
    JOIN @ChargesMain cm ON cm.Id=d.ChargesMainId
    JOIN @Items i ON i.Id=d.ItemId
    WHERE d.ExaminationId>0 AND d.ExaminationTableName IN ('Laboratory','Radiology','EchocardiographicStudy')
    GROUP BY d.ExaminationTableName,d.ExaminationId
)
INSERT INTO @Rows
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
JOIN @Cases c ON c.CaseId=s.CaseId
JOIN @PatientInformation p ON p.Id=c.PatientId
LEFT JOIN @Doctors doctor ON doctor.Id=TRY_CONVERT(int,s.DoctorCode) AND doctor.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(doctor.DeletedBy)),N'') IS NULL
WHERE c.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(c.DeletedBy)),N'') IS NULL
  AND p.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(p.DeletedBy)),N'') IS NULL;
IF NOT ((SELECT COUNT(*) FROM @Rows)=0) THROW 51000,'Cancelled linked exam cannot leak through a shared PDF',1;
PRINT 'PASS Cancelled linked exam cannot leak through a shared PDF';

UPDATE @ChargesDetails SET Cancelled=0,RetQty=Qty WHERE Id=10;
DELETE @Rows;
WITH SavedResults AS (
    SELECT 'Laboratory' AS SourceTable,m.Id AS ExaminationId,m.CaseId,m.ExaminationNo,m.DatePerform,
           CONVERT(nvarchar(50),ISNULL(m.ReqPhysicianId,0)) AS DoctorCode,
           HASHBYTES('SHA2_256',CONCAT((SELECT m.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),(SELECT lr.* FROM @LaboratoryResult lr WHERE lr.LabResultMainId=m.Id AND lr.DeletedDate IS NULL ORDER BY lr.Id FOR JSON PATH))) AS ContentRevision
    FROM @Laboratory m
    WHERE m.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(m.DeletedBy)),N'') IS NULL
    UNION ALL
    SELECT 'Radiology' AS SourceTable,m.Id AS ExaminationId,m.CaseId,m.ExaminationNo,m.DatePerform,
           CONVERT(nvarchar(50),ISNULL(m.ReqPhysicianId,0)) AS DoctorCode,
           HASHBYTES('SHA2_256',CONCAT((SELECT m.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),N'')) AS ContentRevision
    FROM @Radiology m
    WHERE m.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(m.DeletedBy)),N'') IS NULL
    UNION ALL
    SELECT 'EchocardiographicStudy' AS SourceTable,m.Id AS ExaminationId,m.CaseId,m.ExaminationNo,m.DatePerform,
           CONVERT(nvarchar(50),ISNULL(m.ReqPhysicianId,0)) AS DoctorCode,
           HASHBYTES('SHA2_256',CONCAT((SELECT m.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),CONCAT((SELECT z.* FROM @EchocardiographicDetails z WHERE z.ResultMainId=m.Id AND z.DeletedDate IS NULL ORDER BY z.Id FOR JSON PATH),(SELECT z.* FROM @EchocardiographicDoppler z WHERE z.ResultMainId=m.Id AND z.DeletedDate IS NULL ORDER BY z.Id FOR JSON PATH),(SELECT z.* FROM @EchocardiographicPxResponse z WHERE z.ResultMainId=m.Id AND z.DeletedDate IS NULL ORDER BY z.Id FOR JSON PATH)))) AS ContentRevision
    FROM @EchocardiographicStudy m
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
    FROM @ChargesDetails d
    JOIN @ChargesMain cm ON cm.Id=d.ChargesMainId
    JOIN @Items i ON i.Id=d.ItemId
    WHERE d.ExaminationId>0 AND d.ExaminationTableName IN ('Laboratory','Radiology','EchocardiographicStudy')
    GROUP BY d.ExaminationTableName,d.ExaminationId
)
INSERT INTO @Rows
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
JOIN @Cases c ON c.CaseId=s.CaseId
JOIN @PatientInformation p ON p.Id=c.PatientId
LEFT JOIN @Doctors doctor ON doctor.Id=TRY_CONVERT(int,s.DoctorCode) AND doctor.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(doctor.DeletedBy)),N'') IS NULL
WHERE c.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(c.DeletedBy)),N'') IS NULL
  AND p.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(p.DeletedBy)),N'') IS NULL;
IF NOT ((SELECT COUNT(*) FROM @Rows)=0) THROW 51000,'Returned linked exam cannot leak through a shared PDF',1;
PRINT 'PASS Returned linked exam cannot leak through a shared PDF';

UPDATE @ChargesDetails SET RetQty=0;UPDATE @Laboratory SET DeletedDate='20261113';
DELETE @Rows;
WITH SavedResults AS (
    SELECT 'Laboratory' AS SourceTable,m.Id AS ExaminationId,m.CaseId,m.ExaminationNo,m.DatePerform,
           CONVERT(nvarchar(50),ISNULL(m.ReqPhysicianId,0)) AS DoctorCode,
           HASHBYTES('SHA2_256',CONCAT((SELECT m.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),(SELECT lr.* FROM @LaboratoryResult lr WHERE lr.LabResultMainId=m.Id AND lr.DeletedDate IS NULL ORDER BY lr.Id FOR JSON PATH))) AS ContentRevision
    FROM @Laboratory m
    WHERE m.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(m.DeletedBy)),N'') IS NULL
    UNION ALL
    SELECT 'Radiology' AS SourceTable,m.Id AS ExaminationId,m.CaseId,m.ExaminationNo,m.DatePerform,
           CONVERT(nvarchar(50),ISNULL(m.ReqPhysicianId,0)) AS DoctorCode,
           HASHBYTES('SHA2_256',CONCAT((SELECT m.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),N'')) AS ContentRevision
    FROM @Radiology m
    WHERE m.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(m.DeletedBy)),N'') IS NULL
    UNION ALL
    SELECT 'EchocardiographicStudy' AS SourceTable,m.Id AS ExaminationId,m.CaseId,m.ExaminationNo,m.DatePerform,
           CONVERT(nvarchar(50),ISNULL(m.ReqPhysicianId,0)) AS DoctorCode,
           HASHBYTES('SHA2_256',CONCAT((SELECT m.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),CONCAT((SELECT z.* FROM @EchocardiographicDetails z WHERE z.ResultMainId=m.Id AND z.DeletedDate IS NULL ORDER BY z.Id FOR JSON PATH),(SELECT z.* FROM @EchocardiographicDoppler z WHERE z.ResultMainId=m.Id AND z.DeletedDate IS NULL ORDER BY z.Id FOR JSON PATH),(SELECT z.* FROM @EchocardiographicPxResponse z WHERE z.ResultMainId=m.Id AND z.DeletedDate IS NULL ORDER BY z.Id FOR JSON PATH)))) AS ContentRevision
    FROM @EchocardiographicStudy m
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
    FROM @ChargesDetails d
    JOIN @ChargesMain cm ON cm.Id=d.ChargesMainId
    JOIN @Items i ON i.Id=d.ItemId
    WHERE d.ExaminationId>0 AND d.ExaminationTableName IN ('Laboratory','Radiology','EchocardiographicStudy')
    GROUP BY d.ExaminationTableName,d.ExaminationId
)
INSERT INTO @Rows
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
JOIN @Cases c ON c.CaseId=s.CaseId
JOIN @PatientInformation p ON p.Id=c.PatientId
LEFT JOIN @Doctors doctor ON doctor.Id=TRY_CONVERT(int,s.DoctorCode) AND doctor.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(doctor.DeletedBy)),N'') IS NULL
WHERE c.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(c.DeletedBy)),N'') IS NULL
  AND p.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(p.DeletedBy)),N'') IS NULL;
IF NOT ((SELECT COUNT(*) FROM @Rows)=0) THROW 51000,'Deleted source result is not eligible',1;
PRINT 'PASS Deleted source result is not eligible';

UPDATE @Laboratory SET DeletedDate=NULL;UPDATE @PatientInformation SET DeletedDate='20261113';
DELETE @Rows;
WITH SavedResults AS (
    SELECT 'Laboratory' AS SourceTable,m.Id AS ExaminationId,m.CaseId,m.ExaminationNo,m.DatePerform,
           CONVERT(nvarchar(50),ISNULL(m.ReqPhysicianId,0)) AS DoctorCode,
           HASHBYTES('SHA2_256',CONCAT((SELECT m.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),(SELECT lr.* FROM @LaboratoryResult lr WHERE lr.LabResultMainId=m.Id AND lr.DeletedDate IS NULL ORDER BY lr.Id FOR JSON PATH))) AS ContentRevision
    FROM @Laboratory m
    WHERE m.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(m.DeletedBy)),N'') IS NULL
    UNION ALL
    SELECT 'Radiology' AS SourceTable,m.Id AS ExaminationId,m.CaseId,m.ExaminationNo,m.DatePerform,
           CONVERT(nvarchar(50),ISNULL(m.ReqPhysicianId,0)) AS DoctorCode,
           HASHBYTES('SHA2_256',CONCAT((SELECT m.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),N'')) AS ContentRevision
    FROM @Radiology m
    WHERE m.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(m.DeletedBy)),N'') IS NULL
    UNION ALL
    SELECT 'EchocardiographicStudy' AS SourceTable,m.Id AS ExaminationId,m.CaseId,m.ExaminationNo,m.DatePerform,
           CONVERT(nvarchar(50),ISNULL(m.ReqPhysicianId,0)) AS DoctorCode,
           HASHBYTES('SHA2_256',CONCAT((SELECT m.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),CONCAT((SELECT z.* FROM @EchocardiographicDetails z WHERE z.ResultMainId=m.Id AND z.DeletedDate IS NULL ORDER BY z.Id FOR JSON PATH),(SELECT z.* FROM @EchocardiographicDoppler z WHERE z.ResultMainId=m.Id AND z.DeletedDate IS NULL ORDER BY z.Id FOR JSON PATH),(SELECT z.* FROM @EchocardiographicPxResponse z WHERE z.ResultMainId=m.Id AND z.DeletedDate IS NULL ORDER BY z.Id FOR JSON PATH)))) AS ContentRevision
    FROM @EchocardiographicStudy m
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
    FROM @ChargesDetails d
    JOIN @ChargesMain cm ON cm.Id=d.ChargesMainId
    JOIN @Items i ON i.Id=d.ItemId
    WHERE d.ExaminationId>0 AND d.ExaminationTableName IN ('Laboratory','Radiology','EchocardiographicStudy')
    GROUP BY d.ExaminationTableName,d.ExaminationId
)
INSERT INTO @Rows
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
JOIN @Cases c ON c.CaseId=s.CaseId
JOIN @PatientInformation p ON p.Id=c.PatientId
LEFT JOIN @Doctors doctor ON doctor.Id=TRY_CONVERT(int,s.DoctorCode) AND doctor.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(doctor.DeletedBy)),N'') IS NULL
WHERE c.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(c.DeletedBy)),N'') IS NULL
  AND p.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(p.DeletedBy)),N'') IS NULL;
IF NOT ((SELECT COUNT(*) FROM @Rows)=0) THROW 51000,'Deleted patient is not eligible',1;
PRINT 'PASS Deleted patient is not eligible';

UPDATE @PatientInformation SET DeletedDate=NULL;UPDATE @ChargesMain SET CaseId=2;
DELETE @Rows;
WITH SavedResults AS (
    SELECT 'Laboratory' AS SourceTable,m.Id AS ExaminationId,m.CaseId,m.ExaminationNo,m.DatePerform,
           CONVERT(nvarchar(50),ISNULL(m.ReqPhysicianId,0)) AS DoctorCode,
           HASHBYTES('SHA2_256',CONCAT((SELECT m.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),(SELECT lr.* FROM @LaboratoryResult lr WHERE lr.LabResultMainId=m.Id AND lr.DeletedDate IS NULL ORDER BY lr.Id FOR JSON PATH))) AS ContentRevision
    FROM @Laboratory m
    WHERE m.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(m.DeletedBy)),N'') IS NULL
    UNION ALL
    SELECT 'Radiology' AS SourceTable,m.Id AS ExaminationId,m.CaseId,m.ExaminationNo,m.DatePerform,
           CONVERT(nvarchar(50),ISNULL(m.ReqPhysicianId,0)) AS DoctorCode,
           HASHBYTES('SHA2_256',CONCAT((SELECT m.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),N'')) AS ContentRevision
    FROM @Radiology m
    WHERE m.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(m.DeletedBy)),N'') IS NULL
    UNION ALL
    SELECT 'EchocardiographicStudy' AS SourceTable,m.Id AS ExaminationId,m.CaseId,m.ExaminationNo,m.DatePerform,
           CONVERT(nvarchar(50),ISNULL(m.ReqPhysicianId,0)) AS DoctorCode,
           HASHBYTES('SHA2_256',CONCAT((SELECT m.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),CONCAT((SELECT z.* FROM @EchocardiographicDetails z WHERE z.ResultMainId=m.Id AND z.DeletedDate IS NULL ORDER BY z.Id FOR JSON PATH),(SELECT z.* FROM @EchocardiographicDoppler z WHERE z.ResultMainId=m.Id AND z.DeletedDate IS NULL ORDER BY z.Id FOR JSON PATH),(SELECT z.* FROM @EchocardiographicPxResponse z WHERE z.ResultMainId=m.Id AND z.DeletedDate IS NULL ORDER BY z.Id FOR JSON PATH)))) AS ContentRevision
    FROM @EchocardiographicStudy m
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
    FROM @ChargesDetails d
    JOIN @ChargesMain cm ON cm.Id=d.ChargesMainId
    JOIN @Items i ON i.Id=d.ItemId
    WHERE d.ExaminationId>0 AND d.ExaminationTableName IN ('Laboratory','Radiology','EchocardiographicStudy')
    GROUP BY d.ExaminationTableName,d.ExaminationId
)
INSERT INTO @Rows
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
JOIN @Cases c ON c.CaseId=s.CaseId
JOIN @PatientInformation p ON p.Id=c.PatientId
LEFT JOIN @Doctors doctor ON doctor.Id=TRY_CONVERT(int,s.DoctorCode) AND doctor.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(doctor.DeletedBy)),N'') IS NULL
WHERE c.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(c.DeletedBy)),N'') IS NULL
  AND p.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(p.DeletedBy)),N'') IS NULL;
IF NOT ((SELECT COUNT(*) FROM @Rows)=0) THROW 51000,'Mismatched source case cannot expose another patient',1;
PRINT 'PASS Mismatched source case cannot expose another patient';

UPDATE @ChargesMain SET CaseId=1;DELETE @ChargesDetails WHERE Id=11;
DELETE @Rows;
WITH SavedResults AS (
    SELECT 'Laboratory' AS SourceTable,m.Id AS ExaminationId,m.CaseId,m.ExaminationNo,m.DatePerform,
           CONVERT(nvarchar(50),ISNULL(m.ReqPhysicianId,0)) AS DoctorCode,
           HASHBYTES('SHA2_256',CONCAT((SELECT m.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),(SELECT lr.* FROM @LaboratoryResult lr WHERE lr.LabResultMainId=m.Id AND lr.DeletedDate IS NULL ORDER BY lr.Id FOR JSON PATH))) AS ContentRevision
    FROM @Laboratory m
    WHERE m.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(m.DeletedBy)),N'') IS NULL
    UNION ALL
    SELECT 'Radiology' AS SourceTable,m.Id AS ExaminationId,m.CaseId,m.ExaminationNo,m.DatePerform,
           CONVERT(nvarchar(50),ISNULL(m.ReqPhysicianId,0)) AS DoctorCode,
           HASHBYTES('SHA2_256',CONCAT((SELECT m.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),N'')) AS ContentRevision
    FROM @Radiology m
    WHERE m.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(m.DeletedBy)),N'') IS NULL
    UNION ALL
    SELECT 'EchocardiographicStudy' AS SourceTable,m.Id AS ExaminationId,m.CaseId,m.ExaminationNo,m.DatePerform,
           CONVERT(nvarchar(50),ISNULL(m.ReqPhysicianId,0)) AS DoctorCode,
           HASHBYTES('SHA2_256',CONCAT((SELECT m.* FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),CONCAT((SELECT z.* FROM @EchocardiographicDetails z WHERE z.ResultMainId=m.Id AND z.DeletedDate IS NULL ORDER BY z.Id FOR JSON PATH),(SELECT z.* FROM @EchocardiographicDoppler z WHERE z.ResultMainId=m.Id AND z.DeletedDate IS NULL ORDER BY z.Id FOR JSON PATH),(SELECT z.* FROM @EchocardiographicPxResponse z WHERE z.ResultMainId=m.Id AND z.DeletedDate IS NULL ORDER BY z.Id FOR JSON PATH)))) AS ContentRevision
    FROM @EchocardiographicStudy m
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
    FROM @ChargesDetails d
    JOIN @ChargesMain cm ON cm.Id=d.ChargesMainId
    JOIN @Items i ON i.Id=d.ItemId
    WHERE d.ExaminationId>0 AND d.ExaminationTableName IN ('Laboratory','Radiology','EchocardiographicStudy')
    GROUP BY d.ExaminationTableName,d.ExaminationId
)
INSERT INTO @Rows
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
JOIN @Cases c ON c.CaseId=s.CaseId
JOIN @PatientInformation p ON p.Id=c.PatientId
LEFT JOIN @Doctors doctor ON doctor.Id=TRY_CONVERT(int,s.DoctorCode) AND doctor.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(doctor.DeletedBy)),N'') IS NULL
WHERE c.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(c.DeletedBy)),N'') IS NULL
  AND p.DeletedDate IS NULL AND NULLIF(LTRIM(RTRIM(p.DeletedBy)),N'') IS NULL;
IF NOT ((SELECT COUNT(*) FROM @Rows)=1 AND (SELECT ExaminationCount FROM @Rows)=1) THROW 51000,'Independently stored validated exam is eligible',1;
PRINT 'PASS Independently stored validated exam is eligible';
