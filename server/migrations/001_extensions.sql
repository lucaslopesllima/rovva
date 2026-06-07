-- 001 extensions
-- PostGIS for geography, pg_trgm for fuzzy CNAE/company name search.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- unaccent: accent-insensitive municipio search ("florianopolis" -> "Florianópolis").
CREATE EXTENSION IF NOT EXISTS unaccent;
