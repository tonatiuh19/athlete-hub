-- Platform-wide public settings (legal entity, contact page) — admin editable.

CREATE TABLE IF NOT EXISTS `platform_settings` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `setting_value` json NOT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uk_platform_setting_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `platform_settings` (`setting_key`, `setting_value`)
VALUES (
  'site_public_profile',
  JSON_OBJECT(
    'legalEntity', JSON_OBJECT(
      'brandName', 'Triboo Sport',
      'legalName', 'TRIBOO SPORT, S.A.P.I. DE C.V.',
      'rfc', NULL,
      'address', 'Ciudad de México, México',
      'arcoEmail', 'privacidad@triboosport.com',
      'supportEmail', 'soporte@triboosport.com',
      'website', 'https://www.triboosport.com',
      'lastUpdated', '2026-06-13',
      'phone', NULL,
      'whatsapp', NULL
    ),
    'contact', JSON_OBJECT(
      'headline', NULL,
      'subtitle', NULL,
      'supportHint', NULL,
      'organizerHint', NULL,
      'responseTime', NULL,
      'officeHours', NULL,
      'socialInstagram', NULL,
      'socialFacebook', NULL,
      'socialYoutube', NULL
    )
  )
)
ON DUPLICATE KEY UPDATE `setting_value` = VALUES(`setting_value`);
