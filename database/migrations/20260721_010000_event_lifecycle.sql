-- Event lifecycle: auto-unlist after event day; soft-delete already uses deleted_at
ALTER TABLE `events`
  ADD COLUMN `auto_deactivate_after_event` tinyint(1) NOT NULL DEFAULT 1
    COMMENT '1 = after event day ends, set visibility=unlisted (hide from marketplace)'
    AFTER `bib_mode`;
