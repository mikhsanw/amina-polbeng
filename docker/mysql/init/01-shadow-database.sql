CREATE DATABASE IF NOT EXISTS `sami_nonak_shadow`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

GRANT ALL PRIVILEGES ON `sami_nonak_shadow`.* TO 'sami_app'@'%';
FLUSH PRIVILEGES;
