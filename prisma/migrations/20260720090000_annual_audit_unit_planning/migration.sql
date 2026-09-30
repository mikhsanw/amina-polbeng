-- Annual audit program matrix per unit: instruments, team assignments, and phase schedules.

CREATE TABLE `AuditUnitPlan` (
    `id` VARCHAR(191) NOT NULL,
    `programId` VARCHAR(191) NOT NULL,
    `unitId` VARCHAR(191) NOT NULL,
    `included` BOOLEAN NOT NULL DEFAULT true,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `instrumentReviewStart` DATETIME(3) NULL,
    `instrumentReviewEnd` DATETIME(3) NULL,
    `selfAssessmentStart` DATETIME(3) NULL,
    `selfAssessmentEnd` DATETIME(3) NULL,
    `fieldAuditStart` DATETIME(3) NULL,
    `fieldAuditEnd` DATETIME(3) NULL,
    `reportingStart` DATETIME(3) NULL,
    `reportingEnd` DATETIME(3) NULL,
    `followUpStart` DATETIME(3) NULL,
    `followUpEnd` DATETIME(3) NULL,
    `workspaceId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AuditUnitPlan_workspaceId_key`(`workspaceId`),
    UNIQUE INDEX `AuditUnitPlan_programId_unitId_key`(`programId`, `unitId`),
    INDEX `AuditUnitPlan_programId_status_idx`(`programId`, `status`),
    INDEX `AuditUnitPlan_unitId_included_idx`(`unitId`, `included`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AuditUnitPlanAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AuditUnitPlanAssignment_planId_userId_role_key`(`planId`, `userId`, `role`),
    INDEX `AuditUnitPlanAssignment_planId_role_idx`(`planId`, `role`),
    INDEX `AuditUnitPlanAssignment_userId_role_idx`(`userId`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AuditUnitPlanQuestion` (
    `planId` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,

    INDEX `AuditUnitPlanQuestion_questionId_idx`(`questionId`),
    PRIMARY KEY (`planId`, `questionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AuditUnitPlan`
    ADD CONSTRAINT `AuditUnitPlan_programId_fkey`
        FOREIGN KEY (`programId`) REFERENCES `AuditProgram`(`id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `AuditUnitPlan_unitId_fkey`
        FOREIGN KEY (`unitId`) REFERENCES `Unit`(`id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `AuditUnitPlan_workspaceId_fkey`
        FOREIGN KEY (`workspaceId`) REFERENCES `AuditWorkspace`(`id`)
        ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `AuditUnitPlanAssignment`
    ADD CONSTRAINT `AuditUnitPlanAssignment_planId_fkey`
        FOREIGN KEY (`planId`) REFERENCES `AuditUnitPlan`(`id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `AuditUnitPlanAssignment_userId_fkey`
        FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
        ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `AuditUnitPlanQuestion`
    ADD CONSTRAINT `AuditUnitPlanQuestion_planId_fkey`
        FOREIGN KEY (`planId`) REFERENCES `AuditUnitPlan`(`id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `AuditUnitPlanQuestion_questionId_fkey`
        FOREIGN KEY (`questionId`) REFERENCES `MasterQuestion`(`id`)
        ON DELETE RESTRICT ON UPDATE CASCADE;
