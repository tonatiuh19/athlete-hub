-- Multi-waiver support: PDF upload, content type, sort order
ALTER TABLE `event_waivers`
  ADD COLUMN `pdf_url` varchar(500) DEFAULT NULL COMMENT 'CDN URL for PDF responsiva' AFTER `content_html`;

ALTER TABLE `event_waivers`
  ADD COLUMN `content_type` enum('html','pdf','both') NOT NULL DEFAULT 'html' AFTER `pdf_url`;

ALTER TABLE `event_waivers`
  ADD COLUMN `sort_order` int NOT NULL DEFAULT 0 AFTER `is_active`;
