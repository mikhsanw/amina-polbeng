-- Align the original CRUD prototype with the agreed AMI Nonakademik domain.
-- Existing values are retained for backward compatibility while new workflow values are added.

ALTER TABLE `User`
  ADD COLUMN `isUnitApprover` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `UnitFunction`
  ADD COLUMN `sourceRef` VARCHAR(191) NULL,
  ADD COLUMN `riskLevel` VARCHAR(191) NULL;

ALTER TABLE `Standard`
  ADD COLUMN `standardType` VARCHAR(191) NOT NULL DEFAULT 'INTERNAL',
  ADD COLUMN `regulationReference` VARCHAR(191) NULL;

ALTER TABLE `MasterQuestion`
  ADD COLUMN `dimension` ENUM('STANDARD_ACHIEVEMENT','PROCESS_CONFORMITY') NOT NULL DEFAULT 'PROCESS_CONFORMITY',
  ADD COLUMN `criterionSource` VARCHAR(191) NOT NULL DEFAULT 'ISO_9001',
  ADD COLUMN `auditObjective` TEXT NULL,
  ADD COLUMN `testMethod` TEXT NULL,
  ADD COLUMN `regulatoryReference` TEXT NULL,
  ADD COLUMN `regulatorySummary` TEXT NULL,
  ADD COLUMN `internalRequirement` TEXT NULL,
  ADD COLUMN `businessProcess` VARCHAR(191) NULL;

CREATE INDEX `MasterQuestion_dimension_active_idx`
  ON `MasterQuestion`(`dimension`, `active`);

ALTER TABLE `AuditWorkspace`
  MODIFY `status` ENUM(
    'DRAFT','FILE_PREPARATION','INSTRUMENT_REVIEW','INSTRUMENT_APPROVAL',
    'PUBLISHED','SELF_ASSESSMENT','DESK_REVIEW','AUDIT','FIELDWORK',
    'FIELD_AUDIT','REPORTING','REPORT_REVIEW','FOLLOW_UP','CLOSED',
    'ARCHIVED','CANCELLED'
  ) NOT NULL DEFAULT 'DRAFT',
  MODIFY `instrumentStatus` ENUM(
    'GENERATED','DRAFT','AUDITOR_REVIEW','PENDING_P4MP',
    'PENDING_VERIFICATION','APPROVED','RETURNED','REJECTED',
    'PUBLISHED','SUPERSEDED'
  ) NOT NULL DEFAULT 'GENERATED',
  ADD COLUMN `instrumentChangeCount` INTEGER NOT NULL DEFAULT 0;

ALTER TABLE `AuditQuestion`
  MODIFY `reviewStatus` ENUM(
    'GENERATED','DRAFT','AUDITOR_REVIEW','PENDING_P4MP',
    'PENDING_VERIFICATION','APPROVED','RETURNED','REJECTED',
    'PUBLISHED','SUPERSEDED'
  ) NOT NULL DEFAULT 'AUDITOR_REVIEW',
  ADD COLUMN `dimension` ENUM('STANDARD_ACHIEVEMENT','PROCESS_CONFORMITY') NOT NULL DEFAULT 'PROCESS_CONFORMITY',
  ADD COLUMN `defaultQuestion` TEXT NULL,
  ADD COLUMN `auditorQuestion` TEXT NULL,
  ADD COLUMN `publishedQuestion` TEXT NULL,
  ADD COLUMN `defaultExpectedEvidence` TEXT NULL,
  ADD COLUMN `auditorExpectedEvidence` TEXT NULL,
  ADD COLUMN `publishedExpectedEvidence` TEXT NULL,
  ADD COLUMN `defaultTestMethod` TEXT NULL,
  ADD COLUMN `auditorTestMethod` TEXT NULL,
  ADD COLUMN `publishedTestMethod` TEXT NULL,
  ADD COLUMN `defaultRiskLevel` VARCHAR(191) NULL,
  ADD COLUMN `auditorRiskLevel` VARCHAR(191) NULL,
  ADD COLUMN `publishedRiskLevel` VARCHAR(191) NULL,
  ADD COLUMN `defaultWeight` DECIMAL(8,2) NULL,
  ADD COLUMN `auditorWeight` DECIMAL(8,2) NULL,
  ADD COLUMN `publishedWeight` DECIMAL(8,2) NULL,
  ADD COLUMN `changeFlag` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `changeFields` JSON NULL,
  ADD COLUMN `changeReason` TEXT NULL,
  ADD COLUMN `auditorNote` TEXT NULL,
  ADD COLUMN `verifierNote` TEXT NULL,
  ADD COLUMN `excluded` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `exclusionReason` TEXT NULL,
  ADD COLUMN `reviewedById` VARCHAR(191) NULL,
  ADD COLUMN `reviewedAt` DATETIME(3) NULL,
  ADD COLUMN `approvedById` VARCHAR(191) NULL,
  ADD COLUMN `approvedAt` DATETIME(3) NULL;

