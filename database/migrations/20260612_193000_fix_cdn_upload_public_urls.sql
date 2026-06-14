-- Fix CDN upload URLs that omitted /data/api (images returned SPA HTML instead of files).
-- Pattern: https://disruptinglabs.com/data/{folder}/{id}/main_image|images|...

UPDATE `events`
SET `hero_image_url` = REPLACE(
  `hero_image_url`,
  'https://disruptinglabs.com/data/',
  'https://disruptinglabs.com/data/api/data/'
)
WHERE `hero_image_url` LIKE 'https://disruptinglabs.com/data/%'
  AND `hero_image_url` NOT LIKE 'https://disruptinglabs.com/data/api/%'
  AND `hero_image_url` REGEXP '/(main_image|images|files|pdfs)/';

UPDATE `events`
SET `banner_image_url` = REPLACE(
  `banner_image_url`,
  'https://disruptinglabs.com/data/',
  'https://disruptinglabs.com/data/api/data/'
)
WHERE `banner_image_url` LIKE 'https://disruptinglabs.com/data/%'
  AND `banner_image_url` NOT LIKE 'https://disruptinglabs.com/data/api/%'
  AND `banner_image_url` REGEXP '/(main_image|images|files|pdfs)/';

UPDATE `blog_posts`
SET `cover_image_url` = REPLACE(
  `cover_image_url`,
  'https://disruptinglabs.com/data/',
  'https://disruptinglabs.com/data/api/data/'
)
WHERE `cover_image_url` LIKE 'https://disruptinglabs.com/data/%'
  AND `cover_image_url` NOT LIKE 'https://disruptinglabs.com/data/api/%'
  AND `cover_image_url` REGEXP '/(main_image|images|files|pdfs)/';
