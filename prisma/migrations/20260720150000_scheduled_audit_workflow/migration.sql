-- Add explicit schedule windows for instrument verification and desk review.
ALTER TABLE `AuditUnitPlan`
    ADD COLUMN `instrumentVerificationStart` DATETIME(3) NULL AFTER `instrumentReviewEnd`,
    ADD COLUMN `instrumentVerificationEnd` DATETIME(3) NULL AFTER `instrumentVerificationStart`,
    ADD COLUMN `selfAssessmentReviewStart` DATETIME(3) NULL AFTER `selfAssessmentEnd`,
    ADD COLUMN `selfAssessmentReviewEnd` DATETIME(3) NULL AFTER `selfAssessmentReviewStart`;

-- Preserve existing plans by deriving the new windows from adjacent phases.
UPDATE `AuditUnitPlan`
SET
    `instrumentVerificationStart` = `instrumentReviewEnd`,
    `instrumentVerificationEnd` = `selfAssessmentStart`,
    `selfAssessmentReviewStart` = `selfAssessmentEnd`,
    `selfAssessmentReviewEnd` = `fieldAuditStart`
WHERE
    `instrumentVerificationStart` IS NULL
    AND `instrumentVerificationEnd` IS NULL
    AND `selfAssessmentReviewStart` IS NULL
    AND `selfAssessmentReviewEnd` IS NULL;