UPDATE `AuditQuestion` q
JOIN `MasterQuestion` m ON m.`id` = q.`masterQuestionId`
SET q.`dimension` = m.`dimension`,
    q.`defaultQuestion` = q.`questionSnapshot`,
    q.`defaultExpectedEvidence` = m.`expectedEvidence`,
    q.`defaultTestMethod` = m.`testMethod`,
    q.`defaultRiskLevel` = m.`riskLevel`,
    q.`defaultWeight` = q.`weight`;

ALTER TABLE `AuditQuestion`
  MODIFY `defaultQuestion` TEXT NOT NULL,
  MODIFY `defaultRiskLevel` VARCHAR(191) NOT NULL,
  MODIFY `defaultWeight` DECIMAL(8,2) NOT NULL;

CREATE INDEX `AuditQuestion_workspaceId_changeFlag_idx`
  ON `AuditQuestion`(`workspaceId`, `changeFlag`);

ALTER TABLE `SelfAssessment`
  ADD COLUMN `implementationDescription` TEXT NULL,
  ADD COLUMN `evidenceSummary` TEXT NULL,
  ADD COLUMN `constraintNote` TEXT NULL,
  ADD COLUMN `standardResult` ENUM('MELAMPAUI','TERCAPAI','TIDAK_TERCAPAI','BELUM_DIUKUR') NULL,
  ADD COLUMN `processResult` ENUM('C','OFI','OBS','KTS_MINOR','KTS_MAYOR','GP','NA') NULL,
  ADD COLUMN `submittedById` VARCHAR(191) NULL,
  ADD COLUMN `approvedById` VARCHAR(191) NULL;

UPDATE `SelfAssessment`
SET `implementationDescription` = `response`
WHERE `implementationDescription` IS NULL;

ALTER TABLE `Workpaper`
  MODIFY `auditStatus` ENUM(
    'C','OFI','OBS','KTS_MINOR','KTS_MAYOR','GP','NC_MINOR','NC_MAJOR','NA'
  ) NOT NULL DEFAULT 'C',
  ADD COLUMN `documentStatus` ENUM('DRAFT','SUBMITTED','RETURNED','APPROVED','LOCKED') NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN `standardResult` ENUM('MELAMPAUI','TERCAPAI','TIDAK_TERCAPAI','BELUM_DIUKUR') NULL,
  ADD COLUMN `processResult` ENUM('C','OFI','OBS','KTS_MINOR','KTS_MAYOR','GP','NA') NULL,
  ADD COLUMN `reviewNote` TEXT NULL,
  ADD COLUMN `submittedAt` DATETIME(3) NULL,
  ADD COLUMN `reviewedById` VARCHAR(191) NULL,
  ADD COLUMN `reviewedAt` DATETIME(3) NULL,
  ADD COLUMN `lockedAt` DATETIME(3) NULL;

