ALTER TABLE `Finding`
  MODIFY `criteriaRegulation` TEXT NOT NULL,
  MODIFY `criteriaIso` TEXT NOT NULL,
  MODIFY `condition` TEXT NOT NULL,
  MODIFY `objectiveEvidence` TEXT NOT NULL,
  MODIFY `gapStatement` TEXT NOT NULL,
  MODIFY `riskImpact` TEXT NOT NULL;

ALTER TABLE `CorrectiveAction`
  MODIFY `rootCauseStatement` TEXT NOT NULL,
  MODIFY `correctiveAction` TEXT NOT NULL,
  MODIFY `progressNote` TEXT NULL;

ALTER TABLE `Workpaper`
  MODIFY `sampleDescription` TEXT NULL,
  MODIFY `objectiveEvidence` TEXT NULL,
  MODIFY `auditorAnalysis` TEXT NULL,
  MODIFY `reviewNote` TEXT NULL;

ALTER TABLE `Verification`
  MODIFY `implementationResult` TEXT NOT NULL,
  MODIFY `effectivenessResult` TEXT NOT NULL;

ALTER TABLE `AuditQuestion`
  MODIFY `auditorExpectedEvidence` TEXT NULL,
  MODIFY `changeReason` TEXT NULL,
  MODIFY `auditorNote` TEXT NULL,
  MODIFY `verifierNote` TEXT NULL,
  MODIFY `exclusionReason` TEXT NULL;

ALTER TABLE `Evidence`
  MODIFY `description` TEXT NULL,
  MODIFY `validationNote` TEXT NULL;

ALTER TABLE `InstrumentChangeReview`
  MODIFY `note` TEXT NULL;

ALTER TABLE `Notification`
  MODIFY `message` TEXT NOT NULL;
