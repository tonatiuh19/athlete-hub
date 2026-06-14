-- Store admin rejection reason when an event is returned to draft.
ALTER TABLE `events`
  ADD COLUMN `approval_rejection_reason` VARCHAR(500) NULL
  AFTER `submitted_for_approval_at`;
