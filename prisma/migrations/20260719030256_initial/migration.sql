-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'LOCKED') NOT NULL DEFAULT 'ACTIVE',
    `mustChangePassword` BOOLEAN NOT NULL DEFAULT true,
    `failedLoginAttempts` INTEGER NOT NULL DEFAULT 0,
    `lockedUntil` DATETIME(3) NULL,
    `unitId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `User_username_key`(`username`),
    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_unitId_status_idx`(`unitId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Role` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Role_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Permission` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Permission_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserRole` (
    `userId` VARCHAR(191) NOT NULL,
    `roleId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`userId`, `roleId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RolePermission` (
    `roleId` VARCHAR(191) NOT NULL,
    `permissionId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`roleId`, `permissionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `revokedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Session_tokenHash_key`(`tokenHash`),
    INDEX `Session_userId_expiresAt_idx`(`userId`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Unit` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Unit_code_key`(`code`),
    UNIQUE INDEX `Unit_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UnitFunction` (
    `id` VARCHAR(191) NOT NULL,
    `unitId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `UnitFunction_unitId_code_key`(`unitId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Standard` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `Standard_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IsoClause` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `IsoClause_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MasterQuestion` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `moduleCode` VARCHAR(191) NOT NULL,
    `question` VARCHAR(191) NOT NULL,
    `expectedEvidence` VARCHAR(191) NULL,
    `riskLevel` VARCHAR(191) NOT NULL,
    `weight` DECIMAL(8, 2) NOT NULL,
    `required` BOOLEAN NOT NULL DEFAULT true,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `version` INTEGER NOT NULL DEFAULT 1,
    `standardId` VARCHAR(191) NULL,
    `isoClauseId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MasterQuestion_code_key`(`code`),
    INDEX `MasterQuestion_moduleCode_active_idx`(`moduleCode`, `active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuestionUnitMap` (
    `questionId` VARCHAR(191) NOT NULL,
    `unitId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`questionId`, `unitId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditProgram` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `auditYear` INTEGER NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AuditProgram_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditWorkspace` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `unitId` VARCHAR(191) NOT NULL,
    `auditYear` INTEGER NOT NULL,
    `programId` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'INSTRUMENT_REVIEW', 'INSTRUMENT_APPROVAL', 'PUBLISHED', 'SELF_ASSESSMENT', 'AUDIT', 'FIELDWORK', 'REPORTING', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    `instrumentStatus` ENUM('DRAFT', 'PENDING_P4MP', 'APPROVED', 'RETURNED', 'REJECTED', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT',
    `instrumentVersion` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AuditWorkspace_name_key`(`name`),
    INDEX `AuditWorkspace_unitId_auditYear_idx`(`unitId`, `auditYear`),
    INDEX `AuditWorkspace_status_idx`(`status`),
    UNIQUE INDEX `AuditWorkspace_unitId_auditYear_key`(`unitId`, `auditYear`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditTeam` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `AuditTeam_workspaceId_userId_role_key`(`workspaceId`, `userId`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditQuestion` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `masterQuestionId` VARCHAR(191) NOT NULL,
    `questionSnapshot` VARCHAR(191) NOT NULL,
    `moduleCode` VARCHAR(191) NOT NULL,
    `required` BOOLEAN NOT NULL,
    `weight` DECIMAL(8, 2) NOT NULL,
    `sortOrder` INTEGER NOT NULL,
    `reviewStatus` ENUM('DRAFT', 'PENDING_P4MP', 'APPROVED', 'RETURNED', 'REJECTED', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT',

    INDEX `AuditQuestion_workspaceId_reviewStatus_idx`(`workspaceId`, `reviewStatus`),
    UNIQUE INDEX `AuditQuestion_workspaceId_masterQuestionId_key`(`workspaceId`, `masterQuestionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SelfAssessment` (
    `id` VARCHAR(191) NOT NULL,
    `auditQuestionId` VARCHAR(191) NOT NULL,
    `response` VARCHAR(191) NULL,
    `responseStatus` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `score` DECIMAL(8, 2) NULL,
    `submittedAt` DATETIME(3) NULL,
    `approvedAt` DATETIME(3) NULL,
    `returnNote` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SelfAssessment_auditQuestionId_key`(`auditQuestionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Evidence` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `auditQuestionId` VARCHAR(191) NULL,
    `evidenceType` ENUM('POLICY', 'SOP', 'RECORD', 'REPORT', 'LOG', 'PHOTO', 'MINUTES', 'CONTRACT', 'CERTIFICATE', 'LINK', 'OTHER') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `fileSizeBytes` INTEGER NOT NULL,
    `storageKey` VARCHAR(191) NOT NULL,
    `checksum` VARCHAR(191) NOT NULL,
    `confidentiality` VARCHAR(191) NOT NULL DEFAULT 'INTERNAL',
    `reviewStatus` ENUM('PENDING', 'VALID', 'INVALID', 'CLARIFICATION') NOT NULL DEFAULT 'PENDING',
    `uploadedById` VARCHAR(191) NOT NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `validatedAt` DATETIME(3) NULL,
    `validationNote` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Evidence_code_key`(`code`),
    INDEX `Evidence_workspaceId_auditQuestionId_idx`(`workspaceId`, `auditQuestionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Workpaper` (
    `id` VARCHAR(191) NOT NULL,
    `auditQuestionId` VARCHAR(191) NOT NULL,
    `auditorUserId` VARCHAR(191) NOT NULL,
    `sampleDescription` VARCHAR(191) NULL,
    `interviewee` VARCHAR(191) NULL,
    `objectiveEvidence` VARCHAR(191) NULL,
    `auditorAnalysis` VARCHAR(191) NULL,
    `auditStatus` ENUM('C', 'OFI', 'OBS', 'NC_MINOR', 'NC_MAJOR', 'NA') NOT NULL DEFAULT 'C',
    `maturityScore` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Workpaper_auditQuestionId_auditorUserId_key`(`auditQuestionId`, `auditorUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Finding` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `auditQuestionId` VARCHAR(191) NULL,
    `findingType` ENUM('OFI', 'OBS', 'NC_MINOR', 'NC_MAJOR') NOT NULL,
    `criteriaRegulation` VARCHAR(191) NOT NULL,
    `criteriaIso` VARCHAR(191) NOT NULL,
    `condition` VARCHAR(191) NOT NULL,
    `objectiveEvidence` VARCHAR(191) NOT NULL,
    `gapStatement` VARCHAR(191) NOT NULL,
    `riskImpact` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'REVIEW', 'OPEN', 'CAPA_REVIEW', 'IMPLEMENTATION', 'VERIFICATION', 'CLOSED', 'VOID') NOT NULL DEFAULT 'DRAFT',
    `ownerUserId` VARCHAR(191) NULL,
    `dueDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Finding_code_key`(`code`),
    INDEX `Finding_workspaceId_status_idx`(`workspaceId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CorrectiveAction` (
    `id` VARCHAR(191) NOT NULL,
    `findingId` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `correction` VARCHAR(191) NOT NULL,
    `analysisMethod` VARCHAR(191) NOT NULL,
    `rootCauseStatement` VARCHAR(191) NOT NULL,
    `correctiveAction` VARCHAR(191) NOT NULL,
    `successIndicator` VARCHAR(191) NOT NULL,
    `picUserId` VARCHAR(191) NULL,
    `targetDate` DATETIME(3) NOT NULL,
    `progressPercent` INTEGER NOT NULL DEFAULT 0,
    `progressNote` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'APPROVED', 'IN_PROGRESS', 'READY_VERIFY', 'EFFECTIVE', 'NOT_EFFECTIVE') NOT NULL DEFAULT 'DRAFT',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CorrectiveAction_workspaceId_status_idx`(`workspaceId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Verification` (
    `id` VARCHAR(191) NOT NULL,
    `actionId` VARCHAR(191) NOT NULL,
    `verifierUserId` VARCHAR(191) NOT NULL,
    `verificationDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `implementationResult` VARCHAR(191) NOT NULL,
    `effectivenessResult` VARCHAR(191) NOT NULL,
    `status` ENUM('EFFECTIVE', 'EFFECTIVE_WITH_MONITORING', 'NOT_EFFECTIVE') NOT NULL,
    `nextReviewDate` DATETIME(3) NULL,
    `closedAt` DATETIME(3) NULL,

    INDEX `Verification_actionId_status_idx`(`actionId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NULL,
    `recipientUserId` VARCHAR(191) NOT NULL,
    `event` ENUM('AUDIT_WORKSPACE_CREATED', 'INSTRUMENT_REVIEW_REQUESTED', 'INSTRUMENT_CHANGED', 'INSTRUMENT_APPROVAL_REQUESTED', 'INSTRUMENT_APPROVED', 'INSTRUMENT_RETURNED', 'INSTRUMENT_PUBLISHED', 'SELF_ASSESSMENT_OPENED', 'SELF_ASSESSMENT_SUBMITTED', 'SELF_ASSESSMENT_APPROVED', 'SELF_ASSESSMENT_RETURNED', 'FINDING_OPENED', 'CORRECTIVE_ACTION_SUBMITTED', 'VERIFICATION_REQUESTED', 'FINDING_CLOSED', 'ACTION_RETURNED', 'REPORT_APPROVED', 'AUDIT_CLOSED') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_recipientUserId_readAt_idx`(`recipientUserId`, `readAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ActivityLog` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `username` VARCHAR(191) NULL,
    `role` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `workspaceId` VARCHAR(191) NULL,
    `oldValue` JSON NULL,
    `newValue` JSON NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `result` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ActivityLog_workspaceId_createdAt_idx`(`workspaceId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PrintDocument` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `storageKey` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PrintDocument_workspaceId_type_version_key`(`workspaceId`, `type`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SystemConfig` (
    `key` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RolePermission` ADD CONSTRAINT `RolePermission_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RolePermission` ADD CONSTRAINT `RolePermission_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `Permission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UnitFunction` ADD CONSTRAINT `UnitFunction_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MasterQuestion` ADD CONSTRAINT `MasterQuestion_standardId_fkey` FOREIGN KEY (`standardId`) REFERENCES `Standard`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MasterQuestion` ADD CONSTRAINT `MasterQuestion_isoClauseId_fkey` FOREIGN KEY (`isoClauseId`) REFERENCES `IsoClause`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionUnitMap` ADD CONSTRAINT `QuestionUnitMap_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `MasterQuestion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionUnitMap` ADD CONSTRAINT `QuestionUnitMap_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditWorkspace` ADD CONSTRAINT `AuditWorkspace_unitId_fkey` FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditWorkspace` ADD CONSTRAINT `AuditWorkspace_programId_fkey` FOREIGN KEY (`programId`) REFERENCES `AuditProgram`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditTeam` ADD CONSTRAINT `AuditTeam_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `AuditWorkspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditTeam` ADD CONSTRAINT `AuditTeam_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditQuestion` ADD CONSTRAINT `AuditQuestion_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `AuditWorkspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditQuestion` ADD CONSTRAINT `AuditQuestion_masterQuestionId_fkey` FOREIGN KEY (`masterQuestionId`) REFERENCES `MasterQuestion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SelfAssessment` ADD CONSTRAINT `SelfAssessment_auditQuestionId_fkey` FOREIGN KEY (`auditQuestionId`) REFERENCES `AuditQuestion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Evidence` ADD CONSTRAINT `Evidence_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `AuditWorkspace`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Evidence` ADD CONSTRAINT `Evidence_auditQuestionId_fkey` FOREIGN KEY (`auditQuestionId`) REFERENCES `AuditQuestion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Evidence` ADD CONSTRAINT `Evidence_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Workpaper` ADD CONSTRAINT `Workpaper_auditQuestionId_fkey` FOREIGN KEY (`auditQuestionId`) REFERENCES `AuditQuestion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Workpaper` ADD CONSTRAINT `Workpaper_auditorUserId_fkey` FOREIGN KEY (`auditorUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Finding` ADD CONSTRAINT `Finding_auditQuestionId_fkey` FOREIGN KEY (`auditQuestionId`) REFERENCES `AuditQuestion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Finding` ADD CONSTRAINT `Finding_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `AuditWorkspace`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CorrectiveAction` ADD CONSTRAINT `CorrectiveAction_findingId_fkey` FOREIGN KEY (`findingId`) REFERENCES `Finding`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CorrectiveAction` ADD CONSTRAINT `CorrectiveAction_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `AuditWorkspace`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Verification` ADD CONSTRAINT `Verification_actionId_fkey` FOREIGN KEY (`actionId`) REFERENCES `CorrectiveAction`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_recipientUserId_fkey` FOREIGN KEY (`recipientUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `AuditWorkspace`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActivityLog` ADD CONSTRAINT `ActivityLog_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `AuditWorkspace`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PrintDocument` ADD CONSTRAINT `PrintDocument_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `AuditWorkspace`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