UPDATE `Workpaper`
SET `processResult` = CASE
  WHEN `auditStatus` = 'NC_MINOR' THEN 'KTS_MINOR'
  WHEN `auditStatus` = 'NC_MAJOR' THEN 'KTS_MAYOR'
  WHEN `auditStatus` IN ('C','OFI','OBS','KTS_MINOR','KTS_MAYOR','GP','NA') THEN `auditStatus`
  ELSE NULL
END;

CREATE INDEX `Workpaper_documentStatus_idx`
  ON `Workpaper`(`documentStatus`);

ALTER TABLE `Finding`
  MODIFY `findingType` ENUM(
    'OFI','OBS','KTS_MINOR','KTS_MAYOR','NC_MINOR','NC_MAJOR'
  ) NOT NULL;

UPDATE `Finding`
SET `findingType` = CASE
  WHEN `findingType` = 'NC_MINOR' THEN 'KTS_MINOR'
  WHEN `findingType` = 'NC_MAJOR' THEN 'KTS_MAYOR'
  ELSE `findingType`
END;

ALTER TABLE `CorrectiveAction`
  MODIFY `status` ENUM(
    'DRAFT','SUBMITTED','RETURNED','APPROVED','IN_PROGRESS',
    'READY_VERIFY','EFFECTIVE','NOT_EFFECTIVE'
  ) NOT NULL DEFAULT 'DRAFT';

ALTER TABLE `Verification`
  ADD COLUMN `auditorUserId` VARCHAR(191) NULL,
  ADD COLUMN `leadAuditorUserId` VARCHAR(191) NULL,
  ADD COLUMN `decidedAt` DATETIME(3) NULL;

ALTER TABLE `Notification`
  MODIFY `event` ENUM(
    'AUDIT_WORKSPACE_CREATED','INSTRUMENT_REVIEW_REQUESTED','INSTRUMENT_CHANGED',
    'INSTRUMENT_APPROVAL_REQUESTED','INSTRUMENT_APPROVED','INSTRUMENT_RETURNED',
    'INSTRUMENT_PUBLISHED','SELF_ASSESSMENT_OPENED','SELF_ASSESSMENT_SUBMITTED',
    'SELF_ASSESSMENT_APPROVED','SELF_ASSESSMENT_RETURNED','WORKPAPER_SUBMITTED',
    'WORKPAPER_RETURNED','WORKPAPER_APPROVED','FINDING_OPENED',
    'CORRECTIVE_ACTION_SUBMITTED','VERIFICATION_REQUESTED','FINDING_CLOSED',
    'ACTION_RETURNED','REPORT_APPROVED','AUDIT_CLOSED'
  ) NOT NULL;

CREATE TABLE `QuestionFunctionMap` (
  `questionId` VARCHAR(191) NOT NULL,
  `functionId` VARCHAR(191) NOT NULL,
  PRIMARY KEY (`questionId`, `functionId`),
  CONSTRAINT `QuestionFunctionMap_questionId_fkey`
    FOREIGN KEY (`questionId`) REFERENCES `MasterQuestion`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `QuestionFunctionMap_functionId_fkey`
    FOREIGN KEY (`functionId`) REFERENCES `UnitFunction`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `InstrumentChangeReview` (
  `id` VARCHAR(191) NOT NULL,
  `workspaceId` VARCHAR(191) NOT NULL,
  `auditQuestionId` VARCHAR(191) NOT NULL,
  `verifierUserId` VARCHAR(191) NOT NULL,
  `decision` ENUM('APPROVE','RETURN','REJECT') NOT NULL,
  `note` TEXT NULL,
  `beforeValue` JSON NOT NULL,
  `proposedValue` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `InstrumentChangeReview_workspaceId_decision_idx`(`workspaceId`, `decision`),
  INDEX `InstrumentChangeReview_auditQuestionId_createdAt_idx`(`auditQuestionId`, `createdAt`),
  CONSTRAINT `InstrumentChangeReview_workspaceId_fkey`
    FOREIGN KEY (`workspaceId`) REFERENCES `AuditWorkspace`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `InstrumentChangeReview_auditQuestionId_fkey`
    FOREIGN KEY (`auditQuestionId`) REFERENCES `AuditQuestion`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
