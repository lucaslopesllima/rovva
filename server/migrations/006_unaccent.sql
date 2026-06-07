-- 006 unaccent
-- Accent-insensitive municipio search ("florianopolis" -> "Florianópolis").
-- Separate migration so existing databases (where 001 already ran) pick it up.
CREATE EXTENSION IF NOT EXISTS unaccent;
