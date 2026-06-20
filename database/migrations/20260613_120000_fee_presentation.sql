-- Organizer default + per-event override for fee presentation (pass_through | absorb_all)
ALTER TABLE organizers
  ADD COLUMN fee_presentation ENUM('pass_through', 'absorb_all') NOT NULL DEFAULT 'pass_through'
  COMMENT 'pass_through: athlete pays fee on top; absorb_all: list price is final sticker';

ALTER TABLE events
  ADD COLUMN fee_presentation ENUM('pass_through', 'absorb_all') DEFAULT NULL
  COMMENT 'NULL = inherit organizer.fee_presentation';
