-- Normalize staff email addresses for consistent OTP lookup (case + whitespace)
UPDATE `admins`
SET `email` = LOWER(TRIM(`email`))
WHERE `email` <> LOWER(TRIM(`email`));

UPDATE `organizer_members`
SET `email` = LOWER(TRIM(`email`))
WHERE `email` IS NOT NULL AND `email` <> LOWER(TRIM(`email`));
