-- ==========================================================
-- 010_prevent_duplicates.sql: Prevent Duplicate Movies & Theaters
-- ==========================================================

-- 1. Ensure unique movie titles (case-insensitive & trimmed)
CREATE UNIQUE INDEX IF NOT EXISTS uq_movies_lower_title ON movies (LOWER(TRIM(title)));

-- 2. Ensure unique theater per city (case-insensitive & trimmed)
CREATE UNIQUE INDEX IF NOT EXISTS uq_theaters_name_city ON theaters (LOWER(TRIM(name)), LOWER(TRIM(city)));
