-- Organizer-submitted events require admin approval before going public.

ALTER TABLE `events`
  ADD COLUMN `submitted_for_approval_at` datetime DEFAULT NULL AFTER `status`,
  MODIFY COLUMN `status` enum(
    'draft',
    'pending_approval',
    'published',
    'cancelled',
    'completed'
  ) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft';
